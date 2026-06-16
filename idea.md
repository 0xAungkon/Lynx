# Lynx — Linux System Manager

> A modern, all-in-one desktop application for monitoring and managing Linux systems.
> Think "Task Manager + GNOME Disks + systemctl GUI + package manager + cleaner" in a
> single, cohesive, beautiful interface.

---

## 1. Product Definition

### 1.1 Vision
**Lynx** is a unified system control center for Linux desktops and workstations. It
replaces the patchwork of CLI tools (`htop`, `systemctl`, `journalctl`, `apt`/`pacman`,
`nvidia-smi`, `smartctl`, `bleachbit`, …) with one consistent, real-time graphical app.
A user should be able to see what their machine is doing and act on it — kill a runaway
process, restart a failed service, free up disk space, update packages — without opening
a terminal.

### 1.2 Target Users
- Linux desktop users who want a friendly GUI for system tasks.
- Power users / developers who want fast at-a-glance telemetry plus deep control.
- Sysadmins managing a single workstation or server with a display.

### 1.3 Target Platforms (initial)
| Family | Distros (examples) | Package backend | Service backend |
|--------|--------------------|-----------------|-----------------|
| Debian-based | Debian, Ubuntu, Linux Mint, Pop!_OS | `apt` / `dpkg` | `systemd` |
| Arch-based | Arch, Manjaro, EndeavourOS | `pacman` (+ AUR helper) | `systemd` |

Universal package backends (cross-distro): **Flatpak**, **Snap**.
The architecture abstracts the package/service backend so additional families
(Fedora/`dnf`, openSUSE/`zypper`) can be added later behind the same interface.

### 1.4 Design Language
- **Material 3 (dark)** aesthetic, sourced directly from the mockups in `designes/`.
- Color tokens: deep indigo background (`#121221`), soft blue primary (`#b5cfff`),
  green tertiary (`#a1dd9c`), red error (`#ffb4ab`), layered surface containers.
- Typography: **Inter** for UI text, **JetBrains Mono** for data/code/terminal output.
- Iconography: **Material Symbols Outlined**.
- Layout: fixed 72px left icon rail + top app bar + bento-grid content canvas.
- Motif: real-time charts, progress rings, data tables, embedded terminal/log panes.

---

## 2. Feature Modules

Each module maps to a mockup in `designes/` and to a route in the app.

| # | Module | Mockup | Core Capabilities | Needs Root? |
|---|--------|--------|-------------------|-------------|
| 1 | **Dashboard** | `dashboard.html` | At-a-glance rings (CPU/Mem/Disk/Net), system info (hostname, kernel, uptime), GPU summary, live activity log, quick actions (clean cache, kill heavy) | No (read) / some actions yes |
| 2 | **CPU Monitor** | `cpu_monitor.html` | Per-core utilization, frequency & usage history graphs, load average, processor hardware details, temperatures | No |
| 3 | **GPU Monitor** | `gpu_manager.html` | Utilization, VRAM, clock speeds, temp/fan/power, performance history, per-GPU processes, multi-GPU switch, fan control | Fan/clock control: yes |
| 4 | **Memory Monitor** | `memory_manager.html` | Physical memory & swap usage, usage history graph, top consumers (process/PID/memory), hardware layout (DIMM slots), memory tools: clear PageCache, free dentries & inodes | Clear PageCache / free dentries: yes |
| 5 | **Storage Manager** | `storage_manager.html` | Drives & partitions, capacity, I/O activity, mount/unmount, SMART health & tests, FSTRIM, clear cache | Mount/SMART/TRIM: yes |
| 6 | **Network** | (sidebar tab) | Interfaces, throughput graphs, connections, addresses | Mostly read |
| 7 | **Process Manager** | `process_manager.html` | Process list/tree, search & filter (All/My/System), sort, CPU/Mem%, status (running/sleeping/zombie), terminate/kill, change priority (renice) | Kill foreign / renice up: yes |
| 8 | **Logs** | (sidebar tab) | `journalctl` viewer, filter by unit/priority, live tail | System logs: yes |
| 9 | **Package Manager** | `package_manager.html` | Browse/search installed & available packages across **APT/Pacman/Flatpak/Snap**, filter by source, install/remove/update | Install/remove (system): yes |
| 10 | **Services Manager** | `service_manager.html` | systemd unit list, status (running/stopped/failed), start/stop/restart, enable/disable at boot, per-unit `journalctl` logs, CPU/RAM impact | Yes |
| 11 | **Cleaner** | `cleaner.html` | Scan & reclaim space: package caches (APT/Snap/pacman), thumbnails, logs, crash reports, trash; per-task selection, live progress, space breakdown | System caches/logs: yes |
| 12 | **Settings** | (sidebar tab) | Theme, refresh intervals, polling toggles, privilege preferences, distro/backend overrides, telemetry off | No |

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime / shell | **Electron** | Cross-distro native desktop, full Node.js access for system calls |
| UI library | **React 18** | Component model fits the modular sidebar/routes |
| Language | **TypeScript** (strict) | Type safety across main ⇄ preload ⇄ renderer IPC contracts |
| Build / dev | **Vite** + `electron-vite` | Fast HMR for renderer, bundling for main/preload |
| Styling | **Tailwind CSS** (Material 3 tokens) | Mockups already authored in Tailwind; port the `tailwind.config` tokens verbatim |
| Routing | **React Router** (hash/memory router) | Sidebar tab navigation |
| State / data | **Zustand** + **TanStack Query** | Zustand for UI state; Query for polled system snapshots (caching, intervals, refetch) |
| Charts | **Recharts** or **uPlot** | uPlot preferred for high-frequency time-series (CPU/GPU/IO history) |
| IPC | Electron `contextBridge` + typed `ipcRenderer.invoke` channels | Secure, contextIsolation on |
| Privilege escalation | **polkit** (`pkexec`) primary; sudo-via-PTY fallback | On-screen password prompt (see §5) |
| Packaging | **electron-builder** → `.deb`, `.pacman`/`.tar.zst`, AppImage | Native installers for both target families |
| Testing | **Vitest** (unit), **Playwright** (e2e against Electron) | |
| Lint/format | ESLint + Prettier | |

### 3.1 Key System Data Sources
- **CPU/Mem/Load:** `/proc/stat`, `/proc/meminfo`, `/proc/loadavg`, `/proc/cpuinfo`.
- **Temps/fans:** `/sys/class/hwmon`, `lm-sensors`.
- **Processes:** `/proc/<pid>/{stat,status,cmdline}` (build tree from PPID).
- **GPU:** `nvidia-smi` (NVIDIA), `/sys/class/drm` + `radeontop`/sysfs (AMD), Intel via sysfs.
- **Storage:** `lsblk`, `/proc/diskstats`, `smartctl` (smartmontools), `df`, `findmnt`.
- **Network:** `/proc/net/dev`, `ip`, `ss`.
- **Services:** `systemctl` (JSON via `--output=json`), `journalctl -o json`.
- **Packages:** `dpkg-query`/`apt`, `pacman -Q`/`-Sy`, `flatpak`, `snap`.

Prefer reading `/proc` & `/sys` and `D-Bus` (systemd, UDisks2) directly over shelling out
where practical; shell out only where there is no clean programmatic interface.

---

## 4. Architecture

### 4.1 Process Model
```
┌──────────────────────────────────────────────────────────────────┐
│ Electron App (Lynx)                                                │
│                                                                    │
│  ┌────────────────┐   contextBridge    ┌───────────────────────┐  │
│  │  Renderer       │  (typed, async)    │  Preload (isolated)   │  │
│  │  React + TS UI  │ <───────────────►  │  window.lynx.* API    │  │
│  │  Tailwind/M3    │   ipcRenderer      │  exposes invoke/on    │  │
│  └────────────────┘   .invoke / .on     └───────────┬───────────┘  │
│                                                      │ IPC          │
│                                          ┌───────────▼───────────┐  │
│                                          │  Main process (Node)  │  │
│                                          │  - IPC router         │  │
│                                          │  - Collector services │  │
│                                          │  - Backend adapters   │  │
│                                          │  - Privilege manager  │  │
│                                          └───────────┬───────────┘  │
└──────────────────────────────────────────────────────┼─────────────┘
                                                         │ spawn / D-Bus
                            ┌────────────────────────────▼───────────────────────────┐
                            │ System: /proc, /sys, systemd, polkit, pkexec, CLIs      │
                            │ (apt/pacman/flatpak/snap, smartctl, nvidia-smi, …)      │
                            └─────────────────────────────────────────────────────────┘
```

- **Security baseline:** `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true` for the renderer. The renderer never touches Node/system APIs
  directly — only the curated `window.lynx` surface from preload.
- **No remote content** is loaded; all UI is local. CSP locks the renderer down.

### 4.2 Main-Process Internal Layers
1. **IPC Router** — registers `ipcMain.handle(channel, …)` for each typed channel;
   validates payloads (zod schemas) before dispatching.
2. **Collectors** — one per domain (CpuCollector, MemCollector, GpuCollector,
   ProcCollector, DiskCollector, NetCollector). Each exposes `snapshot()` and an
   optional `subscribe(intervalMs)` that pushes updates to the renderer over an event
   channel. Polling intervals are configurable in Settings.
3. **Backend Adapters (Strategy pattern)** — the cross-distro abstraction:
   - `PackageBackend` interface → `AptBackend`, `PacmanBackend`, `FlatpakBackend`,
     `SnapBackend`. A `PackageService` fans out queries and merges results tagged by source.
   - `ServiceBackend` interface → `SystemdBackend` (initial; `runit`/`openrc` later).
   - Distro detection at startup via `/etc/os-release` (`ID`, `ID_LIKE`) selects the
     default system package/service backend.
4. **Privilege Manager** — single chokepoint for any operation needing elevation
   (see §5). All privileged actions route through it; collectors that only *read*
   `/proc`/`/sys` never do.
5. **Action Executors** — perform the actual mutations (kill PID, renice, systemctl
   start/stop, package install, drop_caches, fstrim, mount), each declaring whether it
   `requiresRoot`.

### 4.3 Typed IPC Contract
A shared `@lynx/ipc` types package defines channels and payloads, e.g.:
```ts
// query (renderer → main, awaits result)
'cpu:snapshot'        → CpuSnapshot
'proc:list'           (filter) → ProcessNode[]
'service:list'        → ServiceUnit[]
'package:search'      (q, sources) → PackageResult[]

// command (may require root)
'proc:kill'           ({ pid, signal }) → ActionResult
'service:control'     ({ unit, op })    → ActionResult   // start|stop|restart|enable|disable
'package:install'     ({ id, source })  → ActionResult
'cleaner:run'         ({ tasks })        → ActionResult

// streams (main → renderer, push)
'stream:cpu' | 'stream:proc' | 'stream:cleaner-progress' | 'stream:logs'
```
`ActionResult = { ok: boolean; usedPrivilege: 'root' | 'user'; stdout?; stderr?; error? }`
— note `usedPrivilege` so the UI can show whether the action ran elevated or degraded.

---

## 5. Privilege & Root-Password Handling  *(required behavior)*

Many Lynx actions need root (kill a process owned by another user, control system
services, install/remove system packages, drop caches, run SMART/TRIM, mount). Lynx
treats elevation as an **opportunistic, non-blocking** step:

### 5.1 Rule
> **If root permission is not already granted and an action needs it, Lynx prompts for
> the root password on screen to execute the action. If the root password is not
> provided (cancelled or left empty), Lynx continues anyway — but with user
> privileges**, performing whatever subset of the action is possible without root and
> clearly reporting the degraded outcome.

### 5.2 Flow
```
Action requested
      │
      ▼
requiresRoot? ──no──► run as current user ──► return { ok, usedPrivilege: 'user' }
      │yes
      ▼
already elevated this session? ──yes──► run elevated ──► { ok, usedPrivilege: 'root' }
      │no
      ▼
Show on-screen Root Password dialog  (Material 3 modal)
      │
 ┌────┴───────────────┐
 │ password entered   │ cancelled / empty
 ▼                    ▼
Validate & run        Do NOT abort the whole action.
elevated via polkit/  Fall back to user-privilege execution:
sudo. On success →      • run the user-scoped portion (e.g. kill own PID,
{ok, 'root'}.            query-only, user-level flatpak/snap)
On auth failure →       • skip the parts that truly need root
re-prompt or fall       • return { ok: <partial>, usedPrivilege: 'user',
back to user mode.        note: "ran without root; X skipped" }
                        UI shows a non-blocking banner: "Performed with user
                        privileges — some operations were skipped."
```

### 5.3 Mechanism
- **Primary:** **polkit** via `pkexec`. Ship a polkit policy (`.policy`) declaring Lynx's
  privileged actions; `pkexec` triggers the desktop's own authentication agent. Where
  the polkit agent renders its own dialog, Lynx defers to it; where Lynx must collect
  the secret itself, it uses the in-app modal below.
- **Fallback:** `sudo` driven over a PTY (`sudo -S` / node-pty) so the password Lynx
  collected on screen is fed to `sudo` without ever hitting disk or logs.
- **Session caching:** after a successful elevation, keep a short-lived privileged
  capability (configurable timeout, default ~5 min, like sudo's timestamp) so the user
  isn't re-prompted for every click. Cleared on lock/quit.
- **Secret hygiene:** the password is held only transiently in main-process memory,
  passed to the auth mechanism, then zeroed. It is **never** persisted, logged, sent
  over plain IPC return values, or written to the renderer. The renderer only ever sees
  `usedPrivilege` and a success/skip summary.
- **Settings toggle:** users may choose "Always try polkit", "Ask each time", or
  "Never elevate (user-only mode)" — in user-only mode the password prompt is skipped
  entirely and privileged actions are always reported as skipped/degraded.

### 5.4 On-Screen Root Password Dialog (spec)
- Material 3 modal matching the dark theme; masked input, "Authenticate" + "Continue
  without root" buttons (cancel ≡ continue without root).
- States: prompt → validating → error (wrong password, re-prompt up to N tries) →
  success. Esc / "Continue without root" = proceed in user mode.
- Clearly names *which action* and *why root is needed* (e.g. "Restart
  `postgresql.service` requires administrator access").

---

## 6. Proposed Project Structure
```
Lynx_v2/
├── idea.md                     # this document
├── designes/                   # source HTML/Tailwind mockups (reference)
├── package.json
├── electron.vite.config.ts
├── tailwind.config.ts          # ported Material 3 tokens from mockups
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts
│   │   ├── ipc/                # ipcMain.handle routers + zod validation
│   │   ├── collectors/         # cpu, mem, gpu, proc, disk, net
│   │   ├── backends/
│   │   │   ├── package/        # apt, pacman, flatpak, snap + PackageService
│   │   │   └── service/        # systemd + ServiceService
│   │   ├── privilege/          # PrivilegeManager (polkit/pkexec/sudo-pty)
│   │   ├── actions/            # executors (kill, renice, systemctl, install, clean…)
│   │   └── platform/           # os-release distro detection, capability probing
│   ├── preload/
│   │   └── index.ts            # contextBridge → window.lynx
│   ├── shared/                 # @lynx/ipc types, zod schemas, constants
│   └── renderer/               # React + TS UI
│       ├── main.tsx
│       ├── app/                # router, layout (sidebar rail + top bar)
│       ├── theme/              # Tailwind/M3 tokens, fonts
│       ├── components/         # rings, charts, data tables, terminal pane, modals
│       │   └── RootPasswordDialog.tsx
│       └── modules/            # dashboard, cpu, gpu, memory, storage, network,
│                               #   processes, logs, packages, services, cleaner, settings
├── resources/
│   └── com.lynx.policy         # polkit policy
└── build/                      # electron-builder config & icons
```

---

## 7. Implementation Roadmap

**Phase 0 — Foundations**
- Scaffold `electron-vite` + React + TS (strict) + Tailwind; port Material 3 tokens
  from the mockups into `tailwind.config.ts`. Wire fonts (Inter, JetBrains Mono).
- Build the app shell: 72px icon rail, top app bar, routing, dark theme.
- Establish secure IPC baseline (contextIsolation/sandbox) + typed `@lynx/ipc` package.

**Phase 1 — Read-only telemetry (no root)**
- Collectors for CPU, Memory, Storage, Network, Processes (tree), GPU.
- Dashboard, CPU Monitor, Memory Monitor, Storage (read), Process
  Manager (read/sort/filter/search), GPU Monitor. Live streams + charts.

**Phase 2 — Privilege manager + first mutations**
- Implement PrivilegeManager (polkit/pkexec primary, sudo-PTY fallback) and the
  on-screen Root Password Dialog with the §5 fallback-to-user behavior.
- First privileged actions: process kill/terminate/renice; Services Manager
  (start/stop/restart/enable/disable + per-unit journal logs).

**Phase 3 — Package management**
- Backend adapters: AptBackend, PacmanBackend, FlatpakBackend, SnapBackend + merged
  PackageService; distro detection chooses system backend. Package Manager UI
  (search/filter by source/install/remove/update) routed through PrivilegeManager.

**Phase 4 — Cleaner, Logs, Storage actions**
- Cleaner: scan tasks (caches/thumbnails/logs/crash/trash), space breakdown, live
  progress, selective clean.
- Logs (journalctl viewer + live tail). Storage actions: mount/unmount, SMART tests,
  FSTRIM, drop_caches.

**Phase 5 — Settings, packaging, hardening**
- Settings (intervals, theme, privilege mode, backend overrides).
- electron-builder targets: `.deb` (Debian family) + `.tar.zst`/AppImage (Arch family),
  ship polkit policy.
- Tests (Vitest + Playwright), security review, CSP, secret-hygiene audit.

---

## 8. Open Questions / Risks
- **AUR support** — read/list is easy; building AUR packages needs an AUR helper (`yay`/
  `paru`) and is out of scope for v1 (system `pacman` only initially).
- **GPU coverage** — NVIDIA via `nvidia-smi` is straightforward; AMD/Intel telemetry and
  especially fan/clock *control* vary widely by driver — scope control features per vendor.
- **polkit vs sudo availability** — minimal/headless installs may lack a polkit agent;
  the sudo-PTY fallback covers these, and user-only mode covers locked-down setups.
- **Wayland vs X11** — telemetry is unaffected, but verify the password modal and window
  behavior under both session types.
- **Snap/Flatpak optional** — detect presence; hide/disable those sources when not installed.
