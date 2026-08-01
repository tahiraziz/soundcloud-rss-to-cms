// Dev-only smoke test for src/seasonLabeling.ts, run in Node via jiti.
import assert from "node:assert/strict"

import { resolveSeasonInfo, SPECIALS_SORT_ORDER } from "../src/seasonLabeling.ts"
import type { ParsedEpisode } from "../src/rss.ts"

function makeEpisode(overrides: Partial<ParsedEpisode> & { pubDate: string }): ParsedEpisode {
    return {
        title: "Untitled",
        subtitle: "",
        notes: "",
        audioUrl: "https://example.com/audio.mp3",
        artUrl: "",
        guid: `tag:soundcloud,2010:tracks/${Math.random()}`,
        season: null,
        episode: null,
        ...overrides,
    }
}

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
    try {
        assert.deepEqual(actual, expected)
        console.log(`ok   - ${name}`)
    } catch {
        failures++
        console.log(`FAIL - ${name}`)
        console.log(`  expected: ${JSON.stringify(expected)}`)
        console.log(`  actual:   ${JSON.stringify(actual)}`)
    }
}

// Regular episodes pass through with Season label + Sort Order derived
// directly from their parsed season/episode, no counter involved.
{
    const ep = makeEpisode({ title: "Mercy", season: 7, episode: 3, pubDate: "2024-01-01" })
    const { resolved, newSpecialsCount } = resolveSeasonInfo([ep], 0)
    check("regular episode: season label, episode number, sort order", resolved[0], {
        episode: ep,
        seasonLabel: "Season 7",
        episodeNumber: 3,
        sortOrder: 7,
    })
    check("regular episode: specials count unchanged", newSpecialsCount, 0)
}

// Special Episodes get numbered oldest -> newest by pubDate, regardless of input
// array order, continuing from the starting count.
{
    const oldest = makeEpisode({ title: "A", pubDate: "2020-01-01" })
    const middle = makeEpisode({ title: "B", pubDate: "2022-06-15" })
    const newest = makeEpisode({ title: "C", pubDate: "2024-12-31" })

    // Passed in out of chronological order on purpose.
    const { resolved, newSpecialsCount } = resolveSeasonInfo([newest, oldest, middle], 0)
    const byTitle = new Map(resolved.map(r => [r.episode.title, r]))

    check("specials: oldest gets number 1", byTitle.get("A")?.episodeNumber, 1)
    check("specials: middle gets number 2", byTitle.get("B")?.episodeNumber, 2)
    check("specials: newest gets number 3", byTitle.get("C")?.episodeNumber, 3)
    check("specials: season label is 'Special Episodes'", byTitle.get("A")?.seasonLabel, "Special Episodes")
    check("specials: sort order is the fixed constant", byTitle.get("A")?.sortOrder, SPECIALS_SORT_ORDER)
    check("specials: count advances by number of specials", newSpecialsCount, 3)
}

// Append-only: continuing from a non-zero starting count picks up where it
// left off, never restarting at 1.
{
    const ep = makeEpisode({ title: "D", pubDate: "2025-01-01" })
    const { resolved, newSpecialsCount } = resolveSeasonInfo([ep], 15)
    check("append-only: continues from existing count", resolved[0].episodeNumber, 16)
    check("append-only: new count is starting count + new specials", newSpecialsCount, 16)
}

// Mixed batch: regular episodes and specials resolved independently in the
// same call.
{
    const regular = makeEpisode({ title: "Regular", season: 11, episode: 5, pubDate: "2026-01-01" })
    const special = makeEpisode({ title: "Special", pubDate: "2026-01-02" })
    const { resolved } = resolveSeasonInfo([regular, special], 2)
    const byTitle = new Map(resolved.map(r => [r.episode.title, r]))

    check("mixed batch: regular unaffected by specials counter", byTitle.get("Regular"), {
        episode: regular,
        seasonLabel: "Season 11",
        episodeNumber: 5,
        sortOrder: 11,
    })
    check("mixed batch: special still numbered from counter", byTitle.get("Special")?.episodeNumber, 3)
}

console.log(`\n${failures === 0 ? "all" : "some"} checks passed (${failures} failure${failures === 1 ? "" : "s"})`)
if (failures > 0) process.exit(1)
