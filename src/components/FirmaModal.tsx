import { useEffect, useRef, useState } from 'react'
import { Modal, Btn, Ic } from './ui'
import api from '../lib/api'

// ─── Lienzo de firma (dibujar con mouse/touch o subir una imagen) ───────────────

export function FirmaPad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  "use no memo"
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)

  // Pinta una imagen existente (data URL) dentro del lienzo al abrir/editar.
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    if (value && value.startsWith('data:image')) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height)
      img.src = value
    }
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y)
    canvasRef.current!.setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke()
    dirty.current = true
  }
  function end() {
    if (!drawing.current) return
    drawing.current = false
    if (dirty.current) onChange(canvasRef.current!.toDataURL('image/png'))
  }
  function clear() {
    const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    dirty.current = false; onChange(null)
  }
  function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const c = canvasRef.current!; const ctx = c.getContext('2d')!
      const img = new Image()
      img.onload = () => { ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); onChange(c.toDataURL('image/png')) }
      img.src = dataUrl
    }
    reader.readAsDataURL(f)
  }

  return (
    <div>
      <div style={{ border: '1px dashed #c7d2fe', borderRadius: 10, background: '#fafafe', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={520}
          height={180}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          style={{ width: '100%', height: 180, touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        />
        <div style={{ position: 'absolute', left: 12, bottom: 10, right: 12, borderTop: '1px solid #d4d4d8', pointerEvents: 'none' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 11.5, color: '#71717a' }}>Dibuja tu firma con el mouse o el dedo.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#4f46e5', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Ic n="upload" s={13}/> Subir imagen
            <input type="file" accept="image/*" onChange={subir} style={{ display: 'none' }}/>
          </label>
          <button onClick={clear} style={{ fontSize: 12, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Limpiar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de firma (admin para cualquier usuario; self para el propio) ─────────

export function FirmaModal({ userId, nombre, onClose, onSaved }: {
  // userId: UUID del usuario (admin) | 'me' (self-service)
  userId: string; nombre?: string; onClose: () => void; onSaved?: () => void
}) {
  "use no memo"
  const self = userId === 'me'
  const [firma, setFirma] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const url = self ? '/usuarios/me/firma' : `/usuarios/${userId}/firma`
    api.get<{ firma: string | null }>(url)
      .then(r => setFirma(r.data.firma))
      .catch(() => setFirma(null))
      .finally(() => setLoading(false))
  }, [userId])

  async function guardar() {
    setBusy(true); setErr(null)
    try {
      if (self) await api.patch('/usuarios/me/firma', { firma: firma ?? '' })
      else await api.patch(`/usuarios/${userId}`, { firma: firma ?? '' })
      onSaved?.(); onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar la firma.')
      setBusy(false)
    }
  }

  return (
    <Modal title={self ? 'Mi firma' : `Firma · ${nombre ?? 'usuario'}`} icon="edit" onClose={onClose} width={580}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn variant="accent" icon="check" onClick={guardar} disabled={busy || loading}>{busy ? 'Guardando…' : 'Guardar firma'}</Btn>
        </>
      }>
      <div style={{ fontSize: 12.5, color: '#52525b', marginBottom: 14 }}>
        Esta firma aparecerá en las guías de aprendizaje y reportes descargables. Un documento es válido
        cuando lleva la firma del instructor <strong>y</strong> la del coordinador.
      </div>
      {loading
        ? <div style={{ height: 180, display: 'grid', placeItems: 'center', color: '#a1a1aa', fontSize: 13 }}>Cargando…</div>
        : <FirmaPad value={firma} onChange={setFirma}/>}
      {err && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{err}</div>}
    </Modal>
  )
}
