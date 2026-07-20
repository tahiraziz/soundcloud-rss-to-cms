import "@framer/plugin/framer.css"

import { framer } from "@framer/plugin"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"

const activeCollection = await framer.getActiveManagedCollection()

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

createRoot(root).render(
    <StrictMode>
        <App collection={activeCollection} />
    </StrictMode>
)
