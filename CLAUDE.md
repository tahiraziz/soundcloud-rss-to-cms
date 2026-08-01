# Project context

Framer plugin that imports SoundCloud podcast RSS episodes into a Framer CMS collection.
Full spec: see PRD.md

## Hard rules — do not violate
- Never modify or overwrite an existing CMS item. If an episode's dedup key
  (guid, fallback enclosure URL) already exists in the collection, skip it entirely.
- This is a plugin-created Managed Collection (confirmed via the "Create
  Collection" dialog). The official CMS starter's default sync pattern
  reconciles by deleting any existing CMS item not present in the current
  fetch ("remove unseen items"). DO NOT implement or keep this behavior —
  we only ever add new items, never delete or prune existing ones, even
  if an episode were to disappear from the feed. Confirmed our feed always
  contains full episode history, so this shouldn't come up in practice,
  but the no-delete rule stands regardless.
- Never set `userEditable: true` on any field the plugin writes (Season,
  Episode Number, Season Sort Order, etc.). Per the SDK's `setFields()` doc comment,
  a `userEditable` field can no longer have its value set by the plugin via
  `addItems()` — including on first creation, not just on update. The
  whole-item skip (previous rule) is the only protection against overwriting
  user edits, and it's sufficient since `addItems` is never called on an id
  already in the collection.
- Title parsing: primary format is `Episode <season>.<episode> <sep> <Title>`,
  where `<sep>` is `-`, `•`, or `|` (whitespace around the dot and the
  "Epsiode" typo are also tolerated). A flat `Episode <n> <sep> <Title>`
  fallback (no season digit) assumes season 1. Strip the prefix — only
  "<Title>" goes into the CMS title/slug field for either format. If nothing
  matches, the episode is a Special, not left blank.
- Season is a plain-text field (`"Season <N>"` or `"Special Episodes"`), not a
  number — don't reintroduce a numeric Season field.
- Special Episodes: any episode that doesn't match the title-parsing patterns
  above. Numbered oldest→newest, append-only — a new special always gets
  "current highest Special Episodes number + 1," existing ones are never
  renumbered. The current count is tracked via `collection.setPluginData()` /
  `getPluginData()`, not by reading existing items — `ManagedCollection` has
  no method to read back existing items' field values, only `getItemIds()`.
  Special Episodes' `Season Sort Order` is the fixed constant `9999`, not a
  computed value — a computed value would eventually collide with a real
  season number and require rewriting every existing Special Episodes item to
  fix.
- Notes field uses <description>, fallback <itunes:summary>. Not <content:encoded>.
- Check node_modules/framer-plugin TypeScript types before writing any Framer
  CMS API calls — don't guess method names.
- Feed fetching goes through a Cloudflare Worker proxy, not directly to
  SoundCloud. SoundCloud's CDN locks CORS to a third-party origin, which
  blocks direct browser fetch from the plugin. The Worker fetches the feed
  server-side and returns it with an open CORS header; the plugin fetches
  from the Worker's URL. Don't attempt to fetch the SoundCloud feed URL
  directly from plugin code. Image URLs (itunes:image) do NOT need to route
  through the Worker — confirmed live, Framer ingests external image URLs
  server-side with no CORS issue.

## Workflow
- Build in phases (see PRD §4-6). Confirm one phase works before moving to the next.
- Commit after each working phase with a clear message.
