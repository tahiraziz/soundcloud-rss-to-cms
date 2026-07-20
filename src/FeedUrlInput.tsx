import { type ManagedCollection } from "@framer/plugin"
import { useState } from "react"
import { getNewEpisodes } from "./dedup"
import { fetchAndParseFeed, type ParsedEpisode } from "./rss"

export interface FetchedFeed {
    episodes: ParsedEpisode[]
    newEpisodes: ParsedEpisode[]
}

interface FeedUrlInputProps {
    collection: ManagedCollection
    onFetched: (feed: FetchedFeed) => void
}

export function FeedUrlInput({ collection, onFetched }: FeedUrlInputProps) {
    const [feedUrl, setFeedUrl] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        setIsLoading(true)
        setError(null)

        try {
            const episodes = await fetchAndParseFeed(feedUrl)
            if (episodes.length === 0) {
                throw new Error("This feed doesn't contain any episodes.")
            }

            const existingItemIds = new Set(await collection.getItemIds())
            const newEpisodes = getNewEpisodes(episodes, existingItemIds)

            onFetched({ episodes, newEpisodes })
        } catch (fetchError) {
            console.error(fetchError)
            setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch feed.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <main className="framer-hide-scrollbar setup">
            <div className="intro">
                <div className="logo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="none">
                        <title>SoundCloud RSS Import</title>
                        <path
                            fill="currentColor"
                            d="M15.5 8c3.59 0 6.5 1.38 6.5 3.083 0 1.702-2.91 3.082-6.5 3.082S9 12.785 9 11.083C9 9.38 11.91 8 15.5 8Zm6.5 7.398c0 1.703-2.91 3.083-6.5 3.083S9 17.101 9 15.398v-2.466c0 1.703 2.91 3.083 6.5 3.083s6.5-1.38 6.5-3.083Zm0 4.316c0 1.703-2.91 3.083-6.5 3.083S9 21.417 9 19.714v-2.466c0 1.702 2.91 3.083 6.5 3.083S22 18.95 22 17.248Z"
                        />
                    </svg>
                </div>
                <div className="content">
                    <h2>Import Episodes</h2>
                    <p>Paste a SoundCloud podcast RSS feed URL to import episodes into this collection.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <label htmlFor="feedUrl">
                    RSS Feed URL
                    <input
                        id="feedUrl"
                        type="url"
                        required
                        placeholder="https://feeds.soundcloud.com/…"
                        value={feedUrl}
                        onChange={event => setFeedUrl(event.target.value)}
                        disabled={isLoading}
                    />
                </label>
                {error && <p className="error-message">{error}</p>}
                <button type="submit" disabled={isLoading || !feedUrl}>
                    {isLoading ? <div className="framer-spinner" /> : "Fetch"}
                </button>
            </form>
        </main>
    )
}
