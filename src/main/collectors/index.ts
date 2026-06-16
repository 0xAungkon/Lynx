import { CpuCollector } from './cpu'
import { MemoryCollector } from './memory'
import { DiskCollector } from './disk'
import { NetCollector } from './net'
import { ProcCollector } from './proc'
import { GpuCollector } from './gpu'

/**
 * Long-lived collector singletons. CPU, disk, net and proc collectors are
 * stateful — they diff each snapshot against the previous read to derive
 * instantaneous rates — so a single instance must persist across IPC calls.
 */
export const collectors = {
  cpu: new CpuCollector(),
  memory: new MemoryCollector(),
  disk: new DiskCollector(),
  net: new NetCollector(),
  proc: new ProcCollector(),
  gpu: new GpuCollector()
}
