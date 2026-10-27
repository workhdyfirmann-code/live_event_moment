import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null
export const EVENT_ID = (import.meta.env.VITE_EVENT_ID as string | undefined)?.trim() || 'demo-event'
export const STORAGE_BUCKET = 'event-media'
export const hasBackend = Boolean(supabase && url && key)

export type Media = {
  id: string
  event_id?: string
  url: string
  name: string
  caption: string
  time: string
  type: 'photo' | 'video'
  status: 'Pending' | 'Approved' | 'Rejected'
  featured?: boolean
}

export const mediaUrl = async (path: string) => {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi')
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export const diagnostic = (event: string, details: Record<string, unknown> = {}) => console.info(`[MOMEN KITA] ${event}`, details)
export const diagnosticError = (event: string, error: unknown, details: Record<string, unknown> = {}) => console.error(`[MOMEN KITA] ${event}`, { ...details, error: error instanceof Error ? error.message : String(error) })
