import type {
    FieldDataInput,
    ManagedCollection,
    ManagedCollectionFieldInput,
    ManagedCollectionItemInput,
} from "@framer/plugin"
import { deriveEpisodeId } from "./dedup"
import type { ParsedEpisode } from "./rss"
import { getSpecialsCount, resolveSeasonInfo, setSpecialsCount, type ResolvedEpisode } from "./seasonLabeling"

// Idempotent — safe to call on every plugin open. setFields() re-declares
// this exact set of fields each time; omitted fields would be removed, but
// we always pass the full set, so this is a no-op when fields already match.
//
// Season/Episode Number/Sort Order are deliberately NOT userEditable: per
// the SDK's own setFields() doc comment, a userEditable field "can no
// longer have their values set by the plugin when using addItems" — that
// blocks the plugin from populating it even on first creation, not just on
// update. Our real protection against overwriting user edits is the dedup
// skip (we never call addItems on an id that already exists in the
// collection), so this flag would add no protection while breaking initial
// population.
export const COLLECTION_FIELDS: ManagedCollectionFieldInput[] = [
    { id: "title", name: "Title", type: "string" },
    { id: "subtitle", name: "Subtitle", type: "string" },
    { id: "notes", name: "Notes", type: "formattedText" },
    { id: "audioUrl", name: "Audio URL", type: "string" },
    { id: "episodeArt", name: "Episode Art", type: "image" },
    { id: "publishedDate", name: "Published Date", type: "date" },
    { id: "season", name: "Season", type: "string" },
    { id: "episodeNumber", name: "Episode Number", type: "number" },
    { id: "sortOrder", name: "Season Sort Order", type: "number" },
]

function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    return slug || "episode"
}

// Titles repeat across episodes in this feed (e.g. multiple episodes named
// "Mercy" in different seasons) — Framer rejects a slug collision outright,
// so every slug is disambiguated. Regular episodes use season/episode
// (readable, matches how the show identifies episodes — e.g. "mercy-s7-e3").
// Special Episodes use their assigned sequence number instead, with the
// title omitted entirely — some special titles are long, and the number
// alone is already guaranteed unique.
function buildSlug(episode: ParsedEpisode, resolved: ResolvedEpisode): string {
    if (episode.season !== null && episode.episode !== null) {
        return `${slugify(episode.title)}-s${episode.season}-e${episode.episode}`
    }
    return `specialepisodes-${resolved.episodeNumber}`
}

function buildFieldData(episode: ParsedEpisode, resolved: ResolvedEpisode, includeArt: boolean): FieldDataInput {
    const fieldData: FieldDataInput = {
        title: { type: "string", value: episode.title },
        subtitle: { type: "string", value: episode.subtitle },
        notes: { type: "formattedText", value: episode.notes },
        audioUrl: { type: "string", value: episode.audioUrl },
        publishedDate: { type: "date", value: episode.pubDate ? new Date(episode.pubDate).toISOString() : null },
        season: { type: "string", value: resolved.seasonLabel },
        episodeNumber: { type: "number", value: resolved.episodeNumber },
        sortOrder: { type: "number", value: resolved.sortOrder },
    }

    if (includeArt && episode.artUrl) {
        fieldData.episodeArt = { type: "image", value: episode.artUrl }
    }

    return fieldData
}

export function buildItemInput(episode: ParsedEpisode, resolved: ResolvedEpisode, includeArt = true): ManagedCollectionItemInput {
    return {
        id: deriveEpisodeId(episode),
        slug: buildSlug(episode, resolved),
        fieldData: buildFieldData(episode, resolved, includeArt),
    }
}

export type ImportItemStatus = "success" | "success-no-image" | "skipped" | "failed"

export interface ImportItemResult {
    episode: ParsedEpisode
    status: ImportItemStatus
    error?: string
}

export interface ImportSummary {
    results: ImportItemResult[]
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

// PRD §7: an item missing a required field is skipped (not attempted, not
// counted as a failure) and surfaced in the result summary. Framer itself
// won't reject these — none of COLLECTION_FIELDS are marked `required`, and
// slug/title text fields are just plain strings — so this has to be our own
// check, not something the CMS API would catch for us.
export function missingRequiredFieldReason(episode: ParsedEpisode): string | null {
    if (!episode.title.trim()) return "Missing title"
    if (!episode.audioUrl) return "Missing audio enclosure"
    return null
}

// Imports one episode at a time as a fallback after a batch failure, so one
// bad item (e.g. a broken Episode Art URL) can't take the rest of the batch
// down with it. If an item fails with its image included, retries once
// without the image before giving up on it entirely (PRD §7).
async function importItemsIndividually(
    collection: ManagedCollection,
    newEpisodes: ParsedEpisode[],
    resolvedById: Map<string, ResolvedEpisode>
): Promise<ImportItemResult[]> {
    const results: ImportItemResult[] = []

    for (const episode of newEpisodes) {
        const resolved = resolvedById.get(deriveEpisodeId(episode))
        if (!resolved) throw new Error("Logic error: missing resolved season info for episode")

        const item = buildItemInput(episode, resolved)
        try {
            await collection.addItems([item])
            results.push({ episode, status: "success" })
            continue
        } catch (itemError) {
            console.error(`Failed to import "${episode.title}":`, itemError)
        }

        if (!episode.artUrl) {
            results.push({ episode, status: "failed", error: "Failed to import this episode." })
            continue
        }

        try {
            await collection.addItems([buildItemInput(episode, resolved, false)])
            results.push({ episode, status: "success-no-image" })
        } catch (noArtError) {
            console.error(`Failed to import "${episode.title}" even without Episode Art:`, noArtError)
            results.push({ episode, status: "failed", error: toErrorMessage(noArtError) })
        }
    }

    return results
}

export async function importEpisodes(collection: ManagedCollection, newEpisodes: ParsedEpisode[]): Promise<ImportSummary> {
    await collection.setFields(COLLECTION_FIELDS)

    const existingItemIds = await collection.getItemIds()

    const results: ImportItemResult[] = []
    const validEpisodes: ParsedEpisode[] = []
    for (const episode of newEpisodes) {
        const skipReason = missingRequiredFieldReason(episode)
        if (skipReason) {
            results.push({ episode, status: "skipped", error: skipReason })
        } else {
            validEpisodes.push(episode)
        }
    }

    if (validEpisodes.length > 0) {
        const currentSpecialsCount = await getSpecialsCount(collection)
        const { resolved, newSpecialsCount } = resolveSeasonInfo(validEpisodes, currentSpecialsCount)
        const resolvedById = new Map(resolved.map(r => [deriveEpisodeId(r.episode), r]))

        try {
            await collection.addItems(
                validEpisodes.map(episode => {
                    const info = resolvedById.get(deriveEpisodeId(episode))
                    if (!info) throw new Error("Logic error: missing resolved season info for episode")
                    return buildItemInput(episode, info)
                })
            )
            results.push(...validEpisodes.map(episode => ({ episode, status: "success" as const })))
        } catch (batchError) {
            console.error("Batch import failed, retrying items individually:", batchError)
            results.push(...(await importItemsIndividually(collection, validEpisodes, resolvedById)))
        }

        // Advances even if some items above failed, so a Special Episodes
        // number is never reused across runs — the small chance of a
        // permanent gap in the sequence is harmless, unlike a duplicate
        // would be.
        if (newSpecialsCount > currentSpecialsCount) {
            await setSpecialsCount(collection, newSpecialsCount)
        }
    }

    const importedIds = results
        .filter(result => result.status === "success" || result.status === "success-no-image")
        .map(result => deriveEpisodeId(result.episode))

    // New episodes are always newer than everything already in the
    // collection (feed is newest-first, and the dedup step only surfaces
    // episodes not already present), so prepending them onto the existing
    // order keeps the whole collection newest-to-oldest without depending
    // on addItems()'s own (undocumented) insertion order.
    if (importedIds.length > 0) {
        await collection.setItemOrder([...importedIds, ...existingItemIds])
    }

    return { results }
}
