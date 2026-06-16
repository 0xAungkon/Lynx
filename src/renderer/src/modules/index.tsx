import { PagePlaceholder } from '../components/PagePlaceholder'

/**
 * Module registry. Phase 1 modules (Dashboard, CPU, GPU, Memory, Storage,
 * Network, Processes) are live; the rest remain themed placeholders filled in
 * across Phases 2–5 (see idea.md §7).
 */
export { Dashboard } from './Dashboard'
export { CpuMonitor } from './CpuMonitor'
export { GpuMonitor } from './GpuMonitor'
export { MemoryMonitor } from './MemoryMonitor'
export { StorageManager } from './StorageManager'
export { Network } from './Network'
export { ProcessManager } from './ProcessManager'
export { ServiceManager } from './ServiceManager'
export { Settings } from './Settings'

export const Logs = (): JSX.Element => (
  <PagePlaceholder title="Logs" subtitle="journalctl viewer with live tail" icon="list_alt" />
)
export const PackageManager = (): JSX.Element => (
  <PagePlaceholder title="Package Manager" subtitle="APT, Pacman, Flatpak & Snap" icon="package_2" />
)
