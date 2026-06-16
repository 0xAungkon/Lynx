import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { ErrorState } from './components/ErrorState'
import { hasBridge } from './lib/lynx'
import './theme/index.css'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

if (hasBridge()) {
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  )
} else {
  // The preload bridge is missing — almost always because the dev server URL was
  // opened in a normal browser tab. Lynx needs Electron's privileged main process.
  root.render(
    <React.StrictMode>
      <ErrorState
        icon="desktop_access_disabled"
        title="Open Lynx as a desktop app"
        message="This page is the Lynx renderer, which needs the Electron desktop shell to talk to your system. Launch it with “npm run dev” and use the window it opens — not the browser tab at this URL."
        detail="window.lynx bridge not found"
      />
    </React.StrictMode>
  )
}
