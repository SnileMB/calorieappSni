import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))
const upsertMock = vi.fn()
const fromMock = vi.fn(() => ({ select: selectMock, upsert: upsertMock }))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

const { loadProfile, saveDisplayName } = await import('../profileApi')

beforeEach(() => {
  vi.clearAllMocks()
  eqMock.mockImplementation(() => ({ maybeSingle: maybeSingleMock }))
  selectMock.mockImplementation(() => ({ eq: eqMock }))
  fromMock.mockImplementation(() => ({ select: selectMock, upsert: upsertMock }))
})

describe('loadProfile', () => {
  it('returns the display_name for the row whose id matches the given userId', async () => {
    maybeSingleMock.mockResolvedValue({ data: { display_name: 'Alex' }, error: null })

    const result = await loadProfile('user-1')

    expect(fromMock).toHaveBeenCalledWith('profiles')
    expect(selectMock).toHaveBeenCalledWith('display_name')
    expect(eqMock).toHaveBeenCalledWith('id', 'user-1')
    expect(result).toEqual({ displayName: 'Alex', error: null })
  })

  it('resolves a missing row to { displayName: null, error: null }, not an error', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    const result = await loadProfile('user-2')

    expect(result).toEqual({ displayName: null, error: null })
  })

  it('maps a returned supabase error through toUserMessage', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: new Error('NetworkError when attempting to fetch resource'),
    })

    const result = await loadProfile('user-3')

    expect(result.displayName).toBeNull()
    expect(result.error).toBe(
      "Couldn't reach the server — check your connection and try again.",
    )
  })
})

describe('saveDisplayName', () => {
  it('upserts on the id column so first save inserts and later saves update', async () => {
    upsertMock.mockResolvedValue({ data: null, error: null })

    const result = await saveDisplayName('user-1', 'New Name')

    expect(fromMock).toHaveBeenCalledWith('profiles')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', display_name: 'New Name' }),
      expect.objectContaining({ onConflict: 'id' }),
    )
    expect(result).toEqual({ error: null })
  })

  it('maps a returned supabase error through toUserMessage before returning', async () => {
    upsertMock.mockResolvedValue({ data: null, error: new Error('Invalid login credentials') })

    const result = await saveDisplayName('user-1', 'New Name')

    expect(result.error).toBe(
      "That email or password didn't work. Check your details and try again.",
    )
  })
})
