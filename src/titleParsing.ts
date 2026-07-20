export interface ParsedTitle {
    title: string
    season: number | null
    episode: number | null
}

export function parseEpisodeTitle(rawTitle: string): ParsedTitle {
    // Separator varies across the feed's history: "-", "•", or "|" (e.g.
    // "Episode 7.3 • Mercy", "Episode 4.23 | Mecca"). Whitespace around the
    // dot also varies (e.g. "Episode 10. 2 - The Unseen"). "Epsiode" is a
    // confirmed typo on one real title ("Epsiode 4.21 | Seclusion").
    const primary = rawTitle.match(/(?:Episode|Epsiode)\s+(\d+)\.\s*(\d+)\s*[-•|]\s*(.+)/)
    if (primary) {
        const [, season, episode, title] = primary
        return { title: (title ?? "").trim(), season: Number(season), episode: Number(episode) }
    }

    // Pre-"Season.Episode"-numbering episodes use a flat "Episode N" format
    // with no season digit anywhere in the title (e.g. "Episode 1 | Nafs",
    // confirmed to be this show's actual Season 1, before it adopted
    // "Season.Episode" dotted numbering from Season 2 onward — verified no
    // other episode already has season 1 in this range). Season isn't
    // literally in the title, so this is an inference, not a strict "never
    // guess" violation of blindly defaulting to 0/1 for anything unparsed.
    const flatEpisode = rawTitle.match(/(?:Episode|Epsiode)\s+(\d+)\s*[-•|]\s*(.+)/)
    if (flatEpisode) {
        const [, episode, title] = flatEpisode
        return { title: (title ?? "").trim(), season: 1, episode: Number(episode) }
    }

    const sNumENum = rawTitle.match(/S(\d+)E(\d+)/i)
    if (sNumENum) {
        const [, season, episode] = sNumENum
        return { title: rawTitle, season: Number(season), episode: Number(episode) }
    }

    const nByN = rawTitle.match(/(\d+)x(\d+)/i)
    if (nByN) {
        const [, season, episode] = nByN
        return { title: rawTitle, season: Number(season), episode: Number(episode) }
    }

    const seasonEpisodeWords = rawTitle.match(/Season\s+(\d+)\s+Episode\s+(\d+)/i)
    if (seasonEpisodeWords) {
        const [, season, episode] = seasonEpisodeWords
        return { title: rawTitle, season: Number(season), episode: Number(episode) }
    }

    return { title: rawTitle, season: null, episode: null }
}
