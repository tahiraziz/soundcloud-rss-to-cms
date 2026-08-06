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
    { name: "Season", source: "Parsed from title, or \"Special Episodes\" if unmatched → Plain text" },
    { name: "Episode Number", source: "Parsed from title, or Special Episodes sequence number → Number" },
    { name: "Season Sort Order", source: "Season number, or fixed constant for Special Episodes → Number" },
]

interface ImportPreviewProps {
    newEpisodes: ParsedEpisode[]
    totalEpisodeCount: number
    onImport: () => void
    onBack: () => void
}

export function ImportPreview({ newEpisodes, totalEpisodeCount, onImport, onBack }: ImportPreviewProps) {
    const newCount = newEpisodes.length
    const alreadyImportedCount = totalEpisodeCount - newCount

    return (
        <main className="framer-hide-scrollbar mapping">
            <div className="preview-header">
                <button type="button" className="back-button" onClick={onBack} aria-label="Change feed URL">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none">
                        <path
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 3.5 5.5 8l4.5 4.5"
                        />
                    </svg>
                </button>
            </div>
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
