# SoundCloud RSS → Framer CMS

A Framer plugin that imports SoundCloud podcast RSS episodes into a Framer CMS Managed Collection.

For the full spec and current project state, see [`PRD.md`](./PRD.md) and [`CLAUDE.md`](./CLAUDE.md) (the latter has the hard rules and gotchas discovered along the way — read it before changing anything CMS- or fetch-related).

## Setup

```bash
npm install
```

The plugin fetches the RSS feed through a small Cloudflare Worker (SoundCloud's CDN blocks direct browser-side fetches — see `CLAUDE.md` for why). To run the plugin locally you need that Worker deployed once:

```bash
cd worker
npm install
npx wrangler login       # one-time, opens a browser to authenticate with your Cloudflare account
npm run deploy           # prints a URL like https://soundcloud-rss-to-cms-proxy.<subdomain>.workers.dev
cd ..
```

Then point the plugin at it:

```bash
cp .env.example .env.local
# edit .env.local, set VITE_RSS_PROXY_URL to the URL wrangler printed
```

## Running

```bash
npm run dev
```

Then [open the plugin in Framer](https://www.framer.com/developers/plugins/quick-start#opening-in-framer), pointed at a Managed Collection.

## Useful scripts

```bash
npm run check          # typecheck + lint
npm run build           # production build

# dev-only smoke tests (plain assert scripts, no test framework — see scripts/)
npx tsx scripts/test-title-parsing.ts
npx tsx scripts/test-dedup.ts
npx tsx scripts/test-import-validation.ts
npx tsx scripts/test-fetch.ts <feed-url>   # fetches a real feed, prints parsed episodes
```

## Redeploying the Worker

If `worker/src/index.ts` changes:

```bash
cd worker
npm run deploy
```

The URL stays the same, so no `.env.local` change is needed unless you redeploy under a different name/subdomain.
