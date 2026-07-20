import { framer } from "@framer/plugin"

import type { ParsedEpisode } from "./rss"

export function deriveEpisodeId(episode: Pick<ParsedEpisode, "guid" | "audioUrl">): string {
    return episode.guid || episode.audioUrl
}

export function getNewEpisodes(feedEpisodes: ParsedEpisode[], existingItemIds: Set<string>): ParsedEpisode[] {
    // We only ever add new items to the collection. Existing CMS items are
    // never removed, even if their episode later disappears from the feed —
    // this is intentional (CLAUDE.md hard rules / PRD §4), not an oversight.
    // Do not add "remove items not in feed" logic here.
    return feedEpisodes.filter(episode => !existingItemIds.has(deriveEpisodeId(episode)))
}

export async function getNewEpisodesForActiveCollection(feedEpisodes: ParsedEpisode[]): Promise<ParsedEpisode[]> {
    const collection = await framer.getActiveManagedCollection()
    const existingItemIds = new Set(await collection.getItemIds())
    return getNewEpisodes(feedEpisodes, existingItemIds)
}
