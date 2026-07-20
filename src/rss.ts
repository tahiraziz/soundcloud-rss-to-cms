import { getTitleOverride } from "./titleOverrides"
import { parseEpisodeTitle } from "./titleParsing"

export interface ParsedEpisode {
    title: string
    subtitle: string
    notes: string
    audioUrl: string
    artUrl: string
    pubDate: string
    guid: string
    season: number | null
    episode: number | null
}

// SoundCloud's feed CDN doesn't send CORS headers for our origin, so a
// direct browser fetch() is blocked. When configured, route through a
// small proxy (see worker/) that fetches server-side and re-serves with
// permissive CORS headers. Falls back to a direct fetch when unset, so
// this still works unmodified in Node (e.g. the scripts/test-*.ts scripts).
const RSS_PROXY_URL = import.meta.env?.VITE_RSS_PROXY_URL

export async function fetchAndParseFeed(feedUrl: string): Promise<ParsedEpisode[]> {
    const requestUrl = RSS_PROXY_URL ? `${RSS_PROXY_URL}?url=${encodeURIComponent(feedUrl)}` : feedUrl

    const response = await fetch(requestUrl)
    if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`)
    }

    const xmlText = await response.text()
    const doc = new DOMParser().parseFromString(xmlText, "text/xml")

    const parserError = doc.getElementsByTagName("parsererror")[0]
    if (parserError) {
        throw new Error(`Failed to parse feed XML: ${parserError.textContent}`)
    }

    return Array.from(doc.getElementsByTagName("item")).map(parseItem)
}

function parseItem(item: Element): ParsedEpisode {
    const rawTitle = getText(item, "title")
    const { title, season, episode } = getTitleOverride(rawTitle) ?? parseEpisodeTitle(rawTitle)

    return {
        title,
        subtitle: getText(item, "itunes:subtitle"),
        notes: getText(item, "description") || getText(item, "itunes:summary"),
        audioUrl: item.getElementsByTagName("enclosure")[0]?.getAttribute("url") ?? "",
        artUrl: item.getElementsByTagName("itunes:image")[0]?.getAttribute("href") ?? "",
        pubDate: getText(item, "pubDate"),
        guid: getText(item, "guid"),
        season,
        episode,
    }
}

function getText(item: Element, tagName: string): string {
    return item.getElementsByTagName(tagName)[0]?.textContent?.trim() ?? ""
}
