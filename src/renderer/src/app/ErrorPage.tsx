import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ErrorState } from '../components/ErrorState'

/** Router-level error boundary — replaces React Router's default dev screen. */
export function ErrorPage(): JSX.Element {
  const error = useRouteError()

  let title = 'Something went wrong'
  let message = 'An unexpected error occurred while rendering this view.'
  let detail: string | undefined

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    message = error.data?.toString?.() ?? message
  } else if (error instanceof Error) {
    detail = error.message
  } else if (typeof error === 'string') {
    detail = error
  }

  return (
    <ErrorState
      icon="bug_report"
      title={title}
      message={message}
      detail={detail}
      action={
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-4 py-2 font-title-sm text-title-sm text-on-primary transition-colors hover:bg-primary-fixed"
        >
          Reload
        </button>
      }
    />
  )
}
