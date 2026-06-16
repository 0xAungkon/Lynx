import type { Config } from 'tailwindcss'

/**
 * Material 3 (dark) design tokens, ported verbatim from the source mockups in
 * `designes/`. Keep this in sync with the mockups — it is the single source of
 * truth for Lynx's visual language.
 */
const config: Config = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'on-tertiary-fixed': '#002205',
        'surface-container-lowest': '#0d0d1c',
        'on-surface-variant': '#c3c6d2',
        background: '#121221',
        'inverse-on-surface': '#2f2f40',
        error: '#ffb4ab',
        'surface-dim': '#121221',
        'on-secondary-container': '#b4b3ca',
        'on-background': '#e3e0f7',
        'on-primary': '#003062',
        'tertiary-fixed-dim': '#99d595',
        'secondary-fixed-dim': '#c5c4dc',
        surface: '#121221',
        'inverse-primary': '#305f9f',
        'on-primary-fixed': '#001b3c',
        'secondary-container': '#444558',
        primary: '#b5cfff',
        'secondary-fixed': '#e1e0f8',
        'on-error-container': '#ffdad6',
        'error-container': '#93000a',
        'surface-container-high': '#292839',
        'surface-variant': '#333344',
        'on-tertiary-container': '#174f1e',
        'surface-container-low': '#1a1a2a',
        'on-surface': '#e3e0f7',
        'on-tertiary-fixed-variant': '#19511f',
        'surface-tint': '#a8c8ff',
        'on-tertiary': '#00390c',
        'on-primary-container': '#094583',
        'tertiary-fixed': '#b4f2af',
        'surface-bright': '#383849',
        'on-secondary-fixed-variant': '#444558',
        'outline-variant': '#424750',
        'inverse-surface': '#e3e0f7',
        'on-primary-fixed-variant': '#0e4685',
        secondary: '#c5c4dc',
        'surface-container': '#1e1e2e',
        'on-error': '#690005',
        'primary-fixed': '#d5e3ff',
        'tertiary-container': '#86c182',
        'surface-container-highest': '#333344',
        tertiary: '#a1dd9c',
        'primary-container': '#89b4fa',
        'primary-fixed-dim': '#a8c8ff',
        'on-secondary': '#2e2f41',
        'on-secondary-fixed': '#191a2b',
        outline: '#8d919b'
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      },
      spacing: {
        sidebar_width: '72px',
        container_padding: '24px',
        stack_gap: '8px',
        grid_gutter: '16px',
        card_padding: '20px'
      },
      fontFamily: {
        'data-mono': ['JetBrains Mono', 'monospace'],
        'code-terminal': ['JetBrains Mono', 'monospace'],
        'display-lg': ['Inter', 'sans-serif'],
        'headline-md': ['Inter', 'sans-serif'],
        'title-sm': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'label-caps': ['Inter', 'sans-serif']
      },
      fontSize: {
        'data-mono': ['13px', { lineHeight: '18px', fontWeight: '500' }],
        'code-terminal': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'display-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'title-sm': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-caps': ['11px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '700' }]
      }
    }
  },
  plugins: []
}

export default config
