import { useEffect, useState, Fragment } from 'react'
import { Ic, Card, Btn, Bdg, Ava, Pager } from '../../components/ui'
import { fd, CenterState, LoadingBlock, Spinner, Seg } from '../shared/parts'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { soloDigitos } from '../../lib/input'
import { FiltrosBar, FiltrosResumen, FiltroGrupo, SortCaret } from '../shared/filtros'
import type { FiltroOpcion, SortDir } from '../shared/filtros'
import { tonoEtapa, MODALIDAD_LABEL, MODALIDAD_TIENE_EMPRESA, CASO_TONO_META, CASO_TONO_ORDER } from './types'
import type { EtapaProductiva, Aprendiz, ModalidadEtapaProductiva, CasoTono } from './types'
import { Field, SectionIntro } from './parts'
import { Bloque, Campo, Dato, Aviso, Gfpi023Head } from './Gfpi023Campos'
import '../shared/filtros.css'

// ─── Lista de etapas productivas del instructor ─────────────────────────────────
// Tabla con el mismo lenguaje que las Fichas del super admin: barra de búsqueda
// + panel de filtros faceteado (estado / modalidad / rango de fechas),
// encabezados ordenables, agrupación opcional y paginación.

const PAGE_SIZE = 12
const MODALIDADES: ModalidadEtapaProductiva[] = ['CONTRATO_APRENDIZAJE', 'VINCULO_LABORAL', 'MONITORIA', 'UNIDAD_PRODUCTIVA']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// '' = todas · 'ACTIVAS' = en curso + falta juicio (lo que necesita seguimiento)
type CasoFilt   = '' | 'ACTIVAS' | CasoTono
type FechaCampo = 'fecha_inicio' | 'fecha_fin_estimada'
type GroupBy    = 'estado' | 'modalidad' | 'ninguno'
type SortCol    = 'aprendiz' | 'modalidad' | 'empresa' | 'inicio' | 'fin' | 'estado'

const COLS: { key: SortCol; label: string; defDir: SortDir }[] = [
  { key: 'aprendiz',  label: 'Aprendiz',     defDir: 'asc' },
  { key: 'modalidad', label: 'Modalidad',    defDir: 'asc' },
  { key: 'empresa',   label: 'Empresa',      defDir: 'asc' },
  { key: 'inicio',    label: 'Inicio',       defDir: 'asc' },
  { key: 'fin',       label: 'Fin estimada', defDir: 'asc' },
  { key: 'estado',    label: 'Estado',       defDir: 'asc' },
]

const FECHA_CAMPO_LABEL: Record<FechaCampo, string> = {
  fecha_inicio:       'Inicio de etapa',
  fecha_fin_estimada: 'Fin estimada',
}

const CASO_FILT_OPTS: { key: CasoFilt; label: string }[] = [
  { key: 'ACTIVAS', label: 'Activas' },
  ...CASO_TONO_ORDER.map(c => ({ key: c as CasoFilt, label: CASO_TONO_META[c].label })),
  { key: '',        label: 'Todas' },
]

const CASO_FILT_LABEL: Record<CasoFilt, string> = {
  '': 'Todas', ACTIVAS: 'Activas',
  EN_CURSO: 'En curso', SIN_JUICIO: 'Falta juicio Sofia', SUSPENDIDA: 'Suspendida',
  APLAZADA: 'Aplazada', NO_APROBADO: 'No aprobado', APROBADO: 'Aprobado', CANCELADA: 'Cancelada',
}

const SEL: React.CSSProperties = {
  height: 34, padding: '0 10px', border: '1px solid #e4e4e7', borderRadius: 8,
  fontSize: 12.5, background: '#fff', color: '#18181b',
  fontFamily: 'Inter, sans-serif', cursor: 'pointer', outline: 'none',
}

const TH_S = { padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600 }
const TD_S = { padding: '12px 14px' }

const ES_ACTIVA = (c: CasoTono) => c === 'EN_CURSO' || c === 'SIN_JUICIO'

// Compara dos etapas por una columna en su dirección ascendente. El nombre del
// aprendiz rompe empates.
function cmpAsc(a: EtapaProductiva, b: EtapaProductiva, col: SortCol): number {
  const tie = (a.aprendiz_nombre ?? '').localeCompare(b.aprendiz_nombre ?? '', 'es')
  switch (col) {
    case 'modalidad': return MODALIDAD_LABEL[a.modalidad].localeCompare(MODALIDAD_LABEL[b.modalidad], 'es') || tie
    case 'empresa':   return (a.empresa_nombre ?? '').localeCompare(b.empresa_nombre ?? '', 'es') || tie
    case 'inicio':    return a.fecha_inicio.localeCompare(b.fecha_inicio) || tie
    case 'fin':       return (a.fecha_fin_estimada ?? '').localeCompare(b.fecha_fin_estimada ?? '') || tie
    case 'estado':    return (CASO_TONO_ORDER.indexOf(tonoEtapa(a).caso) - CASO_TONO_ORDER.indexOf(tonoEtapa(b).caso)) || tie
    default:          return tie   // 'aprendiz'
  }
}

// `instructorId` es opcional: por defecto muestra las etapas del propio
// instructor logueado (uso normal, con "Nuevo registro" habilitado). Cuando
// un coordinador/admin hace drill-down sobre OTRO instructor (ver
// shared/InstructorDetalle.tsx) se pasa su id explícito y se oculta el CTA de
// creación, porque el wizard de "nuevo registro" asume el contexto del
// usuario logueado como instructor de práctica.
export function EtapaProductivaList({ onOpen, onNuevo, instructorId }: {
  onOpen: (etapaId: number) => void; onNuevo?: () => void; instructorId?: string
}) {
  "use no memo"
  const user = useAuthStore(s => s.user)!
  const targetId = instructorId ?? user.id
  const [etapas,       setEtapas]       = useState<EtapaProductiva[] | null>(null)
  const [error,        setError]        = useState(false)
  const [search,       setSearch]       = useState('')
  const [casoFilt,     setCasoFilt]     = useState<CasoFilt>('')
  const [modalidadFilt, setModalidadFilt] = useState<ModalidadEtapaProductiva | ''>('')
  const [fechaCampo,   setFechaCampo]   = useState<FechaCampo>('fecha_inicio')
  const [fechaDesde,   setFechaDesde]   = useState('')
  const [fechaHasta,   setFechaHasta]   = useState('')
  const [groupBy,      setGroupBy]      = useState<GroupBy>('estado')
  const [sortCol,      setSortCol]      = useState<SortCol>('inicio')
  const [sortDir,      setSortDir]      = useState<SortDir>('desc')
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [page,         setPage]         = useState(0)

  function load() {
    api.get<EtapaProductiva[]>(`/etapas-productivas?instructor_id=${targetId}`)
      .then(r => setEtapas(r.data))
      .catch(() => setError(true))
  }
  useEffect(load, [targetId])

  if (error) return <Card style={{ padding: 24 }}><CenterState icon="alert" title="No se pudieron cargar los registros" sub="Verifica la conexión con el servidor."/></Card>
  if (!etapas) return <LoadingBlock/>

  const all = etapas
  const q = search.trim().toLowerCase()
  const fechaActiva = !!(fechaDesde || fechaHasta)

  // ─── Predicados de filtro (cada dimensión es independiente) ─────────────────
  const mCaso = (e: EtapaProductiva): boolean => {
    if (!casoFilt) return true
    const c = tonoEtapa(e).caso
    if (casoFilt === 'ACTIVAS') return ES_ACTIVA(c)
    return c === casoFilt
  }
  const mModalidad = (e: EtapaProductiva) => !modalidadFilt || e.modalidad === modalidadFilt
  const mFecha = (e: EtapaProductiva): boolean => {
    if (!fechaActiva) return true
    const raw = e[fechaCampo]
    if (!raw) return false
    const val = raw.slice(0, 10)
    if (fechaDesde && val < fechaDesde) return false
    if (fechaHasta && val > fechaHasta) return false
    return true
  }
  const mSearch = (e: EtapaProductiva): boolean => !q || [
    e.aprendiz_nombre, e.aprendiz_documento, e.empresa_nombre,
  ].some(s => (s ?? '').toLowerCase().includes(q))

  // Conteo faceteado: para cada dimensión, cuántas etapas quedarían al elegir
  // cada opción dejando el resto de filtros como están.
  type Dim = 'caso' | 'modalidad' | 'fecha'
  const passExcept = (e: EtapaProductiva, except: Dim) =>
    (except === 'caso'      || mCaso(e))      &&
    (except === 'modalidad' || mModalidad(e)) &&
    (except === 'fecha'     || mFecha(e))     &&
    mSearch(e)

  const countCaso = (list: EtapaProductiva[], k: CasoFilt): number => {
    if (k === '') return list.length
    if (k === 'ACTIVAS') return list.filter(e => ES_ACTIVA(tonoEtapa(e).caso)).length
    return list.filter(e => tonoEtapa(e).caso === k).length
  }

  // Overview del encabezado -- siempre sobre el total, sin filtros aplicados.
  const activasCount   = countCaso(all, 'ACTIVAS')
  const enCursoCount    = countCaso(all, 'EN_CURSO')
  const sinJuicioCount  = countCaso(all, 'SIN_JUICIO')
  const aprobadoCount   = countCaso(all, 'APROBADO')

  // ─── Opciones del panel (con conteo faceteado) ─────────────────────────────
  const casoBase      = all.filter(e => passExcept(e, 'caso'))
  const modalidadBase = all.filter(e => passExcept(e, 'modalidad'))

  const casoOpts: FiltroOpcion[] = CASO_FILT_OPTS.map(o => ({
    key: o.key, label: o.label, count: countCaso(casoBase, o.key),
  }))
  const modalidadOpts: FiltroOpcion[] = [
    { key: '', label: 'Todas las modalidades', count: modalidadBase.length },
    ...MODALIDADES.map(m => ({
      key: m, label: MODALIDAD_LABEL[m],
      count: modalidadBase.filter(e => e.modalidad === m).length,
    })),
  ]

  const filtrosActivos =
    (casoFilt ? 1 : 0) + (modalidadFilt ? 1 : 0) + (fechaActiva ? 1 : 0)
  const algoQueLimpiar = filtrosActivos > 0 || sortCol !== 'inicio' || sortDir !== 'desc' || groupBy !== 'estado'

  const resumen: string[] = []
  if (casoFilt) resumen.push(CASO_FILT_LABEL[casoFilt])
  if (modalidadFilt) resumen.push(MODALIDAD_LABEL[modalidadFilt])
  if (fechaActiva) resumen.push(`${FECHA_CAMPO_LABEL[fechaCampo]} ${fechaDesde || '…'}–${fechaHasta || '…'}`)

  const limpiarFiltros = () => {
    setCasoFilt(''); setModalidadFilt(''); setFechaCampo('fecha_inicio')
    setFechaDesde(''); setFechaHasta(''); setGroupBy('estado')
    setSortCol('inicio'); setSortDir('desc'); setPage(0)
  }

  const onSort = (col: SortCol, defDir: SortDir) => {
    setPage(0)
    if (col === sortCol) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return }
    setSortCol(col); setSortDir(defDir)
  }

  // ─── Filtrado + agrupación + orden ─────────────────────────────────────────
  const groupRank = (e: EtapaProductiva): number =>
    groupBy === 'modalidad'
      ? MODALIDADES.indexOf(e.modalidad)
      : CASO_TONO_ORDER.indexOf(tonoEtapa(e).caso)
  const groupKey = (e: EtapaProductiva): string =>
    groupBy === 'modalidad' ? e.modalidad : tonoEtapa(e).caso
  const groupLabel = (k: string): { label: string; color: string } =>
    groupBy === 'modalidad'
      ? { label: MODALIDAD_LABEL[k as ModalidadEtapaProductiva], color: '#4f46e5' }
      : { label: CASO_TONO_META[k as CasoTono].label, color: CASO_TONO_META[k as CasoTono].color }

  const filtered = all
    .filter(e => mCaso(e) && mModalidad(e) && mFecha(e) && mSearch(e))
    .sort((a, b) => {
      if (groupBy !== 'ninguno') {
        const g = groupRank(a) - groupRank(b)
        if (g) return g
      }
      const r = cmpAsc(a, b, sortCol)
      return sortDir === 'asc' ? r : -r
    })

  const groupCount = (k: string) => filtered.reduce((n, e) => n + (groupKey(e) === k ? 1 : 0), 0)

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = filtered.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE)
  const cols = COLS.length + 1

  const theadRow = (
    <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', borderBottom: '1px solid #e4e4e7' }}>
      {COLS.map(c => {
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
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 700, color: '#4f46e5', lineHeight: 1 }}>
              {activasCount.toLocaleString('es-CO')}
            </span>
            <span style={{ fontSize: 13, color: '#52525b' }}>
              aprendices en seguimiento activo
              {' · '}<span>{enCursoCount.toLocaleString('es-CO')} en curso</span>
              {sinJuicioCount > 0 && <> · <span style={{ color: '#a16207' }}>{sinJuicioCount.toLocaleString('es-CO')} falta juicio</span></>}
              {' · '}<span style={{ color: '#a1a1aa' }}>{all.length.toLocaleString('es-CO')} en total</span>
              {aprobadoCount > 0 && <> · <span style={{ color: '#15803d' }}>{aprobadoCount.toLocaleString('es-CO')} aprobados</span></>}
            </span>
          </div>
        </div>
        {onNuevo && <Btn variant="accent" icon="plus" onClick={onNuevo}>Nuevo registro</Btn>}
      </div>

      {all.length > 0 && (
        <FiltrosBar
          search={search}
          onSearch={v => { setSearch(v); setPage(0) }}
          placeholder="Buscar aprendiz, documento o empresa…"
          activeCount={filtrosActivos}
          open={panelOpen}
          onToggle={() => setPanelOpen(o => !o)}
        />
      )}

      {all.length > 0 && !panelOpen && (
        <FiltrosResumen items={resumen} onClear={limpiarFiltros}/>
      )}

      {all.length > 0 && panelOpen && (
        <div className="ff-panel pop-in">
          <div className="ff-panel__grid">
            <FiltroGrupo
              title="Estado" icon="briefcase"
              options={casoOpts} value={casoFilt}
              onPick={k => { setCasoFilt(k as CasoFilt); setPage(0) }}
            />
            <FiltroGrupo
              title="Modalidad" icon="fileText"
              options={modalidadOpts} value={modalidadFilt}
              onPick={k => { setModalidadFilt(k as ModalidadEtapaProductiva | ''); setPage(0) }}
            />
          </div>

          <div className="ff-panel__foot">
            <div className="ff-field">
              <span className="ff-field__label">Rango de fechas</span>
              <div className="ff-dates">
                <select value={fechaCampo} onChange={e => setFechaCampo(e.target.value as FechaCampo)} style={SEL}>
                  {(Object.keys(FECHA_CAMPO_LABEL) as FechaCampo[]).map(k => (
                    <option key={k} value={k}>{FECHA_CAMPO_LABEL[k]}</option>
                  ))}
                </select>
                <input type="date" className="nx-input" value={fechaDesde} max={fechaHasta || undefined} onChange={e => { setFechaDesde(e.target.value); setPage(0) }} style={{ width: 150, padding: '7px 8px' }}/>
                <span className="ff-dates__sep">→</span>
                <input type="date" className="nx-input" value={fechaHasta} min={fechaDesde || undefined} onChange={e => { setFechaHasta(e.target.value); setPage(0) }} style={{ width: 150, padding: '7px 8px' }}/>
                {fechaActiva && (
                  <button className="ff-summary__clear" onClick={() => { setFechaDesde(''); setFechaHasta('') }} aria-label="Limpiar fechas">
                    <Ic n="x" s={12}/>
                  </button>
                )}
              </div>
            </div>

            <div className="ff-field">
              <span className="ff-field__label">Agrupar por</span>
              <Seg
                name="epl-group"
                value={groupBy}
                onChange={v => setGroupBy(v as GroupBy)}
                options={[
                  { value: 'estado', label: 'Estado' },
                  { value: 'modalidad', label: 'Modalidad' },
                  { value: 'ninguno', label: 'Sin agrupar' },
                ]}
              />
            </div>

            <div className="ff-foot__spacer"/>

            <div className="ff-foot__actions">
              <button className="ff-clear" onClick={limpiarFiltros} disabled={!algoQueLimpiar}>
                <Ic n="refresh" s={12}/> Limpiar todo
              </button>
              <Btn variant="secondary" size="sm" onClick={() => setPanelOpen(false)}>Listo</Btn>
            </div>
          </div>
        </div>
      )}

      {all.length === 0 ? (
        <Card><CenterState icon="briefcase" title="Sin registros" sub="Todavía no tienes aprendices en etapa productiva a tu cargo."/></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Ic n={q ? 'search' : 'briefcase'} s={26} style={{ color: '#a1a1aa' }}/>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>
              {q ? `Sin resultados para "${search.trim()}"` : 'Ninguna etapa coincide con el filtro'}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>{theadRow}</thead>
                <tbody>
                  {pageItems.map((e, i) => {
                    const tono = tonoEtapa(e)
                    const gk = groupKey(e)
                    const nuevoGrupo = groupBy !== 'ninguno' && (i === 0 || groupKey(pageItems[i - 1]) !== gk)
                    const g = nuevoGrupo ? groupLabel(gk) : null
                    return (
                      <Fragment key={e.id}>
                        {g && (
                          <tr>
                            <td colSpan={cols} style={{ padding: '11px 14px 7px', background: '#fbfbfc', borderTop: i === 0 ? 'none' : '2px solid #ececef' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, flexShrink: 0 }}/>
                                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: g.color }}>{g.label}</span>
                                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: '#a1a1aa' }}>{groupCount(gk)}</span>
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr
                          className="nx-row"
                          onClick={() => onOpen(e.id)}
                          style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer' }}
                        >
                          <td style={TD_S}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <Ava name={e.aprendiz_nombre ?? '?'} size={22}/>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{e.aprendiz_nombre ?? `#${e.aprendiz_id}`}</div>
                                <div style={{ fontSize: 10.5, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{e.aprendiz_documento ?? '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...TD_S, color: '#3f3f46' }}>{MODALIDAD_LABEL[e.modalidad]}</td>
                          <td style={TD_S}>
                            {e.empresa_nombre
                              ? <span style={{ color: '#27272a', display: 'inline-block', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{e.empresa_nombre}</span>
                              : <span style={{ color: '#c4c4c8' }}>—</span>}
                          </td>
                          <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#27272a', whiteSpace: 'nowrap' }}>{fd(e.fecha_inicio)}</td>
                          <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#52525b', whiteSpace: 'nowrap' }}>{fd(e.fecha_fin_estimada)}</td>
                          <td style={TD_S}><Bdg tone={tono.tone}>{tono.label}</Bdg></td>
                          <td style={{ ...TD_S, textAlign: 'right' }}>
                            <Ic n="chevronRight" s={16} style={{ color: '#d4d4d8' }}/>
                          </td>
                        </tr>
                      </Fragment>
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
            pageSize={PAGE_SIZE}
            onPage={setPage}
            noun="aprendices"
          />
        </>
      )}
    </div>
  )
}

// ─── Nuevo registro: ficha → (instructor de práctica, si falta) → aprendiz → datos ─

type Paso =
  | { kind: 'ficha' }
  | { kind: 'instructor'; fichaId: number; numeroFicha: string; coordinacionId: number | null }
  | { kind: 'aprendiz'; fichaId: number; numeroFicha: string }
  | { kind: 'datos'; aprendiz: Aprendiz }

export function NuevoRegistro({ onCancel, onCreated }: { onCancel: () => void; onCreated: (etapaId: number) => void }) {
  "use no memo"
  const [paso, setPaso] = useState<Paso>({ kind: 'ficha' })

  return (
    <div style={{ maxWidth: 720 }}>
      <button onClick={onCancel} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
        <Ic n="arrowLeft" s={14}/>Cancelar
      </button>
      {paso.kind === 'ficha' && (
        <PasoFicha onSeleccion={(fichaId, numeroFicha, coordinacionId, tieneInstructor) =>
          setPaso(tieneInstructor ? { kind: 'aprendiz', fichaId, numeroFicha } : { kind: 'instructor', fichaId, numeroFicha, coordinacionId })
        }/>
      )}
      {paso.kind === 'instructor' && (
        <PasoInstructorPractica fichaId={paso.fichaId} numeroFicha={paso.numeroFicha} coordinacionId={paso.coordinacionId}
          onBack={() => setPaso({ kind: 'ficha' })}
          onAsignado={() => setPaso({ kind: 'aprendiz', fichaId: paso.fichaId, numeroFicha: paso.numeroFicha })}/>
      )}
      {paso.kind === 'aprendiz' && (
        <PasoAprendiz fichaId={paso.fichaId} numeroFicha={paso.numeroFicha}
          onBack={() => setPaso({ kind: 'ficha' })}
          onSeleccion={aprendiz => setPaso({ kind: 'datos', aprendiz })}/>
      )}
      {paso.kind === 'datos' && (
        <CrearEtapaProductivaForm aprendiz={paso.aprendiz} onBack={() => setPaso({ kind: 'aprendiz', fichaId: paso.aprendiz.ficha_id, numeroFicha: '' })} onCreated={onCreated}/>
      )}
    </div>
  )
}

interface FichaOpt { id: number; numero_ficha: string; programa_nombre?: string; coordinacion_academica_id: number | null }

function PasoFicha({ onSeleccion }: {
  onSeleccion: (fichaId: number, numeroFicha: string, coordinacionId: number | null, tieneInstructor: boolean) => void
}) {
  "use no memo"
  const [q, setQ] = useState('')
  const [fichas, setFichas] = useState<FichaOpt[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verificando, setVerificando] = useState<number | null>(null)

  useEffect(() => {
    api.get<FichaOpt[]>('/fichas?estado=EN_EJECUCION').then(r => setFichas(r.data)).catch(() => setError('No se pudieron cargar las fichas.'))
  }, [])

  async function seleccionar(f: FichaOpt) {
    setVerificando(f.id); setError(null)
    try {
      const r = await api.get(`/asignaciones-practica/activa?ficha_id=${f.id}`)
      onSeleccion(f.id, f.numero_ficha, f.coordinacion_academica_id, !!r.data)
    } catch {
      setError('No se pudo verificar el instructor de práctica de esta ficha. Intenta de nuevo.')
    } finally {
      setVerificando(null)
    }
  }

  const ql = q.trim().toLowerCase()
  const view = (fichas ?? []).filter(f => !ql || f.numero_ficha.toLowerCase().includes(ql)).slice(0, 30)

  return (
    <div>
      <SectionIntro title="Selecciona la ficha" sub="Busca por número de ficha del aprendiz que va a iniciar o ya está en etapa productiva."/>
      <input className="nx-input" placeholder="Número de ficha…" value={q} onChange={e => setQ(e.target.value)} autoFocus/>
      {error && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{error}</div>}
      {!fichas && !error && <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 12 }}>Cargando fichas…</div>}
      {fichas && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {view.length === 0 && q && <div style={{ fontSize: 12.5, color: '#71717a' }}>Sin resultados para "{q}".</div>}
          {view.map(f => (
            <button key={f.id} onClick={() => seleccionar(f)} disabled={verificando != null} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
              padding: '10px 14px', border: '1px solid #e4e4e7', borderRadius: 8, background: '#fff',
              cursor: verificando != null ? 'default' : 'pointer', fontFamily: 'inherit', opacity: verificando != null && verificando !== f.id ? 0.5 : 1,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', color: '#18181b' }}>{f.numero_ficha}</span>
              {verificando === f.id ? <Spinner/> : f.programa_nombre && <span style={{ fontSize: 12, color: '#71717a' }}>{f.programa_nombre}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PasoInstructorPractica({ fichaId, numeroFicha, coordinacionId, onBack, onAsignado }: {
  fichaId: number; numeroFicha: string; coordinacionId: number | null; onBack: () => void; onAsignado: () => void
}) {
  "use no memo"
  const [instructores, setInstructores] = useState<{ id: string; nombre_completo: string }[] | null>(null)
  const [instructorId, setInstructorId] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (coordinacionId == null) { setInstructores([]); return }
    api.get(`/usuarios?rol=INSTRUCTOR&coordinacion_id=${coordinacionId}`).then(r => setInstructores(r.data)).catch(() => setInstructores([]))
  }, [coordinacionId])

  async function guardar() {
    if (!instructorId) return
    setBusy(true); setErr(null)
    try {
      await api.post('/asignaciones-practica', { ficha_id: fichaId, instructor_id: instructorId, fecha_inicio: fecha })
      onAsignado()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo asignar el instructor.')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <SectionIntro title="Asigna el instructor de práctica"
        sub={`La ficha ${numeroFicha} todavía no tiene un instructor de seguimiento a etapa productiva — se asigna una sola vez para todos sus aprendices, no por cada uno.`}/>
      <Card style={{ padding: 20 }}>
        {coordinacionId == null ? (
          <div style={{ fontSize: 12.5, color: '#b91c1c' }}>Esta ficha no tiene coordinación académica asignada; no se puede asignar instructor de práctica.</div>
        ) : (
          <>
            <Field label="Instructor" required>
              <select className="nx-input" value={instructorId} onChange={e => setInstructorId(e.target.value)} disabled={!instructores}>
                <option value="">{instructores ? 'Selecciona un instructor…' : 'Cargando…'}</option>
                {instructores?.map(i => <option key={i.id} value={i.id}>{i.nombre_completo}</option>)}
              </select>
            </Field>
            {instructores && instructores.length === 0 && (
              <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 8 }}>No hay instructores en la coordinación académica de esta ficha.</div>
            )}
            <Field label="Desde" style={{ marginTop: 14, maxWidth: 220 }}>
              <input type="date" className="nx-input" value={fecha} onChange={e => setFecha(e.target.value)}/>
            </Field>
          </>
        )}
      </Card>
      {err && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <Btn variant="secondary" onClick={onBack} disabled={busy}>Cambiar ficha</Btn>
        <Btn variant="accent" icon="check" disabled={!instructorId || busy} onClick={guardar}>{busy ? 'Asignando…' : 'Asignar y continuar'}</Btn>
      </div>
    </div>
  )
}

function PasoAprendiz({ fichaId, numeroFicha, onBack, onSeleccion }: {
  fichaId: number; numeroFicha: string; onBack: () => void; onSeleccion: (a: Aprendiz) => void
}) {
  "use no memo"
  const [aprendices, setAprendices] = useState<Aprendiz[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Aprendiz[]>(`/aprendices?ficha_id=${fichaId}`).then(r => setAprendices(r.data)).catch(() => setError('No se pudieron cargar los aprendices de esta ficha.'))
  }, [fichaId])

  return (
    <div>
      <SectionIntro title="Selecciona el aprendiz" sub={`Aprendices registrados en la ficha ${numeroFicha || fichaId}.`}/>
      {error && <div style={{ fontSize: 12, color: '#b91c1c' }}>{error}</div>}
      {!aprendices && !error && <div style={{ fontSize: 12.5, color: '#71717a' }}>Cargando…</div>}
      {aprendices && aprendices.length === 0 && (
        <div style={{ fontSize: 12.5, color: '#71717a' }}>Esta ficha no tiene aprendices cargados todavía.</div>
      )}
      {aprendices && aprendices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
          {aprendices.map(a => (
            <button key={a.id} onClick={() => onSeleccion(a)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
              padding: '10px 14px', border: '1px solid #e4e4e7', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#18181b' }}>{a.nombre_completo}</span>
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: '#71717a' }}>{a.numero_documento}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14 }}><Btn variant="secondary" onClick={onBack}>Cambiar ficha</Btn></div>
    </div>
  )
}

// ─── Fecha fin estimada: calculada, no la escribe el instructor ────────────────
// La duración de la etapa productiva depende del nivel de formación y ya está
// codificada en la ventana productiva de la ficha (fecha_inicio_productiva →
// fecha_fin_productiva). Se toma esa duración y se ancla a la fecha en que
// ESTE aprendiz arranca su etapa. Si la ficha no trae esas fechas, se usa un
// estimado de 6 meses. Siempre queda el botón "ajustar" para casos especiales.
const MESES_ETAPA_PRODUCTIVA_DEFECTO = 6

// La ventana productiva de la ficha viene de GET /fichas/:id/detalle.
interface FichaVentana {
  numero_ficha: string
  nivel_formacion: string
  fecha_fin_lectiva: string | null       // = fecha_inicio_productiva de la ficha
  fecha_fin_productiva: string | null
  // Bloque "Información general" del GFPI-F-023: lo llena coordinación en la
  // ficha y el centro, aquí solo se muestra.
  programa_nombre?: string
  centro_nombre?: string | null
  regional?: string | null
  modalidad_formacion?: 'PRESENCIAL' | 'VIRTUAL' | 'A_DISTANCIA' | null
  estrategia_formativa?: string | null
}

const MODALIDAD_FORMACION_LABEL: Record<string, string> = {
  PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', A_DISTANCIA: 'A distancia',
}

const TIPO_DOC_LABEL: Record<string, string> = {
  CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad', PP: 'Pasaporte',
}

// Parseo en UTC para no correr el día por la zona horaria del navegador.
function addDiasISO(iso: string, dias: number): string {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  return isNaN(t) ? '' : new Date(t + dias * 86400000).toISOString().slice(0, 10)
}
function addMesesISO(iso: string, meses: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return y ? new Date(Date.UTC(y, m - 1 + meses, d)).toISOString().slice(0, 10) : ''
}
function diasEntreISO(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const ta = Date.parse(`${a.slice(0, 10)}T00:00:00Z`)
  const tb = Date.parse(`${b.slice(0, 10)}T00:00:00Z`)
  if (isNaN(ta) || isNaN(tb)) return null
  const dias = Math.round((tb - ta) / 86400000)
  return dias > 0 ? dias : null
}

// fecha_fin_estimada a partir del inicio del aprendiz + la duración de la ficha
// (o el estimado por defecto). Devuelve también los meses aprox. para el texto.
function finEstimada(fechaInicio: string, ficha: FichaVentana | null): { fecha: string; meses: number; desdeFicha: boolean } {
  if (!fechaInicio) return { fecha: '', meses: MESES_ETAPA_PRODUCTIVA_DEFECTO, desdeFicha: false }
  const dur = diasEntreISO(ficha?.fecha_fin_lectiva ?? null, ficha?.fecha_fin_productiva ?? null)
  if (dur != null) {
    return { fecha: addDiasISO(fechaInicio, dur), meses: Math.max(1, Math.round(dur / 30.44)), desdeFicha: true }
  }
  return { fecha: addMesesISO(fechaInicio, MESES_ETAPA_PRODUCTIVA_DEFECTO), meses: MESES_ETAPA_PRODUCTIVA_DEFECTO, desdeFicha: false }
}

// Exportado para reutilizarse fuera del wizard (ej. InstFichaPractica.tsx),
// cuando ya se conoce el aprendiz y no hace falta el paso de buscar ficha/aprendiz.
export function CrearEtapaProductivaForm({ aprendiz, onBack, onCreated }: { aprendiz: Aprendiz; onBack: () => void; onCreated: (id: number) => void }) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const [modalidad, setModalidad] = useState<ModalidadEtapaProductiva>('CONTRATO_APRENDIZAJE')
  const [fechaInicio, setFechaInicio] = useState('')
  const [ficha, setFicha] = useState<FichaVentana | null>(null)
  const [ajusteManual, setAjusteManual] = useState(false)
  const [fechaFinManual, setFechaFinManual] = useState('')

  // Datos del aprendiz que pide el formato y que pueden no estar cargados.
  const [aprDireccion, setAprDireccion] = useState('')
  const [aprCorreoInst, setAprCorreoInst] = useState('')
  const [aprTelefono, setAprTelefono] = useState('')

  const [empresaNombre, setEmpresaNombre] = useState('')
  const [empresaNit, setEmpresaNit] = useState('')
  const [empresaDireccion, setEmpresaDireccion] = useState('')
  const [empresaEmail, setEmpresaEmail] = useState('')
  const [jefeNombre, setJefeNombre] = useState('')
  const [jefeCargo, setJefeCargo] = useState('')
  const [jefeTelefono, setJefeTelefono] = useState('')
  const [jefeEmail, setJefeEmail] = useState('')
  const [otroNombre, setOtroNombre] = useState('')
  const [otroTelefono, setOtroTelefono] = useState('')

  const [apoyoAbierto, setApoyoAbierto] = useState(false)
  const [asisteNombre, setAsisteNombre] = useState('')
  const [asisteTipo, setAsisteTipo] = useState('')
  const [asisteTelefono, setAsisteTelefono] = useState('')

  const [busy, setBusy] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    api.get<{ ficha: FichaVentana }>(`/fichas/${aprendiz.ficha_id}/detalle`)
      .then(r => { if (vivo) setFicha(r.data.ficha) })
      .catch(() => {})
    return () => { vivo = false }
  }, [aprendiz.ficha_id])

  const tieneEmpresa = MODALIDAD_TIENE_EMPRESA[modalidad]
  const calc = finEstimada(fechaInicio, ficha)
  const fechaFin = ajusteManual ? fechaFinManual : calc.fecha

  // Validación: lo que el GFPI-F-023 exige para poder abrir la etapa. Los
  // errores no se ocultan tras un botón deshabilitado -- se muestran al
  // intentar guardar, que es cuando el instructor espera respuesta.
  const errores: Record<string, string> = {}
  if (!fechaInicio) errores.fechaInicio = 'Obligatoria.'
  if (!fechaFin) errores.fechaFin = 'Obligatoria.'
  if (fechaInicio && fechaFin && fechaFin <= fechaInicio) {
    errores.fechaFin = 'Debe ser posterior a la fecha de inicio.'
  }
  if (tieneEmpresa) {
    if (!empresaNombre.trim()) errores.empresaNombre = 'La alternativa elegida exige empresa co-formadora.'
    if (!empresaNit.trim()) errores.empresaNit = 'Obligatorio.'
    if (!empresaDireccion.trim()) errores.empresaDireccion = 'Se usa para verificar los seguimientos en sitio.'
    if (!jefeNombre.trim()) errores.jefeNombre = 'Obligatorio: firma la evaluación del aprendiz.'
    if (!jefeTelefono.trim()) errores.jefeTelefono = 'Obligatorio.'
  }
  if (empresaEmail && !EMAIL_RE.test(empresaEmail.trim())) errores.empresaEmail = 'Correo no válido.'
  if (jefeEmail && !EMAIL_RE.test(jefeEmail.trim())) errores.jefeEmail = 'Correo no válido.'
  if (aprCorreoInst && !EMAIL_RE.test(aprCorreoInst.trim())) errores.aprCorreoInst = 'Correo no válido.'

  const hayErrores = Object.keys(errores).length > 0
  const ver = (k: string) => (intentado ? errores[k] : undefined)

  // Avance de lo que de verdad hay que diligenciar (lo bloqueado no cuenta).
  const diligenciables = [
    fechaInicio, fechaFin,
    ...(tieneEmpresa ? [empresaNombre, empresaNit, empresaDireccion, empresaEmail, jefeNombre, jefeCargo, jefeTelefono, jefeEmail] : []),
  ]
  const llenos = diligenciables.filter(v => v.trim() !== '').length
  const pct = Math.round((llenos / diligenciables.length) * 100)

  async function guardar() {
    setIntentado(true)
    if (hayErrores) {
      setErr('Faltan datos obligatorios del formato. Revisa lo marcado en rojo.')
      return
    }
    setBusy(true); setErr(null)
    try {
      const r = await api.post('/etapas-productivas', {
        aprendiz_id: aprendiz.id,
        modalidad,
        fecha_inicio: fechaInicio,
        fecha_fin_estimada: fechaFin,
        aprendiz_direccion: aprDireccion || undefined,
        aprendiz_email_institucional: aprCorreoInst || undefined,
        aprendiz_telefono: aprTelefono || undefined,
        empresa_nombre: tieneEmpresa ? empresaNombre || undefined : undefined,
        empresa_nit: tieneEmpresa ? empresaNit || undefined : undefined,
        empresa_direccion: tieneEmpresa ? empresaDireccion || undefined : undefined,
        empresa_email: tieneEmpresa ? empresaEmail || undefined : undefined,
        jefe_inmediato_nombre: tieneEmpresa ? jefeNombre || undefined : undefined,
        jefe_inmediato_cargo: tieneEmpresa ? jefeCargo || undefined : undefined,
        jefe_inmediato_telefono: tieneEmpresa ? jefeTelefono || undefined : undefined,
        jefe_inmediato_email: tieneEmpresa ? jefeEmail || undefined : undefined,
        otro_contacto_nombre: tieneEmpresa ? otroNombre || undefined : undefined,
        otro_contacto_telefono: tieneEmpresa ? otroTelefono || undefined : undefined,
        asiste_nombre: asisteNombre || undefined,
        asiste_tipo: asisteTipo || undefined,
        asiste_telefono: asisteTelefono || undefined,
      })
      onCreated(r.data.id)
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setErr(Array.isArray(m) ? m.join(' · ') : m ?? 'No se pudo crear la etapa productiva.')
    } finally { setBusy(false) }
  }

  return (
    <div className="g23">
      <Gfpi023Head
        nombre={aprendiz.nombre_completo}
        tipoDocumento={aprendiz.tipo_documento}
        documento={aprendiz.numero_documento}
        ficha={ficha?.numero_ficha}
        pct={pct}
      />

      <Bloque n={1} titulo="Información general" origen="de la ficha" cols={3}>
        <Campo label="Centro de formación" ancho><Dato valor={ficha?.centro_nombre}/></Campo>
        <Campo label="Nivel formativo"><Dato valor={ficha?.nivel_formacion}/></Campo>
        <Campo label="Programa de formación" ancho><Dato valor={ficha?.programa_nombre}/></Campo>
        <Campo label="No. grupo"><Dato valor={ficha?.numero_ficha} mono/></Campo>
        <Campo label="Modalidad de formación">
          <Dato valor={ficha?.modalidad_formacion ? MODALIDAD_FORMACION_LABEL[ficha.modalidad_formacion] : null}/>
        </Campo>
        <Campo label="Estrategia formativa"><Dato valor={ficha?.estrategia_formativa}/></Campo>
        <Campo label="Fecha fin etapa lectiva">
          <Dato valor={ficha?.fecha_fin_lectiva ? fd(ficha.fecha_fin_lectiva) : null} mono/>
        </Campo>
      </Bloque>

      <Bloque n={2} titulo="Datos del aprendiz">
        <Campo label="Nombre completo" ancho><Dato valor={aprendiz.nombre_completo}/></Campo>
        <Campo label="Tipo de documento">
          <Dato valor={TIPO_DOC_LABEL[aprendiz.tipo_documento] ?? aprendiz.tipo_documento}/>
        </Campo>
        <Campo label="N° de identificación"><Dato valor={aprendiz.numero_documento} mono/></Campo>
        <Campo label="Correo electrónico personal"><Dato valor={aprendiz.email}/></Campo>
        <Campo label="Contacto telefónico">
          {aprendiz.telefono
            ? <Dato valor={aprendiz.telefono} mono/>
            : <input className="nx-input" inputMode="numeric" value={aprTelefono} onChange={e => setAprTelefono(soloDigitos(e.target.value))} placeholder="No registrado"/>}
        </Campo>
        <Campo label="Dirección">
          <input className="nx-input" value={aprDireccion} onChange={e => setAprDireccion(e.target.value)} placeholder="Dirección de residencia"/>
        </Campo>
        <Campo label="Correo electrónico institucional" error={ver('aprCorreoInst')}>
          <input className="nx-input" value={aprCorreoInst} onChange={e => setAprCorreoInst(e.target.value)} placeholder="@sena.edu.co"/>
        </Campo>
      </Bloque>

      <Bloque n={3} titulo="Datos del instructor de seguimiento" origen="tu perfil" cols={3}>
        <Campo label="Nombre"><Dato valor={user?.nombre_completo}/></Campo>
        <Campo label="Correo electrónico institucional"><Dato valor={user?.email}/></Campo>
        <Campo label="Contacto telefónico"><Dato valor={user?.telefono} mono/></Campo>
        {!user?.telefono && (
          <Aviso>
            El formato pide tu teléfono y no lo tienes registrado. Guárdalo una sola vez
            en <strong>Configuración → Perfil</strong> y saldrá aquí y en el formato impreso
            de todos tus aprendices.
          </Aviso>
        )}
      </Bloque>

      <Bloque n={4} titulo="Alternativa de etapa productiva">
        <Campo label="Alternativa / modalidad" required>
          <select className="nx-input" value={modalidad} onChange={e => setModalidad(e.target.value as ModalidadEtapaProductiva)}>
            {MODALIDADES.map(m => <option key={m} value={m}>{MODALIDAD_LABEL[m]}</option>)}
          </select>
        </Campo>
        <Campo label="Fecha de inicio" required error={ver('fechaInicio')}>
          <input type="date" className="nx-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}/>
        </Campo>
        <Campo label={ajusteManual ? 'Fecha fin (a mano)' : 'Fecha fin estimada'} required ancho error={ver('fechaFin')}>
          {ajusteManual ? (
            <input type="date" className="nx-input" value={fechaFinManual} onChange={e => setFechaFinManual(e.target.value)}/>
          ) : (
            <div className="nx-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#f7f7f9' }}>
              <span style={{ color: calc.fecha ? '#18181b' : '#a1a1aa' }}>
                {calc.fecha ? fd(calc.fecha) : 'Elige la fecha de inicio'}
              </span>
              {calc.fecha && (
                <button type="button" onClick={() => { setFechaFinManual(calc.fecha); setAjusteManual(true) }}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  ajustar
                </button>
              )}
            </div>
          )}
        </Campo>
        {fechaInicio && (
          <div className="g23-col2" style={{ fontSize: 11.5, color: '#71717a', marginTop: -4 }}>
            {ajusteManual ? (
              <>Fecha puesta a mano.{' '}
                <button type="button" onClick={() => setAjusteManual(false)}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, padding: 0 }}>
                  volver al cálculo
                </button>
              </>
            ) : calc.desdeFicha ? (
              <>≈ {calc.meses} meses, según la ventana productiva de la ficha {ficha?.numero_ficha}.</>
            ) : (
              <>Estimada en {calc.meses} meses{ficha ? ' — la ficha no tiene fechas de etapa productiva cargadas' : ''}.</>
            )}
          </div>
        )}
      </Bloque>

      {tieneEmpresa && (
        <Bloque n={5} titulo="Datos del ente co-formador">
          <Campo label="Nombre empresa o entidad" required ancho error={ver('empresaNombre')}>
            <input className="nx-input" value={empresaNombre} onChange={e => setEmpresaNombre(e.target.value)}/>
          </Campo>
          <Campo label="NIT" required error={ver('empresaNit')}><input className="nx-input" inputMode="numeric" value={empresaNit} onChange={e => setEmpresaNit(soloDigitos(e.target.value))}/></Campo>
          <Campo label="Correo electrónico" error={ver('empresaEmail')}><input className="nx-input" value={empresaEmail} onChange={e => setEmpresaEmail(e.target.value)}/></Campo>
          <Campo label="Dirección" required ancho error={ver('empresaDireccion')}>
            <input className="nx-input" value={empresaDireccion} onChange={e => setEmpresaDireccion(e.target.value)}/>
          </Campo>
          <Campo label="Jefe inmediato / tutor" required error={ver('jefeNombre')}><input className="nx-input" value={jefeNombre} onChange={e => setJefeNombre(e.target.value)}/></Campo>
          <Campo label="Cargo"><input className="nx-input" value={jefeCargo} onChange={e => setJefeCargo(e.target.value)}/></Campo>
          <Campo label="Contacto telefónico" required error={ver('jefeTelefono')}><input className="nx-input" inputMode="numeric" value={jefeTelefono} onChange={e => setJefeTelefono(soloDigitos(e.target.value))}/></Campo>
          <Campo label="Correo electrónico del jefe" error={ver('jefeEmail')}><input className="nx-input" value={jefeEmail} onChange={e => setJefeEmail(e.target.value)}/></Campo>
          <Campo label="Nombre otro contacto"><input className="nx-input" value={otroNombre} onChange={e => setOtroNombre(e.target.value)}/></Campo>
          <Campo label="Teléfono institucional"><input className="nx-input" inputMode="numeric" value={otroTelefono} onChange={e => setOtroTelefono(soloDigitos(e.target.value))}/></Campo>
        </Bloque>
      )}

      <section className="g23-bloque">
        <button type="button" className="g23-toggle" onClick={() => setApoyoAbierto(v => !v)}>
          <span className="g23-bloque__n">{tieneEmpresa ? 6 : 5}</span>
          <span className="g23-toggle__t">Persona en situación de discapacidad</span>
          <span className="g23-toggle__hint">si aplica</span>
          <Ic n={apoyoAbierto ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: '#a1a1aa' }}/>
        </button>
        {apoyoAbierto && (
          <div className="g23-bloque__body g23-bloque__body--3" style={{ borderTop: '1px solid #f1f1f3' }}>
            <Campo label="Nombre de quien lo asiste">
              <input className="nx-input" value={asisteNombre} onChange={e => setAsisteNombre(e.target.value)}/>
            </Campo>
            <Campo label="Tipo de asistencia">
              <input className="nx-input" value={asisteTipo} onChange={e => setAsisteTipo(e.target.value)} placeholder="Lenguaje de señas, apoyo visual…"/>
            </Campo>
            <Campo label="Contacto telefónico">
              <input className="nx-input" inputMode="numeric" value={asisteTelefono} onChange={e => setAsisteTelefono(soloDigitos(e.target.value))}/>
            </Campo>
          </div>
        )}
      </section>

      {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <Btn variant="secondary" onClick={onBack} disabled={busy}>Volver</Btn>
        <Btn variant="accent" icon="check" disabled={busy} onClick={() => void guardar()}>
          {busy ? 'Creando…' : 'Crear registro'}
        </Btn>
      </div>
    </div>
  )
}
