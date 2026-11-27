import { createClient } from '@supabase/supabase-js'
import { emptyWorkspace, parseWorkspace, type Workspace } from './workspace'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase =
  url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null

export class WorkspaceConflict extends Error {
  constructor() {
    super(
      'Another device changed your workspace. Your edits are kept here. Export a backup or load the online version.',
    )
  }
}

export async function loadCloudWorkspace(userId: string) {
  if (!supabase) throw new Error('Cloud saving is not configured.')
  const { data, error } = await supabase
    .from('workspaces')
    .select('data, revision')
    .eq('user_id', userId)
    .maybeSingle()
  if (error)
    throw new Error(
      'Could not load your online workspace. Check your connection and retry.',
    )
  if (!data) return { data: emptyWorkspace, revision: 0 }
  if (!Number.isInteger(data.revision) || data.revision < 1)
    throw new Error(
      'Your online workspace could not be read. Export a backup before continuing.',
    )
  return {
    data: parseWorkspace(JSON.stringify(data.data)),
    revision: data.revision as number,
  }
}

export async function saveCloudWorkspace(
  userId: string,
  workspace: Workspace,
  revision: number,
) {
  if (!supabase) throw new Error('Cloud saving is not configured.')
  const { data, error } = await supabase.rpc('save_workspace', {
    p_user_id: userId,
    p_data: parseWorkspace(JSON.stringify(workspace)),
    p_revision: revision,
  })
  if (error?.code === '40001') throw new WorkspaceConflict()
  if (error)
    throw new Error(
      'Could not save online. Your edits are kept on this device. Check your connection and retry.',
    )
  if (!Number.isInteger(data) || data !== revision + 1)
    throw new Error(
      'Could not confirm the online save. Your edits are kept on this device.',
    )
  return data as number
}
