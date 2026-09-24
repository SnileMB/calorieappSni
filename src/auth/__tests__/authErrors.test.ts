import { describe, expect, it, vi } from 'vitest'
import { toUserMessage } from '../authErrors'

const CREDENTIALS_MESSAGE =
  "That email or password didn't work. Check your details and try again."
const NETWORK_MESSAGE = "Couldn't reach the server — check your connection and try again."

describe('toUserMessage', () => {
  it('maps "Invalid login credentials" to the credentials message', () => {
    expect(toUserMessage(new Error('Invalid login credentials'))).toBe(CREDENTIALS_MESSAGE)
  })

  it('maps "already registered" to the same credentials message (never leaks account existence)', () => {
    expect(toUserMessage(new Error('User already registered'))).toBe(CREDENTIALS_MESSAGE)
  })

  it('maps a TypeError "Failed to fetch" to the network message', () => {
    expect(toUserMessage(new TypeError('Failed to fetch'))).toBe(NETWORK_MESSAGE)
  })

  it('maps a NetworkError to the network message', () => {
    expect(toUserMessage(new Error('NetworkError when attempting to fetch resource'))).toBe(
      NETWORK_MESSAGE,
    )
  })

  it('maps any unrecognized error to the network message and never returns raw error text', () => {
    const message = toUserMessage(new Error('some totally unexpected internal failure'))
    expect(message).toBe(NETWORK_MESSAGE)
    expect(message).not.toContain('unexpected internal failure')
  })

  it('never returns a string containing an HTTP status code or Postgres error code', () => {
    const error = { message: 'PGRST116 - 406 Not Acceptable', code: 'PGRST116', status: 406 }
    const message = toUserMessage(error)
    expect(message).not.toMatch(/\d{3}/)
    expect(message).not.toContain('PGRST116')
  })

  it('logs the raw error via console.debug for local diagnosis only', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    toUserMessage(new Error('Invalid login credentials'))
    expect(debugSpy).toHaveBeenCalled()
    debugSpy.mockRestore()
  })
})
