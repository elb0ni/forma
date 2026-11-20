// Buscador de la barra de arriba (PLAN_REDISENO v3, Fase 18): un aprendiz por
// nombre o documento, una ficha por número o un instructor por nombre, y un
// clic lleva a su página. Atajo: "/" o Ctrl+K. El backend acota al alcance.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Ic } from './ui'

interface Resultado {
  aprendices: { id: number; nombre: string; documento: string; ficha_id: number; numero_ficha: string; etapa_id: number | null }[]
  fichas: { id: number; numero_ficha: string; programa: string | null }[]
  instructores: { id: string; nombre: string; coordinacion: string | null }[]
}
interface Item { k: string; titulo: string; sub: string; ir: string }

export function Buscador() {
  const rol = useAuthStore((s) => s.user?.rol)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [r, setR] = useState<Resultado | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [sel, setSel] = useState(0)
  const caja = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      const escribiendo = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '')
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !escribiendo)) {
        e.preventDefault(); caja.current?.focus()
      }
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [])

  useEffect(() => {
    const texto = q.trim()
    if (texto.length < 2) return
    let vivo = true
    const t = setTimeout(() => {
      api.get<Resultado>(`/buscar?q=${encodeURIComponent(texto)}`).then((x) => { if (vivo) { setR(x.data); setSel(0) } }).catch(() => undefined)
    }, 220)
    return () => { vivo = false; clearTimeout(t) }
  }, [q])

  const base = rol === 'INSTRUCTOR' ? '/dashboard/instructor' : rol === 'COORD_ACADEMICO' ? '/dashboard/coordinador' : '/dashboard/superadmin'
  const items: Item[] = q.trim().length < 2 || !r ? [] : [
    ...r.aprendices.map((a) => ({
      k: `a${a.id}`, titulo: a.nombre, sub: `Aprendiz · ${a.documento} · ficha ${a.numero_ficha}`,
      ir: rol === 'INSTRUCTOR'
        ? (a.etapa_id ? `${base}/etapa-productiva/${a.etapa_id}` : `${base}/etapa-productiva/nueva?aprendiz=${a.id}`)
        : (a.etapa_id ? `${base}/fichas/${a.ficha_id}/etapa/${a.etapa_id}` : `${base}/fichas/${a.ficha_id}`),
    })),
    ...r.fichas.map((f) => ({ k: `f${f.id}`, titulo: `Ficha ${f.numero_ficha}`, sub: f.programa ?? 'Ficha', ir: `${base}/fichas/${f.id}` })),
    ...r.instructores.map((i) => ({
      k: `i${i.id}`, titulo: i.nombre, sub: `Instructor${i.coordinacion ? ` · ${i.coordinacion}` : ''}`,
      ir: rol === 'COORD_ACADEMICO' ? `${base}/instructores/${i.id}` : `${base}/equipo/${i.id}`,
    })),
  ]
  function ir(it: Item) { setAbierto(false); setQ(''); setR(null); navigate(it.ir) }

  return (
    <div className="buscador">
      <Ic n="search" s={14} className="buscador__icono"/>
      <input
        ref={caja} value={q} placeholder={rol === 'INSTRUCTOR' ? 'Buscar aprendiz o ficha' : 'Buscar aprendiz, ficha o instructor'}
        aria-label="Buscar" onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onChange={(e) => { setQ(e.target.value); setAbierto(true) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
          else if (e.key === 'Enter' && items[sel]) ir(items[sel])
          else if (e.key === 'Escape') { setAbierto(false); caja.current?.blur() }
        }}
      />
      <kbd className="buscador__kbd">/</kbd>
      {abierto && q.trim().length >= 2 && r && (
        <div className="buscador__lista" role="listbox">
          {items.length === 0 && <div className="buscador__vacio">Nada con “{q.trim()}”.</div>}
          {items.map((it, i) => (
            <button key={it.k} type="button" role="option" aria-selected={i === sel} data-sel={i === sel || undefined}
              onMouseDown={(e) => e.preventDefault()} onClick={() => ir(it)} onMouseEnter={() => setSel(i)}>
              <span className="buscador__t">{it.titulo}</span>
              <span className="buscador__s">{it.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
