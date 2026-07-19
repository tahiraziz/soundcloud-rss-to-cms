// Dev-only smoke test for src/rss.ts, run in Node via jiti.
// Polyfills DOMParser (browser-only in the real plugin runtime) with xmldom
// purely so this script can execute outside a browser; production code never
// imports xmldom.
import { DOMParser } from "@xmldom/xmldom"

// @ts-expect-error -- Node has no global DOMParser; xmldom stands in for tests only.
globalThis.DOMParser = DOMParser

const { fetchAndParseFeed } = await import("../src/rss.ts")

const feedUrl = "https://feeds.soundcloud.com/users/soundcloud:users:309489020/sounds.rss"

const episodes = await fetchAndParseFeed(feedUrl)

console.log(`Parsed ${episodes.length} episodes`)
console.log(
    JSON.stringify(
        episodes.slice(0, 2).map(({ title, pubDate, audioUrl }) => ({ title, pubDate, audioUrl })),
        null,
        2
    )
)
