import type { ParsedEpisode } from "./rss"

interface FieldMappingRow {
    name: string
    source: string
}

// Fixed field mapping per PRD §3 — this is a read-only preview, not an
// editable mapper, since the RSS → CMS mapping is not configurable.
const FIELD_MAPPING_ROWS: FieldMappingRow[] = [
    { name: "Slug/Title", source: "Title regex-parsed from <title> → Plain text" },
    { name: "Subtitle", source: "<itunes:subtitle> → Plain text" },
    { name: "Notes", source: "<description>, fallback <itunes:summary> → Formatted text" },
    { name: "Audio URL", source: "<enclosure url> → Plain text" },
    { name: "Episode Art", source: "itunes:image → Image" },
    { name: "Published Date", source: "<pubDate> → Date" },
    { name: "Season", source: "Parsed from title, or \"Specials\" if unmatched → Plain text" },
    { name: "Episode Number", source: "Parsed from title, or Specials sequence number → Number" },
    { name: "Season Sort Order", source: "Season number, or fixed constant for Specials → Number" },
]

interface ImportPreviewProps {
    newEpisodes: ParsedEpisode[]
    totalEpisodeCount: number
    onImport: () => void
}

export function ImportPreview({ newEpisodes, totalEpisodeCount, onImport }: ImportPreviewProps) {
    const newCount = newEpisodes.length
    const alreadyImportedCount = totalEpisodeCount - newCount

    return (
        <main className="framer-hide-scrollbar mapping">
            <hr className="sticky-divider" />

            <div className="preview-fields">
                {FIELD_MAPPING_ROWS.map(row => (
                    <div className="preview-field-row" key={row.name}>
                        <span className="preview-field-name">{row.name}</span>
                        <span className="preview-field-source">{row.source}</span>
                    </div>
                ))}
            </div>

            <footer>
                <hr />
                <p className="import-summary">
                    {newCount} new episode{newCount === 1 ? "" : "s"} found, {alreadyImportedCount} already imported
                    (will be skipped)
                </p>
                {newCount > 0 ? (
                    <button type="button" onClick={onImport}>
                        Import {newCount} Episode{newCount === 1 ? "" : "s"}
                    </button>
                ) : (
                    <p className="import-summary">You're all caught up — nothing new to import.</p>
                )}
            </footer>
        </main>
    )
}
