export interface TitleOverride {
    title: string
    season: number
    episode: number
}

// Known raw titles that don't fit the "Episode <season>.<episode> - <Title>"
// pattern (or any fallback pattern) but have a known correct Season/Episode/Title.
const TITLE_OVERRIDES: Record<string, TitleOverride> = {
    "Episode 0 | Why SoulFood?": { title: "Why SoulFood", season: 1, episode: 0 },
}

export function getTitleOverride(rawTitle: string): TitleOverride | undefined {
    return TITLE_OVERRIDES[rawTitle]
}
