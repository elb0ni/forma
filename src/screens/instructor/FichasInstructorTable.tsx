// Tabla de "Mis fichas" del instructor -- mismo lenguaje visual que la tabla de
// Fichas del super admin (FichasAdmin): fila con punto de fase, sigla de
// programa, seguimiento de aprendices, fin de práctica y píldora de fase.
// Se usa en el Home del instructor (preview: `max`, sin orden ni paginación) y
// en la pantalla "Mis fichas" (`paginate`: encabezados ordenables + paginador).
import { useState } from 'react'
import { Ic, Card, Tag, Pager } from '../../components/ui'
import { SortCaret } from '../shared/filtros'
import type { SortDir } from '../shared/filtros'
import { jornadaLabel } from '../shared/parts'
import { FasePill } from '../shared/FichasAdmin'
import { faseFicha, FASE_META } from '../shared/fichaFase'
import type { FaseFicha } from '../shared/fichaFase'
import type { FichaInstructor } from './types'
import '../shared/filtros.css'

type SortCol = 'numero' | 'programa' | 'aprendices' | 'cierre' | 'fase'

const COLS: { key: SortCol; label: string; defDir: SortDir }[] = [
  { key: 'numero',     label: 'Ficha',          defDir: 'asc'  },
  { key: 'programa',   label: 'Programa',       defDir: 'asc'  },
  { key: 'aprendices', label: 'Seguimiento',    defDir: 'desc' },
  { key: 'cierre',     label: 'Fin productiva', defDir: 'asc'  },
  { key: 'fase',       label: 'Fase',           defDir: 'asc'  },
]

const FASE_ORDEN: Record<FaseFicha, number> = { PROXIMA: 0, EN_PRACTICA: 1, EN_CIERRE: 2, FINALIZADA: 3 }
const PAGE_SIZE = 12

const TH_S = { padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600 }
const TD_S = { padding: '12px 14px' }

// Fecha aaaa-mm-dd directo del ISO (sin pasar por Date, que correría el día por
// la conversión de timezone del navegador).
function fdISO(s: string | null): string {
  return s ? s.slice(0, 10) : '—'
}

function diasChip(d: number | null) {
  if (d == null) return null
  const txt = d < 0 ? `${Math.abs(d)} d vencida` : d === 0 ? 'cierra hoy' : `faltan ${d} d`
  const color = d < 0 ? '#dc2626' : d <= 30 ? '#c2410c' : '#a1a1aa'
  return <div style={{ fontSize: 10.5, color, marginTop: 3, fontFamily: '"JetBrains Mono", monospace' }}>{txt}</div>
}

// Compara dos fichas por una columna en su dirección ascendente. El número de
// ficha rompe empates.
function cmpAsc(a: FichaInstructor, b: FichaInstructor, col: SortCol): number {
  const tie = a.numero_ficha.localeCompare(b.numero_ficha, 'es', { numeric: true })
  switch (col) {
    case 'programa':   return a.programa_nombre.localeCompare(b.programa_nombre, 'es') || tie
    case 'aprendices': return (a.aprendices_en_seguimiento - b.aprendices_en_seguimiento) || (a.aprendices - b.aprendices) || tie
    case 'cierre':     return (a.fecha_fin_productiva ?? '').localeCompare(b.fecha_fin_productiva ?? '') || tie
    case 'fase':       return (FASE_ORDEN[faseFicha(a)] - FASE_ORDEN[faseFicha(b)]) || tie
    default:           return tie   // 'numero'
  }
}

function FichaFilaTabla({ f, onOpen }: { f: FichaInstructor; onOpen: (f: FichaInstructor) => void }) {
  const fase = faseFicha(f)
  const sub = [jornadaLabel(f.jornada), f.sede].filter(v => v && v !== '—').join(' · ')
  return (
    <tr
      className="nx-row"
      onClick={() => onOpen(f)}
      style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer' }}
    >
      <td style={TD_S}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: FASE_META[fase].dot, flexShrink: 0 }}/>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
        </div>
        <div style={{ fontSize: 10.5, color: '#a1a1aa', marginTop: 3 }}>{f.nivel_formacion}</div>
      </td>
      <td style={TD_S}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Tag>{f.programa_codigo}</Tag>
          <span style={{ color: '#18181b', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.programa_nombre}
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: '#52525b', marginTop: 3 }}>{sub || '—'}</div>
      </td>
      <td style={{ ...TD_S, whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5 }}>
          <strong style={{ color: '#4f46e5' }}>{f.aprendices_en_seguimiento}</strong>
          <span style={{ color: '#a1a1aa' }}>/{f.aprendices}</span>
        </span>
      </td>
      <td style={{ ...TD_S, whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#27272a' }}>
          {fdISO(f.fecha_fin_productiva)}
        </span>
        {f.estado === 'EN_EJECUCION' && diasChip(f.dias_restantes)}
      </td>
      <td style={TD_S}><FasePill fase={fase}/></td>
      <td style={{ ...TD_S, textAlign: 'right' }}>
        <Ic n="chevronRight" s={16} style={{ color: '#d4d4d8' }}/>
      </td>
    </tr>
  )
}

export function FichasInstructorTable({ fichas, onOpen, paginate = false, max }: {
  fichas: FichaInstructor[]        // ya filtradas por el llamador
  onOpen: (f: FichaInstructor) => void
  paginate?: boolean               // encabezados ordenables + paginador
  max?: number                     // tope de filas (preview del Home)
}) {
  const [sortCol, setSortCol] = useState<SortCol>('cierre')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(0)

  const onSort = (col: SortCol, defDir: SortDir) => {
    setPage(0)
    if (col === sortCol) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return }
    setSortCol(col); setSortDir(defDir)
  }

  let rows = fichas
  if (paginate) {
    rows = [...fichas].sort((a, b) => {
      const r = cmpAsc(a, b, sortCol)
      return sortDir === 'asc' ? r : -r
    })
  }
  if (max != null) rows = rows.slice(0, max)

  const pageCount = paginate ? Math.ceil(rows.length / PAGE_SIZE) : 1
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = paginate ? rows.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE) : rows

  const thead = (
    <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', borderBottom: '1px solid #e4e4e7' }}>
      {COLS.map(c => {
        if (!paginate) return <th key={c.key} style={TH_S}>{c.label}</th>
        const on = sortCol === c.key
        return (
          <th
            key={c.key}
            className={`ff-sort-th${on ? ' ff-sort-th--on' : ''}`}
            onClick={() => onSort(c.key, c.defDir)}
            title={`Ordenar por ${c.label.toLowerCase()}`}
            style={TH_S}
          >
            {c.label}
            <SortCaret active={on} dir={on ? sortDir : c.defDir}/>
          </th>
        )
      })}
      <th style={TH_S}/>
    </tr>
  )

  return (
    <>
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>{thead}</thead>
            <tbody>
              {pageItems.map(f => <FichaFilaTabla key={f.id} f={f} onOpen={onOpen}/>)}
            </tbody>
          </table>
        </div>
      </Card>
      {paginate && (
        <Pager
          page={curPage}
          pageCount={pageCount}
          total={rows.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="fichas"
        />
      )}
    </>
  )
}
