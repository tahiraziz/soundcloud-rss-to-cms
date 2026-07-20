import "./App.css"

import { framer, type ManagedCollection } from "@framer/plugin"
import { useLayoutEffect, useState } from "react"
import { type FetchedFeed, FeedUrlInput } from "./FeedUrlInput"
import { ImportPreview } from "./ImportPreview"

interface AppProps {
    collection: ManagedCollection
}

export function App({ collection }: AppProps) {
    const [fetchedFeed, setFetchedFeed] = useState<FetchedFeed | null>(null)

    useLayoutEffect(() => {
        const hasFetchedFeed = Boolean(fetchedFeed)

        framer.showUI({
            width: hasFetchedFeed ? 360 : 260,
            height: hasFetchedFeed ? 425 : 340,
            minWidth: hasFetchedFeed ? 360 : undefined,
            minHeight: hasFetchedFeed ? 425 : undefined,
            resizable: hasFetchedFeed,
        })
    }, [fetchedFeed])

    if (!fetchedFeed) {
        return <FeedUrlInput collection={collection} onFetched={setFetchedFeed} />
    }

    return (
        <ImportPreview
            newEpisodes={fetchedFeed.newEpisodes}
            totalEpisodeCount={fetchedFeed.episodes.length}
            onImport={() => {
                // Phase 5: wire collection.addItems()/setItemOrder() here.
                framer.notify("Import isn't wired up yet — coming in the next phase.", { variant: "info" })
            }}
        />
    )
}
