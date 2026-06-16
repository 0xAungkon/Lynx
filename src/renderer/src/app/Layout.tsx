import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { ToastProvider } from '../components/Toast'
import { PrivilegeProvider } from './PrivilegeProvider'
import { SettingsProvider } from './SettingsProvider'

/** App shell: rail + top bar + scrollable content canvas. */
export function Layout(): JSX.Element {
  return (
    <SettingsProvider>
      <PrivilegeProvider>
        <ToastProvider>
          <div className="h-screen bg-background text-on-surface">
            <Sidebar />
            <TopBar />
            <main className="ml-sidebar_width h-screen overflow-y-auto px-container_padding pb-12 pt-24">
              <Outlet />
            </main>
          </div>
        </ToastProvider>
      </PrivilegeProvider>
    </SettingsProvider>
  )
}
