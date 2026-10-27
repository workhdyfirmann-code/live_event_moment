import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { EVENT_ID, STORAGE_BUCKET, diagnostic, diagnosticError, mediaUrl, supabase } from './lib/supabase'

type Status = 'pending' | 'approved' | 'rejected'
type Media = {
  id: string | number
  url: string
  name: string
  caption: string
  time: string
  type: 'photo' | 'video'
  status: Status
  featured?: boolean
}

const initialMedia: Media[] = []

const fromRow = async (row: any): Promise<Media> => ({ id: row.id, url: await mediaUrl(row.storage_path), name: row.guest_name || 'Tamu', caption: row.caption || 'Momen indah', time: new Date(row.created_at).toLocaleString('id-ID'), type: row.media_type, status: String(row.moderation_status).toLowerCase() as Status, featured: row.is_featured })
async function fetchMedia(approvedOnly = false) {
  if (!supabase) throw new Error('Backend belum dikonfigurasi. Isi VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, dan VITE_EVENT_ID di Vercel.')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(EVENT_ID)) throw new Error('VITE_EVENT_ID harus berisi UUID event Supabase yang valid.')
  const query = supabase.from('media_uploads').select('*').eq('event_id', EVENT_ID).order('created_at', { ascending: false })
  const { data, error } = approvedOnly ? await query.eq('moderation_status', 'approved') : await query
  if (error) throw error
  diagnostic('MEDIA_FETCH_SUCCESS', { eventId: EVENT_ID, count: data?.length || 0, approvedOnly })
  return Promise.all((data || []).map(fromRow))
}

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

function GuestPage() {
  const input = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<{ file: File; url: string }[]>([])
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [gallery, setGallery] = useState<Media[]>([])
  const [guestName, setGuestName] = useState('')
  const [caption, setCaption] = useState('')

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || [])
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
    const invalid = selected.find(file => !allowed.includes(file.type) || file.size > 25 * 1024 * 1024)
    if (invalid) return setError(`${invalid.name} tidak didukung atau melebihi 25 MB.`)
    setError('')
    setFiles(current => [...current, ...selected.map(file => ({ file, url: URL.createObjectURL(file) }))])
    event.target.value = ''
  }

  useEffect(() => { const refresh = () => fetchMedia(true).then(setGallery).catch(err => diagnosticError('GALLERY_FETCH_ERROR', err, { eventId: EVENT_ID })); refresh(); window.addEventListener('momen-media-changed', refresh); return () => window.removeEventListener('momen-media-changed', refresh) }, [])

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
        const { file } = files[i]; const mediaId = crypto.randomUUID(); const extension = file.name.split('.').pop()?.toLowerCase() || (file.type === 'video/mp4' ? 'mp4' : 'jpg'); const path = `events/${EVENT_ID}/${mediaId}/original.${extension}`
        diagnostic('FILE_SELECTED', { mediaId, eventId: EVENT_ID, mediaType: file.type, fileSize: file.size })
        diagnostic('UPLOAD_STARTED', { mediaId, eventId: EVENT_ID })
        const uploaded = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        if (uploaded.error) throw uploaded.error
        diagnostic('STORAGE_UPLOAD_SUCCESS', { mediaId, eventId: EVENT_ID, storagePath: path })
        const metadata = await supabase.from('media_uploads').insert({ id: mediaId, event_id: EVENT_ID, guest_name: guestName.trim(), caption: caption.trim(), storage_path: path, media_type: file.type.startsWith('video') ? 'video' : 'image', mime_type: file.type, file_size: file.size, moderation_status: 'pending' })
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
      <div className="eyebrow"><span/> RAKA & NADINE <span/></div>
      <h1>Bagikan momen<br/><em>indahmu.</em></h1>
      <p>Jadikan momen ini lebih berkesan! Upload foto dan video terbaikmu, lalu saksikan momen tersebut tampil langsung di layar acara.</p>
      <div className="event-date">12 <span>•</span> OKTOBER <span>•</span> 2025</div>
    </section>
    <section className="upload-wrap">
      <div className="upload-card">
        <div className="step"><span>01</span><div><strong>Ceritakan momennya</strong><small>Opsional, tapi membuatnya lebih personal.</small></div></div>
         <div className="fields"><label>Nama kamu <span className="required-mark"> wajib</span><input required value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Contoh: Nadia & Fikri"/></label><label>Pesan singkat <span className="required-mark"> wajib</span><textarea required value={caption} onChange={e => setCaption(e.target.value)} placeholder="Tulis doa atau cerita singkatmu..."/></label></div>
        <div className="step second"><span>02</span><div><strong>Pilih foto & video</strong><small>JPG, PNG, WEBP atau MP4 · Maks. 25 MB/file</small></div></div>
         <input ref={input} className="file-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.mp4,image/jpeg,image/png,image/webp,video/mp4" onChange={pick}/>
         <input ref={cameraInput} className="file-input" type="file" accept="image/*" capture="environment" onChange={pick}/>
         {!files.length ? <div className="upload-options"><button className="dropzone" onClick={() => input.current?.click()}><span className="upload-icon"><Icon name="upload" size={25}/></span><strong>Pilih dari galeri</strong><small>JPG, PNG, WEBP atau MP4</small></button><button className="camera-button" type="button" onClick={() => cameraInput.current?.click()}><span className="upload-icon"><Icon name="camera" size={22}/></span><strong>Buka kamera HP</strong><small>Ambil foto langsung dengan kamera</small></button></div> :
           <div className="previews">{files.map(({file, url}) => <div className="preview" key={url}>{file.type.startsWith('image') ? <img src={url} alt="Preview"/> : <video src={url}/>}<button onClick={() => setFiles(x => x.filter(f => f.url !== url))}><Icon name="x" size={14}/></button><small>{file.name}</small></div>)}</div>}
        {error && <p className="error">{error}</p>}
        {progress > 0 && !done && <div className="progress"><span style={{width: `${progress}%`}}/><small>Mengunggah... {progress}%</small></div>}
          {done ? <div className="success"><Icon name="check"/><span><strong>Berhasil terkirim!</strong><small>Media kamu sedang menunggu persetujuan admin.</small></span></div> :
          <button className="primary-button" onClick={upload}><Icon name="upload" size={18}/>{files.length ? `Kirim ${files.length} media` : 'Pilih media untuk diunggah'}<Icon name="chevron" size={17}/></button>}
         <p className="privacy">Dengan mengunggah, kamu setuju media langsung ditampilkan pada galeri acara.</p>
      </div>
    </section>
    <section className="public-gallery" id="gallery">
      <div className="section-title"><div><span>MOMEN PILIHAN</span><h2>Dari mereka, untuk kita.</h2></div><a href="/live">Lihat layar live <Icon name="chevron" size={15}/></a></div>
       <div className="masonry">{gallery.map((item, i) => <figure key={item.id} className={`tile tile-${i % 3}`}><img src={item.url} alt={item.caption}/><figcaption><strong>{item.name}</strong><span>{item.caption}</span></figcaption></figure>)}</div>
    </section>
    <footer><Brand/><span>Dibuat untuk mengabadikan setiap cerita.</span><small>© 2025 Momen Kita</small></footer>
  </main>
}

function LivePage() {
  const [active, setActive] = useState(0)
  const [approved, setApproved] = useState<Media[]>([])
  useEffect(() => {
    const load = () => fetchMedia(true).then(items => { setApproved(items); items.forEach(item => diagnostic('MEDIA_ADDED_TO_SLIDESHOW', { mediaId: item.id, eventId: EVENT_ID })) }).catch(err => diagnosticError('REALTIME_ERROR', err, { eventId: EVENT_ID }))
    load(); window.addEventListener('momen-media-changed', load)
    // Polling fallback keeps the LED screen current when Realtime is not enabled yet.
    const poll = window.setInterval(load, 5000)
    if (supabase) { const channel = supabase.channel(`live-gallery-${EVENT_ID}`).on('postgres_changes', { event: '*', schema: 'public', table: 'media_uploads', filter: `event_id=eq.${EVENT_ID}` }, payload => { diagnostic('REALTIME_EVENT_RECEIVED', { mediaId: (payload.new as any)?.id || (payload.old as any)?.id, eventId: EVENT_ID, event: payload.eventType }); load() }).subscribe(status => diagnostic(status === 'SUBSCRIBED' ? 'REALTIME_CONNECTED' : 'REALTIME_STATUS', { eventId: EVENT_ID, status })); return () => { window.clearInterval(poll); window.removeEventListener('momen-media-changed', load); supabase.removeChannel(channel) } }
    return () => { window.clearInterval(poll); window.removeEventListener('momen-media-changed', load) }
  }, [])
  useEffect(() => { if (active >= approved.length) setActive(0) }, [approved.length, active])
  useEffect(() => {
    if (approved.length < 2) return
    const t = setInterval(() => setActive(x => (x + 1) % approved.length), 7000)
    return () => clearInterval(t)
  }, [approved.length])
  if (!approved.length) return <main className="live-page"><div className="live-empty"><Brand light/><h1>Menunggu momen terbaik.</h1><p>Foto yang disetujui akan tampil di sini secara otomatis.</p></div></main>
  const current = approved[active]
  return <main className="live-page">
    <div className="live-bg" style={{backgroundImage: `url(${current.url})`}}/>
    <header className="live-head"><Brand light/><div className="live-label"><i/> LIVE · RAKA & NADINE</div><button onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Fullscreen"><Icon name="expand"/></button></header>
    <section className="live-stage" key={current.id}>
       <div className="live-photo"><img src={current.url} alt={current.caption} onLoad={() => diagnostic('MEDIA_RENDERED', { mediaId: current.id, eventId: EVENT_ID })} onError={() => diagnosticError('MEDIA_RENDER_ERROR', new Error('Media URL gagal dimuat'), { mediaId: current.id, eventId: EVENT_ID })}/><span className="corner tl"/><span className="corner br"/></div>
      <div className="live-copy"><span>MOMEN TERBARU</span><blockquote>“{current.caption}”</blockquote><p>— {current.name}</p></div>
    </section>
    <footer className="live-footer"><div>12 OKTOBER 2025 <span/> THE GRAND BALLROOM, JAKARTA</div><div className="live-progress"><i key={active}/></div><small>{active + 1} / {approved.length}</small></footer>
  </main>
}

function AdminPage() {
  const [logged, setLogged] = useState(false)
  const [media, setMedia] = useState<Media[]>([])
  const [filter, setFilter] = useState<'All' | Status>('All')
  const [query, setQuery] = useState('')
  const list = useMemo(() => media.filter(x => (filter === 'All' || x.status === filter) && x.name.toLowerCase().includes(query.toLowerCase())), [media, filter, query])
  const update = (id: string | number, patch: Partial<Media>) => setMedia(x => x.map(m => m.id === id ? {...m, ...patch} : m))
  useEffect(() => { if (!supabase || !logged) return; const load = () => fetchMedia().then(setMedia).catch(err => diagnosticError('ADMIN_FETCH_ERROR', err, { eventId: EVENT_ID })); load(); const channel = supabase.channel(`admin-media-${EVENT_ID}`).on('postgres_changes', { event: '*', schema: 'public', table: 'media_uploads', filter: `event_id=eq.${EVENT_ID}` }, load).subscribe(); return () => { supabase.removeChannel(channel) } }, [logged])
  const moderate = async (id: string | number, status: Status) => { if (!supabase || typeof id !== 'string') return; const { error } = await supabase.from('media_uploads').update({ moderation_status: status, approved_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', id); if (error) diagnosticError('MODERATION_ERROR', error, { mediaId: id, eventId: EVENT_ID }) }
   if (!logged) return <main className="login-page"><div className="login-visual"><div className="login-image"/><div className="login-overlay"><Brand light/><blockquote>“Setiap momen layak<br/>untuk <em>diabadikan.</em>”</blockquote><p>Kelola cerita indah dari para tamu dalam satu tempat.</p></div></div><div className="login-panel"><div className="login-box"><span className="login-kicker">ADMIN PORTAL</span><h1>Selamat datang kembali.</h1><p>Masuk untuk mengelola galeri acaramu.</p><label>Email<input type="email" placeholder="admin@example.com"/></label><label>Password<div className="password"><input type="password" placeholder="Password"/></div></label><div className="login-row"><label className="check"><input type="checkbox" defaultChecked/> Ingat saya</label><button>Lupa password?</button></div><button className="primary-button" onClick={async () => { if (!supabase) return alert('Supabase belum dikonfigurasi.'); const email = (document.querySelector('input[type=email]') as HTMLInputElement).value; const password = (document.querySelector('input[type=password]') as HTMLInputElement).value; const result = await supabase.auth.signInWithPassword({ email, password }); if (result.error) return alert(result.error.message); setLogged(true) }}>Masuk ke dashboard <Icon name="chevron" size={17}/></button><small className="demo-note">Login menggunakan akun Supabase Auth.</small></div></div></main>

   const counts = { pending: media.filter(x => x.status === 'pending').length, approved: media.filter(x => x.status === 'approved').length, rejected: media.filter(x => x.status === 'rejected').length }
  return <main className="admin-page">
    <aside><Brand light/><nav><small>MENU UTAMA</small><button className="active"><Icon name="grid"/> Media Gallery <b>{counts.pending}</b></button><button><Icon name="users"/> Guest Activity</button><button><Icon name="settings"/> Event Settings</button></nav><div className="side-event"><small>ACARA AKTIF</small><strong>Raka & Nadine</strong><span><i/> Live display aktif</span></div><button className="logout" onClick={() => setLogged(false)}><Icon name="logout"/> Keluar</button></aside>
    <section className="dashboard">
      <header><div><span>DASHBOARD</span><h1>Selamat sore, Admin.</h1><p>Ini yang terjadi di acaramu hari ini.</p></div><a href="/live"><i/> Buka Live Display <Icon name="chevron" size={16}/></a></header>
      <div className="stats"><article><span><Icon name="image"/></span><div><small>Total Unggahan</small><strong>{media.length}</strong><em>+6 dalam 1 jam</em></div></article><article><span><Icon name="users"/></span><div><small>Kontributor</small><strong>42</strong><em>+8 tamu baru</em></div></article><article><span><Icon name="image"/></span><div><small>Total Foto</small><strong>{media.filter(x=>x.type==='photo').length}</strong><em>86% dari media</em></div></article><article><span><Icon name="play"/></span><div><small>Total Video</small><strong>12</strong><em>14% dari media</em></div></article></div>
      <div className="moderation-head"><div><h2>Moderasi Media</h2><p>Tinjau dan kelola unggahan dari para tamu.</p></div><label className="auto"><span><strong>Auto-approve</strong><small>Media langsung tayang</small></span><input type="checkbox"/><i/></label></div>
      <div className="toolbar"><div className="tabs">{(['all','pending','approved','rejected'] as const).map(x => <button className={filter === (x === 'all' ? 'All' : x) ? 'active' : ''} onClick={() => setFilter(x === 'all' ? 'All' : x)} key={x}>{x === 'all' ? 'Semua' : x} <span>{x === 'all' ? media.length : counts[x]}</span></button>)}</div><label className="search"><Icon name="search" size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama tamu..."/></label></div>
       <div className="media-grid">{list.map(item => <article className="media-card" key={item.id}><div className="media-image">{item.type === 'video' ? <video src={item.url} controls /> : <img src={item.url} alt={item.caption}/>}<span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>{item.featured && <span className="featured"><Icon name="star" size={12}/> Featured</span>}<div className="card-actions"><button title="Feature" onClick={async () => { if (supabase && typeof item.id === 'string') await supabase.from('media_uploads').update({ is_featured: !item.featured }).eq('id', item.id); update(item.id, {featured: !item.featured}) }}><Icon name="star" size={16}/></button><button title="Delete" onClick={async () => { if (supabase && typeof item.id === 'string') await supabase.from('media_uploads').delete().eq('id', item.id); setMedia(x => x.filter(m => m.id !== item.id)) }}><Icon name="trash" size={16}/></button></div></div><div className="media-info"><strong>{item.name}</strong><p>“{item.caption}”</p><small>{item.time}</small></div>{item.status === 'pending' ? <div className="review-actions"><button onClick={() => moderate(item.id,'rejected')}><Icon name="x" size={16}/> Tolak</button><button onClick={() => moderate(item.id,'approved')}><Icon name="check" size={16}/> Setujui</button></div> : <div className="approved-row"><span><Icon name={item.status === 'approved' ? 'check' : 'x'} size={15}/>{item.status === 'approved' ? 'Tayang di galeri' : 'Tidak ditayangkan'}</span><button>•••</button></div>}</article>)}</div>
    </section>
  </main>
}

export default function App() {
  const path = window.location.pathname
  return path.startsWith('/admin') ? <AdminPage/> : path.startsWith('/live') ? <LivePage/> : <GuestPage/>
}
