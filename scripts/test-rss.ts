// Dev-only smoke test for src/rss.ts, run in Node via jiti.
// Polyfills DOMParser (browser-only in the real plugin runtime) with xmldom
// purely so this script can execute outside a browser; production code never
// imports xmldom.
import { DOMParser } from "@xmldom/xmldom"

// @ts-expect-error -- Node has no global DOMParser; xmldom stands in for tests only.
globalThis.DOMParser = DOMParser

const { fetchAndParseFeed } = await import("../src/rss.ts")

const feedUrl = process.argv[2] ?? "https://feeds.soundcloud.com/users/soundcloud:users:309489020/sounds.rss"

const episodes = await fetchAndParseFeed(feedUrl)

console.log(`Parsed ${episodes.length} episodes\n`)
console.log("First episode:")
console.log(episodes[0])
console.log("\nLast episode:")
console.log(episodes.at(-1))

const missingAudio = episodes.filter(e => !e.audioUrl)
const missingArt = episodes.filter(e => !e.artUrl)
const missingGuid = episodes.filter(e => !e.guid)
console.log(`\nMissing audioUrl: ${missingAudio.length}`)
console.log(`Missing artUrl: ${missingArt.length}`)
console.log(`Missing guid: ${missingGuid.length}`)
