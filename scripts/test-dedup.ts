// Dev-only smoke test for src/dedup.ts, run in Node via jiti.
import assert from "node:assert/strict"

import { deriveEpisodeId, getNewEpisodes } from "../src/dedup.ts"
import type { ParsedEpisode } from "../src/rss.ts"

function makeEpisode(guid: string, audioUrl: string, title: string): ParsedEpisode {
    return {
        title,
        subtitle: "",
        notes: "",
        audioUrl,
        artUrl: "",
        pubDate: "",
        guid,
        season: null,
        episode: null,
    }
}

// Mock feed episodes, newest first — same shape as Phase 1/2 output.
const ep1005 = makeEpisode("tag:soundcloud,2010:tracks/1005", "https://.../1005.mp3", "Episode 12.5 Title")
const ep1004 = makeEpisode("tag:soundcloud,2010:tracks/1004", "https://.../1004.mp3", "Episode 12.4 Title")
const ep1003 = makeEpisode("tag:soundcloud,2010:tracks/1003", "https://.../1003.mp3", "Episode 12.3 Title")
const ep1002 = makeEpisode("tag:soundcloud,2010:tracks/1002", "https://.../1002.mp3", "Episode 12.2 Title")
const ep1001 = makeEpisode("tag:soundcloud,2010:tracks/1001", "https://.../1001.mp3", "Episode 12.1 Title")

const feedEpisodes = [ep1005, ep1004, ep1003, ep1002, ep1001]

function logResult(name: string, result: ParsedEpisode[]) {
    console.log(`\n${name}`)
    console.log(JSON.stringify(result.map(({ guid, title }) => ({ guid, title }))))
}

// Test case 1 — no existing items (first-ever import)
{
    const result = getNewEpisodes(feedEpisodes, new Set())
    logResult("Test case 1 — no existing items", result)
    assert.deepEqual(result, feedEpisodes)
}

// Test case 2 — partial overlap (2 already imported, 3 new)
{
    const existingItemIds = new Set([deriveEpisodeId(ep1001), deriveEpisodeId(ep1002)])
    const result = getNewEpisodes(feedEpisodes, existingItemIds)
    logResult("Test case 2 — partial overlap", result)
    assert.deepEqual(result, [ep1005, ep1004, ep1003])
}

// Test case 3 — full overlap (nothing new)
{
    const existingItemIds = new Set([
        deriveEpisodeId(ep1001),
        deriveEpisodeId(ep1002),
        deriveEpisodeId(ep1003),
        deriveEpisodeId(ep1004),
        deriveEpisodeId(ep1005),
    ])
    const result = getNewEpisodes(feedEpisodes, existingItemIds)
    logResult("Test case 3 — full overlap", result)
    assert.deepEqual(result, [])
}

// Test case 4 — missing guid, falls back to audioUrl
{
    // ParsedEpisode.guid is typed `string`, not `string | null` (rss.ts's
    // getText() returns "" for a missing <guid>, never null) — using "" here
    // to stay a valid ParsedEpisode. deriveEpisodeId's `guid || audioUrl`
    // treats "" and null identically, so this exercises the same fallback.
    const ep1006NoGuid = makeEpisode("", "https://.../1006.mp3", "Episode 12.6 Title")
    const feedWithMissingGuid = [ep1006NoGuid, ...feedEpisodes]
    const result = getNewEpisodes(feedWithMissingGuid, new Set())
    logResult("Test case 4 — missing guid, falls back to audioUrl", result)
    assert.deepEqual(result, feedWithMissingGuid)
    assert.equal(result.some(e => e.audioUrl === "https://.../1006.mp3"), true)
}

console.log("\nAll 4 test cases passed")
