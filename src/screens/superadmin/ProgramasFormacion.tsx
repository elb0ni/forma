import { useState, useEffect } from 'react'
import axios from 'axios'
import { Ic, Btn, Card, Pager } from '../../components/ui'
import type { ProgramaListItem } from '../../types'
import api from '../../lib/api'
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
  ['48px', '14px'], ['48px', '14px'], ['64px', '14px'],
]

function SkeletonTableRow({ i }: { i: number }) {
  return (
    <tr style={{ borderBottom: '1px solid #f1f1f3' }}>
      {TABLE_WIDTHS.map(([w, h], col) => (
        <td key={col} style={{ padding: '13px 12px' }}>
          <div className="skeleton" style={{
            width: col === 0 ? `${55 + ((i + col) % 4) * 10}%` : w,
            height: h,
            borderRadius: 5,
            animationDelay: `${i * 60 + col * 15}ms`,
          }}/>
        </td>
      ))}
    </tr>
  )
}

// ─── Vista: catálogo de programas (solo lectura) ─────────────────────────────
// El catálogo de programas es estructural (una ficha requiere un programa),
// pero ya no se crea/edita desde este front -- FORMA dejó de cubrir el diseño
// curricular, así que solo se lista para elegirlo al armar una ficha.

type ListState =
  | { status: 'loading' }
  | { status: 'ok';    data: ProgramaListItem[] }
  | { status: 'error'; msg: string }

type ProgSortKey = 'nombre' | 'codigo' | 'recientes' | 'horas'

const PROG_SORT_LABEL: Record<ProgSortKey, string> = {
  nombre:    'Nombre (A–Z)',
  codigo:    'Código',
  recientes: 'Más recientes',
  horas:     'Más horas',
}

export function ProgramasFormacion() {
  const [state,  setState]  = useState<ListState>({ status: 'loading' })
  const [search, setSearch] = useState('')
  const [sort,   setSort]   = useState<ProgSortKey>('nombre')
  const [page,   setPage]   = useState(0)

  useEffect(() => {
    api.get<ProgramaListItem[]>('/programas')
      .then(({ data }) => setState({ status: 'ok', data }))
      .catch(err => {
        const msg = axios.isAxiosError(err)
          ? (err.response?.data?.message ?? err.message)
          : 'No se pudo conectar con el servidor'
        setState({ status: 'error', msg: String(msg) })
      })
  }, [])

  // Volver a la primera página cuando cambian búsqueda/orden
  useEffect(() => { setPage(0) }, [search, sort])

  const allData = state.status === 'ok' ? state.data : []

  const q = search.trim().toLowerCase()
  const filtered = allData
    .filter(p => !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
    .sort((a, b) => {
      switch (sort) {
        case 'codigo':    return a.codigo.localeCompare(b.codigo, 'es')
        case 'recientes': return b.created_at.localeCompare(a.created_at)
        case 'horas':     return b.horas_lectivas - a.horas_lectivas
        default:          return a.nombre.localeCompare(b.nombre, 'es')
      }
    })

  const pageCount = Math.ceil(filtered.length / PROG_PAGE_SIZE)
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = filtered.slice(curPage * PROG_PAGE_SIZE, (curPage + 1) * PROG_PAGE_SIZE)

  return (
    <div>
      <div className="programas-header">
        <div>
          <h2 className="programas-header__title">Programas de formación</h2>
          <p className="programas-header__sub">Catálogo regional — se usa al crear o editar una ficha.</p>
        </div>
      </div>

      {/* Búsqueda + orden */}
      {state.status === 'ok' && (
        <div className="prog-list-toolbar">
          <div/>
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
                {['Programa', 'Código', 'Versión', 'Nivel', 'Fichas', 'Horas'].map(h => (
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

      {/* Sin resultados para la búsqueda activa */}
      {state.status === 'ok' && allData.length > 0 && filtered.length === 0 && (
        <Card>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Ic n="search" s={24} style={{ color: '#a1a1aa' }}/>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>Sin resultados para "{search.trim()}"</div>
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
            <div className="prog-empty__sub">Todavía no hay programas de formación en el catálogo regional.</div>
          </div>
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
                <th className="prog-table__th">Nivel</th>
                <th className="prog-table__th prog-table__th--num">Fichas</th>
                <th className="prog-table__th prog-table__th--num">Horas</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(p => {
                const nc    = nivelColor(p.nivel_formacion)
                const horas = p.horas_lectivas + (p.horas_productivas ?? 0)
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f1f3' }}>
                    <td className="prog-table__td">
                      <div className="prog-table__name-cell">
                        <div className="prog-table__badge">{programaShort(p.nombre)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="prog-table__name">{p.nombre}</div>
                        </div>
                      </div>
                    </td>
                    <td className="prog-table__td"><span className="prog-code">{p.codigo}</span></td>
                    <td className="prog-table__td"><span className="prog-code">{fmtVersion(p.version)}</span></td>
                    <td className="prog-table__td">
                      <span className="prog-table__nivel-badge" style={{ background: nc.bg, color: nc.fg }}>
                        {p.nivel_formacion}
                      </span>
                    </td>
                    <td className="prog-table__td--num">{p.fichas_activas.toLocaleString('es-CO')}</td>
                    <td className="prog-table__td--num">{horas.toLocaleString('es-CO')} h</td>
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
