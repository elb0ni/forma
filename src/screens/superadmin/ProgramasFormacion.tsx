import { useState, useEffect } from 'react'
import axios from 'axios'
import { Ic, Btn, Card, Pager, DigBadge } from '../../components/ui'
import type { ProgramaListItem } from '../../types'
import api from '../../lib/api'
import { ProgramaDetalleView } from '../shared/ProgramaDetalleView'
import '../shared/ProgramasFormacion.css'

const PROG_PAGE_SIZE = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Versión con el formato de FORMA (V102, V001, …)
function fmtVersion(v: string | number): string {
  return `V${String(v).replace(/^v/i, '').padStart(3, '0')}`
}

// Sigla derivada del nombre para el recuadro del programa (p. ej. "ADS")
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
  if (n.includes('TECNÓLOGO'))      return { bg: '#dbeafe', fg: '#1d4ed8' }
  if (n.includes('TÉCNICO'))        return { bg: '#dcfce7', fg: '#15803d' }
  if (n.includes('ESPECIALIZACIÓN'))return { bg: '#f3e8ff', fg: '#6b21a8' }
  return                                    { bg: '#f1f1f3', fg: '#52525b' }
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

const TABLE_WIDTHS = [
  ['75%', '14px'], ['64px', '14px'], ['40px', '14px'],
  ['28px', '14px'], ['28px', '14px'], ['24px', '14px'],
  ['28px', '14px'], ['28px', '14px'], ['72px', '22px'],
]

function SkeletonTableRow({ i }: { i: number }) {
  return (
    <tr style={{ borderBottom: '1px solid #f1f1f3' }}>
      {TABLE_WIDTHS.map(([w, h], col) => (
        <td key={col} style={{ padding: '13px 12px' }}>
          <div className="skeleton" style={{
            width: col === 0 ? `${55 + ((i + col) % 4) * 10}%` : w,
            height: h,
            borderRadius: col === 8 ? 100 : 5,
            animationDelay: `${i * 60 + col * 15}ms`,
          }}/>
        </td>
      ))}
    </tr>
  )
}

// ─── Vista: lista de programas ────────────────────────────────────────────────

type ListState =
  | { status: 'loading' }
  | { status: 'ok';    data: ProgramaListItem[] }
  | { status: 'error'; msg: string }

type DigFilt = 'todos' | 'digitalizados' | 'sin_digitalizar'

type ProgSortKey = 'nombre' | 'codigo' | 'recientes' | 'digitalizados_primero' | 'pendientes_primero' | 'horas'

const PROG_SORT_LABEL: Record<ProgSortKey, string> = {
  nombre:                'Nombre (A–Z)',
  codigo:                'Código',
  recientes:             'Más recientes',
  digitalizados_primero: 'Digitalizados primero',
  pendientes_primero:    'Pendientes primero',
  horas:                 'Más horas',
}

function ProgramasList({ onImportar, refreshKey }: { onImportar: () => void; refreshKey: number }) {
  const [state,      setState]      = useState<ListState>({ status: 'loading' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [digFilt,    setDigFilt]    = useState<DigFilt>('todos')
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState<ProgSortKey>('digitalizados_primero')
  const [page,       setPage]       = useState(0)

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<ProgramaListItem[]>('/programas')
      .then(({ data }) => setState({ status: 'ok', data }))
      .catch(err => {
        const msg = axios.isAxiosError(err)
          ? (err.response?.data?.message ?? err.message)
          : 'No se pudo conectar con el servidor'
        setState({ status: 'error', msg: String(msg) })
      })
  }, [refreshKey])

  // Volver a la primera página cuando cambian filtros/búsqueda/orden
  useEffect(() => { setPage(0) }, [digFilt, search, sort])

  const allData     = state.status === 'ok' ? state.data : []
  const digitCount  = allData.filter(p => p.tiene_disenio_curricular).length
  const sinCount    = allData.filter(p => !p.tiene_disenio_curricular).length

  const q = search.trim().toLowerCase()
  const filtered = allData
    .filter(p => {
      if (digFilt === 'digitalizados'   && !p.tiene_disenio_curricular) return false
      if (digFilt === 'sin_digitalizar' &&  p.tiene_disenio_curricular) return false
      if (q && !p.nombre.toLowerCase().includes(q) && !p.codigo.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => {
      switch (sort) {
        case 'codigo':                return a.codigo.localeCompare(b.codigo, 'es')
        case 'recientes':             return b.created_at.localeCompare(a.created_at)
        case 'digitalizados_primero': return (Number(!!b.tiene_disenio_curricular) - Number(!!a.tiene_disenio_curricular)) || a.nombre.localeCompare(b.nombre, 'es')
        case 'pendientes_primero':    return (Number(!!a.tiene_disenio_curricular) - Number(!!b.tiene_disenio_curricular)) || a.nombre.localeCompare(b.nombre, 'es')
        case 'horas':                 return b.horas_lectivas - a.horas_lectivas
        default:                      return a.nombre.localeCompare(b.nombre, 'es')
      }
    })

  const CHIPS: { key: DigFilt; label: string; count: number }[] = [
    { key: 'todos',          label: 'Todos',           count: allData.length },
    { key: 'digitalizados',  label: 'Digitalizados',   count: digitCount     },
    { key: 'sin_digitalizar',label: 'Sin digitalizar', count: sinCount       },
  ]

  const pageCount = Math.ceil(filtered.length / PROG_PAGE_SIZE)
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = filtered.slice(curPage * PROG_PAGE_SIZE, (curPage + 1) * PROG_PAGE_SIZE)

  if (selectedId !== null) {
    return <ProgramaDetalleView id={selectedId} onBack={() => setSelectedId(null)} onDigitalizar={onImportar}/>
  }

  return (
    <div>
      <div className="programas-header">
        <div>
          <h2 className="programas-header__title">Programas de formación</h2>
          <p className="programas-header__sub">Diseños curriculares cargados en el sistema.</p>
        </div>
        <Btn variant="accent" icon="upload" onClick={onImportar}>
          Importar programa
        </Btn>
      </div>

      {/* Filtros: chips + búsqueda + orden */}
      {state.status === 'ok' && (
        <div className="prog-list-toolbar">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CHIPS.map(c => {
              const active = digFilt === c.key
              return (
                <button
                  key={c.key}
                  onClick={() => setDigFilt(c.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    border: active ? '1.5px solid #4f46e5' : '1.5px solid #e4e4e7',
                    background: active ? '#eef2ff' : '#fff',
                    color: active ? '#4f46e5' : '#52525b',
                    fontSize: 12.5, fontWeight: active ? 600 : 400,
                    transition: 'all 120ms',
                  }}
                >
                  {c.label}
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    fontFamily: '"JetBrains Mono", monospace',
                    background: active ? '#c7d2fe' : '#f1f1f3',
                    color: active ? '#4338ca' : '#71717a',
                    padding: '1px 6px', borderRadius: 10,
                  }}>
                    {c.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="prog-list-toolbar__right">
            <div className="prog-list-search">
              <Ic n="search" s={14} className="prog-list-search__icon" style={{ color: '#a1a1aa' }}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por código o nombre…"
                className="prog-list-search__input"
              />
              {search && (
                <button onClick={() => setSearch('')} className="prog-list-search__clear" aria-label="Limpiar búsqueda">
                  <Ic n="x" s={12}/>
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as ProgSortKey)}
              className="prog-list-sort"
            >
              {(Object.keys(PROG_SORT_LABEL) as ProgSortKey[]).map(k => (
                <option key={k} value={k}>Ordenar: {PROG_SORT_LABEL[k]}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Estado: cargando */}
      {state.status === 'loading' && (
        <Card style={{ overflow: 'hidden' }}>
          <div className="prog-table-scroll">
          <table className="prog-table">
            <thead>
              <tr className="prog-table__head-row">
                {['Programa', 'Código', 'Versión', 'Fichas', 'Comp.', 'RA', 'Conoc.', 'Crit.', 'Estado'].map(h => (
                  <th key={h} className="prog-table__th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map(i => <SkeletonTableRow key={i} i={i}/>)}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {/* Estado: error */}
      {state.status === 'error' && (
        <Card style={{ padding: 24 }}>
          <div className="prog-error">
            <div className="prog-error__icon-wrap">
              <Ic n="alert" s={16} style={{ color: '#b91c1c' }}/>
            </div>
            <div>
              <div className="prog-error__title">Error al cargar los programas</div>
              <div className="prog-error__msg">{state.msg}</div>
              <div className="prog-error__retry">
                <Btn variant="secondary" size="sm" icon="refresh" onClick={() => setState({ status: 'loading' })}>
                  Reintentar
                </Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Sin resultados para el filtro/búsqueda activos */}
      {state.status === 'ok' && allData.length > 0 && filtered.length === 0 && (
        <Card>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Ic n={q ? 'search' : 'layers'} s={24} style={{ color: '#a1a1aa' }}/>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>
              {q
                ? `Sin resultados para "${search.trim()}"`
                : `Sin programas ${digFilt === 'digitalizados' ? 'digitalizados' : 'sin digitalizar'}`}
            </div>
          </div>
        </Card>
      )}

      {/* Estado: lista vacía */}
      {state.status === 'ok' && allData.length === 0 && (
        <Card style={{ padding: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div className="prog-empty__icon">
            <Ic n="layers" s={24} style={{ color: '#a1a1aa' }}/>
          </div>
          <div>
            <div className="prog-empty__title">Sin programas cargados</div>
            <div className="prog-empty__sub">
              Importa el primer diseño curricular en PDF para comenzar el seguimiento.
            </div>
          </div>
          <Btn variant="accent" icon="upload" onClick={onImportar}>Importar programa</Btn>
        </Card>
      )}

      {/* Tabla */}
      {state.status === 'ok' && filtered.length > 0 && (
        <>
        <Card style={{ overflow: 'hidden' }}>
          <div className="prog-table-scroll">
          <table className="prog-table">
            <thead>
              <tr className="prog-table__head-row">
                <th className="prog-table__th">Programa</th>
                <th className="prog-table__th">Código</th>
                <th className="prog-table__th">Versión</th>
                <th className="prog-table__th prog-table__th--num">Fichas</th>
                <th className="prog-table__th prog-table__th--num">Comp.</th>
                <th className="prog-table__th prog-table__th--num">RA</th>
                <th className="prog-table__th prog-table__th--num">Conoc.</th>
                <th className="prog-table__th prog-table__th--num">Crit.</th>
                <th className="prog-table__th">Estado</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(p => {
                const nc     = nivelColor(p.nivel_formacion)
                const active = selectedId === p.id
                const dig    = !!p.tiene_disenio_curricular
                const horas  = p.horas_lectivas + (p.horas_productivas ?? 0)
                return (
                  <tr
                    key={p.id}
                    className="nx-row"
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      borderBottom: '1px solid #f1f1f3', cursor: 'pointer',
                      background: active ? '#f5f3ff' : undefined,
                      borderLeft: active ? '3px solid #4f46e5' : '3px solid transparent',
                      transition: 'background 120ms',
                    }}
                  >
                    <td className="prog-table__td">
                      <div className="prog-table__name-cell">
                        <div className="prog-table__badge">{programaShort(p.nombre)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="prog-table__name">{p.nombre}</div>
                          <div className="prog-table__meta">
                            <span className="prog-table__nivel-badge" style={{ background: nc.bg, color: nc.fg }}>
                              {p.nivel_formacion}
                            </span>
                            <span>{horas.toLocaleString('es-CO')} h</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="prog-table__td"><span className="prog-code">{p.codigo}</span></td>
                    <td className="prog-table__td"><span className="prog-code">{fmtVersion(p.version)}</span></td>
                    <td className="prog-table__td--num">{p.fichas_activas.toLocaleString('es-CO')}</td>
                    <td className="prog-table__td--num">{dig ? p.total_competencias.toLocaleString('es-CO') : '—'}</td>
                    <td className="prog-table__td--num">{dig ? p.total_ra.toLocaleString('es-CO') : '—'}</td>
                    <td className="prog-table__td--num">{dig ? p.total_conocimientos.toLocaleString('es-CO') : '—'}</td>
                    <td className="prog-table__td--num">{dig ? p.total_criterios.toLocaleString('es-CO') : '—'}</td>
                    <td className="prog-table__td">
                      <DigBadge dig={dig}/>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </Card>
        <Pager
          page={curPage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={PROG_PAGE_SIZE}
          onPage={setPage}
          noun="programas"
        />
        </>
      )}
    </div>
  )
}

// ─── Orquestador del flujo ────────────────────────────────────────────────────

export function ProgramasFormacion({ onDigitalizar }: { onDigitalizar?: () => void }) {
  return <ProgramasList onImportar={onDigitalizar ?? (() => {})} refreshKey={0}/>
}

