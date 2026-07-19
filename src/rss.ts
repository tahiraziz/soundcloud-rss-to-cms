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

export async function fetchAndParseFeed(feedUrl: string): Promise<ParsedEpisode[]> {
    const response = await fetch(feedUrl)
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
