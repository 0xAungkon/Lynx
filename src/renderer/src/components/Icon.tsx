interface IconProps {
  name: string
  className?: string
}

/** Renders a Material Symbols Outlined glyph by ligature name. */
export function Icon({ name, className }: IconProps): JSX.Element {
  return <span className={`material-symbols-outlined ${className ?? ''}`}>{name}</span>
}
