import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Ic, Btn, Card, Bdg, Modal, Pager } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { Seg, InlineAlert, CenterState, LoadingBlock, fd } from '../shared/parts'
import api from '../../lib/api'
import '../shared/ProgramasFormacion.css'
import './SofiaSync.css'

// ─── Sincronización semanal con SofiaPlus (PE-04) ────────────────────────────
// Cada semana se sube el PE-04 que descarga coordinación de SofiaPlus. El
// backend (forma_server/src/sofia-sync) guarda la foto, la compara con la
// anterior y con FORMA, y propone cambios: nada toca las fichas hasta que se
// aplica aquí. Lo que es de FORMA (coordinación, instructores, práctica)
// nunca se modifica, y nada se borra: lo que deja de venir solo se marca.

const BASE = '/dashboard/superadmin/sofia'

type Accion = 'APLICAR' | 'REVISAR' | 'BLOQUEADO' | 'IGNORADO'
type EstadoCarga = 'PREVISUALIZADA' | 'APLICADA' | 'REVERTIDA' | 'DESCARTADA'

interface Resumen {
  filas_recibidas: number; filas_titulada: number
  nuevas: number; modificadas: number; sin_cambios: number
  desaparecidas: number; reaparecidas: number; solo_en_forma: number
  por_accion: Record<Accion, number>; alertas: number; programas_nuevos: number
}

interface Carga {
  id: number; periodo: string; fecha_corte: string; archivo_nombre: string; hoja: string | null
  carga_base_id: number | null; estado: EstadoCarga; bloqueada: boolean; motivo_bloqueo: string | null
  resumen: Resumen; aplicada_at: string | null; revertida_at: string | null; created_at: string
}

interface Cambio {
  id: number; carga_id: number; numero_ficha: string; ficha_id: number | null
  tipo: 'NUEVA' | 'MODIFICADA' | 'DESAPARECIDA' | 'REAPARECIDA' | 'SOLO_EN_FORMA'
  campo: string | null; valor_anterior: string | null; valor_nuevo: string | null
  accion: Accion; motivo: string | null; alerta: string | null
  resultado: 'PENDIENTE' | 'APLICADO' | 'DESCARTADO' | 'REVERTIDO'; resultado_nota: string | null
}

interface FichaAlerta {
  id: number; numero_ficha: string; programa_nombre: string
  sofia_etapa: string | null; sofia_estado_curso: string | null; sofia_responsable: string | null
  sofia_ausente_desde: string | null
}

interface Alertas {
  ultima_carga: { id: number; periodo: string; fecha_corte: string } | null
  practica_sin_instructor: FichaAlerta[]
  ausentes_en_sofia: FichaAlerta[]
  creadas_sin_coordinacion: FichaAlerta[]
  alertas_ultima_carga: { numero_ficha: string; ficha_id: number; campo: string; valor_anterior: string | null; valor_nuevo: string | null; alerta: string }[]
}

const ESTADO_CARGA: Record<EstadoCarga, { label: string; tone: 'ok' | 'accent' | 'neutral' | 'warn' }> = {
  PREVISUALIZADA: { label: 'Por revisar', tone: 'accent' },
  APLICADA:       { label: 'Aplicada',    tone: 'ok' },
  REVERTIDA:      { label: 'Revertida',   tone: 'warn' },
  DESCARTADA:     { label: 'Descartada',  tone: 'neutral' },
}

const ACCION: Record<Accion, { label: string; tone: 'accent' | 'warn' | 'err' | 'neutral' }> = {
  APLICAR:   { label: 'Aplicar',   tone: 'accent' },
  REVISAR:   { label: 'Revisar',   tone: 'warn' },
  BLOQUEADO: { label: 'Bloqueado', tone: 'err' },
  IGNORADO:  { label: 'Informativo', tone: 'neutral' },
}

const TIPO: Record<Cambio['tipo'], string> = {
  NUEVA: 'Ficha nueva',
  MODIFICADA: 'Cambio',
  DESAPARECIDA: 'Ya no viene',
  REAPARECIDA: 'Volvió',
  SOLO_EN_FORMA: 'Solo en FORMA',
}

const CAMPO: Record<string, string> = {
  estado: 'Estado',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin_productiva: 'Fecha de terminación',
  modalidad_formacion: 'Modalidad',
  programa_id: 'Programa',
  centro_formacion_id: 'Centro',
  sofia_ausente_desde: 'Ausente en SofiaPlus',
  sofia_estado_curso: 'Estado en SofiaPlus',
  sofia_etapa: 'Etapa en SofiaPlus',
  sofia_jornada: 'Jornada',
  sofia_tipo_formacion: 'Tipo de formación',
  sofia_responsable: 'Responsable',
  sofia_empresa_nit: 'NIT empresa',
  sofia_empresa_nombre: 'Empresa',
  sofia_municipio: 'Municipio',
  sofia_total_aprendices: 'Aprendices',
  sofia_total_activos: 'Aprendices activos',
}

function valor(campo: string | null, v: string | null): string {
  if (v == null || v === '') return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fd(v)
  if (campo === 'programa_id') return v.replace('|v', ' · v')
  if (v === 'EN_EJECUCION') return 'En ejecución'
  if (v === 'FINALIZADA') return 'Finalizada'
  return v
}

const hoy = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' })

function mensajeError(e: unknown, porDefecto: string): { texto: string; detalle: string[] } {
  const data = (e as { response?: { data?: { message?: unknown } } })?.response?.data
  const m = data?.message
  if (m && typeof m === 'object' && 'message' in m) {
    const o = m as { message: string; errores?: { fila: number; numero_ficha: string | null; mensaje: string }[]; columnas_faltantes?: string[] }
    return {
      texto: o.message,
      detalle: [
        ...(o.columnas_faltantes?.length ? [`Faltan columnas: ${o.columnas_faltantes.join(', ')}`] : []),
        ...(o.errores ?? []).slice(0, 8).map(x => `Fila ${x.fila}${x.numero_ficha ? ` (ficha ${x.numero_ficha})` : ''}: ${x.mensaje}`),
      ],
    }
  }
  return { texto: Array.isArray(m) ? m.join('. ') : typeof m === 'string' ? m : porDefecto, detalle: [] }
}

export function SofiaSync() {
  return (
    <Routes>
      <Route index element={<SofiaInicio/>}/>
      <Route path=":id" element={<CargaDetalle/>}/>
    </Routes>
  )
}

// ─── Inicio: subir el reporte + historial + alertas ─────────────────────────

function SofiaInicio() {
  "use no memo"
  const navigate = useNavigate()
  const [cargas, setCargas] = useState<Carga[] | null>(null)
  const [alertas, setAlertas] = useState<Alertas | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [vista, setVista] = useState<'cargas' | 'alertas'>('cargas')

  useEffect(() => {
    api.get<Carga[]>('/sofia-sync/cargas').then(r => setCargas(r.data))
      .catch(e => setErr(mensajeError(e, 'No se pudo cargar el historial.').texto))
    api.get<Alertas>('/sofia-sync/alertas').then(r => setAlertas(r.data)).catch(() => {})
  }, [])

  if (err) return <CenterState icon="alert" title={err}/>
  if (!cargas) return <LoadingBlock/>

  const vigente = cargas.find(c => c.estado === 'APLICADA')
  const abierta = cargas.find(c => c.estado === 'PREVISUALIZADA')
  const nAlertas = alertas
    ? alertas.practica_sin_instructor.length + alertas.ausentes_en_sofia.length + alertas.alertas_ultima_carga.length
    : 0

  return (
    <div className="sofia">
      <div className="sofia-top">
        <SubirPe04 onSubida={id => navigate(`${BASE}/${id}`)}/>
        <Card style={{ padding: 18 }}>
          <div className="sofia-vigente__label">Datos vigentes en FORMA</div>
          {vigente ? (
            <>
              <div className="sofia-vigente__valor">Corte del {fd(vigente.fecha_corte)}</div>
              <div className="sofia-vigente__sub">
                Periodo {vigente.periodo} · {vigente.resumen.filas_titulada} fichas de titulada · carga #{vigente.id}
              </div>
            </>
          ) : (
            <div className="sofia-vigente__sub">Todavía no se ha aplicado ningún reporte.</div>
          )}
          {abierta && (
            <button type="button" className="sofia-pendiente" onClick={() => navigate(`${BASE}/${abierta.id}`)}>
              <Ic n="eye" s={13}/> Hay una carga por revisar (#{abierta.id}, corte {fd(abierta.fecha_corte)})
              <Ic n="chevronRight" s={13}/>
            </button>
          )}
        </Card>
      </div>

      <Seg name="sofia-vista" value={vista} onChange={v => setVista(v as 'cargas' | 'alertas')} options={[
        { value: 'cargas', label: `Historial de cargas ${cargas.length}`, icon: 'clock' },
        { value: 'alertas', label: `Alertas ${nAlertas}`, icon: 'bell' },
      ]}/>

      {vista === 'cargas' ? (
        <Card style={{ overflow: 'hidden' }}>
          <div className="prog-table-scroll">
            <table className="prog-table">
              <thead>
                <tr className="prog-table__head-row">
                  <th className="prog-table__th">Carga</th>
                  <th className="prog-table__th">Corte</th>
                  <th className="prog-table__th">Estado</th>
                  <th className="prog-table__th">Resultado</th>
                  <th className="prog-table__th"/>
                </tr>
              </thead>
              <tbody>
                {cargas.length === 0 && (
                  <tr><td colSpan={5} className="sofia-vacio">Aún no se ha subido ningún PE-04.</td></tr>
                )}
                {cargas.map(c => (
                  <tr key={c.id} className="nx-row sofia-fila" onClick={() => navigate(`${BASE}/${c.id}`)}>
                    <td className="prog-table__td">
                      <div className="prog-table__name">#{c.id} · {c.archivo_nombre}</div>
                      <div className="prog-table__meta"><span className="prog-code">Periodo {c.periodo}{c.hoja ? ` · hoja ${c.hoja}` : ''}</span></div>
                    </td>
                    <td className="prog-table__td">{fd(c.fecha_corte)}</td>
                    <td className="prog-table__td">
                      <Bdg tone={ESTADO_CARGA[c.estado].tone}>{ESTADO_CARGA[c.estado].label}</Bdg>
                      {c.bloqueada && <span className="sofia-bloq"><Ic n="lock" s={11}/> bloqueada</span>}
                    </td>
                    <td className="prog-table__td sofia-chips">
                      <ResumenChips r={c.resumen}/>
                    </td>
                    <td className="prog-table__td" style={{ textAlign: 'right' }}><Ic n="chevronRight" s={14} style={{ color: '#a1a1aa' }}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <AlertasPanel alertas={alertas}/>
      )}
    </div>
  )
}

function ResumenChips({ r }: { r: Resumen }) {
  const chips: [string, number, string][] = [
    ['nuevas', r.nuevas, 'sofia-chip--new'],
    ['con cambios', r.modificadas, ''],
    ['ya no vienen', r.desaparecidas, 'sofia-chip--warn'],
    ['por revisar', r.por_accion.REVISAR, 'sofia-chip--warn'],
    ['alertas', r.alertas, 'sofia-chip--err'],
  ]
  const visibles = chips.filter(([, n]) => n > 0)
  if (!visibles.length) return <span className="sofia-nada">Sin cambios</span>
  return <>{visibles.map(([l, n, cls]) => <span key={l} className={`sofia-chip ${cls}`}><b>{n}</b> {l}</span>)}</>
}

// ─── Subida del archivo ──────────────────────────────────────────────────────

function SubirPe04({ onSubida }: { onSubida: (cargaId: number) => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [fecha, setFecha] = useState(hoy)
  const [arrastrando, setArrastrando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<{ texto: string; detalle: string[] } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  function elegir(f: File | undefined) {
    setError(null)
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) { setError({ texto: 'El archivo debe ser el .xlsx que descarga SofiaPlus.', detalle: [] }); return }
    setArchivo(f)
  }

  async function subir() {
    if (!archivo) return
    const datos = new FormData()
    datos.append('archivo', archivo)
    datos.append('fecha_corte', fecha)
    setSubiendo(true); setError(null)
    try {
      const r = await api.post<{ carga: Carga }>('/sofia-sync/cargas/archivo', datos)
      onSubida(r.data.carga.id)
    } catch (e) {
      setError(mensajeError(e, 'No se pudo procesar el archivo.'))
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Card style={{ padding: 18 }}>
      <div className="sofia-subir__titulo"><Ic n="upload" s={15}/> Subir el PE-04 de la semana</div>
      <p className="sofia-subir__txt">
        Se guarda la foto del reporte y se calculan los cambios. <b>No se modifica ninguna ficha</b> hasta que revises y apliques.
      </p>
      <div
        className={`sofia-drop${arrastrando ? ' sofia-drop--on' : ''}${archivo ? ' sofia-drop--ok' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]) }}
      >
        <input ref={input} type="file" accept=".xlsx" hidden onChange={e => { elegir(e.target.files?.[0]); e.target.value = '' }}/>
        <Ic n={archivo ? 'fileText' : 'upload'} s={18}/>
        {archivo
          ? <span><b>{archivo.name}</b> · {Math.round(archivo.size / 1024)} KB</span>
          : <span>Arrastra el archivo aquí o <u>haz clic para elegirlo</u></span>}
      </div>
      <div className="sofia-subir__fila">
        <label className="sofia-campo">
          <span>Fecha de corte</span>
          <input type="date" value={fecha} max={hoy()} onChange={e => setFecha(e.target.value)}/>
        </label>
        <Btn icon="refresh" disabled={!archivo || !fecha || subiendo} onClick={() => void subir()}>
          {subiendo ? 'Procesando…' : 'Subir y comparar'}
        </Btn>
      </div>
      {error && (
        <InlineAlert tone="crit" icon="alert" style={{ marginTop: 12 }} title={error.texto}>
          {error.detalle.length > 0 && <ul className="sofia-errores">{error.detalle.map(d => <li key={d}>{d}</li>)}</ul>}
        </InlineAlert>
      )}
    </Card>
  )
}

// ─── Alertas vigentes ────────────────────────────────────────────────────────

function AlertasPanel({ alertas }: { alertas: Alertas | null }) {
  const navigate = useNavigate()
  if (!alertas) return <LoadingBlock minHeight={160}/>
  const abrir = (id: number) => navigate(`/dashboard/superadmin/fichas/${id}`)

  const grupos: { titulo: string; sub: string; icon: IcName; tone: string; filas: FichaAlerta[]; extra: (f: FichaAlerta) => string }[] = [
    {
      titulo: 'En práctica sin instructor', icon: 'alert', tone: 'err',
      sub: 'SofiaPlus las reporta en etapa práctica y no tienen instructor de práctica asignado en FORMA.',
      filas: alertas.practica_sin_instructor, extra: f => f.sofia_responsable ?? '',
    },
    {
      titulo: 'Ya no aparecen en SofiaPlus', icon: 'eye', tone: 'warn',
      sub: 'No vinieron en el último reporte. No se borró nada: revisa si es un error del export.',
      filas: alertas.ausentes_en_sofia, extra: f => f.sofia_ausente_desde ? `desde ${fd(f.sofia_ausente_desde)}` : '',
    },
    {
      titulo: 'Creadas desde SofiaPlus sin coordinación', icon: 'users', tone: 'neutral',
      sub: 'Hay que asignarles coordinación para que aparezcan en los tableros de coordinación.',
      filas: alertas.creadas_sin_coordinacion, extra: f => f.sofia_etapa === 'PRACTICA' ? 'en práctica' : '',
    },
  ]

  return (
    <div className="sofia-alertas">
      {alertas.alertas_ultima_carga.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div className="sofia-grupo__cab">
            <Ic n="bell" s={14}/> <b>Novedades del último reporte</b>
            <span className="sofia-grupo__n">{alertas.alertas_ultima_carga.length}</span>
          </div>
          <div className="sofia-lista">
            {alertas.alertas_ultima_carga.map((a, i) => (
              <button key={i} type="button" className="sofia-lista__item" onClick={() => abrir(a.ficha_id)}>
                <span className="prog-code">{a.numero_ficha}</span>
                <span>{a.alerta}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
      {grupos.map(g => (
        <Card key={g.titulo} style={{ padding: 16 }}>
          <div className="sofia-grupo__cab">
            <Ic n={g.icon} s={14}/> <b>{g.titulo}</b>
            <span className={`sofia-grupo__n sofia-grupo__n--${g.tone}`}>{g.filas.length}</span>
          </div>
          <div className="sofia-grupo__sub">{g.sub}</div>
          {g.filas.length === 0 ? (
            <div className="sofia-nada">Ninguna.</div>
          ) : (
            <ListaFichas filas={g.filas} extra={g.extra} onAbrir={abrir}/>
          )}
        </Card>
      ))}
    </div>
  )
}

function ListaFichas({ filas, extra, onAbrir }: {
  filas: FichaAlerta[]; extra: (f: FichaAlerta) => string; onAbrir: (id: number) => void
}) {
  const [todas, setTodas] = useState(false)
  const visibles = todas ? filas : filas.slice(0, 8)
  return (
    <div className="sofia-lista">
      {visibles.map(f => (
        <button key={f.id} type="button" className="sofia-lista__item" onClick={() => onAbrir(f.id)}>
          <span className="prog-code">{f.numero_ficha}</span>
          <span className="sofia-lista__prog">{f.programa_nombre}</span>
          <span className="sofia-lista__extra">{extra(f)}</span>
        </button>
      ))}
      {filas.length > 8 && (
        <button type="button" className="sofia-mas" onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : `Ver las ${filas.length}`}
        </button>
      )}
    </div>
  )
}

// ─── Detalle de una carga: revisar y aplicar ────────────────────────────────

type Filtro = 'todos' | 'aplicar' | 'revisar' | 'alertas' | 'nuevas' | 'otros'
const POR_PAGINA = 40

function CargaDetalle() {
  "use no memo"
  const { id } = useParams()
  const cargaId = Number(id)
  const navigate = useNavigate()
  const [carga, setCarga] = useState<Carga | null>(null)
  const [cambios, setCambios] = useState<Cambio[] | null>(null)
  const [esUltima, setEsUltima] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(0)
  const [aprobar, setAprobar] = useState<Set<number>>(new Set())
  const [excluir, setExcluir] = useState<Set<number>>(new Set())
  const [confirmar, setConfirmar] = useState<'aplicar' | 'revertir' | 'descartar' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [resolviendo, setResolviendo] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tone: 'ok' | 'crit'; texto: string } | null>(null)

  function cargar() {
    Promise.all([
      api.get<Carga>(`/sofia-sync/cargas/${cargaId}`),
      api.get<Cambio[]>(`/sofia-sync/cargas/${cargaId}/cambios`),
      api.get<Carga[]>('/sofia-sync/cargas'),
    ]).then(([c, cs, todas]) => {
      setCarga(c.data)
      setCambios(cs.data)
      setEsUltima(todas.data.find(x => x.estado === 'APLICADA')?.id === cargaId)
    }).catch(e => setErr(mensajeError(e, 'No se pudo cargar la carga.').texto))
  }
  useEffect(cargar, [cargaId])

  const cuenta = useMemo(() => {
    const cs = cambios ?? []
    return {
      todos: cs.length,
      aplicar: cs.filter(c => c.accion === 'APLICAR').length,
      revisar: cs.filter(c => c.accion === 'REVISAR').length,
      alertas: cs.filter(c => c.alerta).length,
      nuevas: cs.filter(c => c.tipo === 'NUEVA').length,
      otros: cs.filter(c => c.accion === 'IGNORADO' || c.accion === 'BLOQUEADO').length,
    }
  }, [cambios])

  const visibles = useMemo(() => {
    const qn = q.trim()
    return (cambios ?? []).filter(c =>
      (filtro === 'todos'
        || (filtro === 'aplicar' && c.accion === 'APLICAR')
        || (filtro === 'revisar' && c.accion === 'REVISAR')
        || (filtro === 'alertas' && c.alerta)
        || (filtro === 'nuevas' && c.tipo === 'NUEVA')
        || (filtro === 'otros' && (c.accion === 'IGNORADO' || c.accion === 'BLOQUEADO')))
      && (!qn || c.numero_ficha.includes(qn)))
  }, [cambios, filtro, q])

  if (err) return <CenterState icon="alert" title={err}/>
  if (!carga || !cambios) return <LoadingBlock/>

  const previa = carga.estado === 'PREVISUALIZADA'
  const r = carga.resumen
  const pendientes = cambios.filter(c => c.accion === 'REVISAR' && c.resultado === 'PENDIENTE').length
  const nAplicar = cuenta.aplicar - excluir.size + aprobar.size
  const pageCount = Math.ceil(visibles.length / POR_PAGINA)
  const pagina_ = Math.min(pagina, Math.max(0, pageCount - 1))
  const enPagina = visibles.slice(pagina_ * POR_PAGINA, (pagina_ + 1) * POR_PAGINA)

  function alternar(set: Set<number>, fn: (s: Set<number>) => void, cid: number) {
    const s = new Set(set)
    if (s.has(cid)) s.delete(cid); else s.add(cid)
    fn(s)
  }

  async function ejecutar() {
    setOcupado(true); setAviso(null)
    try {
      if (confirmar === 'aplicar') {
        const res = await api.post<{ aplicados: number; descartados: number; pendientes_revision: number }>(
          `/sofia-sync/cargas/${cargaId}/aplicar`, { aprobar: [...aprobar], excluir: [...excluir] })
        setAviso({ tone: 'ok', texto: `Carga aplicada: ${res.data.aplicados} cambios aplicados${res.data.descartados ? `, ${res.data.descartados} descartados por cambios recientes en FORMA` : ''}${res.data.pendientes_revision ? `. ${res.data.pendientes_revision} revisiones quedan pendientes` : ''}.` })
      } else if (confirmar === 'revertir') {
        const res = await api.post<{ revertidos: number; conservados: number; fichas_borradas: number }>(`/sofia-sync/cargas/${cargaId}/revertir`)
        setAviso({ tone: 'ok', texto: `Carga revertida: ${res.data.revertidos} cambios deshechos${res.data.conservados ? `, ${res.data.conservados} se conservaron porque ya se editaron en FORMA` : ''}.` })
      } else if (confirmar === 'descartar') {
        await api.post(`/sofia-sync/cargas/${cargaId}/descartar`)
        navigate(BASE)
        return
      }
      setAprobar(new Set()); setExcluir(new Set())
      cargar()
    } catch (e) {
      setAviso({ tone: 'crit', texto: mensajeError(e, 'La operación no se pudo completar.').texto })
    } finally {
      setOcupado(false); setConfirmar(null)
    }
  }

  async function resolver(c: Cambio, decision: 'APLICAR' | 'DESCARTAR') {
    setResolviendo(c.id); setAviso(null)
    try {
      const res = await api.post<Cambio>(`/sofia-sync/cargas/${cargaId}/cambios/${c.id}/resolver`, { decision })
      setCambios(prev => (prev ?? []).map(x => x.id === c.id ? res.data : x))
    } catch (e) {
      setAviso({ tone: 'crit', texto: mensajeError(e, 'No se pudo resolver el cambio.').texto })
    } finally {
      setResolviendo(null)
    }
  }

  return (
    <div className="sofia">
      <button type="button" className="sofia-volver" onClick={() => navigate(BASE)}>
        <Ic n="arrowLeft" s={14}/> SofiaPlus
      </button>

      <div className="sofia-cab">
        <div>
          <h2 className="sofia-cab__titulo">Corte del {fd(carga.fecha_corte)} <span>· carga #{carga.id}</span></h2>
          <div className="sofia-cab__meta">
            <Bdg tone={ESTADO_CARGA[carga.estado].tone}>{ESTADO_CARGA[carga.estado].label}</Bdg>
            <span>{carga.archivo_nombre}</span>
            <span>·</span><span>Periodo {carga.periodo}</span>
            <span>·</span><span>{r.filas_titulada} fichas de titulada</span>
          </div>
        </div>
        <div className="sofia-cab__acciones">
          {previa && <Btn variant="ghost" icon="x" disabled={ocupado} onClick={() => setConfirmar('descartar')}>Descartar</Btn>}
          {previa && (
            <Btn icon="check" disabled={ocupado || carga.bloqueada || nAplicar === 0} onClick={() => setConfirmar('aplicar')}>
              Aplicar {nAplicar} cambios
            </Btn>
          )}
          {carga.estado === 'APLICADA' && esUltima && (
            <Btn variant="secondary" icon="refresh" disabled={ocupado} onClick={() => setConfirmar('revertir')}>Revertir</Btn>
          )}
        </div>
      </div>

      {aviso && <InlineAlert tone={aviso.tone} icon={aviso.tone === 'ok' ? 'checkCircle' : 'alert'}>{aviso.texto}</InlineAlert>}
      {carga.bloqueada && (
        <InlineAlert tone="crit" icon="lock" title="Esta carga no se puede aplicar">{carga.motivo_bloqueo}</InlineAlert>
      )}
      {previa && !carga.bloqueada && (
        <InlineAlert tone="info" icon="info">
          Los cambios <b>Aplicar</b> van por defecto (desmarca los que no quieras). Los de <b>Revisar</b> solo se aplican si los marcas;
          si no, quedan pendientes y puedes resolverlos después. Coordinación, instructores y práctica nunca se tocan.
        </InlineAlert>
      )}
      {carga.estado === 'APLICADA' && esUltima && pendientes > 0 && (
        <InlineAlert tone="warn" icon="clock">
          <b>{pendientes}</b> cambios quedaron pendientes de revisión. Apruébalos o recházalos en el filtro <b>Revisar</b>;
          los que sigan pendientes se vuelven a proponer con el próximo reporte.
        </InlineAlert>
      )}

      <div className="sofia-metricas">
        {([
          ['Fichas nuevas', r.nuevas, 'plus'],
          ['Con cambios', r.modificadas, 'edit'],
          ['Sin cambios', r.sin_cambios, 'check'],
          ['Ya no vienen', r.desaparecidas, 'eye'],
          ['Alertas', r.alertas, 'bell'],
          ['Programas nuevos', r.programas_nuevos, 'layers'],
        ] as [string, number, IcName][]).map(([l, n, ic]) => (
          <div key={l} className="sofia-metrica">
            <Ic n={ic} s={13}/>
            <b>{n}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>

      <div className="sofia-barra">
        <Seg name="sofia-filtro" value={filtro} onChange={v => { setFiltro(v as Filtro); setPagina(0) }} options={[
          { value: 'todos', label: `Todos ${cuenta.todos}` },
          { value: 'aplicar', label: `Aplicar ${cuenta.aplicar}` },
          { value: 'revisar', label: `Revisar ${cuenta.revisar}` },
          { value: 'alertas', label: `Alertas ${cuenta.alertas}` },
          { value: 'nuevas', label: `Nuevas ${cuenta.nuevas}` },
          { value: 'otros', label: `Informativos ${cuenta.otros}` },
        ]}/>
        <label className="sofia-buscar">
          <Ic n="search" s={13}/>
          <input value={q} onChange={e => { setQ(e.target.value.replace(/\D/g, '')); setPagina(0) }} placeholder="Buscar número de ficha"/>
        </label>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <div className="prog-table-scroll">
          <table className="prog-table">
            <thead>
              <tr className="prog-table__head-row">
                {previa && <th className="prog-table__th sofia-check"/>}
                <th className="prog-table__th">Ficha</th>
                <th className="prog-table__th">Qué cambia</th>
                <th className="prog-table__th">Antes → Después</th>
                <th className="prog-table__th">Decisión</th>
              </tr>
            </thead>
            <tbody>
              {enPagina.length === 0 && (
                <tr><td colSpan={previa ? 5 : 4} className="sofia-vacio">Ningún cambio en este filtro.</td></tr>
              )}
              {enPagina.map(c => {
                const marcado = c.accion === 'APLICAR' ? !excluir.has(c.id) : aprobar.has(c.id)
                const marcable = previa && (c.accion === 'APLICAR' || c.accion === 'REVISAR')
                const porResolver = !previa && esUltima && c.accion === 'REVISAR' && c.resultado === 'PENDIENTE'
                return (
                  <Fragment key={c.id}>
                    <tr className={`nx-row${marcable && !marcado ? ' sofia-fila--off' : ''}`}>
                      {previa && (
                        <td className="prog-table__td sofia-check">
                          {marcable && (
                            <input
                              type="checkbox" checked={marcado}
                              onChange={() => c.accion === 'APLICAR'
                                ? alternar(excluir, setExcluir, c.id)
                                : alternar(aprobar, setAprobar, c.id)}
                            />
                          )}
                        </td>
                      )}
                      <td className="prog-table__td">
                        {c.ficha_id
                          ? <button type="button" className="sofia-ficha" onClick={() => navigate(`/dashboard/superadmin/fichas/${c.ficha_id}`)}>{c.numero_ficha}</button>
                          : <span className="prog-code">{c.numero_ficha}</span>}
                        <div className="sofia-tipo">{TIPO[c.tipo]}</div>
                      </td>
                      <td className="prog-table__td">
                        <div className="sofia-campo-l">{c.campo ? CAMPO[c.campo] ?? c.campo : c.tipo === 'NUEVA' ? 'Crear ficha' : '—'}</div>
                        {c.motivo && <div className="sofia-motivo">{c.motivo}</div>}
                        {c.alerta && <div className="sofia-alerta"><Ic n="bell" s={11}/> {c.alerta}</div>}
                      </td>
                      <td className="prog-table__td sofia-valores">
                        {c.tipo === 'NUEVA'
                          ? <span className="sofia-nuevo">{c.valor_nuevo?.replace('|v', ' · v')}</span>
                          : c.tipo === 'SOLO_EN_FORMA' ? <span className="sofia-nada">—</span>
                          : <><span className="sofia-antes">{valor(c.campo, c.valor_anterior)}</span><Ic n="arrowRight" s={12}/><span className="sofia-despues">{valor(c.campo, c.valor_nuevo)}</span></>}
                      </td>
                      <td className="prog-table__td">
                        {previa ? (
                          <Bdg tone={ACCION[c.accion].tone}>{ACCION[c.accion].label}</Bdg>
                        ) : porResolver ? (
                          <div className="sofia-resolver">
                            <Btn size="sm" icon="check" disabled={resolviendo != null} onClick={() => void resolver(c, 'APLICAR')}>Aprobar</Btn>
                            <Btn size="sm" variant="ghost" disabled={resolviendo != null} onClick={() => void resolver(c, 'DESCARTAR')}>Rechazar</Btn>
                          </div>
                        ) : (
                          <ResultadoBdg c={c}/>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pager page={pagina_} pageCount={pageCount} total={visibles.length} pageSize={POR_PAGINA} onPage={setPagina} noun="cambios"/>
      </Card>

      {confirmar && (
        <Modal
          title={confirmar === 'aplicar' ? 'Aplicar la carga' : confirmar === 'revertir' ? 'Revertir la carga' : 'Descartar la carga'}
          icon={confirmar === 'aplicar' ? 'check' : confirmar === 'revertir' ? 'refresh' : 'x'}
          onClose={() => !ocupado && setConfirmar(null)}
          width={460}
          footer={<>
            <Btn variant="ghost" disabled={ocupado} onClick={() => setConfirmar(null)}>Cancelar</Btn>
            <Btn variant={confirmar === 'aplicar' ? 'primary' : 'danger'} disabled={ocupado} onClick={() => void ejecutar()}>
              {ocupado ? 'Procesando…' : confirmar === 'aplicar' ? `Aplicar ${nAplicar} cambios` : confirmar === 'revertir' ? 'Revertir' : 'Descartar'}
            </Btn>
          </>}
        >
          <div className="sofia-confirma">
            {confirmar === 'aplicar' && <>
              <p>Se escriben en FORMA <b>{nAplicar}</b> cambios en una sola operación: si algo falla, no se aplica nada.</p>
              <ul>
                {r.nuevas > 0 && <li>Se crean hasta <b>{r.nuevas - cambios.filter(c => c.tipo === 'NUEVA' && ((c.accion === 'APLICAR' && excluir.has(c.id)) || (c.accion === 'REVISAR' && !aprobar.has(c.id)))).length}</b> fichas nuevas, sin coordinación.</li>}
                {aprobar.size > 0 && <li>Incluye <b>{aprobar.size}</b> cambios de revisión que aprobaste.</li>}
                {excluir.size > 0 && <li>Excluiste <b>{excluir.size}</b> cambios.</li>}
                <li>Se puede revertir mientras sea la última carga aplicada.</li>
              </ul>
            </>}
            {confirmar === 'revertir' && (
              <p>Se deshacen los cambios de esta carga. Lo que se haya editado después en FORMA se conserva, y las fichas creadas solo se eliminan si todavía no tienen coordinación, aprendices ni práctica.</p>
            )}
            {confirmar === 'descartar' && <p>La carga queda en el historial como descartada y no se aplica nada.</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}

function ResultadoBdg({ c }: { c: Cambio }) {
  const m: Record<Cambio['resultado'], { l: string; t: 'ok' | 'neutral' | 'warn' | 'accent' }> = {
    APLICADO: { l: 'Aplicado', t: 'ok' },
    DESCARTADO: { l: 'No aplicado', t: 'neutral' },
    REVERTIDO: { l: 'Revertido', t: 'warn' },
    PENDIENTE: { l: 'Pendiente', t: 'accent' },
  }
  return (
    <div>
      <Bdg tone={m[c.resultado].t}>{m[c.resultado].l}</Bdg>
      {c.resultado_nota && <div className="sofia-motivo">{c.resultado_nota}</div>}
    </div>
  )
}
