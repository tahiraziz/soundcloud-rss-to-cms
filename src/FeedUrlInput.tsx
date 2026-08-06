import { type ManagedCollection } from "@framer/plugin"
import { useEffect, useState } from "react"
import { getNewEpisodes } from "./dedup"
import { fetchAndParseFeed, type ParsedEpisode } from "./rss"

export interface FetchedFeed {
    episodes: ParsedEpisode[]
    newEpisodes: ParsedEpisode[]
}

const FEED_URL_KEY = "feedUrl"

interface FeedUrlInputProps {
    collection: ManagedCollection
    // Skip the on-mount auto-fetch even if a URL was saved from a previous
    // run — used when the user explicitly navigates back to this screen to
    // change the URL, so it doesn't immediately fetch the old one again.
    skipAutoFetch?: boolean
    onFetched: (feed: FetchedFeed) => void
}

export function FeedUrlInput({ collection, skipAutoFetch = false, onFetched }: FeedUrlInputProps) {
    const [feedUrl, setFeedUrl] = useState("")
    // Starts loading unless we're skipping auto-fetch, so the form doesn't
    // flash empty for a moment before a saved URL is restored and fetched.
    const [isLoading, setIsLoading] = useState(!skipAutoFetch)
    const [error, setError] = useState<string | null>(null)

    const runFetch = async (url: string) => {
        setIsLoading(true)
        setError(null)

        try {
            const episodes = await fetchAndParseFeed(url)
            if (episodes.length === 0) {
                throw new Error("This feed doesn't contain any episodes.")
            }

            const existingItemIds = new Set(await collection.getItemIds())
            const newEpisodes = getNewEpisodes(episodes, existingItemIds)

            await collection.setPluginData(FEED_URL_KEY, url)
            onFetched({ episodes, newEpisodes })
        } catch (fetchError) {
            console.error(fetchError)
            setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch feed.")
            setIsLoading(false)
        }
    }

    useEffect(() => {
        let cancelled = false

        collection.getPluginData(FEED_URL_KEY).then(stored => {
            if (cancelled || !stored) {
                setIsLoading(false)
                return
            }

            setFeedUrl(stored)
            if (!skipAutoFetch) {
                void runFetch(stored)
            } else {
                setIsLoading(false)
            }
        })

        return () => {
            cancelled = true
        }
        // Only ever runs once per mount of this screen (re-mounted fresh via
        // the "back" navigation from the preview screen), not on every
        // feedUrl keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collection, skipAutoFetch])

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        void runFetch(feedUrl)
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
