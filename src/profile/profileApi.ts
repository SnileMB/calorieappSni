/**
 * RLS-scoped read/write of the signed-in user's own `profiles` row — this is
 * the cross-device sync proof for SYNC-01. Authorization is enforced entirely
 * by the RLS policies pushed in plan 01-02 (auth.uid() = id); filtering by
 * `userId` here selects the right row, it is not the security boundary.
 */
import { supabase } from '../lib/supabase'
import { toUserMessage } from '../auth/authErrors'

export async function loadProfile(
  userId: string,
): Promise<{ displayName: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return { displayName: null, error: toUserMessage(error) }
  }

  return { displayName: data?.display_name ?? null, error: null }
}

export async function saveDisplayName(
  userId: string,
  displayName: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) {
    return { error: toUserMessage(error) }
  }

  return { error: null }
}
