# PRD: SoundCloud RSS → Framer CMS Import Plugin

## 1. Summary
A Framer plugin that imports podcast episodes from a SoundCloud RSS feed into a Framer CMS Collection. It's designed for repeat, incremental runs: each run only adds episodes newer than what's already in the CMS, so manually-edited fields (like Season/Episode) are never touched.

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
| Season Number | Number | Not in feed — parsed from title prefix (see §5) |
| Episode Number | Number | Not in feed — parsed from title prefix (see §5) |

Dedup key (not a visible CMS field, used internally): `<guid>` if present, else `<enclosure url>`. Since this is a plugin-created **Managed Collection**, the dedup key is used directly as the CMS item's own `id` on creation — no separate metadata storage needed. Re-runs call `getItemIds()` and compare against ids derived from the current feed to detect "already imported."

**Slug uniqueness:** episode titles are not unique across the feed (e.g. multiple episodes titled "Mercy" in different seasons, or two "Special" episodes with no season/episode parsed at all — confirmed live, Framer rejects a slug collision outright and fails that item). The slug is `<slugified title>-<season>-<episode>` when both are parsed (readable, matches how the show identifies episodes — e.g. `mercy-7-3`); for the handful of episodes with no season/episode, it falls back to `<slugified title>-<publish date>`, and finally to a track-id suffix only if that publish date is somehow missing too.

## 4. Import Behavior
- **Parse:** Fetch feed, parse all `<item>` elements in document order (feed is newest-first).
- **Diff:** Compare against existing CMS collection items using the dedup key.
- **Import all new items** — every episode newer than the newest one already in the CMS gets added (not just the single latest), so no episodes are missed if multiple were published between runs.
- **Existing items are never modified** — if an episode's dedup key already exists in the CMS, it is skipped entirely (title, notes, audio, art, date — nothing is overwritten). This protects manual post-processing.
- No delete/prune behavior — plugin only ever adds. This is a deliberate deviation from the official CMS starter template's default sync pattern, which reconciles by deleting any existing CMS item not present in the current feed ("remove unseen items") — that behavior must be explicitly omitted, not inherited from the starter. (Confirmed the feed contains full episode history, so this is unlikely to come up in practice, but the rule holds regardless.)

## 5. Season / Episode Number Parsing
- The feed's actual title format is: `Episode <season>.<episode> - <Title>` (e.g. `"Episode 11.27 - Title"` → Season 11, Episode 27, Title = "Title").
- Primary pattern: `Episode\s+(\d+)\.(\d+)\s*-\s*(.+)` — capture group 1 → Season, group 2 → Episode, group 3 → becomes the CMS title/slug (trimmed).
- Fallback patterns (in case a title doesn't match the primary format): `S<season>E<episode>`, `<season>x<episode>`, `Season <n> Episode <n>` — if one of these matches, the full original title is kept as-is (not stripped), since these formats don't imply a clean prefix to remove.
- If nothing matches: Season/Episode are left blank, and the full original `<title>` is used unmodified. Never guess or default to 0.

## 6. Plugin UI
1. **URL input** — paste RSS feed URL, "Fetch" button.
2. **Field mapping preview** — after a successful fetch, display the *first item after channel metadata* (i.e., channel block is parsed but not shown) in a **2-column layout**:
   - Column 1: CMS field name (e.g. "Episode Art")
   - Column 2 (subtext under it): source + data type (e.g. "itunes:image → Image")
   - This is a preview/confirmation step, not an editable mapper (mapping is fixed per §3).
3. **Import summary** — shows count of new episodes detected vs. already-imported (skipped), then an "Import N Episodes" confirm button.
4. **Result state** — success/failure count, list of any items that failed to parse (e.g. missing audio enclosure) with reason.

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
- Image URLs pulled from `itunes:image` are uploaded to Framer's CMS image field via the plugin's asset upload API. **Open question:** confirm whether image URLs also hit the same CORS restriction and need to route through the Worker, or whether Framer's asset upload API fetches them server-side on Framer's end (in which case no proxying is needed for images specifically) — worth explicitly testing rather than assuming either way, since the audio/RSS CORS issue didn't surface until real browser testing.
- As defense-in-depth alongside the whole-item skip (§4), fields can additionally be defined with `userEditable: true` via `collection.setFields()` (available since it's a Managed Collection) — Framer's own `addItems()` will then silently no-op on those fields even on a full write, protecting against future manual CMS edits to fields the plugin doesn't otherwise track.

## 10. Estimate
**~4–6 hours** of focused build time with Sonnet 5 High, covering: RSS fetch/parse, diffing logic, season/episode regex parsing, the 2-column mapping preview UI, import execution with image upload, and error-state handling. This assumes the Framer CMS field schema already exists (or the plugin creates it once on first run) — schema creation logic is straightforward and included in the estimate.
