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

const BASE = '/dashboard/superadmin/integridad/sofia'

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
  // Solo fichas NUEVA: a qué coordinación la manda el catálogo al aplicar.
  coordinacion_sugerida?: { tipo: string; coordinacion_academica_id: number | null; coordinacion_nombre: string | null } | null
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

// ─── Inicio: estado del reporte, subida, historial y novedades ──────────────

const DIA = 86_400_000
const diasDesde = (iso: string) => Math.max(0, Math.round((Date.parse(hoy()) - Date.parse(iso)) / DIA))

// Semáforo del reporte: se sube cada semana.
function frescura(dias: number | null): { tono: 'ok' | 'warn' | 'err'; titulo: string } {
  if (dias == null) return { tono: 'err', titulo: 'Todavía no hay datos de SofiaPlus' }
  if (dias <= 7) return { tono: 'ok', titulo: 'Datos al día' }
  if (dias <= 14) return { tono: 'warn', titulo: 'Toca subir el reporte de esta semana' }
  return { tono: 'err', titulo: 'El reporte está atrasado' }
}

function SofiaInicio() {
  "use no memo"
  const navigate = useNavigate()
  const [cargas, setCargas] = useState<Carga[] | null>(null)
  const [alertas, setAlertas] = useState<Alertas | null>(null)
  const [pendientes, setPendientes] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [vista, setVista] = useState<'cargas' | 'alertas'>('cargas')

  useEffect(() => {
    api.get<Carga[]>('/sofia-sync/cargas')
      .then(r => {
        setCargas(r.data)
        // Revisiones que quedaron pendientes en la carga vigente.
        const vig = r.data.find(c => c.estado === 'APLICADA')
        if (vig) api.get<Cambio[]>(`/sofia-sync/cargas/${vig.id}/cambios`, { params: { accion: 'REVISAR' } })
          .then(x => setPendientes(x.data.filter(c => c.resultado === 'PENDIENTE').length))
          .catch(() => setPendientes(null))
      })
      .catch(e => setErr(mensajeError(e, 'No se pudo cargar el historial.').texto))
    api.get<Alertas>('/sofia-sync/alertas').then(r => setAlertas(r.data)).catch(() => {})
  }, [])

  if (err) return <CenterState icon="alert" title={err}/>
  if (!cargas) return <LoadingBlock/>

  const vigente = cargas.find(c => c.estado === 'APLICADA')
  const abierta = cargas.find(c => c.estado === 'PREVISUALIZADA')
  const dias = vigente ? diasDesde(vigente.fecha_corte) : null
  const f = frescura(dias)
  const nAlertas = alertas
    ? alertas.practica_sin_instructor.length + alertas.ausentes_en_sofia.length + alertas.alertas_ultima_carga.length
    : 0
  const paso = abierta ? 3 : f.tono === 'ok' ? 0 : 1

  return (
    <div className="sofia sp">
      <section className="sp-hero">
        <div className={`sp-estado sp-estado--${f.tono}`}>
          <div className="sp-estado__cab">
            <span className="sp-semaforo"/>
            <span>{f.titulo}</span>
          </div>
          {vigente ? (
            <>
              <div className="sp-estado__corte">Corte del {fd(vigente.fecha_corte)}</div>
              <div className="sp-estado__sub">
                {dias === 0 ? 'Hoy' : `Hace ${dias} día${dias === 1 ? '' : 's'}`} · periodo {vigente.periodo} · {vigente.resumen.filas_titulada.toLocaleString('es-CO')} fichas de titulada
              </div>
              <div className="sp-estado__accesos">
                <button type="button" className="sp-acceso" onClick={() => navigate(`${BASE}/${vigente.id}`)}>
                  <Ic n="fileText" s={13}/> Ver carga #{vigente.id}
                </button>
                {pendientes != null && pendientes > 0 && (
                  <button type="button" className="sp-acceso sp-acceso--warn" onClick={() => navigate(`${BASE}/${vigente.id}`)}>
                    <Ic n="clock" s={13}/> {pendientes} revisiones pendientes
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="sp-estado__sub">Sube el primer PE-04 para que FORMA tenga las fichas de SofiaPlus.</div>
          )}
        </div>
        <SubirPe04 onSubida={id => navigate(`${BASE}/${id}`)}/>
      </section>

      {abierta && (
        <button type="button" className="sp-abierta" onClick={() => navigate(`${BASE}/${abierta.id}`)}>
          <Ic n="eye" s={15}/>
          <span><b>Tienes una carga por revisar</b> · corte del {fd(abierta.fecha_corte)}. Nada se aplica hasta que la confirmes.</span>
          <span className="sp-abierta__ir">Revisar <Ic n="chevronRight" s={13}/></span>
        </button>
      )}

      <ol className="sp-pasos">
        {[
          ['Descarga', 'el PE-04 de SofiaPlus (Programación específica de cursos)'],
          ['Súbelo', 'aquí: FORMA lo compara con lo que ya tiene'],
          ['Revisa y aplica', 'los cambios: nada se toca hasta que confirmes'],
        ].map(([t, d], i) => (
          <li key={t} className={i + 1 === paso ? 'sp-paso--actual' : ''}>
            <span className="sp-pasos__n">{i + 1}</span>
            <span><b>{t}</b> {d}</span>
          </li>
        ))}
      </ol>

      <div className="sp-barra">
        <Seg name="sofia-vista" value={vista} onChange={v => setVista(v as 'cargas' | 'alertas')} options={[
          { value: 'cargas', label: `Historial ${cargas.length}`, icon: 'clock' },
          { value: 'alertas', label: `Novedades ${nAlertas}`, icon: 'bell' },
        ]}/>
      </div>

      {vista === 'cargas' ? (
        cargas.length === 0 ? (
          <div className="sofia-vacio">Aún no se ha subido ningún PE-04.</div>
        ) : (
          <ol className="sp-linea">
            {cargas.map((c, i) => (
              <li key={c.id} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <button type="button" className={`sp-carga sp-carga--${c.estado.toLowerCase()}`} onClick={() => navigate(`${BASE}/${c.id}`)}>
                  <span className="sp-carga__punto"/>
                  <span className="sp-carga__fecha">
                    <b>{fd(c.fecha_corte)}</b>
                    <small>carga #{c.id}</small>
                  </span>
                  <span className="sp-carga__cuerpo">
                    <span className="sp-carga__archivo">{c.archivo_nombre}</span>
                    <span className="sofia-chips"><ResumenChips r={c.resumen}/></span>
                  </span>
                  <span className="sp-carga__estado">
                    <Bdg tone={ESTADO_CARGA[c.estado].tone}>{ESTADO_CARGA[c.estado].label}</Bdg>
                    {c.bloqueada && <span className="sofia-bloq"><Ic n="lock" s={11}/> bloqueada</span>}
                  </span>
                  <Ic n="chevronRight" s={14} className="sp-carga__ir"/>
                </button>
              </li>
            ))}
          </ol>
        )
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
  ]
  const visibles = chips.filter(([, n]) => n > 0)
  if (!visibles.length) return <span className="sofia-nada">Sin cambios</span>
  return <>{visibles.map(([l, n, cls]) => <span key={l} className={`sofia-chip ${cls}`}><b>{n.toLocaleString('es-CO')}</b> {l}</span>)}</>
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
    <div className="sp-subir">
      <div
        className={`sp-drop${arrastrando ? ' sp-drop--on' : ''}${archivo ? ' sp-drop--ok' : ''}`}
        role="button" tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click() } }}
        onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]) }}
      >
        <input ref={input} type="file" accept=".xlsx" hidden onChange={e => { elegir(e.target.files?.[0]); e.target.value = '' }}/>
        <span className="sp-drop__icono"><Ic n={archivo ? 'fileText' : 'upload'} s={22}/></span>
        {archivo ? (
          <>
            <b>{archivo.name}</b>
            <span>{Math.round(archivo.size / 1024).toLocaleString('es-CO')} KB · toca para cambiarlo</span>
          </>
        ) : (
          <>
            <b>Arrastra aquí el PE-04 de esta semana</b>
            <span>o haz clic para elegir el .xlsx</span>
          </>
        )}
      </div>
      <div className="sp-subir__fila">
        <label className="sofia-campo">
          <span>Fecha de corte</span>
          <input type="date" value={fecha} max={hoy()} onChange={e => setFecha(e.target.value)}/>
        </label>
        <Btn icon="refresh" disabled={!archivo || !fecha || subiendo} onClick={() => void subir()}>
          {subiendo ? 'Comparando…' : 'Subir y comparar'}
        </Btn>
      </div>
      {error && (
        <InlineAlert tone="crit" icon="alert" style={{ marginTop: 10 }} title={error.texto}>
          {error.detalle.length > 0 && <ul className="sofia-errores">{error.detalle.map(d => <li key={d}>{d}</li>)}</ul>}
        </InlineAlert>
      )}
    </div>
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
  ]

  return (
    <div className="sofia-alertas">
      {alertas.creadas_sin_coordinacion.length > 0 && (
        <button type="button" className="sp-a-catalogo" onClick={() => navigate('/dashboard/superadmin/integridad/catalogo')}>
          <Ic n="users" s={15}/>
          <span><b>{alertas.creadas_sin_coordinacion.length.toLocaleString('es-CO')}</b> fichas de SofiaPlus sin coordinación: se asignan definiendo las reglas del catálogo de su centro.</span>
          <span className="sp-abierta__ir">Ir al catálogo <Ic n="chevronRight" s={13}/></span>
        </button>
      )}
      {alertas.alertas_ultima_carga.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div className="sofia-grupo__cab">
            <Ic n="bell" s={14}/> <b>Novedades del último reporte</b>
            <span className="sofia-grupo__n">{alertas.alertas_ultima_carga.length}</span>
          </div>
          <NovedadesLista items={alertas.alertas_ultima_carga} onAbrir={abrir}/>
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

function NovedadesLista({ items, onAbrir }: {
  items: Alertas['alertas_ultima_carga']; onAbrir: (id: number) => void
}) {
  const [todas, setTodas] = useState(false)
  const visibles = todas ? items : items.slice(0, 8)
  return (
    <div className="sofia-lista">
      {visibles.map((a, i) => (
        <button key={i} type="button" className="sofia-lista__item" onClick={() => onAbrir(a.ficha_id)}>
          <span className="prog-code">{a.numero_ficha}</span>
          <span>{a.alerta}</span>
        </button>
      ))}
      {items.length > 8 && (
        <button type="button" className="sofia-mas" onClick={() => setTodas(!todas)}>
          {todas ? 'Ver menos' : `Ver las ${items.length}`}
        </button>
      )}
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

type Filtro = 'todos' | 'aplicar' | 'revisar' | 'alertas' | 'nuevas' | 'otros' | 'pendientes' | 'aplicados' | 'descartados'
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
  const [filtroElegido, setFiltro] = useState<Filtro | null>(null)
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

  // Sin elección: en la vista previa, todo; ya aplicada, lo que quedó pendiente
  // (o lo aplicado si no queda nada), no el historial completo.
  const filtro: Filtro = filtroElegido ?? (!carga || carga.estado === 'PREVISUALIZADA'
    ? 'todos'
    : (cambios ?? []).some(c => c.resultado === 'PENDIENTE') ? 'pendientes' : 'aplicados')

  const cuenta = useMemo(() => {
    const cs = cambios ?? []
    return {
      todos: cs.length,
      aplicar: cs.filter(c => c.accion === 'APLICAR').length,
      revisar: cs.filter(c => c.accion === 'REVISAR').length,
      alertas: cs.filter(c => c.alerta).length,
      nuevas: cs.filter(c => c.tipo === 'NUEVA').length,
      otros: cs.filter(c => c.accion === 'IGNORADO' || c.accion === 'BLOQUEADO').length,
      pendientes: cs.filter(c => c.resultado === 'PENDIENTE').length,
      aplicados: cs.filter(c => c.resultado === 'APLICADO').length,
      descartados: cs.filter(c => c.resultado === 'DESCARTADO' || c.resultado === 'REVERTIDO').length,
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
        || (filtro === 'otros' && (c.accion === 'IGNORADO' || c.accion === 'BLOQUEADO'))
        || (filtro === 'pendientes' && c.resultado === 'PENDIENTE')
        || (filtro === 'aplicados' && c.resultado === 'APLICADO')
        || (filtro === 'descartados' && (c.resultado === 'DESCARTADO' || c.resultado === 'REVERTIDO')))
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

  async function resolverLote(ids: number[], decision: 'APLICAR' | 'DESCARTAR', que: string) {
    if (!confirm(`${decision === 'APLICAR' ? 'Aprobar' : 'Rechazar'} ${ids.length} ${que}?`)) return
    setOcupado(true); setAviso(null)
    try {
      const res = await api.post<{ aplicados: number; descartados: number }>(`/sofia-sync/cargas/${cargaId}/resolver`, { cambios: ids, decision })
      setAviso({ tone: 'ok', texto: decision === 'APLICAR'
        ? `${res.data.aplicados} cambios aplicados${res.data.descartados ? `, ${res.data.descartados} no se pudieron aplicar` : ''}.`
        : `${res.data.descartados} cambios rechazados.` })
      cargar()
    } catch (e) {
      setAviso({ tone: 'crit', texto: mensajeError(e, 'No se pudieron resolver los cambios.').texto })
    } finally {
      setOcupado(false)
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
      {carga.estado === 'APLICADA' && (
        <InlineAlert tone="ok" icon="checkCircle" title={`Carga aplicada${carga.aplicada_at ? ` el ${new Date(carga.aplicada_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}`}>
          Se aplicaron <b>{cuenta.aplicados}</b> cambios en FORMA
          {cuenta.descartados > 0 && <> y <b>{cuenta.descartados}</b> se descartaron</>}.
          {pendientes > 0
            ? <> Quedan <b>{pendientes}</b> revisiones pendientes: abajo solo ves esas. El historial completo está en <b>Todos</b>.</>
            : <> No quedan revisiones pendientes.</>}
        </InlineAlert>
      )}
      {carga.estado === 'APLICADA' && esUltima && pendientes > 0 && (() => {
        const pend = cambios.filter(c => c.accion === 'REVISAR' && c.resultado === 'PENDIENTE')
        const nuevasFin = pend.filter(c => c.tipo === 'NUEVA')
        const otras = pend.filter(c => c.tipo !== 'NUEVA')
        return (
          <div className="sofia-lote">
            <div className="sofia-lote__txt">
              <b>Resolver pendientes</b>
              <span>
                {nuevasFin.length > 0 && <>{nuevasFin.length} fichas nuevas que ya terminaron en SofiaPlus (histórico)</>}
                {nuevasFin.length > 0 && otras.length > 0 && ' · '}
                {otras.length > 0 && <>{otras.length} cambios en fichas existentes (programa, estado o centro): mejor uno por uno</>}
              </span>
            </div>
            {nuevasFin.length > 0 && (
              <>
                <Btn size="sm" icon="check" disabled={ocupado} onClick={() => void resolverLote(nuevasFin.map(c => c.id), 'APLICAR', 'fichas finalizadas (se crean como histórico)')}>
                  Crear las {nuevasFin.length} fichas finalizadas
                </Btn>
                <Btn size="sm" variant="secondary" icon="x" disabled={ocupado} onClick={() => void resolverLote(nuevasFin.map(c => c.id), 'DESCARTAR', 'fichas finalizadas (no se crean)')}>
                  No crearlas
                </Btn>
              </>
            )}
          </div>
        )
      })()}

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
        <Seg name="sofia-filtro" value={filtro} onChange={v => { setFiltro(v as Filtro); setPagina(0) }} options={!previa ? [
          { value: 'pendientes', label: `Pendientes ${cuenta.pendientes}` },
          { value: 'aplicados', label: `Aplicados ${cuenta.aplicados}` },
          { value: 'descartados', label: `Descartados ${cuenta.descartados}` },
          { value: 'alertas', label: `Alertas ${cuenta.alertas}` },
          { value: 'todos', label: `Todos ${cuenta.todos}` },
        ] : [
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
                          ? <>
                              <span className="sofia-nuevo">{c.valor_nuevo?.replace('|v', ' · v')}</span>
                              {c.coordinacion_sugerida?.coordinacion_nombre
                                ? <div className="sofia-coord sofia-coord--ok"><Ic n="users" s={11}/> {c.coordinacion_sugerida.coordinacion_nombre.replace(/^Coordinaci[oó]n Acad[eé]mica de /i, '')}</div>
                                : <div className="sofia-coord">{c.coordinacion_sugerida?.tipo === 'AMBIGUA' ? 'Catálogo ambiguo: ' : ''}Queda por asignar coordinación</div>}
                            </>
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
                {r.nuevas > 0 && (() => {
                  const creadas = cambios.filter(c => c.tipo === 'NUEVA' && !((c.accion === 'APLICAR' && excluir.has(c.id)) || (c.accion === 'REVISAR' && !aprobar.has(c.id))) && c.accion !== 'BLOQUEADO' && c.accion !== 'IGNORADO')
                  const conCoord = creadas.filter(c => c.coordinacion_sugerida?.coordinacion_academica_id != null).length
                  return <li>Se crean hasta <b>{creadas.length}</b> fichas nuevas: <b>{conCoord}</b> quedan en su coordinación según el catálogo{creadas.length - conCoord > 0 && <> y <b>{creadas.length - conCoord}</b> quedan en Integridad › Por asignar</>}.</li>
                })()}
                {aprobar.size > 0 && <li>Incluye <b>{aprobar.size}</b> cambios de revisión que aprobaste.</li>}
                {excluir.size > 0 && <li>Excluiste <b>{excluir.size}</b> cambios.</li>}
                <li>Se puede revertir mientras sea la última carga aplicada.</li>
              </ul>
            </>}
            {confirmar === 'revertir' && (
              <p>Se deshacen los cambios de esta carga. Lo que se haya editado después en FORMA se conserva, y las fichas creadas solo se eliminan si todavía no tienen aprendices ni práctica y nadie les cambió la coordinación que puso el catálogo.</p>
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
