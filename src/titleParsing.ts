export interface ParsedTitle {
    title: string
    season: number | null
    episode: number | null
}

export function parseEpisodeTitle(rawTitle: string): ParsedTitle {
    const primary = rawTitle.match(/Episode\s+(\d+)\.(\d+)\s*-\s*(.+)/)
    if (primary) {
        const [, season, episode, title] = primary
        return { title: (title ?? "").trim(), season: Number(season), episode: Number(episode) }
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
