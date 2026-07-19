// Dev-only smoke test for src/titleParsing.ts, run in Node via jiti.
import assert from "node:assert/strict"

import { parseEpisodeTitle } from "../src/titleParsing.ts"

const cases: Array<{ name: string; input: string; expected: ReturnType<typeof parseEpisodeTitle> }> = [
    {
        name: "primary format",
        input: "Episode 11.27 - The Title Here",
        expected: { title: "The Title Here", season: 11, episode: 27 },
    },
    {
        name: "primary format, extra whitespace around title",
        input: "Episode 3.5 -   Loose Spacing  ",
        expected: { title: "Loose Spacing", season: 3, episode: 5 },
    },
    {
        name: "fallback: SxEy, title kept as-is",
        input: "S3E12",
        expected: { title: "S3E12", season: 3, episode: 12 },
    },
    {
        name: "fallback: NxN, title kept as-is",
        input: "3x12",
        expected: { title: "3x12", season: 3, episode: 12 },
    },
    {
        name: "fallback: Season N Episode N, title kept as-is",
        input: "Season 3 Episode 12",
        expected: { title: "Season 3 Episode 12", season: 3, episode: 12 },
    },
    {
        name: "no match: full raw string kept, season/episode null",
        input: "Why SoulFood?",
        expected: { title: "Why SoulFood?", season: null, episode: null },
    },
]

let failures = 0

for (const { name, input, expected } of cases) {
    const actual = parseEpisodeTitle(input)
    try {
        assert.deepEqual(actual, expected)
        console.log(`ok   - ${name}`)
    } catch {
        failures++
        console.log(`FAIL - ${name}`)
        console.log(`  input:    ${JSON.stringify(input)}`)
        console.log(`  expected: ${JSON.stringify(expected)}`)
        console.log(`  actual:   ${JSON.stringify(actual)}`)
    }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`)
if (failures > 0) process.exit(1)
