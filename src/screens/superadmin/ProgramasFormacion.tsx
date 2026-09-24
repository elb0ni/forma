import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Ic, Btn, Card, Bdg, Pager } from '../../components/ui'
import type { IcName } from '../../components/ui'
import type { ProgramaResumen } from '../../types'
import { fd, CenterState, centroLabel, centroTone, ProxPill } from '../shared/parts'
import { FiltroGrupo, FiltrosBar, FiltrosResumen, SortCaret } from '../shared/filtros'
import type { FiltroOpcion, SortDir } from '../shared/filtros'
import { FichaDetalle } from '../shared/FichasAdmin'
import api from '../../lib/api'
import '../shared/ProgramasFormacion.css'
import '../shared/filtros.css'

const BASE_FICHAS = '/dashboard/superadmin/fichas'
const PAGE_SIZE = 12

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVersion(v: string | number): string {
  return `V${String(v).replace(/^v/i, '').padStart(3, '0')}`
}

const SHORT_STOPWORDS = new Set(['de', 'del', 'y', 'e', 'la', 'el', 'en', 'los', 'las', 'para', 'con', 'a'])
function programaShort(nombre: string): string {
  const sigla = nombre
    .split(/\s+/)
    .filter(w => w && !SHORT_STOPWORDS.has(w.toLowerCase()))
    .map(w => w[0])
    .join('')
    .toUpperCase()
  return sigla.slice(0, 4) || nombre.slice(0, 2).toUpperCase()
}

function nivelColor(nivel: string) {
  const n = nivel.toUpperCase()
  if (n.includes('TECNÓLOGO'))       return { bg: '#dbeafe', fg: '#1d4ed8' }
  if (n.includes('TÉCNICO'))         return { bg: '#dcfce7', fg: '#15803d' }
  if (n.includes('ESPECIALIZACIÓN')) return { bg: '#f3e8ff', fg: '#6b21a8' }
  return                                    { bg: '#f1f1f3', fg: '#52525b' }
}

function nivelCorto(nivel: string): string {
  const n = nivel.toUpperCase()
  if (n.includes('TECNÓLOGO'))       return 'Tecnólogo'
  if (n.includes('ESPECIALIZACIÓN')) return 'Especialización'
  if (n.includes('TÉCNICO'))         return 'Técnico'
  return nivel.charAt(0) + nivel.slice(1).toLowerCase()
}

function Sk({ w, h, r = 5, delay = 0 }: { w: string | number; h: number; r?: number; delay?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, animationDelay: `${delay}ms` }}/>
}

// ─── Tipos del detalle (GET /api/programas/:id/detalle) ───────────────────────

interface FichaPrograma {
  id: number
  numero_ficha: string
  estado: string
  jornada: string | null
  etapa: string | null
  centro_nombre: string
  coordinacion_nombre: string | null
  coordinador_nombre: string | null   // coordinador académico de la ficha
  fecha_fin_productiva: string | null
  dias_restantes: number | null
  instructor_practica: string | null
  aprendices: number               // total de aprendices de la ficha (reporte de juicios)
  aprendices_en_practica: number   // de esos, con etapa productiva en ejecución
}

export interface ProgramaDetalleData {
  programa: {
    id: number
    nombre: string
    codigo: string
    version: number
    nivel_formacion: string
    titulo_otorga: string
    descripcion: string | null
    estado: 'VIGENTE' | 'INACTIVO'
    fecha_inicio: string | null
    created_at: string
    updated_at: string
  }
  kpi: {
    fichas_total: number
    fichas_activas: number
    fichas_finalizadas: number
    fichas_en_practica: number
    fichas_sin_instructor: number
    centros: number
    coordinaciones: number
    aprendices_practica: number
  }
  fichas: FichaPrograma[]
  por_centro: Array<{
    centro_id: number
    centro_nombre: string
    fichas: number
    fichas_practica: number
    con_instructor: number
    sin_instructor: number
    aprendices_practica: number
  }>
  alertas: {
    fichas_sin_instructor: Array<{ id: number; numero_ficha: string; centro_nombre: string; dias_restantes: number | null }>
    conceptos_no_favorables: Array<{ seguimiento_id: number; tipo_momento: string; fecha: string; numero_ficha: string; aprendiz_nombre: string; instructor_nombre: string | null; con_plan_mejoramiento: boolean }>
    etapas_vencidas: Array<{ etapa_id: number; estado: string; fecha_fin_estimada: string; dias_vencida: number; numero_ficha: string; aprendiz_nombre: string; instructor_nombre: string | null }>
  }
}

// ─── Pills de ficha (locales; el lenguaje visual sigue a FichasAdmin) ─────────

function EstadoFichaPill({ estado }: { estado: string }) {
  const map: Record<string, { label: string; tone: 'ok' | 'blue' | 'err' | 'neutral' }> = {
    EN_EJECUCION: { label: 'En ejecución', tone: 'ok' },
    FINALIZADA:   { label: 'Finalizada',   tone: 'blue' },
    SUSPENDIDA:   { label: 'Suspendida',   tone: 'err' },
  }
  const m = map[estado] ?? { label: estado, tone: 'neutral' as const }
  return <Bdg tone={m.tone}>{m.label}</Bdg>
}

function EtapaPill({ etapa }: { etapa: string | null }) {
  if (!etapa) return <span style={{ color: '#a1a1aa', fontSize: 12 }}>—</span>
  if (etapa === 'PRACTICA') return <Bdg tone="accent" icon="briefcase">Práctica</Bdg>
  return <Bdg tone="neutral" icon="layers">Lectiva</Bdg>
}

// ════════════════════════════════════════════════════════════════════════════
//  LISTA
// ════════════════════════════════════════════════════════════════════════════

// El orden de la tabla se maneja con clic en el encabezado de cada columna
// (asc/desc). `sort` y `dir` van como parámetros de URL.
type SortKey = 'programa' | 'nivel' | 'practica' | 'sin_instructor' | 'proxima'

const SORT_DEFAULT: SortKey = 'practica'
const DIR_DEFAULT: SortDir  = 'desc'

// Dirección natural (primer clic) de cada columna.
const COL_DEF_DIR: Record<SortKey, SortDir> = {
  programa: 'asc', nivel: 'asc', practica: 'desc', sin_instructor: 'desc', proxima: 'asc',
}

const PROG_COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'programa',       label: 'Programa'                     },
  { key: 'nivel',          label: 'Nivel'                        },
  { key: 'practica',       label: 'Fichas en práctica', num: true },
  { key: 'sin_instructor', label: 'Sin instructor',     num: true },
  { key: 'proxima',        label: 'Próxima a práctica'           },
]

// Compara dos programas por una columna en su dirección ascendente. Para
// 'proxima', los que no tienen fecha se hunden aparte (ver aplicación del sort).
function cmpProgramaAsc(a: ProgramaResumen, b: ProgramaResumen, key: SortKey): number {
  const tie = a.nombre.localeCompare(b.nombre, 'es')
  switch (key) {
    case 'nivel':          return a.nivel_formacion.localeCompare(b.nivel_formacion, 'es') || tie
    case 'practica':       return (a.fichas_en_practica - b.fichas_en_practica) || tie
    case 'sin_instructor': return (a.fichas_sin_instructor - b.fichas_sin_instructor) || tie
    case 'proxima':        return (a.proxima_a_practica ?? '').localeCompare(b.proxima_a_practica ?? '') || tie
    default:               return tie   // 'programa'
  }
}

type PractFilter = '' | 'con' | 'sin' | 'sin_instr'

// GET /api/programas/resumen-centros
interface CentroResumen {
  id: number
  nombre: string
  codigo: string
  ciudad: string
  fichas_en_practica: number
  fichas_sin_instructor: number
  programas_en_practica: number
  aprendices_en_practica: number
  etapas_vencidas: number          // etapas fuera de plazo -> se muestran como "por cerrar"
  instructores: number             // instructores con asignación de práctica activa en el centro
  proxima_a_practica: string | null
}

const SEL_STYLE: React.CSSProperties = {
  height: 34, padding: '0 10px', border: '1px solid #e4e4e7', borderRadius: 8,
  fontSize: 12.5, background: '#fff', color: '#18181b',
  fontFamily: 'Inter, sans-serif', cursor: 'pointer', outline: 'none',
}

const PRACT_LABEL: Record<PractFilter, string> = {
  '':          'Todos los programas',
  con:         'Con práctica activa',
  sin:         'Sin práctica activa',
  sin_instr:   'Con fichas sin instructor',
}

function matchPract(p: ProgramaResumen, v: PractFilter): boolean {
  if (v === 'con')       return p.fichas_en_practica > 0
  if (v === 'sin')       return p.fichas_en_practica === 0
  if (v === 'sin_instr') return p.fichas_sin_instructor > 0
  return true
}

// ── Panel de centros: los 4 en un 2×2 compacto. Cada card es además el filtro
//    por centro (clic → acota toda la vista a ese centro). ──

function CentroCardSkeleton() {
  return (
    <div className="prog-centro-card" style={{ cursor: 'default' }}>
      <div className="prog-centro-card__top"><Sk w={24} h={24} r={7}/><Sk w="52%" h={12}/></div>
      <Sk w="70%" h={10}/>
      <div style={{ marginTop: 2 }}><Sk w="100%" h={6} r={6}/></div>
    </div>
  )
}

function CentrosPanel({ centros, value, onPick, loading }: {
  centros: CentroResumen[]; value: string; onPick: (id: string) => void; loading: boolean
}) {
  "use no memo"
  if (loading && centros.length === 0) {
    return (
      <div>
        <div className="prog-centros__head"><span>Centros</span></div>
        <div className="prog-centros">{[0, 1, 2, 3].map(i => <CentroCardSkeleton key={i}/>)}</div>
      </div>
    )
  }
  if (centros.length === 0) return null

  const byId  = [...centros].sort((a, b) => a.id - b.id)
  const orden = [...centros].sort((a, b) =>
    b.fichas_en_practica - a.fichas_en_practica || a.nombre.localeCompare(b.nombre, 'es'))
  const totalEnPractica = Math.max(1, centros.reduce((s, c) => s + c.fichas_en_practica, 0))

  return (
    <div>
      <div className="prog-centros__head"><span>Centros</span></div>
      <div className="prog-centros">
        {orden.map(c => {
          const tone     = centroTone(byId.findIndex(x => x.id === c.id))
          const active   = String(c.id) === value
          const conInstr = c.fichas_en_practica - c.fichas_sin_instructor
          const pct      = c.fichas_en_practica > 0 ? Math.round((conInstr / c.fichas_en_practica) * 100) : 0
          // Barra = qué parte del total de fichas en práctica de la regional lleva
          // el centro; color = cobertura de instructor.
          const share    = c.fichas_en_practica > 0 ? Math.round((c.fichas_en_practica / totalEnPractica) * 100) : 0
          const barPct   = c.fichas_en_practica > 0 ? Math.max(4, share) : 0
          const barCol   = c.fichas_en_practica === 0 ? '#d4d4d8'
            : c.fichas_sin_instructor === 0 ? '#16a34a'
            : pct >= 60 ? '#c2410c' : '#dc2626'
          const nota = c.fichas_sin_instructor > 0
            ? `${c.fichas_sin_instructor} ficha${c.fichas_sin_instructor === 1 ? '' : 's'} sin instructor`
            : c.etapas_vencidas > 0
              ? `${c.etapas_vencidas} etapa${c.etapas_vencidas === 1 ? '' : 's'} por cerrar`
              : null

          return (
            <button
              key={c.id}
              onClick={() => onPick(active ? '' : String(c.id))}
              className={`prog-centro-card${active ? ' prog-centro-card--active' : ''}`}
              title={c.nombre}
            >
              <div className="prog-centro-card__top">
                <span className="prog-centro-card__badge" style={{ background: tone }}><Ic n="shield" s={12}/></span>
                <span className="prog-centro-card__name">{centroLabel(c.nombre)}</span>
                {nota
                  ? <span className="prog-centro-card__flag"/>
                  : c.fichas_en_practica > 0 && <span className="prog-centro-card__flag prog-centro-card__flag--ok"/>}
              </div>

              <div className="prog-centro-card__line">
                <b style={{ color: c.fichas_en_practica > 0 ? '#0a0a0b' : '#a1a1aa' }}>{c.fichas_en_practica}</b> fichas
                <span className="prog-centro-card__sep">·</span>
                <b>{c.instructores}</b> instructor{c.instructores === 1 ? '' : 'es'}
              </div>

              {c.fichas_en_practica > 0 ? (
                <div className="prog-centro-card__bar" title={`${share}% de las fichas en práctica de la regional`}>
                  <span style={{ width: `${barPct}%`, background: barCol }}/>
                </div>
              ) : (
                <div className="prog-centro-card__cov" style={{ color: '#c4c4cc' }}>sin práctica activa</div>
              )}

              {nota && <div className="prog-centro-card__note">{nota}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Sk w={320} h={38} r={10}/>
        <Sk w={110} h={38} r={10}/>
      </div>
      <div style={{ marginTop: 16 }}>
        <Card style={{ overflow: 'hidden' }}>
          <div className="prog-table-scroll">
            <table className="prog-table">
              <tbody>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f1f3' }}>
                    <td className="prog-table__td"><Sk w={`${55 + (i % 4) * 8}%`} h={14} delay={i * 50}/></td>
                    <td className="prog-table__td"><Sk w={64} h={14} delay={i * 50 + 10}/></td>
                    <td className="prog-table__td"><Sk w={28} h={14} delay={i * 50 + 20}/></td>
                    <td className="prog-table__td"><Sk w={28} h={14} delay={i * 50 + 30}/></td>
                    <td className="prog-table__td"><Sk w={60} h={20} r={20} delay={i * 50 + 40}/></td>
                    <td className="prog-table__td"/>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

function ProgramasList() {
  "use no memo"
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const q      = params.get('q') ?? ''
  const nivel  = params.get('nivel') ?? ''
  const estado = params.get('estado') ?? ''
  const pract  = (params.get('pract') as PractFilter) || ''
  const centro = params.get('centro') ?? ''
  const sort   = (params.get('sort') as SortKey) || SORT_DEFAULT
  const dir    = (params.get('dir') as SortDir) || (sort === SORT_DEFAULT ? DIR_DEFAULT : COL_DEF_DIR[sort])
  const page   = Number(params.get('page') ?? '0') || 0

  const [panelOpen, setPanelOpen] = useState(false)
  const [data, setData]         = useState<ProgramaResumen[] | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [centros, setCentros]   = useState<CentroResumen[]>([])
  const [centrosLoading, setCentrosLoading] = useState(true)

  useEffect(() => {
    let live = true
    api.get<CentroResumen[]>('/programas/resumen-centros')
      .then(r => { if (live) setCentros(r.data) })
      .catch(() => {})
      .finally(() => { if (live) setCentrosLoading(false) })
    return () => { live = false }
  }, [])

  // El centro es filtro server-side: acota TODO el rollup a ese centro, así que
  // se re-consulta. El resto (buscador, nivel, vigencia, práctica) es client-side.
  useEffect(() => {
    let live = true
    api.get<ProgramaResumen[]>(`/programas${centro ? `?centro_id=${centro}` : ''}`)
      .then(({ data }) => { if (live) { setData(data); setError(null) } })
      .catch(err => {
        if (!live) return
        setError(axios.isAxiosError(err) ? (err.response?.data?.message ?? err.message) : 'No se pudo conectar con el servidor')
      })
      .finally(() => { if (live) setFetching(false) })
    return () => { live = false }
  }, [centro, reloadKey])

  function setParam(key: string, value: string | null) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('page')
      return next
    }, { replace: true })
  }
  function pickCentro(id: string) {
    if ((id || '') !== centro) setFetching(true)   // solo el cambio de centro re-consulta
    setParam('centro', id || null)
  }
  const retry = () => { setFetching(true); setError(null); setReloadKey(k => k + 1) }
  function limpiarTodo() {
    if (centro) setFetching(true)
    setParams(prev => {
      const next = new URLSearchParams()
      const s = prev.get('sort'); if (s) next.set('sort', s)
      const d = prev.get('dir');  if (d) next.set('dir', d)
      return next
    }, { replace: true })
  }

  // Clic en un encabezado de columna: mismo campo -> invierte; otro -> su
  // dirección natural. Los parámetros se omiten cuando coinciden con el default.
  function sortBy(k: SortKey) {
    const nDir: SortDir = k === sort ? (dir === 'asc' ? 'desc' : 'asc') : COL_DEF_DIR[k]
    const defForK: SortDir = k === SORT_DEFAULT ? DIR_DEFAULT : COL_DEF_DIR[k]
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (k === SORT_DEFAULT) next.delete('sort'); else next.set('sort', k)
      if (nDir === defForK) next.delete('dir'); else next.set('dir', nDir)
      next.delete('page')
      return next
    }, { replace: true })
  }

  const all = useMemo(() => data ?? [], [data])
  const niveles = useMemo(
    () => [...new Set(all.map(p => p.nivel_formacion))].sort((a, b) => a.localeCompare(b, 'es')),
    [all],
  )

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const rows = all.filter(p => {
      if (nivel && p.nivel_formacion !== nivel) return false
      if (estado && p.estado !== estado) return false
      if (!matchPract(p, pract)) return false
      if (ql && !p.nombre.toLowerCase().includes(ql) && !p.codigo.toLowerCase().includes(ql)) return false
      return true
    })
    return rows.sort((a, b) => {
      if (sort === 'proxima') {   // programas sin fecha de próxima entrada, al final
        const an = !a.proxima_a_practica, bn = !b.proxima_a_practica
        if (an !== bn) return an ? 1 : -1
      }
      const r = cmpProgramaAsc(a, b, sort)
      return dir === 'asc' ? r : -r
    })
  }, [all, q, nivel, estado, pract, sort, dir])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = filtered.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE)

  const centroSel = centros.find(c => String(c.id) === centro) ?? null

  // ─── Opciones del panel de filtros (conteo faceteado en lo client-side) ─────
  const ql = q.trim().toLowerCase()
  const passQ = (p: ProgramaResumen) => !ql || p.nombre.toLowerCase().includes(ql) || p.codigo.toLowerCase().includes(ql)
  const practBase  = all.filter(p => passQ(p) && (!nivel || p.nivel_formacion === nivel) && (!estado || p.estado === estado))
  const nivelBase  = all.filter(p => passQ(p) && matchPract(p, pract) && (!estado || p.estado === estado))
  const estadoBase = all.filter(p => passQ(p) && matchPract(p, pract) && (!nivel || p.nivel_formacion === nivel))

  const practOpts: FiltroOpcion[] = (['', 'con', 'sin', 'sin_instr'] as PractFilter[])
    .map(k => ({ key: k, label: PRACT_LABEL[k], count: practBase.filter(p => matchPract(p, k)).length }))
  const nivelOpts: FiltroOpcion[] = [
    { key: '', label: 'Todos los niveles', count: nivelBase.length },
    ...niveles.map(n => ({ key: n, label: nivelCorto(n), count: nivelBase.filter(p => p.nivel_formacion === n).length })),
  ]
  const estadoOpts: FiltroOpcion[] = [
    { key: '',         label: 'Vigentes e inactivos', count: estadoBase.length },
    { key: 'VIGENTE',  label: 'Solo vigentes',        count: estadoBase.filter(p => p.estado === 'VIGENTE').length },
    { key: 'INACTIVO', label: 'Solo inactivos',       count: estadoBase.filter(p => p.estado === 'INACTIVO').length },
  ]
  const centroOpts: FiltroOpcion[] = [
    { key: '', label: 'Todos los centros' },
    ...[...centros].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(c => ({ key: String(c.id), label: centroLabel(c.nombre), count: c.programas_en_practica })),
  ]

  const filtrosActivos = (pract ? 1 : 0) + (nivel ? 1 : 0) + (estado ? 1 : 0) + (centro ? 1 : 0)
  const resumen: string[] = []
  if (centroSel) resumen.push(centroLabel(centroSel.nombre))
  if (pract)  resumen.push(PRACT_LABEL[pract])
  if (nivel)  resumen.push(nivelCorto(nivel))
  if (estado) resumen.push(estado === 'VIGENTE' ? 'Solo vigentes' : 'Solo inactivos')

  if (data === null && (fetching || error)) {
    return (
      <div className="prog-view">
        <div className="programas-header"><div><h2 className="programas-header__title">Programas de formación</h2></div></div>
        <div className="prog-layout">
          <div className="prog-layout__main">
            {error ? (
              <Card style={{ padding: 24 }}>
                <div className="prog-error">
                  <div className="prog-error__icon-wrap"><Ic n="alert" s={16} style={{ color: '#b91c1c' }}/></div>
                  <div>
                    <div className="prog-error__title">No se pudieron cargar los programas</div>
                    <div className="prog-error__msg">{error}</div>
                    <div className="prog-error__retry"><Btn variant="secondary" size="sm" icon="refresh" onClick={retry}>Reintentar</Btn></div>
                  </div>
                </div>
              </Card>
            ) : (
              <ListSkeleton/>
            )}
          </div>
          <aside className="prog-layout__aside">
            <CentrosPanel centros={centros} value={centro} onPick={pickCentro} loading={centrosLoading}/>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="prog-view">
      <div className="programas-header">
        <div>
          <h2 className="programas-header__title">Programas de formación</h2>
          <p className="programas-header__sub">
            El estado de la etapa práctica por programa{centroSel ? <> · <strong style={{ color: '#4f46e5' }}>{centroLabel(centroSel.nombre)}</strong></> : ''}.
          </p>
        </div>
      </div>

      <div className="prog-layout">
        <div className="prog-layout__main">
      {all.length === 0 ? (
        <CenterState
          icon="layers"
          title={centroSel ? 'Sin programas con fichas en este centro' : 'Sin programas en el catálogo'}
          sub={centroSel ? 'Quitá el filtro de centro para ver todo el catálogo.' : 'Todavía no hay programas de formación registrados.'}
        />
      ) : (
        <>
          <FiltrosBar
            search={q}
            onSearch={v => setParam('q', v || null)}
            placeholder="Buscar programa o código…"
            activeCount={filtrosActivos}
            open={panelOpen}
            onToggle={() => setPanelOpen(o => !o)}
          />

          {!panelOpen && <FiltrosResumen items={resumen} onClear={limpiarTodo}/>}

          {panelOpen && (
            <div className="ff-panel pop-in">
              <div className="ff-panel__grid">
                <FiltroGrupo
                  title="Práctica" icon="briefcase"
                  options={practOpts} value={pract}
                  onPick={k => setParam('pract', k || null)}
                />
                <FiltroGrupo
                  title="Nivel" icon="layers"
                  options={nivelOpts} value={nivel}
                  onPick={k => setParam('nivel', k || null)}
                />
                <FiltroGrupo
                  title="Vigencia" icon="checkCircle"
                  options={estadoOpts} value={estado}
                  onPick={k => setParam('estado', k || null)}
                />
                {centros.length > 1 && (
                  <FiltroGrupo
                    title="Centro" icon="shield"
                    options={centroOpts} value={centro}
                    onPick={k => pickCentro(k)}
                  />
                )}
              </div>
              <div className="ff-panel__foot">
                <div className="ff-foot__spacer"/>
                <div className="ff-foot__actions">
                  <button className="ff-clear" onClick={limpiarTodo} disabled={!filtrosActivos}>
                    <Ic n="refresh" s={12}/> Limpiar todo
                  </button>
                  <Btn variant="secondary" size="sm" onClick={() => setPanelOpen(false)}>Listo</Btn>
                </div>
              </div>
            </div>
          )}

          <div style={{ opacity: fetching ? 0.45 : 1, pointerEvents: fetching ? 'none' : undefined, transition: 'opacity 160ms' }}>
            {filtered.length === 0 ? (
              <Card>
                <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Ic n={q ? 'search' : 'folder'} s={26} style={{ color: '#a1a1aa' }}/>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>
                    {q ? `Sin programas que coincidan con "${q.trim()}"` : 'Ningún programa cumple estos filtros'}
                  </div>
                </div>
              </Card>
            ) : (
              <>
                <Card style={{ overflow: 'hidden' }}>
                  <div className="prog-table-scroll">
                    <table className="prog-table">
                      <thead>
                        <tr className="prog-table__head-row">
                          {PROG_COLS.map(c => {
                            const on = sort === c.key
                            return (
                              <th
                                key={c.key}
                                className={`prog-table__th prog-sort-th${c.num ? ' prog-table__th--num' : ''}${on ? ' prog-sort-th--active' : ''}`}
                                onClick={() => sortBy(c.key)}
                                title={`Ordenar por ${c.label.toLowerCase()}`}
                              >
                                {c.label}
                                <SortCaret active={on} dir={dir}/>
                              </th>
                            )
                          })}
                          <th className="prog-table__th"/>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map(p => {
                          const nc = nivelColor(p.nivel_formacion)
                          return (
                            <tr
                              key={p.id}
                              className="nx-row"
                              onClick={() => navigate(String(p.id), { relative: 'path' })}
                              style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer' }}
                            >
                              <td className="prog-table__td">
                                <div className="prog-table__name-cell">
                                  <div className="prog-table__badge">{programaShort(p.nombre)}</div>
                                  <div style={{ minWidth: 0 }}>
                                    <div className="prog-table__name">{p.nombre}</div>
                                    <div className="prog-table__meta">
                                      <span className="prog-code">{p.codigo} · {fmtVersion(p.version)}</span>
                                      <span style={{ color: '#d4d4d8' }}>·</span>
                                      <span style={{ fontSize: 11, color: '#71717a' }}>{p.fichas_total} ficha{p.fichas_total === 1 ? '' : 's'}{centroSel ? ' aquí' : ''}</span>
                                      {p.estado === 'INACTIVO' && <Bdg tone="neutral">Inactivo</Bdg>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="prog-table__td">
                                <span className="prog-table__nivel-badge" style={{ background: nc.bg, color: nc.fg }}>
                                  {nivelCorto(p.nivel_formacion)}
                                </span>
                              </td>
                              <td className="prog-table__td--num">
                                {p.fichas_en_practica > 0
                                  ? <span style={{ color: '#4f46e5' }}>{p.fichas_en_practica}</span>
                                  : <span style={{ color: '#d4d4d8', fontWeight: 400 }}>—</span>}
                              </td>
                              <td className="prog-table__td--num">
                                {p.fichas_sin_instructor > 0
                                  ? <span style={{ color: '#dc2626' }}>{p.fichas_sin_instructor}</span>
                                  : <span style={{ color: '#d4d4d8', fontWeight: 400 }}>—</span>}
                              </td>
                              <td className="prog-table__td"><ProxPill iso={p.proxima_a_practica}/></td>
                              <td className="prog-table__td" style={{ textAlign: 'right' }}>
                                <Ic n="chevronRight" s={15} style={{ color: '#d4d4d8', verticalAlign: 'middle' }}/>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Pager page={curPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE}
                  onPage={p => setParams(prev => { const n = new URLSearchParams(prev); if (p) n.set('page', String(p)); else n.delete('page'); return n }, { replace: true })}
                  noun="programas"/>
              </>
            )}
          </div>
        </>
      )}
        </div>
        <aside className="prog-layout__aside">
          <CentrosPanel centros={centros} value={centro} onPick={pickCentro} loading={centrosLoading}/>
        </aside>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  DETALLE
// ════════════════════════════════════════════════════════════════════════════

type DetState =
  | { status: 'loading' }
  | { status: 'ok'; data: ProgramaDetalleData }
  | { status: 'error' }
  | { status: 'notfound' }

function KpiBox({ label, value, sub, icon, tone, hover }: {
  label: string; value: React.ReactNode; sub?: string; icon: IcName; tone?: string
  hover?: React.ReactNode
}) {
  return (
    <Card style={{ padding: 16, overflow: 'visible' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        {hover ? (
          <div className="prog-kpi-trigger" tabIndex={0}>
            <Ic n={icon} s={15} style={{ color: tone ?? '#a1a1aa' }}/>
            <Ic n="chevronDown" s={9} className="prog-kpi-trigger__caret"/>
            <div className="prog-kpi-pop">
              <div className="prog-kpi-pop__panel">{hover}</div>
            </div>
          </div>
        ) : (
          <Ic n={icon} s={15} style={{ color: tone ?? '#a1a1aa' }}/>
        )}
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 600, color: tone ?? '#0a0a0b', marginTop: 10 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}

function ProgramaKpis({ kpi, porCentro }: {
  kpi: ProgramaDetalleData['kpi']
  porCentro: ProgramaDetalleData['por_centro']
}) {
  const conInstructor = kpi.fichas_en_practica - kpi.fichas_sin_instructor
  const pct = kpi.fichas_en_practica > 0 ? Math.round((conInstructor / kpi.fichas_en_practica) * 100) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
      <KpiBox label="Fichas en práctica" value={kpi.fichas_en_practica} sub={`${kpi.fichas_activas} en ejecución`} icon="briefcase" tone="#4f46e5"/>
      <KpiBox label="Aprendices en práctica" value={kpi.aprendices_practica} icon="users"/>
      <KpiBox
        label="Cobertura de instructor"
        value={kpi.fichas_en_practica > 0 ? <>{conInstructor}/{kpi.fichas_en_practica} <span style={{ fontSize: 13, color: '#71717a' }}>{pct}%</span></> : '—'}
        sub={kpi.fichas_sin_instructor > 0 ? `${kpi.fichas_sin_instructor} ficha${kpi.fichas_sin_instructor === 1 ? '' : 's'} sin asignar` : 'todas cubiertas'}
        icon="user"
        tone={kpi.fichas_sin_instructor > 0 ? '#c2410c' : '#16a34a'}
      />
      <KpiBox
        label="Centros"
        value={kpi.centros}
        sub={`${kpi.coordinaciones} coordinaciones`}
        icon="shield"
        hover={porCentro.length > 0 ? <CentrosRollup rows={porCentro}/> : undefined}
      />
      <KpiBox label="Fichas del programa" value={kpi.fichas_total} sub={`${kpi.fichas_finalizadas} finalizadas`} icon="folder"/>
    </div>
  )
}

// Alertas de práctica: un menú de iconos flotante (sticky, arriba a la derecha
// del detalle). Cada ícono = una categoría con ítems; al hacer clic se abre un
// pop-up animado con la lista y cada fila enlaza a su ficha. No es una tabla.
type AlertaId = 'sin_instructor' | 'no_favorables' | 'vencidas'

const ALERTA_META: Record<AlertaId, { label: string; tone: string; bg: string; bd: string; icon: IcName; hint: string }> = {
  sin_instructor: {
    label: 'Sin instructor', tone: '#c2410c', bg: '#fff7ed', bd: '#fed7aa', icon: 'user',
    hint: 'Fichas en práctica sin instructor de seguimiento asignado.',
  },
  no_favorables: {
    label: 'Conceptos por resolver', tone: '#b45309', bg: '#fffbeb', bd: '#fde68a', icon: 'fileText',
    hint: 'Seguimientos con concepto no favorable. Se resuelven con la coordinación y un plan de mejoramiento acordado con el instructor — no cuentan en contra suya mientras haya plan en curso.',
  },
  vencidas: {
    label: 'Etapas por cerrar', tone: '#c2410c', bg: '#fff7ed', bd: '#fed7aa', icon: 'clock',
    hint: 'La fecha estimada de fin ya pasó y la etapa sigue abierta. Ciérrala o ajusta la fecha.',
  },
}

function AlertaRow({ fichaId, onOpen, title, sub, chip, chipTone }: {
  fichaId: number | null
  onOpen: (id: number) => void
  title: string
  sub: string
  chip: string
  chipTone: { fg: string; bg: string }
}) {
  const clickable = fichaId != null
  return (
    <div
      onClick={clickable ? () => onOpen(fichaId) : undefined}
      className={clickable ? 'prog-alertas__row nx-row' : 'prog-alertas__row'}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="prog-alertas__row-title">{title}</div>
        <div className="prog-alertas__row-sub">{sub}</div>
      </div>
      <span className="prog-alertas__chip" style={{ color: chipTone.fg, background: chipTone.bg }}>{chip}</span>
      {clickable && <Ic n="chevronRight" s={13} style={{ color: '#d4d4d8', flexShrink: 0 }}/>}
    </div>
  )
}

const CHIP_NEUTRAL = { fg: '#c2410c', bg: '#ffedd5' }
const CHIP_OK      = { fg: '#15803d', bg: '#dcfce7' }
const CHIP_WARN    = { fg: '#b45309', bg: '#fef3c7' }
const CHIP_CRIT    = { fg: '#b91c1c', bg: '#fee2e2' }

function ProgramaAlertas({ alertas, fichas, onOpenFicha }: {
  alertas: ProgramaDetalleData['alertas']
  fichas: FichaPrograma[]
  onOpenFicha: (fichaId: number) => void
}) {
  "use no memo"
  const idPorNumero = useMemo(() => new Map(fichas.map(f => [f.numero_ficha, f.id])), [fichas])
  const [open, setOpen] = useState<AlertaId | null>(null)

  const counts: Record<AlertaId, number> = {
    sin_instructor: alertas.fichas_sin_instructor.length,
    no_favorables:  alertas.conceptos_no_favorables.length,
    vencidas:       alertas.etapas_vencidas.length,
  }
  const ids = (['sin_instructor', 'no_favorables', 'vencidas'] as AlertaId[]).filter(id => counts[id] > 0)
  if (ids.length === 0) return null

  return (
    <div className="prog-alertas">
      {ids.map(id => {
        const m = ALERTA_META[id]
        const isOpen = open === id
        return (
          <div key={id} className="prog-alertas__wrap">
            <button
              className={`prog-alertas__btn${isOpen ? ' prog-alertas__btn--open' : ''}`}
              style={{ '--tone': m.tone, '--bg': m.bg, '--bd': m.bd } as React.CSSProperties}
              onClick={() => setOpen(isOpen ? null : id)}
              aria-label={m.label}
              data-tip={m.label}
            >
              <Ic n={m.icon} s={16}/>
              <span className="prog-alertas__count">{counts[id]}</span>
            </button>

            {isOpen && (
              <>
                <div className="prog-alertas__overlay" onClick={() => setOpen(null)}/>
                <div className="prog-alertas__pop pop-in">
                  <div className="prog-alertas__pop-head">
                    <div className="prog-alertas__pop-title" style={{ color: m.tone }}>
                      <Ic n={m.icon} s={13}/> {m.label} <span>· {counts[id]}</span>
                    </div>
                    <p className="prog-alertas__pop-hint">{m.hint}</p>
                  </div>
                  <div className="prog-alertas__pop-list">
                    {id === 'sin_instructor' && alertas.fichas_sin_instructor.map(a => (
                      <AlertaRow
                        key={`si-${a.id}`}
                        fichaId={a.id}
                        onOpen={onOpenFicha}
                        title={`Ficha ${a.numero_ficha}`}
                        sub={a.centro_nombre}
                        chip={a.dias_restantes == null ? 'sin fecha' : a.dias_restantes < 0 ? `cerró hace ${Math.abs(a.dias_restantes)} d` : `cierra en ${a.dias_restantes} d`}
                        chipTone={a.dias_restantes != null && a.dias_restantes < 0 ? CHIP_CRIT : CHIP_NEUTRAL}
                      />
                    ))}
                    {id === 'no_favorables' && alertas.conceptos_no_favorables.map(a => (
                      <AlertaRow
                        key={`nf-${a.seguimiento_id}`}
                        fichaId={idPorNumero.get(a.numero_ficha) ?? null}
                        onOpen={onOpenFicha}
                        title={a.aprendiz_nombre}
                        sub={`Ficha ${a.numero_ficha} · ${a.tipo_momento.toLowerCase()} · ${fd(a.fecha)}`}
                        chip={a.con_plan_mejoramiento ? 'plan en curso' : 'falta plan'}
                        chipTone={a.con_plan_mejoramiento ? CHIP_OK : CHIP_WARN}
                      />
                    ))}
                    {id === 'vencidas' && alertas.etapas_vencidas.map(a => (
                      <AlertaRow
                        key={`ev-${a.etapa_id}`}
                        fichaId={idPorNumero.get(a.numero_ficha) ?? null}
                        onOpen={onOpenFicha}
                        title={a.aprendiz_nombre}
                        sub={`Ficha ${a.numero_ficha} · fin estimado ${fd(a.fecha_fin_estimada)}${a.instructor_nombre ? ` · ${a.instructor_nombre}` : ''}`}
                        chip={`${a.dias_vencida} d`}
                        chipTone={CHIP_NEUTRAL}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Orden de la tabla "Fichas del programa": clic en el encabezado (asc/desc).
type FichaSortKey = 'ficha' | 'coordinador' | 'etapa' | 'instructor' | 'aprendices' | 'cierre'

const FICHA_COL_DIR: Record<FichaSortKey, SortDir> = {
  ficha: 'asc', coordinador: 'asc', etapa: 'desc', instructor: 'asc', aprendices: 'desc', cierre: 'asc',
}

// Columnas cuyo valor vacío debe quedar siempre al final (no invertir con la dir).
const FICHA_VACIO_AL_FINAL: Partial<Record<FichaSortKey, (f: FichaPrograma) => boolean>> = {
  instructor: f => !f.instructor_practica,
  cierre:     f => f.dias_restantes == null,
}

function cmpFichaAsc(a: FichaPrograma, b: FichaPrograma, key: FichaSortKey): number {
  const tie = a.numero_ficha.localeCompare(b.numero_ficha, 'es', { numeric: true })
  switch (key) {
    case 'coordinador': return (a.coordinador_nombre ?? '').localeCompare(b.coordinador_nombre ?? '', 'es') || tie
    case 'etapa':       return ((a.etapa === 'PRACTICA' ? 1 : 0) - (b.etapa === 'PRACTICA' ? 1 : 0)) || tie
    case 'instructor':  return (a.instructor_practica ?? '').localeCompare(b.instructor_practica ?? '', 'es') || tie
    case 'aprendices':  return ((a.aprendices_en_practica ?? 0) - (b.aprendices_en_practica ?? 0)) || (a.aprendices - b.aprendices) || tie
    case 'cierre':      return ((a.dias_restantes ?? 0) - (b.dias_restantes ?? 0)) || tie
    default:            return tie   // 'ficha'
  }
}

function FichasDelPrograma({ fichas: fichasProp, onOpen }: { fichas: FichaPrograma[]; onOpen: (fichaId: number) => void }) {
  "use no memo"
  const [estado, setEstado] = useState('')
  const [centro, setCentro] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<FichaSortKey>('aprendices')
  const [dir, setDir]   = useState<SortDir>('desc')

  const onSort = (k: FichaSortKey) => {
    if (k === sort) { setDir(d => (d === 'asc' ? 'desc' : 'asc')); return }
    setSort(k); setDir(FICHA_COL_DIR[k])
  }

  // Solo fichas que ya están (o estuvieron) en etapa práctica -- las que siguen
  // en lectiva no tienen nada de práctica que mostrar acá.
  const fichas = useMemo(() => fichasProp.filter(f => f.etapa !== 'LECTIVA'), [fichasProp])

  const centros = useMemo(
    () => [...new Set(fichas.map(f => f.centro_nombre))].sort((a, b) => a.localeCompare(b, 'es')),
    [fichas],
  )
  const ql = q.trim().toLowerCase()
  const vacio = FICHA_VACIO_AL_FINAL[sort]
  const view = fichas
    .filter(f =>
      (!estado || f.estado === estado)
      && (!centro || f.centro_nombre === centro)
      && (!ql || f.numero_ficha.toLowerCase().includes(ql)))
    .sort((a, b) => {
      if (vacio) {
        const va = vacio(a), vb = vacio(b)
        if (va !== vb) return va ? 1 : -1
      }
      const r = cmpFichaAsc(a, b, sort)
      return dir === 'asc' ? r : -r
    })

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>
          Fichas del programa <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#71717a', fontWeight: 400 }}>· {view.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="prog-list-search">
            <Ic n="search" s={14} className="prog-list-search__icon" style={{ color: '#a1a1aa' }}/>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar N° de ficha…"
              className="prog-list-search__input"
              style={{ width: 170, height: 34 }}
            />
            {q && (
              <button onClick={() => setQ('')} className="prog-list-search__clear" aria-label="Limpiar">
                <Ic n="x" s={12}/>
              </button>
            )}
          </div>
          <select value={estado} onChange={e => setEstado(e.target.value)} style={SEL_STYLE}>
            <option value="">Todos los estados</option>
            <option value="EN_EJECUCION">En ejecución</option>
            <option value="FINALIZADA">Finalizadas</option>
            <option value="SUSPENDIDA">Suspendidas</option>
          </select>
          {centros.length > 1 && (
            <select value={centro} onChange={e => setCentro(e.target.value)} style={SEL_STYLE}>
              <option value="">Todos los centros</option>
              {centros.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {view.length === 0 ? (
        <Card><div style={{ padding: 32, textAlign: 'center', fontSize: 12.5, color: '#71717a' }}>
          {fichas.length === 0
            ? 'Este programa no tiene fichas en etapa práctica.'
            : ql ? `Sin fichas con "${q.trim()}".` : 'Sin fichas para este filtro.'}
        </div></Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <div className="prog-table-scroll">
            <table className="prog-table">
              <thead>
                <tr className="prog-table__head-row">
                  <SortTh label="Ficha"                  k="ficha"       sort={sort} dir={dir} onSort={onSort}/>
                  <SortTh label="Coordinador"            k="coordinador" sort={sort} dir={dir} onSort={onSort}/>
                  <SortTh label="Etapa"                  k="etapa"       sort={sort} dir={dir} onSort={onSort}/>
                  <SortTh label="Instructor de práctica" k="instructor"  sort={sort} dir={dir} onSort={onSort}/>
                  <SortTh label="Aprendices en práctica" k="aprendices"  sort={sort} dir={dir} onSort={onSort} num/>
                  <SortTh label="Cierre"                 k="cierre"      sort={sort} dir={dir} onSort={onSort}/>
                  <th className="prog-table__th"/>
                </tr>
              </thead>
              <tbody>
                {view.map(f => (
                  <tr key={f.id} className="nx-row" onClick={() => onOpen(f.id)} style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer' }}>
                    <td className="prog-table__td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5, fontWeight: 600, color: '#0a0a0b' }}>{f.numero_ficha}</span>
                        <EstadoFichaPill estado={f.estado}/>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#71717a', marginTop: 3 }}>
                        {centroLabel(f.centro_nombre)}{f.coordinacion_nombre ? ` · ${f.coordinacion_nombre}` : ''}
                      </div>
                    </td>
                    <td className="prog-table__td" style={{ fontSize: 12.5 }}>
                      {f.coordinador_nombre
                        ? <span style={{ color: '#18181b' }}>{f.coordinador_nombre}</span>
                        : <span style={{ color: '#a1a1aa' }}>Sin coordinador</span>}
                    </td>
                    <td className="prog-table__td"><EtapaPill etapa={f.etapa}/></td>
                    <td className="prog-table__td">
                      {f.instructor_practica
                        ? <span style={{ fontSize: 12.5, color: '#18181b' }}>{f.instructor_practica}</span>
                        : f.etapa === 'PRACTICA'
                          ? <span style={{ fontSize: 12, color: '#b91c1c', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic n="alert" s={12}/> sin asignar</span>
                          : <span style={{ fontSize: 12, color: '#a1a1aa' }}>—</span>}
                    </td>
                    <td className="prog-table__td--num" title={`${f.aprendices_en_practica ?? 0} con etapa productiva en ejecución · ${f.aprendices} en la ficha`}>
                      <span style={{ color: (f.aprendices_en_practica ?? 0) > 0 ? '#4f46e5' : '#a1a1aa' }}>{f.aprendices_en_practica ?? 0}</span>
                      <span style={{ color: '#a1a1aa', fontWeight: 400 }}>/{f.aprendices}</span>
                    </td>
                    <td className="prog-table__td">
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: f.dias_restantes != null && f.dias_restantes < 0 ? '#b91c1c' : f.dias_restantes != null && f.dias_restantes <= 30 ? '#c2410c' : '#52525b' }}>
                        {f.dias_restantes == null ? '—' : f.dias_restantes < 0 ? `venció hace ${Math.abs(f.dias_restantes)} d` : `${f.dias_restantes} d`}
                      </span>
                    </td>
                    <td className="prog-table__td" style={{ textAlign: 'right' }}><Ic n="chevronRight" s={15} style={{ color: '#d4d4d8' }}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// Encabezado de columna que ordena por esa columna al hacer clic (asc/desc).
function SortTh({ label, k, sort, dir, onSort, num }: {
  label: string; k: FichaSortKey; sort: FichaSortKey; dir: SortDir
  onSort: (k: FichaSortKey) => void; num?: boolean
}) {
  const active = sort === k
  return (
    <th
      className={`prog-table__th prog-sort-th${num ? ' prog-table__th--num' : ''}${active ? ' prog-sort-th--active' : ''}`}
      onClick={() => onSort(k)}
      title={`Ordenar por ${label.toLowerCase()}`}
    >
      {label}
      <SortCaret active={active} dir={dir}/>
    </th>
  )
}

// Contenido del pop-up que aparece al hacer hover en el ícono del KPI "Centros":
// el reparto de la práctica del programa por centro, con su cobertura de instructor.
function CentrosRollup({ rows }: { rows: ProgramaDetalleData['por_centro'] }) {
  if (rows.length === 0) return null
  const orden = [...rows].sort((a, b) =>
    b.aprendices_practica - a.aprendices_practica
    || b.fichas_practica - a.fichas_practica
    || a.centro_nombre.localeCompare(b.centro_nombre, 'es'))
  return (
    <>
      <div className="prog-kpi-pop__head">Práctica por centro · aprendices</div>
      <div className="prog-kpi-pop__list">
        {orden.map(c => {
          const pct = c.fichas_practica > 0 ? Math.round((c.con_instructor / c.fichas_practica) * 100) : 0
          const col = c.sin_instructor === 0 ? '#16a34a' : c.sin_instructor >= c.fichas_practica / 2 ? '#dc2626' : '#c2410c'
          return (
            <div
              key={c.centro_id}
              className="prog-kpi-pop__row"
              title={`${c.aprendices_practica} aprendices en práctica · ${c.fichas_practica} fichas · ${c.con_instructor}/${c.fichas_practica} con instructor`}
            >
              <span className="prog-kpi-pop__name">{centroLabel(c.centro_nombre)}</span>
              {c.fichas_practica > 0 ? (
                <span className="prog-kpi-pop__cov">
                  <b style={{ color: c.aprendices_practica > 0 ? '#4f46e5' : '#a1a1aa' }}>{c.aprendices_practica}</b>
                  <span className="prog-kpi-pop__bar"><span style={{ width: `${pct}%`, background: col }}/></span>
                  <i>{c.con_instructor}/{c.fichas_practica}</i>
                </span>
              ) : (
                <span className="prog-kpi-pop__cov prog-kpi-pop__cov--empty">sin práctica</span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function ProgramaDetalle() {
  "use no memo"
  const { programaId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<DetState>({ status: 'loading' })

  // Se monta con `key={programaId}` (ver <Routes> abajo), así que el estado
  // inicial 'loading' ya cubre cada programa -- sin setState síncrono en el efecto.
  useEffect(() => {
    let live = true
    api.get<ProgramaDetalleData>(`/programas/${programaId}/detalle`)
      .then(r => { if (live) setState({ status: 'ok', data: r.data }) })
      .catch(e => {
        if (!live) return
        setState({ status: axios.isAxiosError(e) && e.response?.status === 404 ? 'notfound' : 'error' })
      })
    return () => { live = false }
  }, [programaId])

  const back = (
    <button
      onClick={() => navigate('..', { relative: 'path' })}
      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, fontFamily: 'Inter, sans-serif' }}
    >
      <Ic n="arrowLeft" s={14}/> Programas
    </button>
  )

  if (state.status === 'loading') {
    return (
      <div style={{ maxWidth: 1200 }}>
        {back}
        <Sk w={280} h={24}/>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 24 }}>
          {[0, 1, 2, 3, 4].map(i => <Card key={i} style={{ padding: 16 }}><Sk w="60%" h={9} delay={i * 40}/><div style={{ marginTop: 12 }}><Sk w="45%" h={22} delay={i * 40 + 20}/></div></Card>)}
        </div>
        <Card style={{ padding: 20, marginTop: 24 }}><Sk w="40%" h={14}/><div style={{ marginTop: 14 }}><Sk w="100%" h={40}/></div></Card>
      </div>
    )
  }
  if (state.status === 'notfound') {
    return <div style={{ maxWidth: 1200 }}>{back}<CenterState icon="search" title="Programa no encontrado" sub="El programa que buscas no existe o fue eliminado."/></div>
  }
  if (state.status === 'error') {
    return <div style={{ maxWidth: 1200 }}>{back}<CenterState icon="alert" title="No se pudo cargar el programa" sub="Verifica la conexión con el servidor."/></div>
  }

  const { programa: p, kpi, fichas, por_centro, alertas } = state.data
  const nc = nivelColor(p.nivel_formacion)
  const sinPractica = kpi.fichas_en_practica === 0

  const openFicha = (fichaId: number) => navigate(`fichas/${fichaId}`, { relative: 'path' })

  return (
    <div style={{ maxWidth: 1200 }}>
      {back}

      {/* Cabecera */}
      <div style={{ marginBottom: 22, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#52525b', marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{p.codigo}</span>
            <span>·</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fmtVersion(p.version)}</span>
            <span>·</span>
            <span className="prog-table__nivel-badge" style={{ background: nc.bg, color: nc.fg }}>{nivelCorto(p.nivel_formacion)}</span>
            <Bdg tone={p.estado === 'VIGENTE' ? 'ok' : 'neutral'}>{p.estado === 'VIGENTE' ? 'Vigente' : 'Inactivo'}</Bdg>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: '#0a0a0b', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>
              {programaShort(p.nombre)}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>{p.nombre}</h2>
              <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>Título que otorga: {p.titulo_otorga}</div>
            </div>
          </div>
        </div>
        <ProgramaAlertas alertas={alertas} fichas={fichas} onOpenFicha={openFicha}/>
      </div>

      <ProgramaKpis kpi={kpi} porCentro={por_centro}/>

      {sinPractica && alertas.fichas_sin_instructor.length === 0 && alertas.conceptos_no_favorables.length === 0 && alertas.etapas_vencidas.length === 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 8, background: '#f1f1f3', border: '1px solid #e4e4e7', color: '#27272a', fontSize: 13 }}>
            <Ic n="info" s={15} style={{ marginTop: 2, flexShrink: 0 }}/>
            <span>Este programa no tiene fichas en etapa práctica todavía.</span>
          </div>
        </div>
      )}

      <FichasDelPrograma fichas={fichas} onOpen={openFicha}/>
    </div>
  )
}

// ─── Wrapper: detalle de una ficha del programa (reutiliza FichaDetalle) ──────

function FichaDePrograma() {
  "use no memo"
  const { fichaId } = useParams()
  const navigate = useNavigate()
  const id = Number(fichaId)
  return (
    <FichaDetalle
      id={id}
      onBack={() => navigate('../..', { relative: 'path' })}
      onEditar={() => navigate(`${BASE_FICHAS}/${id}/editar`)}
      onOpenEtapa={etapaId => navigate(`${BASE_FICHAS}/${id}/etapa/${etapaId}`)}
    />
  )
}

// ════════════════════════════════════════════════════════════════════════════

// Re-monta ProgramaDetalle al cambiar de programa (estado 'loading' limpio).
function ProgramaDetalleKeyed() {
  "use no memo"
  const { programaId } = useParams()
  return <ProgramaDetalle key={programaId}/>
}

export function ProgramasFormacion() {
  "use no memo"
  return (
    <Routes>
      <Route index element={<ProgramasList/>}/>
      <Route path=":programaId" element={<ProgramaDetalleKeyed/>}/>
      <Route path=":programaId/fichas/:fichaId" element={<FichaDePrograma/>}/>
    </Routes>
  )
}
