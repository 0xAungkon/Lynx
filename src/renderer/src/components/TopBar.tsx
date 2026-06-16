import { Icon } from './Icon'

/** Fixed top app bar offset by the 72px rail. */
export function TopBar(): JSX.Element {
  return (
    <header className="fixed left-sidebar_width right-0 top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant bg-background/80 px-container_padding backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="font-headline-md text-headline-md font-bold text-primary">Lynx</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Refresh"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-primary"
        >
          <Icon name="refresh" />
        </button>
        <button
          type="button"
          title="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-primary"
        >
          <Icon name="notifications" />
        </button>
        <button
          type="button"
          title="Power"
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-primary"
        >
          <Icon name="power_settings_new" />
        </button>
      </div>
    </header>
  )
}
