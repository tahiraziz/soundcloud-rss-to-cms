// CORS proxy for the plugin's RSS fetch. SoundCloud's feed CDN only sends
// Access-Control-Allow-Origin for a fixed partner origin, so a browser-side
// fetch() from the plugin is blocked outright. This worker fetches the feed
// server-side (not subject to CORS) and re-serves it with a permissive
// Access-Control-Allow-Origin header.
//
// Locked to feeds.soundcloud.com so this can't be used as an open proxy for
// arbitrary URLs by anyone who finds the worker's URL.
const ALLOWED_HOST = "feeds.soundcloud.com"

export default {
    async fetch(request: Request): Promise<Response> {
        const requestUrl = new URL(request.url)
        const feedUrlParam = requestUrl.searchParams.get("url")

        if (!feedUrlParam) {
            return new Response("Missing 'url' query parameter", { status: 400 })
        }

        let feedUrl: URL
        try {
            feedUrl = new URL(feedUrlParam)
        } catch {
            return new Response("Invalid 'url' query parameter", { status: 400 })
        }

        if (feedUrl.protocol !== "https:" || feedUrl.hostname !== ALLOWED_HOST) {
            return new Response(`Only https://${ALLOWED_HOST}/... URLs are allowed`, { status: 403 })
        }

        const upstreamResponse = await fetch(feedUrl.toString())
        const body = await upstreamResponse.arrayBuffer()

        return new Response(body, {
            status: upstreamResponse.status,
            headers: {
                "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "application/rss+xml",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
            },
        })
    },
}
