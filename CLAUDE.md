# Project context

Framer plugin that imports SoundCloud podcast RSS episodes into a Framer CMS collection.
Full spec: see PRD.md

## Hard rules — do not violate
- Never modify or overwrite an existing CMS item. If an episode's dedup key
  (guid, fallback enclosure URL) already exists in the collection, skip it entirely.
- Title parsing: RSS `<title>` is "Episode <season>.<episode> - <Title>".
  Strip the prefix — only "<Title>" goes into the CMS title/slug field.
  Season/Episode numbers are parsed out into their own Number fields.
- Notes field uses <description>, fallback <itunes:summary>. Not <content:encoded>.
- Check node_modules/framer-plugin TypeScript types before writing any Framer
  CMS API calls — don't guess method names.

## Workflow
- Build in phases (see PRD §4-6). Confirm one phase works before moving to the next.
- Commit after each working phase with a clear message.
