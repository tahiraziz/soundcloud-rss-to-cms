import "./App.css"

import { framer, type ManagedCollection } from "@framer/plugin"
import { useLayoutEffect, useState } from "react"
import { type FetchedFeed, FeedUrlInput } from "./FeedUrlInput"
import { importEpisodes, type ImportItemResult } from "./importEpisodes"
import { ImportPreview } from "./ImportPreview"
import { ImportResult } from "./ImportResult"

interface AppProps {
    collection: ManagedCollection
}

type Screen =
    | { type: "input"; skipAutoFetch?: boolean }
    | { type: "preview"; feed: FetchedFeed }
    | { type: "importing"; feed: FetchedFeed }
    | { type: "result"; results: ImportItemResult[] }

export function App({ collection }: AppProps) {
    const [screen, setScreen] = useState<Screen>({ type: "input" })

    useLayoutEffect(() => {
        const isCompact = screen.type === "input"

        framer.showUI({
            width: isCompact ? 260 : 360,
            height: isCompact ? 340 : 425,
            minWidth: isCompact ? undefined : 360,
            minHeight: isCompact ? undefined : 425,
            resizable: !isCompact,
        })
    }, [screen.type])

    if (screen.type === "input") {
        return (
            <FeedUrlInput
                collection={collection}
                skipAutoFetch={screen.skipAutoFetch}
                onFetched={feed => setScreen({ type: "preview", feed })}
            />
        )
    }

    if (screen.type === "preview") {
        const { feed } = screen
        return (
            <ImportPreview
                newEpisodes={feed.newEpisodes}
                totalEpisodeCount={feed.episodes.length}
                onBack={() => setScreen({ type: "input", skipAutoFetch: true })}
                onImport={async () => {
                    setScreen({ type: "importing", feed })
                    try {
                        const { results } = await importEpisodes(collection, feed.newEpisodes)
                        setScreen({ type: "result", results })
                    } catch (error) {
                        console.error(error)
                        framer.notify("Import failed. Check the logs for more details.", { variant: "error" })
                        setScreen({ type: "preview", feed })
                    }
                }}
            />
        )
    }

    if (screen.type === "importing") {
        return (
            <main className="loading">
                <div className="framer-spinner" />
            </main>
        )
    }

    return (
        <ImportResult
            results={screen.results}
            onDone={() => framer.closePlugin("Import complete", { variant: "success" })}
        />
    )
}
