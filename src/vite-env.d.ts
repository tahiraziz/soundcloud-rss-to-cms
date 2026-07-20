/// <reference types="vite/client" />

interface ViteTypeOptions {
    strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
    /** Base URL of the RSS CORS proxy worker (see worker/). Optional — falls back to a direct fetch when unset. */
    readonly VITE_RSS_PROXY_URL?: string
}
