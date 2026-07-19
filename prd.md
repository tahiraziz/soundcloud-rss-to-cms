# PRD: SoundCloud RSS → Framer CMS Import Plugin

## 1. Summary
A Framer plugin that imports podcast episodes from a SoundCloud RSS feed into a Framer CMS Collection. It's designed for repeat, incremental runs: each run only adds episodes newer than what's already in the CMS, so manually-edited fields (like Season/Episode) are never touched.

## 2. Input
- **Feed URL (user-pasted):** e.g. `https://feeds.soundcloud.com/users/soundcloud:users:309489020/sounds.rss`
- Feed is standard RSS 2.0 + iTunes podcast namespace. Structure:
  - `<channel>` — show-level metadata (title, description, image, etc.) — **ignored** for import purposes.
  - `<item>` (repeated, newest first) — one per episode.

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

Dedup key (not a visible CMS field, used internally): `<guid>` if present, else `<enclosure url>`, stored via Framer CMS's item ID matching so re-runs can detect "already imported."

## 4. Import Behavior
- **Parse:** Fetch feed, parse all `<item>` elements in document order (feed is newest-first).
- **Diff:** Compare against existing CMS collection items using the dedup key.
- **Import all new items** — every episode newer than the newest one already in the CMS gets added (not just the single latest), so no episodes are missed if multiple were published between runs.
- **Existing items are never modified** — if an episode's dedup key already exists in the CMS, it is skipped entirely (title, notes, audio, art, date — nothing is overwritten). This protects manual post-processing.
- No delete/prune behavior — plugin only ever adds.

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
- RSS fetch/parse via `DOMParser` (client-side XML parsing) — no backend needed.
- Image URLs pulled from `itunes:image` are uploaded to Framer's CMS image field via the plugin's asset upload API.

## 10. Estimate
**~4–6 hours** of focused build time with Sonnet 5 High, covering: RSS fetch/parse, diffing logic, season/episode regex parsing, the 2-column mapping preview UI, import execution with image upload, and error-state handling. This assumes the Framer CMS field schema already exists (or the plugin creates it once on first run) — schema creation logic is straightforward and included in the estimate.
