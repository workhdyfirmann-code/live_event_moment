import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { EVENT_ID, STORAGE_BUCKET, publicUrl, supabase } from './lib/supabase'

type Status = 'Pending' | 'Approved' | 'Rejected'
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

const photos = [
  'https://images.unsplash.com/photo-1525272149490-82288cb110a0?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1749731893442-1f9a0dfe12cb?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1715588837113-80441978e93e?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1623991616266-37fcccc0d679?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1610604708806-a5c1d7c9bc21?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1769038935144-bf372fe6ec08?auto=format&fit=crop&w=900&q=85',
]

const initialMedia: Media[] = [
  { id: 1, url: photos[0], name: 'Nadia & Fikri', caption: 'Bahagia selalu untuk kalian!', time: 'Baru saja', type: 'photo', status: 'Pending' },
  { id: 2, url: photos[1], name: 'Alya Pratama', caption: 'Momen haru yang indah', time: '2 menit lalu', type: 'photo', status: 'Approved', featured: true },
  { id: 3, url: photos[2], name: 'Raka', caption: 'Satu frame, seribu cerita.', time: '4 menit lalu', type: 'photo', status: 'Approved' },
  { id: 4, url: photos[3], name: 'Dinda', caption: 'Turut berbahagia!', time: '8 menit lalu', type: 'photo', status: 'Pending' },
  { id: 5, url: photos[4], name: 'Keluarga Wirawan', caption: 'Selamat menempuh hidup baru', time: '12 menit lalu', type: 'photo', status: 'Rejected' },
  { id: 6, url: photos[5], name: 'Salsa', caption: 'A night to remember', time: '15 menit lalu', type: 'photo', status: 'Approved' },
]

const LOCAL_KEY = `momen-kita-media-${EVENT_ID}`
const readLocal = (): Media[] => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null') || initialMedia } catch { return initialMedia } }
const writeLocal = (items: Media[]) => { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); window.dispatchEvent(new Event('momen-media-changed')) }
const fromRow = (row: any): Media => ({ id: row.id, url: publicUrl(row.storage_path), name: row.guest_name || 'Tamu', caption: row.caption || 'Momen indah', time: new Date(row.created_at).toLocaleString('id-ID'), type: row.media_type, status: row.moderation_status, featured: row.is_featured })
async function fetchMedia(approvedOnly = false) {
  if (!supabase) return readLocal().filter(item => !approvedOnly || item.status === 'Approved')
  const query = supabase.from('media_uploads').select('*').eq('event_id', EVENT_ID).order('created_at', { ascending: false })
  const { data, error } = approvedOnly ? await query.eq('moderation_status', 'Approved') : await query
  if (error) throw error
  return (data || []).map(fromRow)
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
  const [gallery, setGallery] = useState<Media[]>(() => readLocal().filter(x => x.status === 'Approved'))
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

  useEffect(() => { fetchMedia(true).then(setGallery).catch(() => undefined); const refresh = () => fetchMedia(true).then(setGallery).catch(() => undefined); window.addEventListener('momen-media-changed', refresh); return () => window.removeEventListener('momen-media-changed', refresh) }, [])

  const upload = async () => {
    if (!files.length) return input.current?.click()
    if (!guestName.trim() || !caption.trim()) {
      setError('Nama tamu dan pesan singkat wajib diisi sebelum mengunggah.')
      return
    }
    setDone(false); setProgress(8); setError('')
    try {
      if (!supabase) {
        const additions = files.map(({ file, url }, index) => ({ id: `local-${Date.now()}-${index}`, url, name: guestName || 'Tamu', caption: caption || 'Momen indah', time: 'Baru saja', type: file.type.startsWith('video') ? 'video' as const : 'photo' as const, status: 'Approved' as const }))
        writeLocal([...additions, ...readLocal()]); setProgress(100); setDone(true); return
      }
      for (let i = 0; i < files.length; i++) {
        const { file } = files[i]; const path = `${EVENT_ID}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`
        const uploaded = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        if (uploaded.error) throw uploaded.error
        const saved = await supabase.from('media_uploads').insert({ event_id: EVENT_ID, guest_name: guestName || null, caption: caption || null, storage_path: path, media_type: file.type.startsWith('video') ? 'video' : 'photo', mime_type: file.type, file_size: file.size, moderation_status: 'Approved', approved_at: new Date().toISOString() }).select().single()
        if (saved.error) throw saved.error
        setProgress(Math.round(((i + 1) / files.length) * 100))
      }
      setDone(true); setFiles([])
    } catch (err: any) { setError(err.message || 'Upload gagal. Coba lagi.') }
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
        {done ? <div className="success"><Icon name="check"/><span><strong>Berhasil terkirim!</strong><small>Media kamu sedang menunggu persetujuan.</small></span></div> :
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
  const [approved, setApproved] = useState<Media[]>(() => readLocal().filter(x => x.status === 'Approved'))
  useEffect(() => {
    const load = () => fetchMedia(true).then(setApproved).catch(() => undefined)
    load(); window.addEventListener('momen-media-changed', load)
    // Polling fallback keeps the LED screen current when Realtime is not enabled yet.
    const poll = window.setInterval(load, 5000)
    if (supabase) { const channel = supabase.channel('live-gallery').on('postgres_changes', { event: '*', schema: 'public', table: 'media_uploads', filter: `event_id=eq.${EVENT_ID}` }, load).subscribe(); return () => { window.clearInterval(poll); window.removeEventListener('momen-media-changed', load); supabase.removeChannel(channel) } }
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
      <div className="live-photo"><img src={current.url} alt={current.caption}/><span className="corner tl"/><span className="corner br"/></div>
      <div className="live-copy"><span>MOMEN TERBARU</span><blockquote>“{current.caption}”</blockquote><p>— {current.name}</p></div>
    </section>
    <footer className="live-footer"><div>12 OKTOBER 2025 <span/> THE GRAND BALLROOM, JAKARTA</div><div className="live-progress"><i key={active}/></div><small>{active + 1} / {approved.length}</small></footer>
  </main>
}

function AdminPage() {
  const [logged, setLogged] = useState(false)
  const [media, setMedia] = useState(initialMedia)
  const [backend, setBackend] = useState(Boolean(supabase))
  const [filter, setFilter] = useState<'All' | Status>('All')
  const [query, setQuery] = useState('')
  const list = useMemo(() => media.filter(x => (filter === 'All' || x.status === filter) && x.name.toLowerCase().includes(query.toLowerCase())), [media, filter, query])
  const update = (id: string | number, patch: Partial<Media>) => setMedia(x => { const next = x.map(m => m.id === id ? {...m, ...patch} : m); if (!supabase) writeLocal(next); return next })
  useEffect(() => { if (!supabase) return; fetchMedia().then(setMedia).catch(() => undefined); const channel = supabase.channel('admin-media').on('postgres_changes', { event: '*', schema: 'public', table: 'media_uploads', filter: `event_id=eq.${EVENT_ID}` }, () => fetchMedia().then(setMedia)).subscribe(); return () => { supabase.removeChannel(channel) } }, [])
  const moderate = async (id: string | number, status: Status) => { if (supabase && typeof id === 'string') { await supabase.from('media_uploads').update({ moderation_status: status, approved_at: status === 'Approved' ? new Date().toISOString() : null }).eq('id', id) } else update(id, { status }) }
   if (!logged) return <main className="login-page"><div className="login-visual"><div className="login-image"/><div className="login-overlay"><Brand light/><blockquote>“Setiap momen layak<br/>untuk <em>diabadikan.</em>”</blockquote><p>Kelola cerita indah dari para tamu dalam satu tempat.</p></div></div><div className="login-panel"><div className="login-box"><span className="login-kicker">ADMIN PORTAL</span><h1>Selamat datang kembali.</h1><p>Masuk untuk mengelola galeri acaramu.</p><label>Email<input type="email" defaultValue="admin@momenkita.id"/></label><label>Password<div className="password"><input type="password" defaultValue="password"/></div></label><div className="login-row"><label className="check"><input type="checkbox" defaultChecked/> Ingat saya</label><button>Lupa password?</button></div><button className="primary-button" onClick={async () => { if (supabase) { const email = (document.querySelector('input[type=email]') as HTMLInputElement).value; const password = (document.querySelector('input[type=password]') as HTMLInputElement).value; const result = await supabase.auth.signInWithPassword({ email, password }); if (result.error) return alert(result.error.message) } setLogged(true) }}>Masuk ke dashboard <Icon name="chevron" size={17}/></button><small className="demo-note">{backend ? 'Gunakan akun admin Supabase.' : 'Mode demo: isi env Supabase untuk autentikasi nyata.'}</small></div></div></main>

  const counts = { Pending: media.filter(x => x.status === 'Pending').length, Approved: media.filter(x => x.status === 'Approved').length, Rejected: media.filter(x => x.status === 'Rejected').length }
  return <main className="admin-page">
    <aside><Brand light/><nav><small>MENU UTAMA</small><button className="active"><Icon name="grid"/> Media Gallery <b>{counts.Pending}</b></button><button><Icon name="users"/> Guest Activity</button><button><Icon name="settings"/> Event Settings</button></nav><div className="side-event"><small>ACARA AKTIF</small><strong>Raka & Nadine</strong><span><i/> Live display aktif</span></div><button className="logout" onClick={() => setLogged(false)}><Icon name="logout"/> Keluar</button></aside>
    <section className="dashboard">
      <header><div><span>DASHBOARD</span><h1>Selamat sore, Admin.</h1><p>Ini yang terjadi di acaramu hari ini.</p></div><a href="/live"><i/> Buka Live Display <Icon name="chevron" size={16}/></a></header>
      <div className="stats"><article><span><Icon name="image"/></span><div><small>Total Unggahan</small><strong>{media.length}</strong><em>+6 dalam 1 jam</em></div></article><article><span><Icon name="users"/></span><div><small>Kontributor</small><strong>42</strong><em>+8 tamu baru</em></div></article><article><span><Icon name="image"/></span><div><small>Total Foto</small><strong>{media.filter(x=>x.type==='photo').length}</strong><em>86% dari media</em></div></article><article><span><Icon name="play"/></span><div><small>Total Video</small><strong>12</strong><em>14% dari media</em></div></article></div>
      <div className="moderation-head"><div><h2>Moderasi Media</h2><p>Tinjau dan kelola unggahan dari para tamu.</p></div><label className="auto"><span><strong>Auto-approve</strong><small>Media langsung tayang</small></span><input type="checkbox"/><i/></label></div>
      <div className="toolbar"><div className="tabs">{(['All','Pending','Approved','Rejected'] as const).map(x => <button className={filter === x ? 'active' : ''} onClick={() => setFilter(x)} key={x}>{x === 'All' ? 'Semua' : x} <span>{x === 'All' ? media.length : counts[x]}</span></button>)}</div><label className="search"><Icon name="search" size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama tamu..."/></label></div>
       <div className="media-grid">{list.map(item => <article className="media-card" key={item.id}><div className="media-image">{item.type === 'video' ? <video src={item.url} controls /> : <img src={item.url} alt={item.caption}/>}<span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>{item.featured && <span className="featured"><Icon name="star" size={12}/> Featured</span>}<div className="card-actions"><button title="Feature" onClick={async () => { if (supabase && typeof item.id === 'string') await supabase.from('media_uploads').update({ is_featured: !item.featured }).eq('id', item.id); update(item.id, {featured: !item.featured}) }}><Icon name="star" size={16}/></button><button title="Delete" onClick={async () => { if (supabase && typeof item.id === 'string') await supabase.from('media_uploads').delete().eq('id', item.id); setMedia(x => x.filter(m => m.id !== item.id)) }}><Icon name="trash" size={16}/></button></div></div><div className="media-info"><strong>{item.name}</strong><p>“{item.caption}”</p><small>{item.time}</small></div>{item.status === 'Pending' ? <div className="review-actions"><button onClick={() => moderate(item.id,'Rejected')}><Icon name="x" size={16}/> Tolak</button><button onClick={() => moderate(item.id,'Approved')}><Icon name="check" size={16}/> Setujui</button></div> : <div className="approved-row"><span><Icon name={item.status === 'Approved' ? 'check' : 'x'} size={15}/>{item.status === 'Approved' ? 'Tayang di galeri' : 'Tidak ditayangkan'}</span><button>•••</button></div>}</article>)}</div>
    </section>
  </main>
}

export default function App() {
  const path = window.location.pathname
  return path.startsWith('/admin') ? <AdminPage/> : path.startsWith('/live') ? <LivePage/> : <GuestPage/>
}
