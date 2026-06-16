import { NavLink } from 'react-router-dom'
import { NAV_ITEMS, SETTINGS_ITEM, type NavItem } from '../app/navigation'
import { Icon } from './Icon'

function RailLink({ item }: { item: NavItem }): JSX.Element {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      title={item.label}
      className={({ isActive }) =>
        [
          'group relative flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200',
          isActive
            ? 'bg-primary text-on-primary shadow-sm scale-95'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'
        ].join(' ')
      }
    >
      <Icon name={item.icon} />
      <span className="absolute left-14 z-50 hidden whitespace-nowrap rounded border border-outline-variant bg-surface-container-high px-2 py-1 font-label-caps text-label-caps text-on-surface shadow-sm group-hover:block">
        {item.label}
      </span>
    </NavLink>
  )
}

/** Fixed 72px icon rail, matching the mockups. */
export function Sidebar(): JSX.Element {
  return (
    <nav className="fixed left-0 top-0 z-20 flex h-screen w-sidebar_width flex-col items-center gap-stack_gap border-r border-outline-variant bg-background pt-6">
      {NAV_ITEMS.map((item) => (
        <RailLink key={item.path} item={item} />
      ))}
      <div className="flex-grow" />
      <div className="mb-6">
        <RailLink item={SETTINGS_ITEM} />
      </div>
    </nav>
  )
}
