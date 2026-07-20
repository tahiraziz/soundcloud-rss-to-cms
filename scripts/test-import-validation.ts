// Dev-only smoke test for the PRD §7 "missing required field" skip logic in
// src/importEpisodes.ts, run in Node via jiti.
import { missingRequiredFieldReason } from "../src/importEpisodes.ts"
import type { ParsedEpisode } from "../src/rss.ts"

function makeEpisode(overrides: Partial<ParsedEpisode> = {}): ParsedEpisode {
    return {
        title: "A Real Episode",
        subtitle: "",
        notes: "",
        audioUrl: "https://example.com/audio.mp3",
        artUrl: "",
        pubDate: "",
        guid: "tag:soundcloud,2010:tracks/1",
        season: null,
        episode: null,
        ...overrides,
    }
}

const cases: Array<{ name: string; episode: ParsedEpisode; expectSkip: boolean }> = [
    { name: "valid episode: not skipped", episode: makeEpisode(), expectSkip: false },
    { name: "missing audioUrl: skipped", episode: makeEpisode({ audioUrl: "" }), expectSkip: true },
    { name: "missing title: skipped", episode: makeEpisode({ title: "" }), expectSkip: true },
    { name: "whitespace-only title: skipped", episode: makeEpisode({ title: "   " }), expectSkip: true },
]

let failures = 0

for (const { name, episode, expectSkip } of cases) {
    const reason = missingRequiredFieldReason(episode)
    const actualSkip = reason !== null
    if (actualSkip === expectSkip) {
        console.log(`ok   - ${name}${reason ? ` (${reason})` : ""}`)
    } else {
        failures++
        console.log(`FAIL - ${name}: expected skip=${expectSkip}, got skip=${actualSkip} (reason=${reason})`)
    }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`)
if (failures > 0) process.exit(1)
