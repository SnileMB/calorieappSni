/**
 * Maps any error thrown or returned by supabase-js into exactly one of the
 * two user-facing strings from UI-SPEC.md's Copywriting Contract. Raw
 * Supabase/HTTP error text, status codes, and Postgres error codes must
 * never reach a rendered surface — this is the single funnel that enforces
 * that (T-01-10: credential and "already registered" errors collapse to the
 * same copy so account existence can't be enumerated).
 */

const CREDENTIALS_MESSAGE =
  "That email or password didn't work. Check your details and try again."
const NETWORK_MESSAGE =
  "Couldn't reach the server — check your connection and try again."

function extractMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message : null
  }

  return null
}

export function toUserMessage(error: unknown): string {
  // Logged for local debugging only — never surfaced to the UI or committed.
  console.debug('Supabase error (mapped to a generic user-facing message):', error)

  const message = extractMessage(error)

  if (message) {
    if (message.includes('Invalid login credentials')) {
      return CREDENTIALS_MESSAGE
    }
    if (message.includes('already registered')) {
      return CREDENTIALS_MESSAGE
    }
  }

  // Network/transport failures (TypeError, "Failed to fetch", "NetworkError")
  // and anything unrecognized all collapse to the same generic message.
  return NETWORK_MESSAGE
}
