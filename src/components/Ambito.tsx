// Selector de ámbito en la barra de arriba: centro (solo regional) y
// coordinación (regional con un centro elegido, o subdirector).
import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuthStore } from '../store/auth'
import { useAmbito } from '../store/ambito'

interface Opcion { id: number; nombre: string }

export function AmbitoSelector() {
  const rol = useAuthStore((s) => s.user?.rol)
  const centroUsuario = useAuthStore((s) => s.user?.centro_formacion_id ?? null)
  const { centroId, coordId, setCentro, setCoord } = useAmbito()
  const [centros, setCentros] = useState<Opcion[]>([])
  const [coords, setCoords] = useState<Opcion[]>([])
  const regional = rol === 'SUPER_ADMIN'
  const centro = regional ? centroId : centroUsuario

  useEffect(() => {
    if (!regional) return
    api.get<Opcion[]>('/centros').then((r) => setCentros(r.data)).catch(() => setCentros([]))
  }, [regional])
  useEffect(() => {
    let vivo = true
    const q = centro ? `/coordinaciones?centro_id=${centro}` : null
    if (q) api.get<Opcion[]>(q).then((r) => { if (vivo) setCoords(r.data) }).catch(() => { if (vivo) setCoords([]) })
    return () => { vivo = false }
  }, [centro])

  if (rol !== 'SUPER_ADMIN' && rol !== 'SUBDIRECTOR') return null
  const corto = (n: string) => n.replace(/^Coordinaci[oó]n Acad[eé]mica de /i, '').replace(/^Centro (de |para el |Nacional )?/i, '')
  return (
    <div className="ambito" role="group" aria-label="Ámbito">
      <span className="ambito__k">Viendo</span>
      {regional && (
        <select value={centroId ?? ''} onChange={(e) => setCentro(e.target.value ? Number(e.target.value) : null)} aria-label="Centro">
          <option value="">Los 4 centros</option>
          {centros.map((c) => <option key={c.id} value={c.id}>{corto(c.nombre)}</option>)}
        </select>
      )}
      {centro != null && (
        <select value={coordId ?? ''} onChange={(e) => setCoord(e.target.value ? Number(e.target.value) : null)} aria-label="Coordinación">
          <option value="">Todas las coordinaciones</option>
          {coords.filter((c) => c.id).map((c) => <option key={c.id} value={c.id}>{corto(c.nombre)}</option>)}
        </select>
      )}
    </div>
  )
}
