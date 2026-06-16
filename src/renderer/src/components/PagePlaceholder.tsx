import { Icon } from './Icon'

interface PagePlaceholderProps {
  title: string
  subtitle: string
  icon: string
}

/** Themed stub for modules not yet implemented (Phase 1+). */
export function PagePlaceholder({ title, subtitle, icon }: PagePlaceholderProps): JSX.Element {
  return (
    <section>
      <div className="mb-8">
        <h1 className="font-display-lg text-display-lg text-on-surface">{title}</h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-outline-variant bg-surface-container p-card_padding py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-variant text-primary">
          <Icon name={icon} className="text-[32px]" />
        </div>
        <p className="font-title-sm text-title-sm text-on-surface">Coming in a later phase</p>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          The {title} module is scaffolded and routed. Its live data and controls land in the
          upcoming implementation phases.
        </p>
      </div>
    </section>
  )
}
