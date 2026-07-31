import type { ManagedCollection } from "@framer/plugin"
import type { ParsedEpisode } from "./rss"

const SPECIALS_COUNT_KEY = "specialsCount"

// Fixed, not computed from "current max season + 1" — a computed value
// would eventually collide with a real season number and require rewriting
// every existing Specials item's Sort Order to fix. A sufficiently high
// constant is set once and never needs revision.
export const SPECIALS_SORT_ORDER = 9999

export interface ResolvedEpisode {
    episode: ParsedEpisode
    seasonLabel: string
    episodeNumber: number
    sortOrder: number
}

// ManagedCollection has no method to read back existing items' field
// values (only getItemIds() exists for reads), so the current Specials
// count can't be derived by inspecting the collection — it's tracked here
// as a counter stored on the collection itself instead.
export async function getSpecialsCount(collection: ManagedCollection): Promise<number> {
    const stored = await collection.getPluginData(SPECIALS_COUNT_KEY)
    return stored ? Number(stored) : 0
}

export async function setSpecialsCount(collection: ManagedCollection, count: number): Promise<void> {
    await collection.setPluginData(SPECIALS_COUNT_KEY, String(count))
}

// Specials numbering is append-only: a new special always gets "current
// highest Specials number + 1", continuing from currentSpecialsCount (read
// via getSpecialsCount before calling this). This only ever assigns numbers
// to the episodes passed in here — it never touches or renumbers anything
// already imported.
export function resolveSeasonInfo(
    episodes: ParsedEpisode[],
    currentSpecialsCount: number
): { resolved: ResolvedEpisode[]; newSpecialsCount: number } {
    const specials = episodes
        .filter(episode => episode.season === null || episode.episode === null)
        .slice()
        .sort((a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime())

    const specialsNumberByEpisode = new Map<ParsedEpisode, number>()
    specials.forEach((episode, index) => {
        specialsNumberByEpisode.set(episode, currentSpecialsCount + index + 1)
    })

    const resolved = episodes.map((episode): ResolvedEpisode => {
        if (episode.season !== null && episode.episode !== null) {
            return {
                episode,
                seasonLabel: `Season ${episode.season}`,
                episodeNumber: episode.episode,
                sortOrder: episode.season,
            }
        }

        const specialsNumber = specialsNumberByEpisode.get(episode)
        if (specialsNumber === undefined) {
            throw new Error("Logic error: special episode missing from specials numbering map")
        }

        return {
            episode,
            seasonLabel: "Specials",
            episodeNumber: specialsNumber,
            sortOrder: SPECIALS_SORT_ORDER,
        }
    })

    return { resolved, newSpecialsCount: currentSpecialsCount + specials.length }
}
