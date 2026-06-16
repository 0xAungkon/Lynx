/**
 * The module registry — single source for both the sidebar rail and the router.
 * `icon` is the Material Symbols Outlined ligature used in the mockups.
 */
export interface NavItem {
  path: string
  label: string
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/cpu', label: 'CPU', icon: 'memory' },
  { path: '/gpu', label: 'GPU', icon: 'videogame_asset' },
  { path: '/memory', label: 'Memory', icon: 'storage' },
  { path: '/storage', label: 'Storage', icon: 'hard_drive' },
  { path: '/network', label: 'Network', icon: 'language' },
  { path: '/processes', label: 'Processes', icon: 'terminal' },
  { path: '/services', label: 'Services', icon: 'settings_suggest' }
]

/** Settings sits pinned at the bottom of the rail. */
export const SETTINGS_ITEM: NavItem = { path: '/settings', label: 'Settings', icon: 'settings' }
