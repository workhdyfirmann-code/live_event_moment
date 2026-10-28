import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { EVENT_ID, FRAME_BUCKET, STORAGE_BUCKET, diagnostic, diagnosticError, frameSignedUrl, mediaUrl, supabase } from './lib/supabase'

type Status = 'pending' | 'approved' | 'rejected'
type FrameStyle = 'gold' | 'charcoal' | 'minimal' | 'none'
type FrameSettings = { style: FrameStyle; url: string; path: string; enabled: boolean; version: number }
type EventConfig = { name: string; eventDate: string; venue: string; displayTitle: string; showGuestName: boolean; showCaption: boolean }
type Media = {
  id: string | number
  storagePath?: string
  url: string
  name: string
  caption: string
  time: string
  type: 'photo' | 'video'
  status: Status
  featured?: boolean
}

const initialMedia: Media[] = []

const fromRow = async (row: any): Promise<Media> => ({ id: row.id, storagePath: row.framed_storage_path || row.storage_path, url: await mediaUrl(row.framed_storage_path || row.storage_path), name: row.guest_name || 'Tamu', caption: row.caption || 'Momen indah', time: new Date(row.created_at).toLocaleString('id-ID'), type: row.media_type, status: String(row.moderation_status).toLowerCase() as Status, featured: row.is_featured })
async function fetchMedia(approvedOnly = false) {
  if (!supabase) throw new Error('Backend belum dikonfigurasi. Isi VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, dan VITE_EVENT_ID di Vercel.')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(EVENT_ID)) throw new Error('VITE_EVENT_ID harus berisi UUID event Supabase yang valid.')
  const query = supabase.from('media_uploads').select('*').eq('event_id', EVENT_ID).order('created_at', { ascending: false })
  const { data, error } = approvedOnly ? await query.eq('moderation_status', 'approved').eq('processing_status', 'completed') : await query
  if (error) throw error
  diagnostic('MEDIA_FETCH_SUCCESS', { eventId: EVENT_ID, count: data?.length || 0, approvedOnly })
  return Promise.all((data || []).map(fromRow))
}
async function fetchFrameSettings(): Promise<FrameSettings> {
  if (!supabase) return { style: 'gold', url: '', path: '', enabled: false, version: 0 }
  const { data, error } = await supabase.from('events').select('settings').eq('id', EVENT_ID).maybeSingle()
  if (error) throw error
  const style = data?.settings?.frame_style
  const framePath = data?.settings?.frame_path || ''
  return { style: ['gold', 'charcoal', 'minimal', 'none'].includes(style) ? style : 'gold', url: framePath ? await frameSignedUrl(framePath) : '', path: framePath, enabled: data?.settings?.frame_enabled === true && Boolean(framePath), version: Number(data?.settings?.frame_version || 0) }
}
async function fetchEventConfig(): Promise<EventConfig> {
  if (!supabase) return { name: 'Momen Kita', eventDate: '', venue: '', displayTitle: 'LIVE EVENT', showGuestName: true, showCaption: true }
  const { data, error } = await supabase.from('events').select('name, event_date, settings').eq('id', EVENT_ID).maybeSingle()
  if (error) throw error
  const settings = data?.settings || {}
  return { name: data?.name || 'Momen Kita', eventDate: data?.event_date || '', venue: settings.venue || '', displayTitle: settings.display_title || data?.name || 'LIVE EVENT', showGuestName: settings.show_guest_name !== false, showCaption: settings.show_caption !== false }
}
const formatEventDate = (value: string) => value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value)) : ''

async function composeFramedImage(file: File, frameUrl: string): Promise<Blob> {
  const [image, frame] = await Promise.all([loadImage(URL.createObjectURL(file)), loadImage(frameUrl)])
  const canvas = document.createElement('canvas'); canvas.width = frame.naturalWidth || image.naturalWidth; canvas.height = frame.naturalHeight || image.naturalHeight
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Browser tidak mendukung pemrosesan Canvas.')
  const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
  const width = image.naturalWidth * scale; const height = image.naturalHeight * scale
  ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
  ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Gagal membuat hasil foto berb bingkai.')), 'image/png', 0.95))
}
function loadImage(src: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Gagal memuat foto atau bingkai.')); image.src = src }) }

const Icon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const paths: Record<string, ReactNode> = {
     upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4"/></>,
     camera: <><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.5"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="M21 15l-5-5L5 20"/></>,
    play: <path d="M8 5v14l11-7z"/>,
    check: <path d="M5 12l4 4L19 6"/>,
    x: <path d="M6 6l12 12M18 6L6 18"/>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1.1L12 21l7.8-7.5a5.5 5.5 0 001-8.9z"/>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0114 0M16 4a4 4 0 010 8m2 3a6 6 0 014 6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-4V21a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H2.8v-4H3a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 001.9.3A1.7 1.7 0 0010 3V2.8h4V3a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2v4H21a1.7 1.7 0 00-1.6 1z"/></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3"/><path d="M15 4h5a1 1 0 011 1v14a1 1 0 01-1 1h-5"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0l-1 14H7L6 7"/><path d="M10 11v6m4-6v6"/></>,
    star: <path d="M12 2l3 6 7 .9-5 4.8 1.3 6.8L12 17.3l-6.3 3.2L7 13.7 2 8.9 9 8z"/>,
    expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5m13 5h5v-5"/></>,
    chevron: <path d="M9 18l6-6-6-6"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>
}

function Brand({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><Icon name="heart" size={16}/></span><span><strong>Momen Kita</strong><small>LIVE EVENT GALLERY</small></span></div>
}

function LiveQr({ value, label }: { value: string; label: string }) {
  return <div className="live-download-qr"><QRCodeSVG value={value} size={150} marginSize={3} bgColor="#ffffff" fgColor="#111111" level="H"/><span>{label}</span></div>
}

function DownloadPage() {
  const mediaId = window.location.pathname.split('/').filter(Boolean).pop()
  const [url, setUrl] = useState('')
  const [downloadPath, setDownloadPath] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  useEffect(() => {
    if (!supabase || !mediaId) { setError('Tautan media tidak valid atau Supabase belum dikonfigurasi.'); return }
    supabase.from('media_uploads').select('storage_path, framed_storage_path, media_type').eq('id', mediaId).eq('moderation_status', 'approved').eq('is_hidden', false).maybeSingle().then(async ({ data, error: queryError }) => {
      if (queryError || !data) { setError('Media tidak ditemukan atau sudah dihapus.'); return }
      try { const path = data.framed_storage_path || data.storage_path; setDownloadPath(path); setUrl(await mediaUrl(path)); setMediaType(data.media_type) } catch { setError('Media tidak dapat dibuka saat ini.') }
    })
  }, [mediaId])
  const download = async () => { if (!url || !downloadPath || downloading) return; setDownloading(true); try { const response = await fetch(url); if (!response.ok) throw new Error('File tidak dapat diunduh.'); const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = `momen-kita-${mediaId}.${mediaType === 'video' ? 'mp4' : 'png'}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl) } catch { window.open(url, '_blank', 'noopener,noreferrer') } finally { setDownloading(false) } }
  return <main className="download-page"><Brand/><div className="download-card">{error ? <><h1>Media tidak tersedia</h1><p>{error}</p></> : !url ? <><h1>Menyiapkan media...</h1><p>Mohon tunggu sebentar.</p></> : <>{mediaType === 'video' ? <video src={url} controls playsInline /> : <img src={url} alt="Media acara dengan bingkai" />}<p className="download-note">{downloadPath.includes('/framed.') ? 'Foto dengan bingkai acara' : 'Foto original — bingkai belum tersedia untuk media ini'}</p><button className="primary-button" onClick={download}>{downloading ? 'Menyiapkan download...' : 'Download media'}</button></>}</div></main>
}

function GuestPage() {
  const input = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<{ file: File; url: string; framedUrl?: string; framedBlob?: Blob }[]>([])
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [gallery, setGallery] = useState<Media[]>([])
  const [guestName, setGuestName] = useState('')
  const [caption, setCaption] = useState('')
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('gold')
  const [frameSettings, setFrameSettings] = useState<FrameSettings>({ style: 'gold', url: '', path: '', enabled: false, version: 0 })
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null)

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
    if (files.length + selected.length > 10) return setError('Maksimal 10 foto atau video per batch.')
    const invalid = selected.find(file => !allowed.includes(file.type) || file.size > 25 * 1024 * 1024)
    if (invalid) return setError(`${invalid.name} tidak didukung atau melebihi 25 MB.`)
    setError('')
    const additions = selected.map(file => ({ file, url: URL.createObjectURL(file) }))
    setFiles(current => [...current, ...additions])
    if (frameSettings.enabled && frameSettings.url) additions.forEach(async item => { if (!item.file.type.startsWith('image')) return; try { const blob = await composeFramedImage(item.file, frameSettings.url); setFiles(current => current.map(existing => existing.url === item.url ? { ...existing, framedBlob: blob, framedUrl: URL.createObjectURL(blob) } : existing)) } catch (error) { setError(error instanceof Error ? error.message : 'Gagal menerapkan bingkai.') } })
    event.target.value = ''
  }

  const totalSize = files.reduce((total, item) => total + item.file.size, 0)
  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

  useEffect(() => { const refresh = () => fetchMedia(true).then(setGallery).catch(err => diagnosticError('GALLERY_FETCH_ERROR', err, { eventId: EVENT_ID })); refresh(); window.addEventListener('momen-media-changed', refresh); return () => window.removeEventListener('momen-media-changed', refresh) }, [])
  useEffect(() => { fetchEventConfig().then(setEventConfig).catch(err => diagnosticError('EVENT_CONFIG_ERROR', err, { eventId: EVENT_ID })); fetchFrameSettings().then(result => { setFrameStyle(result.style); setFrameSettings(result) }).catch(() => undefined) }, [])

  const upload = async () => {
    if (!files.length) return input.current?.click()
    if (!guestName.trim() || !caption.trim()) {
      setError('Nama tamu dan pesan singkat wajib diisi sebelum mengunggah.')
      return
    }
    setDone(false); setProgress(8); setError('')
    try {
      if (!supabase) throw new Error('Upload belum tersedia karena koneksi Supabase belum dikonfigurasi.')
      for (let i = 0; i < files.length; i++) {
        const { file, framedBlob } = files[i]; const mediaId = crypto.randomUUID(); const extension = file.name.split('.').pop()?.toLowerCase() || (file.type === 'video/mp4' ? 'mp4' : 'jpg'); const path = `events/${EVENT_ID}/${mediaId}/original.${extension}`
        diagnostic('FILE_SELECTED', { mediaId, eventId: EVENT_ID, mediaType: file.type, fileSize: file.size })
        diagnostic('UPLOAD_STARTED', { mediaId, eventId: EVENT_ID })
        const uploaded = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        if (uploaded.error) throw uploaded.error
        diagnostic('STORAGE_UPLOAD_SUCCESS', { mediaId, eventId: EVENT_ID, storagePath: path })
        let framedPath: string | null = null
        if (framedBlob) { framedPath = `events/${EVENT_ID}/${mediaId}/framed.png`; const framedUpload = await supabase.storage.from(STORAGE_BUCKET).upload(framedPath, framedBlob, { contentType: 'image/png', upsert: false }); if (framedUpload.error) { await supabase.storage.from(STORAGE_BUCKET).remove([path]); throw framedUpload.error } }
        const metadata = await supabase.from('media_uploads').insert({ id: mediaId, event_id: EVENT_ID, guest_name: guestName.trim(), caption: caption.trim(), storage_path: path, original_storage_path: path, framed_storage_path: framedPath, frame_template_path: framedPath ? frameSettings.path : null, frame_template_version: framedPath ? frameSettings.version : null, processing_status: 'completed', processed_at: framedPath ? new Date().toISOString() : null, media_type: file.type.startsWith('video') ? 'video' : 'image', mime_type: file.type, file_size: file.size, moderation_status: 'approved', approved_at: new Date().toISOString() })
        if (metadata.error) { await supabase.storage.from(STORAGE_BUCKET).remove([path]); throw metadata.error }
        diagnostic('DATABASE_INSERT_SUCCESS', { mediaId, eventId: EVENT_ID })
        setProgress(Math.round(((i + 1) / files.length) * 100))
      }
      setDone(true); setFiles([])
      window.dispatchEvent(new Event('momen-media-changed'))
    } catch (err: any) {
      diagnosticError('UPLOAD_ERROR', err, { eventId: EVENT_ID })
      const detail = err?.message || err?.error || err?.statusCode || 'Storage menolak file.'
      setError(`Upload gagal: ${detail}. Pastikan bucket event-media dan policy Storage sudah dibuat di Supabase.`)
    }
  }

  return <main className="guest-page">
    <nav className="guest-nav"><Brand/><a className="nav-gallery" href="#gallery"><Icon name="grid" size={17}/> Galeri</a></nav>
    <section className="guest-hero">
       <div className="eyebrow"><span/> {eventConfig?.name || 'MOMEN KITA'} <span/></div>
      <h1>Bagikan momen<br/><em>indahmu.</em></h1>
      <p>Jadikan momen ini lebih berkesan! Upload foto dan video terbaikmu, lalu saksikan momen tersebut tampil langsung di layar acara.</p>
       <div className="event-date">{formatEventDate(eventConfig?.eventDate || '')}</div>
    </section>
    <section className="upload-wrap">
      <div className="upload-card">
        <div className="step"><span>01</span><div><strong>Ceritakan momennya</strong><small>Opsional, tapi membuatnya lebih personal.</small></div></div>
         <div className="fields"><label>Nama kamu <span className="required-mark"> wajib</span><input required value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Contoh: Nadia & Fikri"/></label><label>Pesan singkat <span className="required-mark"> wajib</span><textarea required value={caption} onChange={e => setCaption(e.target.value)} placeholder="Tulis doa atau cerita singkatmu..."/></label></div>
        <div className="step second"><span>02</span><div><strong>Pilih foto & video</strong><small>JPG, PNG, WEBP atau MP4 · Maks. 25 MB/file</small></div></div>
         <input ref={input} className="file-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.mp4,image/jpeg,image/png,image/webp,video/mp4" onChange={pick}/>
         <input ref={cameraInput} className="file-input" type="file" accept="image/*" capture="environment" onChange={pick}/>
         {!files.length ? <div className="upload-options"><button className="dropzone" onClick={() => input.current?.click()}><span className="upload-icon"><Icon name="upload" size={25}/></span><strong>Pilih dari galeri</strong><small>JPG, PNG, WEBP atau MP4</small></button><button className="camera-button" type="button" onClick={() => cameraInput.current?.click()}><span className="upload-icon"><Icon name="camera" size={22}/></span><strong>Buka kamera HP</strong><small>Ambil foto langsung dengan kamera</small></button></div> :
            <><div className="batch-summary"><strong>{files.length} media dipilih</strong><span>Total {formatSize(totalSize)} · Maks. 10 file</span></div><div className="previews">{files.map(({file, url, framedUrl}) => <div className="preview" key={url}>{file.type.startsWith('image') ? <div className="preview-stack"><img src={url} alt="Preview asli"/>{framedUrl && <img className="preview-frame" src={framedUrl} alt="Preview bingkai"/>}</div> : <video src={url}/>}<button onClick={() => { URL.revokeObjectURL(url); if (framedUrl) URL.revokeObjectURL(framedUrl); setFiles(x => x.filter(f => f.url !== url)) }}><Icon name="x" size={14}/></button><small>{framedUrl ? 'Bingkai diterapkan · ' : ''}{file.name}</small></div>)}</div><div className="add-media-actions"><button type="button" onClick={() => input.current?.click()}><Icon name="upload" size={15}/> Tambah dari galeri</button><button type="button" onClick={() => cameraInput.current?.click()}><Icon name="camera" size={15}/> Tambah dari kamera</button></div></>}
        {error && <p className="error">{error}</p>}
        {progress > 0 && !done && <div className="progress"><span style={{width: `${progress}%`}}/><small>Mengunggah... {progress}%</small></div>}
          {done ? <div className="success"><Icon name="check"/><span><strong>Berhasil tayang!</strong><small>Media kamu langsung masuk ke galeri live.</small></span></div> :
          <button className="primary-button" onClick={upload}><Icon name="upload" size={18}/>{files.length ? `Kirim ${files.length} media` : 'Pilih media untuk diunggah'}<Icon name="chevron" size={17}/></button>}
         <p className="privacy">Dengan mengunggah, kamu setuju media langsung ditampilkan pada galeri acara.</p>
      </div>
    </section>
    <section className="public-gallery" id="gallery">
      <div className="section-title"><div><span>MOMEN PILIHAN</span><h2>Dari mereka, untuk kita.</h2></div><a href="/live">Lihat layar live <Icon name="chevron" size={15}/></a></div>
        <div className="masonry">{gallery.map((item, i) => <figure key={item.id} className={`tile frame-${frameStyle} tile-${i % 3}`}><img src={item.url} alt={item.caption}/><figcaption><strong>{item.name}</strong><span>{item.caption}</span></figcaption></figure>)}</div>
    </section>
    <footer><Brand/><span>Dibuat untuk mengabadikan setiap cerita.</span><small>© 2025 Momen Kita</small></footer>
  </main>
}

function LivePage() {
  const [active, setActive] = useState(0)
  const [approved, setApproved] = useState<Media[]>([])
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('gold')
  const [frameUrl, setFrameUrl] = useState('')
  const [eventConfig, setEventConfig] = useState<EventConfig | null>(null)
  useEffect(() => {
    const load = () => fetchMedia(true).then(items => { setApproved(items); items.forEach(item => diagnostic('MEDIA_ADDED_TO_SLIDESHOW', { mediaId: item.id, eventId: EVENT_ID })) }).catch(err => diagnosticError('REALTIME_ERROR', err, { eventId: EVENT_ID }))
    load(); window.addEventListener('momen-media-changed', load)
    // Polling fallback keeps the LED screen current when Realtime is not enabled yet.
    const poll = window.setInterval(load, 5000)
    if (supabase) { const channel = supabase.channel(`live-gallery-${EVENT_ID}`).on('postgres_changes', { event: '*', schema: 'public', table: 'media_uploads', filter: `event_id=eq.${EVENT_ID}` }, payload => { diagnostic('REALTIME_EVENT_RECEIVED', { mediaId: (payload.new as any)?.id || (payload.old as any)?.id, eventId: EVENT_ID, event: payload.eventType }); load() }).subscribe(status => diagnostic(status === 'SUBSCRIBED' ? 'REALTIME_CONNECTED' : 'REALTIME_STATUS', { eventId: EVENT_ID, status })); return () => { window.clearInterval(poll); window.removeEventListener('momen-media-changed', load); supabase.removeChannel(channel) } }
    return () => { window.clearInterval(poll); window.removeEventListener('momen-media-changed', load) }
  }, [])
  useEffect(() => { const loadEvent = () => fetchEventConfig().then(setEventConfig).catch(err => diagnosticError('EVENT_CONFIG_ERROR', err, { eventId: EVENT_ID })); loadEvent(); const timer = window.setInterval(loadEvent, 3000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    const loadFrame = () => fetchFrameSettings().then(result => { setFrameStyle(result.style); setFrameUrl(result.url) }).catch(err => diagnosticError('FRAME_SETTINGS_ERROR', err, { eventId: EVENT_ID }))
    loadFrame()
    const timer = window.setInterval(loadFrame, 3000)
    if (supabase) {
      const channel = supabase.channel(`event-settings-${EVENT_ID}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${EVENT_ID}` }, loadFrame).subscribe()
      return () => { window.clearInterval(timer); supabase.removeChannel(channel) }
    }
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { if (active >= approved.length) setActive(0) }, [approved.length, active])
  useEffect(() => {
    if (approved.length < 2) return
    const t = setInterval(() => setActive(x => (x + 1) % approved.length), 7000)
    return () => clearInterval(t)
  }, [approved.length])
  if (!approved.length) return <main className="live-page"><div className="live-empty"><Brand light/><h1>Menunggu momen terbaik.</h1><p>Foto yang disetujui akan tampil di sini secara otomatis.</p></div><LiveQr value={`${window.location.origin}/`} label="SCAN UNTUK UPLOAD"/></main>
  const current = approved[active]
  return <main className="live-page">
    <div className="live-bg" style={{backgroundImage: `url(${current.url})`}}/>
     <header className="live-head"><Brand light/><div className="live-label"><i/> LIVE · {eventConfig?.displayTitle || eventConfig?.name || 'EVENT'}</div><button onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Fullscreen"><Icon name="expand"/></button></header>
     <section className="live-stage" key={current.id}>
       <div className={`live-photo frame-${frameStyle}`}><img src={current.url} alt={current.caption} onLoad={() => diagnostic('MEDIA_RENDERED', { mediaId: current.id, eventId: EVENT_ID })} onError={() => diagnosticError('MEDIA_RENDER_ERROR', new Error('Media URL gagal dimuat'), { mediaId: current.id, eventId: EVENT_ID })}/>{frameUrl && <img className="custom-frame-overlay" src={frameUrl} alt="" aria-hidden="true"/>}<span className="corner tl"/><span className="corner br"/></div>
      <div className="live-copy"><span>MOMEN TERBARU</span><blockquote>“{current.caption}”</blockquote><p>— {current.name}</p></div>
     </section>
     <LiveQr value={`${window.location.origin}/download/${current.id}`} label="SCAN UNTUK SIMPAN"/>
     <footer className="live-footer"><div>{formatEventDate(eventConfig?.eventDate || '')} {eventConfig?.venue && <><span/> {eventConfig.venue}</>}</div><div className="live-progress"><i key={active}/></div><small>{active + 1} / {approved.length}</small></footer>
  </main>
}

function AdminPage() {
  const [logged, setLogged] = useState(false)
  const [media, setMedia] = useState<Media[]>([])
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('gold')
  const [filter, setFilter] = useState<'All' | Status>('All')
  const [query, setQuery] = useState('')
  const [adminView, setAdminView] = useState<'media' | 'settings'>('media')
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [venue, setVenue] = useState('')
  const [displayTitle, setDisplayTitle] = useState('')
  const list = useMemo(() => media.filter(x => (filter === 'All' || x.status === filter) && x.name.toLowerCase().includes(query.toLowerCase())), [media, filter, query])
  const update = (id: string | number, patch: Partial<Media>) => setMedia(x => x.map(m => m.id === id ? {...m, ...patch} : m))
  const deleteMedia = async (item: Media) => {
    if (!supabase || typeof item.id !== 'string' || !item.storagePath) return
    const confirmed = window.confirm(`Hapus media dari ${item.name}?\n\nFile akan dihapus dari Storage, record database akan dihapus, dan media akan hilang dari Live Display. Tindakan ini tidak dapat dibatalkan.`)
    if (!confirmed) return
    try {
      const databaseResult = await supabase.from('media_uploads').delete().eq('id', item.id)
      if (databaseResult.error) throw new Error(`Database: ${databaseResult.error.message}`)
      const remaining = await supabase.from('media_uploads').select('id').eq('id', item.id)
      if (remaining.error) throw new Error(`Verifikasi database: ${remaining.error.message}`)
      if (remaining.data?.length) throw new Error('Database tidak menghapus row. Periksa policy DELETE admin pada media_uploads dan role profile admin.')
      const storageResult = await supabase.storage.from(STORAGE_BUCKET).remove([item.storagePath])
      if (storageResult.error) {
        diagnosticError('MEDIA_STORAGE_CLEANUP_ERROR', storageResult.error, { mediaId: item.id, eventId: EVENT_ID, storagePath: item.storagePath })
        alert('Data database sudah dihapus, tetapi file Storage gagal dibersihkan. Jalankan cleanup manual untuk path: ' + item.storagePath + '\n\nDetail: ' + storageResult.error.message)
      }
      diagnostic('MEDIA_DELETED', { mediaId: item.id, eventId: EVENT_ID, storagePath: item.storagePath })
      setMedia(x => x.filter(m => m.id !== item.id))
    } catch (error) {
      diagnosticError('MEDIA_DELETE_ERROR', error, { mediaId: item.id, eventId: EVENT_ID })
      alert('Media belum terhapus. Tidak ada perubahan yang diselesaikan.\n\nDetail: ' + (error instanceof Error ? error.message : String(error)))
    }
  }
  useEffect(() => { if (!supabase || !logged) return; const load = () => fetchMedia().then(setMedia).catch(err => diagnosticError('ADMIN_FETCH_ERROR', err, { eventId: EVENT_ID })); load(); const channel = supabase.channel(`admin-media-${EVENT_ID}`).on('postgres_changes', { event: '*', schema: 'public', table: 'media_uploads', filter: `event_id=eq.${EVENT_ID}` }, load).subscribe(); return () => { supabase.removeChannel(channel) } }, [logged])
  useEffect(() => { if (logged) fetchFrameSettings().then(result => { setFrameStyle(result.style); setFrameUrl(result.url) }).catch(() => undefined) }, [logged])
  useEffect(() => { if (!logged || !supabase) return; supabase.from('events').select('name, event_date, settings').eq('id', EVENT_ID).single().then(({ data }) => { if (data) { setEventName(data.name || ''); setEventDate(data.event_date ? String(data.event_date).slice(0, 16) : ''); setVenue(data.settings?.venue || ''); setDisplayTitle(data.settings?.display_title || data.name || '') } }) }, [logged])
  const uploadFrame = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file || !supabase) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return alert('Bingkai harus PNG, JPG, atau WEBP maksimal 5 MB.')
    const path = `${EVENT_ID}/frame-${Date.now()}.${file.name.split('.').pop()?.toLowerCase() || 'png'}`
    const uploaded = await supabase.storage.from(FRAME_BUCKET).upload(path, file, { contentType: file.type, upsert: true })
    if (uploaded.error) return alert(uploaded.error.message)
    const { data } = await supabase.from('events').select('settings').eq('id', EVENT_ID).single()
    const settings = { ...(data?.settings || {}), frame_path: path, frame_enabled: true, frame_version: Number(data?.settings?.frame_version || 0) + 1 }
    const updated = await supabase.from('events').update({ settings }).eq('id', EVENT_ID)
    if (updated.error) return alert(updated.error.message)
    setFrameUrl(framePublicUrl(path)); alert('Bingkai berhasil diperbarui.')
  }
  const saveFrameStyle = async (style: FrameStyle) => { if (!supabase) return; const { data } = await supabase.from('events').select('settings').eq('id', EVENT_ID).single(); const { error } = await supabase.from('events').update({ settings: { ...(data?.settings || {}), frame_style: style } }).eq('id', EVENT_ID); if (error) return alert(error.message); setFrameStyle(style) }
  const saveEventSettings = async () => { if (!supabase) return; const { data } = await supabase.from('events').select('settings').eq('id', EVENT_ID).single(); const { error } = await supabase.from('events').update({ name: eventName.trim(), event_date: eventDate || null, settings: { ...(data?.settings || {}), venue: venue.trim(), display_title: displayTitle.trim() || eventName.trim() } }).eq('id', EVENT_ID); if (error) return alert(error.message); alert('Pengaturan acara berhasil disimpan.') }
  const moderate = async (id: string | number, status: Status) => { if (!supabase || typeof id !== 'string') return; const { error } = await supabase.from('media_uploads').update({ moderation_status: status, approved_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', id); if (error) diagnosticError('MODERATION_ERROR', error, { mediaId: id, eventId: EVENT_ID }) }
   if (!logged) return <main className="login-page"><div className="login-visual"><div className="login-image"/><div className="login-overlay"><Brand light/><blockquote>“Setiap momen layak<br/>untuk <em>diabadikan.</em>”</blockquote><p>Kelola cerita indah dari para tamu dalam satu tempat.</p></div></div><div className="login-panel"><div className="login-box"><span className="login-kicker">ADMIN PORTAL</span><h1>Selamat datang kembali.</h1><p>Masuk untuk mengelola galeri acaramu.</p><label>Email<input type="email" placeholder="admin@example.com"/></label><label>Password<div className="password"><input type="password" placeholder="Password"/></div></label><div className="login-row"><label className="check"><input type="checkbox" defaultChecked/> Ingat saya</label><button>Lupa password?</button></div><button className="primary-button" onClick={async () => { if (!supabase) return alert('Supabase belum dikonfigurasi.'); const email = (document.querySelector('input[type=email]') as HTMLInputElement).value; const password = (document.querySelector('input[type=password]') as HTMLInputElement).value; const result = await supabase.auth.signInWithPassword({ email, password }); if (result.error) return alert(result.error.message); setLogged(true) }}>Masuk ke dashboard <Icon name="chevron" size={17}/></button><small className="demo-note">Login menggunakan akun Supabase Auth.</small></div></div></main>

   const counts = { pending: media.filter(x => x.status === 'pending').length, approved: media.filter(x => x.status === 'approved').length, rejected: media.filter(x => x.status === 'rejected').length }
  return <main className="admin-page">
     <aside><Brand light/><nav><small>MENU UTAMA</small><button className={adminView === 'media' ? 'active' : ''} onClick={() => setAdminView('media')}><Icon name="grid"/> Media Gallery <b>{counts.pending}</b></button><button><Icon name="users"/> Guest Activity</button><button className={adminView === 'settings' ? 'active' : ''} onClick={() => setAdminView('settings')}><Icon name="settings"/> Event Settings</button></nav><div className="side-event"><small>ACARA AKTIF</small><strong>{eventName || 'Acara aktif'}</strong><span><i/> Live display aktif</span></div><button className="logout" onClick={() => setLogged(false)}><Icon name="logout"/> Keluar</button></aside>
    <section className="dashboard">
      <header><div><span>DASHBOARD</span><h1>Selamat sore, Admin.</h1><p>Ini yang terjadi di acaramu hari ini.</p></div><a href="/live"><i/> Buka Live Display <Icon name="chevron" size={16}/></a></header>
       {adminView === 'settings' && <section className="event-settings-panel"><span className="login-kicker">EVENT SETTINGS</span><h2>Pengaturan acara</h2><p>Atur identitas acara dan tampilan bingkai Live Display.</p><label>Nama acara<input value={eventName} onChange={e => setEventName(e.target.value)} /></label><label>Judul Live Display<input value={displayTitle} onChange={e => setDisplayTitle(e.target.value)} /></label><label>Lokasi acara<input value={venue} onChange={e => setVenue(e.target.value)} /></label><label>Tanggal acara<input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} /></label><div className="settings-frame-row"><label>Bingkai live<select value={frameStyle} onChange={e => saveFrameStyle(e.target.value as FrameStyle)}><option value="gold">Gold Elegan</option><option value="charcoal">Charcoal</option><option value="minimal">Minimal</option><option value="none">Tanpa Bingkai</option></select></label><label className="frame-upload">Upload PNG/JPG/WEBP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadFrame}/></label></div><button className="primary-button settings-save" onClick={saveEventSettings}>Simpan pengaturan</button></section>}
       <div className="stats"><article><span><Icon name="image"/></span><div><small>Total Unggahan</small><strong>{media.length}</strong><em>+6 dalam 1 jam</em></div></article><article><span><Icon name="users"/></span><div><small>Kontributor</small><strong>42</strong><em>+8 tamu baru</em></div></article><article><span><Icon name="image"/></span><div><small>Total Foto</small><strong>{media.filter(x=>x.type==='photo').length}</strong><em>86% dari media</em></div></article><article><span><Icon name="play"/></span><div><small>Total Video</small><strong>12</strong><em>14% dari media</em></div></article></div>
       <div className="moderation-head"><div><h2>Moderasi Media</h2><p>Tinjau dan kelola unggahan dari para tamu.</p></div><div className="frame-setting"><strong>Bingkai live</strong><select value={frameStyle} onChange={e => saveFrameStyle(e.target.value as FrameStyle)}><option value="gold">Gold Elegan</option><option value="charcoal">Charcoal</option><option value="minimal">Minimal</option><option value="none">Tanpa Bingkai</option></select><label className="frame-upload">Upload PNG/JPG/WEBP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadFrame}/></label></div><label className="auto"><span><strong>Auto-approve</strong><small>Media langsung tayang</small></span><input type="checkbox"/><i/></label></div>
      <div className="toolbar"><div className="tabs">{(['all','pending','approved','rejected'] as const).map(x => <button className={filter === (x === 'all' ? 'All' : x) ? 'active' : ''} onClick={() => setFilter(x === 'all' ? 'All' : x)} key={x}>{x === 'all' ? 'Semua' : x} <span>{x === 'all' ? media.length : counts[x]}</span></button>)}</div><label className="search"><Icon name="search" size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama tamu..."/></label></div>
       <div className="media-grid">{list.map(item => <article className="media-card" key={item.id}><div className={`media-image frame-${frameStyle}`}>{item.type === 'video' ? <video src={item.url} controls /> : <img src={item.url} alt={item.caption}/>}<span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>{item.featured && <span className="featured"><Icon name="star" size={12}/> Featured</span>}<div className="card-actions"><button title="Feature" onClick={async () => { if (supabase && typeof item.id === 'string') await supabase.from('media_uploads').update({ is_featured: !item.featured }).eq('id', item.id); update(item.id, {featured: !item.featured}) }}><Icon name="star" size={16}/></button><button title="Delete" onClick={() => deleteMedia(item)}><Icon name="trash" size={16}/></button></div></div><div className="media-info"><strong>{item.name}</strong><p>“{item.caption}”</p><small>{item.time}</small></div>{item.status === 'pending' ? <div className="review-actions"><button onClick={() => moderate(item.id,'rejected')}><Icon name="x" size={16}/> Tolak</button><button onClick={() => moderate(item.id,'approved')}><Icon name="check" size={16}/> Setujui</button></div> : <div className="approved-row"><span><Icon name={item.status === 'approved' ? 'check' : 'x'} size={15}/>{item.status === 'approved' ? 'Tayang di galeri' : 'Tidak ditayangkan'}</span><button>•••</button></div>}</article>)}</div>
    </section>
  </main>
}

export default function App() {
  const path = window.location.pathname
  return path.startsWith('/admin') ? <AdminPage/> : path.startsWith('/live') ? <LivePage/> : path.startsWith('/download/') ? <DownloadPage/> : <GuestPage/>
}
