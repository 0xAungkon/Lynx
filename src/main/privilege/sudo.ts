import { execFile } from 'node:child_process'

export interface ExecResult {
  code: number
  stdout: string
  stderr: string
}

/** True if stderr looks like a sudo authentication failure rather than a command error. */
export function isAuthFailure(stderr: string): boolean {
  return /incorrect password|authentication failure|a password is required|sorry, try again/i.test(
    stderr
  )
}

/** True if sudo refused because it needs a controlling terminal (requiretty). */
export function isNoTtyFailure(stderr: string): boolean {
  return /a terminal is required|no tty present|sudo: a password is required/i.test(stderr)
}

/**
 * Run a command under `sudo -S`, feeding `password` to sudo on stdin so the
 * secret never touches disk, a shell, argv, or a log. `-k` ignores any cached
 * sudo timestamp so a stale ticket can't mask a wrong password; `-p ''`
 * suppresses sudo's own prompt (we collected the password in the GUI).
 *
 * The command is passed as an explicit argv array — never a shell string —
 * which removes any shell-injection surface from user-supplied unit names etc.
 */
export function sudoExec(argv: string[], password: string, timeoutMs = 15000): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = execFile(
      'sudo',
      ['-S', '-k', '-p', '', '--', ...argv],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
      }
    )
    // Feed the password, then immediately end stdin. Wrapped so a closed pipe
    // (sudo exited early) never throws into the main process.
    try {
      child.stdin?.write(`${password}\n`)
      child.stdin?.end()
    } catch {
      // sudo already gone; the callback will report the failure
    }
  })
}

/** Run a command directly as the current (unprivileged) user. */
export function userExec(argv: string[], timeoutMs = 15000): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      argv[0],
      argv.slice(1),
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = error && typeof error.code === 'number' ? error.code : error ? 1 : 0
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' })
      }
    )
  })
}
