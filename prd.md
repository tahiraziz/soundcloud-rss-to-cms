# PRD: SoundCloud RSS → Framer CMS Import Plugin

## 1. Summary
A Framer plugin that imports podcast episodes from a SoundCloud RSS feed into a Framer CMS Collection. It's designed for repeat, incremental runs: each run only adds episodes newer than what's already in the CMS, so manually-edited fields on existing items (like Season/Episode) are never touched. (The plugin does maintain one small piece of collection-level state — a counter for Special Episodes numbering, see §5a — but this lives on the collection itself via `setPluginData`, not on any individual item, so it doesn't conflict with this rule.)

## 2. Input
- **Feed URL (user-pasted):** e.g. `https://feeds.soundcloud.com/users/soundcloud:users:309489020/sounds.rss`
- Feed is standard RSS 2.0 + iTunes podcast namespace. Structure:
  - `<channel>` — show-level metadata (title, description, image, etc.) — **ignored** for import purposes.
  - `<item>` (repeated, newest first) — one per episode.
- **Fetched via a Cloudflare Worker proxy, not directly from the browser.** SoundCloud's CDN returns a hardcoded `Access-Control-Allow-Origin` locked to a specific third-party domain, which blocks direct browser-side reads from the Framer plugin (confirmed via header inspection — not a caching artifact). The plugin fetches the feed through our own Worker, which fetches server-side (no CORS restriction applies server-to-server) and returns the raw feed with an open CORS header. See §9 for the proxy's role in the architecture.

## 3. Field Mapping (RSS → CMS)

| CMS Field | Type | RSS Source |
|---|---|---|
| Slug/Title | Plain text (native slug field) | `<title>`, stripped of the "Episode SS.EE - " prefix (see §5) — only the actual title text remains |
| Subtitle | Plain text | `<itunes:subtitle>` |
| Notes | Formatted text | `<description>` (fallback: `<itunes:summary>`) |
| Audio URL | Plain text | `<enclosure url="...">` |
| Episode Art | Image | `<itunes:image href="...">` (fallback: channel `<itunes:image>` if item-level missing) |
| Published Date | Date | `<pubDate>` |
| Season | Plain text | `"Season <N>"` for episodes matching a title pattern in §5; `"Special Episodes"` for anything that doesn't (see §5a) |
| Episode Number | Number | Parsed episode number for regular episodes (see §5); for Special Episodes, a sequential position assigned oldest→newest by publish date (see §5a) |
| Season Sort Order | Number — internal only, drives correct ordering when Season is listed dynamically in the site UI; not intended to be shown to visitors | The season number for regular episodes; a fixed constant (`9999`) for Special Episodes (see §5a) |

Dedup key (not a visible CMS field, used internally): `<guid>` if present, else `<enclosure url>`. Since this is a plugin-created **Managed Collection**, the dedup key is used directly as the CMS item's own `id` on creation — no separate metadata storage needed. Re-runs call `getItemIds()` and compare against ids derived from the current feed to detect "already imported."

**Slug uniqueness:** episode titles are not unique across the feed (e.g. multiple episodes titled "Mercy" in different seasons — confirmed live, Framer rejects a slug collision outright and fails that item). The slug is `<slugified title>-s<season>-e<episode>` when both are parsed (readable, matches how the show identifies episodes — e.g. `mercy-s7-e3`). For Special Episodes, the slug is just `specialepisodes-<episode number>` (e.g. `specialepisodes-7`) — title is omitted since some special titles are long, and the sequence number alone is already guaranteed unique.

## 4. Import Behavior
- **Parse:** Fetch feed, parse all `<item>` elements in document order (feed is newest-first).
- **Diff:** Compare against existing CMS collection items using the dedup key.
- **Import all new items** — every episode newer than the newest one already in the CMS gets added (not just the single latest), so no episodes are missed if multiple were published between runs.
- **Existing items are never modified** — if an episode's dedup key already exists in the CMS, it is skipped entirely (title, notes, audio, art, date, season, episode — nothing is overwritten). This protects manual post-processing. (The one piece of state that *does* update on every run that adds new Special Episodes is the collection-level counter described in §5a — that's metadata on the collection object itself, not a modification of any item, so it doesn't conflict with this rule.)
- No delete/prune behavior — plugin only ever adds. This is a deliberate deviation from the official CMS starter template's default sync pattern, which reconciles by deleting any existing CMS item not present in the current feed ("remove unseen items") — that behavior must be explicitly omitted, not inherited from the starter. (Confirmed the feed contains full episode history, so this is unlikely to come up in practice, but the rule holds regardless.)

## 5. Season / Episode Number Parsing
- Primary pattern: `Episode <season>.<episode> <separator> <Title>`, where `<separator>` is `-`, `•`, or `|` (e.g. `"Episode 11.27 - Title"`, `"Episode 7.3 • Mercy"`, `"Episode 4.23 | Mecca"`). Whitespace around the dot is tolerated (e.g. `"Episode 10. 2 - The Unseen"`), as is one confirmed typo in the real feed (`"Epsiode"` instead of `"Episode"`). Regex: `(?:Episode|Epsiode)\s+(\d+)\.\s*(\d+)\s*[-•|]\s*(.+)` — capture group 1 → Season, group 2 → Episode, group 3 → becomes the CMS title/slug (trimmed).
- Flat-numbering fallback: the show's earliest episodes use `Episode <n> <separator> <Title>` with no season digit at all (e.g. `"Episode 1 | Nafs"`). Season is assumed to be `1` for these — confirmed against the real feed that nothing else already claims season 1 in that range, so this doesn't collide with anything. Episode is extracted and the prefix stripped, same as the primary pattern.
- Other fallback patterns (in case a title doesn't match either format above): `S<season>E<episode>`, `<season>x<episode>`, `Season <n> Episode <n>` — if one of these matches, the full original title is kept as-is (not stripped), since these formats don't imply a clean prefix to remove.
- **If nothing matches, the episode is categorized as a Special Episode — not left blank.** See §5a. This is still a "never guess" outcome at the parsing level: `parseEpisodeTitle` itself still returns `season: null, episode: null` for these titles, exactly as before. Special Episodes categorization is a separate, subsequent, data-driven step, not the parser inventing a number.

## 5a. Special Episodes Categorization
- Any episode whose title doesn't match one of the patterns in §5 (i.e. `season: null, episode: null` from parsing) is categorized as a Special Episode — no sub-categories or exclusions. Replays are included, not treated separately.
- Special Episodes get `Season: "Special Episodes"` and their own `Episode Number` sequence, independent of any real season's numbering, assigned oldest→newest by publish date.
- This sequence is **append-only**: a newly-discovered special always gets "current highest Special Episodes number + 1." Existing Special Episodes items are never renumbered, even as new ones are added later. New specials are always the chronologically newest (same assumption already relied on elsewhere for feed ordering), so this is always correct.
- The current Special Episodes count is **not** derived by reading existing CMS items — the Managed Collection API has no method to read back existing items' field values (only `getItemIds()` exists for reads, confirmed via SDK types). It's tracked via a counter stored on the collection itself with `collection.setPluginData()` / `getPluginData()`, read at the start of each import and written back at the end.
- `Season Sort Order` for Special Episodes is the fixed constant `9999`, not a computed "current max season + 1." A computed value would eventually collide with a real season number reaching it, which would require rewriting every existing Special Episodes item's `Season Sort Order` to fix — conflicting with the append-only, no-modify-existing-items design. A sufficiently high fixed constant is set once and never needs revision.

## 6. Plugin UI
1. **URL input** — paste RSS feed URL, "Fetch" button.
2. **Field mapping preview** — after a successful fetch, display the *first item after channel metadata* (i.e., channel block is parsed but not shown) in a **2-column layout**:
   - Column 1: CMS field name (e.g. "Episode Art")
   - Column 2 (subtext under it): source + data type (e.g. "itunes:image → Image")
   - This is a preview/confirmation step, not an editable mapper (mapping is fixed per §3).
3. **Import summary** — shows count of new episodes detected vs. already-imported (skipped), then an "Import N Episodes" confirm button.
4. **Result state** — success/failure count, list of any items that failed to parse (e.g. missing audio enclosure) with reason.

This is the plugin's own configuration UI. Season/Special Episodes browsing tabs or toggles are a separate thing — built by hand in the Framer site editor against the `Season` field, not produced by the plugin.

## 7. Error Handling
- Feed fetch failure (bad URL, network, non-RSS content) → inline error, no partial state.
- Missing required field on an item (no audio enclosure, no title) → skip that item, surface in the result summary rather than failing the whole run.
- Image fetch/upload failure for `itunes:image` → import the item anyway, leave Episode Art blank, flag in summary.

## 8. Out of Scope (v1)
- Editing/updating previously-imported items.
- Deleting CMS items when removed from feed.
- Supporting feeds without iTunes namespace tags.
- Multi-feed / multi-podcast management in one plugin instance.

## 9. Technical Notes
- Built with `framer-plugin` SDK, using the CMS Collection API for reading existing items and creating new ones.
- Target collection is a plugin-created **Managed Collection** (confirmed via Framer's "Create Collection" flow), not an existing user collection.
- **Fetch architecture (revised from initial "no backend needed" assumption):** a Cloudflare Worker acts as a CORS proxy — it fetches the RSS feed server-side and returns it with an open `Access-Control-Allow-Origin` header. The plugin's fetch call points at the Worker's URL, not SoundCloud's feed URL directly. This is already implemented and deployed. The XML itself is still parsed client-side in the plugin via `DOMParser` — only the fetch hop changed, not the parsing logic.
- Image URLs pulled from `itunes:image` are set directly as the CMS image field's value (a raw URL string, not a pre-uploaded asset). Confirmed live: Framer ingests external image URLs server-side — no CORS issue, no Worker proxying needed for images.
- Special Episodes numbering uses `collection.setPluginData()` / `getPluginData()` as a persistent counter — see §5a for why (the Managed Collection API can't read back existing items' field values, so there's no other way to know the current count).
- Season, Episode Number, and Season Sort Order are never `userEditable` — a `userEditable` field blocks the plugin from setting its value via `addItems()` at all, including on first creation, not just later updates. The whole-item skip (§4) is the only protection against overwriting user edits, and is sufficient on its own.
- **Migration note:** the `Season` (string) + `Season Sort Order` fields replace the old `Season Number` (number) field — a breaking schema change. Rolled out via a one-time delete-and-reimport of all existing CMS items (same approach used for the earlier `userEditable` fix), not an in-place migration.

## 10. Estimate
**~4–6 hours** of focused build time with Sonnet 5 High, covering: RSS fetch/parse, diffing logic, season/episode regex parsing, the 2-column mapping preview UI, import execution with image upload, and error-state handling. This assumes the Framer CMS field schema already exists (or the plugin creates it once on first run) — schema creation logic is straightforward and included in the estimate.
