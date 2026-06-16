import { createHashRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { ErrorPage } from './ErrorPage'
import {
  Dashboard,
  CpuMonitor,
  GpuMonitor,
  MemoryMonitor,
  StorageManager,
  Network,
  ProcessManager,
  Logs,
  PackageManager,
  ServiceManager,
  Settings
} from '../modules'

/** Hash router — robust for the file:// renderer in packaged builds. */
export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'cpu', element: <CpuMonitor /> },
      { path: 'gpu', element: <GpuMonitor /> },
      { path: 'memory', element: <MemoryMonitor /> },
      { path: 'storage', element: <StorageManager /> },
      { path: 'network', element: <Network /> },
      { path: 'processes', element: <ProcessManager /> },
      { path: 'logs', element: <Logs /> },
      { path: 'packages', element: <PackageManager /> },
      { path: 'services', element: <ServiceManager /> },
      { path: 'settings', element: <Settings /> }
    ]
  }
])
