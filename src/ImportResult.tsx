import type { ImportItemResult } from "./importEpisodes"

interface ImportResultProps {
    results: ImportItemResult[]
    onDone: () => void
}

export function ImportResult({ results, onDone }: ImportResultProps) {
    const succeeded = results.filter(result => result.status === "success" || result.status === "success-no-image")
    const noImage = results.filter(result => result.status === "success-no-image")
    const skipped = results.filter(result => result.status === "skipped")
    const failed = results.filter(result => result.status === "failed")

    return (
        <main className="framer-hide-scrollbar mapping">
            <hr className="sticky-divider" />

            <div className="preview-fields">
                <p className="import-summary">
                    {succeeded.length} of {results.length} episode{results.length === 1 ? "" : "s"} imported
                </p>

                {noImage.length > 0 && (
                    <p className="import-summary">
                        {noImage.length} imported without Episode Art (image failed to load)
                    </p>
                )}

                {skipped.length > 0 && (
                    <div className="preview-fields">
                        <p className="error-message">Skipped {skipped.length} (missing required data):</p>
                        {skipped.map(result => (
                            <div className="preview-field-row" key={result.episode.guid || result.episode.audioUrl}>
                                <span className="preview-field-name">{result.episode.title || "(untitled)"}</span>
                                <span className="preview-field-source">{result.error}</span>
                            </div>
                        ))}
                    </div>
                )}

                {failed.length > 0 && (
                    <div className="preview-fields">
                        <p className="error-message">Failed to import {failed.length}:</p>
                        {failed.map(result => (
                            <div className="preview-field-row" key={result.episode.guid || result.episode.audioUrl}>
                                <span className="preview-field-name">{result.episode.title}</span>
                                <span className="preview-field-source">{result.error}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <footer>
                <hr />
                <button type="button" onClick={onDone}>
                    Done
                </button>
            </footer>
        </main>
    )
}
