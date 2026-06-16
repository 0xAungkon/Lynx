/**
 * Plain runtime constants shared across main, preload, and renderer.
 *
 * This module deliberately has NO dependencies (no zod) so it is safe to import
 * for its *values* from the sandboxed preload, which cannot `require()` external
 * packages. Importing a value from `@shared/ipc` instead would drag zod into the
 * preload bundle and break it ("module not found: zod").
 */

/** Main → renderer push asking the UI to collect a root password (idea.md §5). */
export const PRIVILEGE_PROMPT_CHANNEL = 'privilege:prompt'
