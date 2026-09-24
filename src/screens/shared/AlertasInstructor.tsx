import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Ic, Ava, Modal, Btn } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import { fd } from './parts'

// ─── Alertas de práctica ─────────────────────────────────────────────────────
// El instructor de práctica levanta alertas puntuales sobre un aprendiz
// (inasistencia, ARL, contrato, desempeño, riesgo de deserción...) para que la
// coordinación las vea sin entrar ficha por ficha. No ocupan espacio en la
// pantalla: un botón compacto abre la lista en un modal y cada alerta abre su
// propio modal de detalle.
//
// La alerta cuelga de la FICHA, no del instructor (ver migración
// 006_alerta_ficha.sql): el backend enruta hacia coordinación por
// ficha.coordinacion_academica_id, así que si mañana cambia la metodología de
// asignación -- de un instructor por ficha a aprendices sueltos por instructor
// -- las alertas siguen llegando a quien corresponde sin tocar nada.

const MONO = '"JetBrains Mono", monospace'

export type AlertaSeveridad = 'CRITICA' | 'MEDIA' | 'BAJA'
export type AlertaEstado = 'ABIERTA' | 'EN_GESTION' | 'CERRADA'

const TIPOS = {
  INASISTENCIA: { label: 'Inasistencia', icon: 'calendar' },
  DESEMPENO:    { label: 'Desempeño', icon: 'trend' },
  CONVIVENCIA:  { label: 'Convivencia', icon: 'users' },
  CONTRATO:     { label: 'Contrato / alternativa', icon: 'fileText' },
  ARL:          { label: 'ARL', icon: 'shield' },
  DESERCION:    { label: 'Riesgo de deserción', icon: 'alert' },
} satisfies Record<string, { label: string; icon: IcName }>
export type AlertaTipo = keyof typeof TIPOS

// Contrato de GET /alertas (forma_server, módulo `alertas`).
export interface AlertaInstructor {
  id: number
  ficha_id: number
  aprendiz_id: number | null
  numero_documento: string
  aprendiz_nombre: string
  tipo: AlertaTipo
  severidad: AlertaSeveridad
  estado: AlertaEstado
  nota: string
  respuesta: string | null
  created_at: string
  cerrada_at: string | null
  numero_ficha: string
  programa_codigo: string
  instructor_nombre: string
  gestor_nombre: string | null
}

const SEV: Record<AlertaSeveridad, { label: string; color: string; tone: 'err' | 'warn' | 'blue'; rank: number }> = {
  CRITICA: { label: 'Crítica', color: '#dc2626', tone: 'err',  rank: 0 },
  MEDIA:   { label: 'Media',   color: '#c2410c', tone: 'warn', rank: 1 },
  BAJA:    { label: 'Baja',    color: '#0891b2', tone: 'blue', rank: 2 },
}

const EST: Record<AlertaEstado, { label: string; fg: string; bg: string }> = {
  ABIERTA:    { label: 'Abierta',    fg: '#b91c1c', bg: '#fee2e2' },
  EN_GESTION: { label: 'En gestión', fg: '#a16207', bg: '#fef9c3' },
  CERRADA:    { label: 'Cerrada',    fg: '#3f6212', bg: '#ecfccb' },
}

function hace(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  if (dias < 30) return `hace ${Math.floor(dias / 7)} sem`
  return `hace ${Math.floor(dias / 30)} mes`
}

// ─── Piezas visuales ─────────────────────────────────────────────────────────

function EstadoChip({ estado }: { estado: AlertaEstado }) {
  const e = EST[estado]
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
      color: e.fg, background: e.bg, padding: '1px 6px', borderRadius: 4,
    }}>
      {e.label}
    </span>
  )
}

const rowBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer',
  textAlign: 'left', fontFamily: 'inherit',
}

function MetaFila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
      <span style={{ width: 96, flexShrink: 0, color: '#a1a1aa' }}>{label}</span>
      <span style={{ color: '#27272a', minWidth: 0 }}>{children}</span>
    </div>
  )
}

// ─── Botón + modales ─────────────────────────────────────────────────────────
// `coordId` y `fichaId` solo acotan: el backend ya recorta por rol, así que
// pedir otra coordinación no amplía lo que se ve.

export function AlertasInstructorButton({ coordId, fichaId, style, refreshKey }: {
  coordId?: number
  fichaId?: number
  style?: CSSProperties
  refreshKey?: number
}) {
  "use no memo"

  const [alertas, setAlertas] = useState<AlertaInstructor[] | null>(null)
  const [listaAbierta, setListaAbierta] = useState(false)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [verCerradas, setVerCerradas] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(() => {
    const q = new URLSearchParams({ incluir_cerradas: 'true' })
    if (coordId) q.set('coordinacion_id', String(coordId))
    if (fichaId) q.set('ficha_id', String(fichaId))
    api.get<AlertaInstructor[]>(`/alertas?${q}`)
      .then(r => setAlertas(r.data))
      .catch(() => setAlertas([]))
  }, [coordId, fichaId])

  useEffect(cargar, [cargar, refreshKey])

  const conEstado = alertas ?? []
  const pendientes = conEstado.filter(a => a.estado !== 'CERRADA')
  const criticas   = pendientes.filter(a => a.severidad === 'CRITICA').length
  const lista      = conEstado.filter(a => verCerradas || a.estado !== 'CERRADA')
  const detalle    = detalleId != null ? conEstado.find(a => a.id === detalleId) ?? null : null
  const hayCerradas = conEstado.some(a => a.estado === 'CERRADA')

  async function avanzar(a: AlertaInstructor) {
    const next: AlertaEstado =
      a.estado === 'ABIERTA' ? 'EN_GESTION' : a.estado === 'EN_GESTION' ? 'CERRADA' : 'ABIERTA'
    setGuardando(true)
    try {
      const r = await api.patch<AlertaInstructor>(`/alertas/${a.id}/estado`, { estado: next })
      setAlertas(prev => (prev ?? []).map(x => (x.id === a.id ? r.data : x)))
    } finally {
      setGuardando(false)
    }
  }

  function cerrarTodo() {
    setListaAbierta(false)
    setDetalleId(null)
  }

  // ── Trigger compacto ──
  const triggerBase: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, height: 32,
    padding: '0 11px', borderRadius: 9, border: '1px solid #e4e4e7',
    background: '#fff', color: '#3f3f46', fontSize: 12.5, fontWeight: 500,
    fontFamily: 'inherit', ...style,
  }

  if (alertas === null) {
    return (
      <span style={{ ...triggerBase, color: '#a1a1aa', background: '#fafafa' }}>
        <Ic n="bell" s={14}/> Alertas…
      </span>
    )
  }

  if (pendientes.length === 0 && !hayCerradas) {
    return (
      <span style={{ ...triggerBase, color: '#a1a1aa', background: '#fafafa' }}>
        <Ic n="bell" s={14}/> Sin alertas
      </span>
    )
  }

  const alarma = criticas > 0
  const trigger = (
    <button
      onClick={() => setListaAbierta(true)}
      style={{
        ...triggerBase, cursor: 'pointer',
        ...(alarma ? { border: '1px solid #fecaca', background: '#fff5f5', color: '#b91c1c', fontWeight: 600 } : {}),
      }}
    >
      <Ic n="bell" s={14}/>
      Alertas
      {pendientes.length > 0 && (
        <span style={{
          fontFamily: MONO, fontSize: 11, fontWeight: 700, minWidth: 18, height: 18,
          padding: '0 5px', borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: alarma ? '#dc2626' : '#4f46e5', color: '#fff',
        }}>
          {pendientes.length}
        </span>
      )}
      <Ic n="chevronDown" s={13} style={{ color: '#a1a1aa' }}/>
    </button>
  )

  return (
    <>
      {trigger}

      {listaAbierta && (
        <Modal title="Alertas de práctica" icon="bell" width={480} onClose={cerrarTodo}>
          {lista.length === 0 ? (
            <div style={{ padding: '22px 12px', textAlign: 'center' }}>
              <Ic n="checkCircle" s={20} style={{ color: '#16a34a' }}/>
              <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 6 }}>Sin alertas pendientes.</div>
            </div>
          ) : (
            <div style={{ border: '1px solid #f1f1f3', borderRadius: 10, overflow: 'hidden auto', maxHeight: '52vh' }}>
              {lista.map((a, i) => {
                const sev = SEV[a.severidad]
                const cerrada = a.estado === 'CERRADA'
                return (
                  <button
                    key={a.id}
                    onClick={() => setDetalleId(a.id)}
                    className="nx-row"
                    style={{
                      ...rowBtn,
                      borderBottom: i < lista.length - 1 ? '1px solid #f1f1f3' : 'none',
                      borderLeft: `3px solid ${cerrada ? '#d4d4d8' : sev.color}`,
                      opacity: cerrada ? 0.6 : 1,
                    }}
                  >
                    <Ava name={a.aprendiz_nombre} size={26}/>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.aprendiz_nombre}
                        </span>
                        <span style={{ fontSize: 10.5, fontFamily: MONO, color: '#a1a1aa', flexShrink: 0 }}># {a.numero_ficha}</span>
                      </span>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: cerrada ? '#a1a1aa' : sev.color }}>{TIPOS[a.tipo].label}</span>
                        <span style={{ fontSize: 10.5, color: '#a1a1aa' }}>· {hace(a.created_at)}</span>
                        <EstadoChip estado={a.estado}/>
                      </span>
                    </span>
                    <Ic n="chevronRight" s={15} style={{ color: '#c4c4cc', flexShrink: 0 }}/>
                  </button>
                )
              })}
            </div>
          )}

          {hayCerradas && (
            <button
              onClick={() => setVerCerradas(v => !v)}
              style={{ marginTop: 10, fontSize: 11.5, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
            >
              {verCerradas ? 'Ocultar cerradas' : 'Ver cerradas'}
            </button>
          )}
        </Modal>
      )}

      {listaAbierta && detalle && (
        <AlertaDetalleModal
          alerta={detalle}
          guardando={guardando}
          onClose={() => setDetalleId(null)}
          onAvanzar={() => void avanzar(detalle)}
        />
      )}
    </>
  )
}

function AlertaDetalleModal({ alerta, guardando, onClose, onAvanzar }: {
  alerta: AlertaInstructor
  guardando: boolean
  onClose: () => void
  onAvanzar: () => void
}) {
  const sev = SEV[alerta.severidad]
  const tipo = TIPOS[alerta.tipo]
  const accion =
    alerta.estado === 'ABIERTA' ? 'Tomar' : alerta.estado === 'EN_GESTION' ? 'Marcar cerrada' : 'Reabrir'

  return (
    <Modal
      title={`Alerta · ${tipo.label}`}
      icon={tipo.icon}
      width={440}
      onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Volver</Btn>
        <Btn variant="accent" onClick={onAvanzar} disabled={guardando}>{guardando ? 'Guardando…' : accion}</Btn>
      </>}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <Ava name={alerta.aprendiz_nombre} size={36}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0b' }}>{alerta.aprendiz_nombre}</div>
          <div style={{ fontSize: 11.5, color: '#71717a', fontFamily: MONO }}>CC {alerta.numero_documento}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <MetaFila label="Ficha">
          <span style={{ fontFamily: MONO }}>{alerta.programa_codigo} · # {alerta.numero_ficha}</span>
        </MetaFila>
        <MetaFila label="Severidad">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: sev.color, fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: sev.color }}/>
            {sev.label}
          </span>
        </MetaFila>
        <MetaFila label="Estado"><EstadoChip estado={alerta.estado}/></MetaFila>
        <MetaFila label="Reportada por">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Ava name={alerta.instructor_nombre} size={16}/>
            {alerta.instructor_nombre}
          </span>
        </MetaFila>
        <MetaFila label="Fecha">{fd(alerta.created_at)} · {hace(alerta.created_at)}</MetaFila>
        {alerta.gestor_nombre && <MetaFila label="Gestionada por">{alerta.gestor_nombre}</MetaFila>}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a1a1aa', marginBottom: 5 }}>
        Nota del instructor
      </div>
      <div style={{ fontSize: 12.5, color: '#27272a', lineHeight: 1.5, background: '#fafafa', border: '1px solid #f1f1f3', borderRadius: 8, padding: 11 }}>
        {alerta.nota}
      </div>

      {alerta.respuesta && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#a1a1aa', margin: '12px 0 5px' }}>
            Respuesta de coordinación
          </div>
          <div style={{ fontSize: 12.5, color: '#27272a', lineHeight: 1.5, background: '#fafafa', border: '1px solid #f1f1f3', borderRadius: 8, padding: 11 }}>
            {alerta.respuesta}
          </div>
        </>
      )}
    </Modal>
  )
}

// ─── Levantar una alerta ─────────────────────────────────────────────────────
// Se usa desde la ficha, donde el instructor ya tiene su roster a la mano.

export function NuevaAlertaButton({ fichaId, aprendices, onCreada, style }: {
  fichaId: number
  aprendices: { aprendiz_id: number | null; numero_documento: string; nombre_completo: string }[]
  onCreada?: () => void
  style?: CSSProperties
}) {
  "use no memo"
  const [abierto, setAbierto] = useState(false)
  const [doc, setDoc] = useState('')
  const [tipo, setTipo] = useState<AlertaTipo>('INASISTENCIA')
  const [severidad, setSeveridad] = useState<AlertaSeveridad>('MEDIA')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const elegido = aprendices.find(a => a.numero_documento === doc) ?? null
  const puede = !!elegido && nota.trim().length > 0 && !guardando

  function limpiar() {
    setDoc(''); setTipo('INASISTENCIA'); setSeveridad('MEDIA'); setNota(''); setError(null)
  }

  async function guardar() {
    if (!elegido) return
    setGuardando(true)
    setError(null)
    try {
      await api.post('/alertas', {
        ficha_id: fichaId,
        aprendiz_id: elegido.aprendiz_id ?? undefined,
        numero_documento: elegido.numero_documento,
        aprendiz_nombre: elegido.nombre_completo,
        tipo, severidad, nota: nota.trim(),
      })
      setAbierto(false)
      limpiar()
      onCreada?.()
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'No se pudo guardar la alerta.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Btn variant="secondary" icon="bell" style={style} onClick={() => setAbierto(true)}>
        Levantar alerta
      </Btn>

      {abierto && (
        <Modal
          title="Nueva alerta"
          icon="bell"
          width={460}
          onClose={() => { setAbierto(false); limpiar() }}
          footer={<>
            <Btn variant="ghost" onClick={() => { setAbierto(false); limpiar() }}>Cancelar</Btn>
            <Btn variant="accent" onClick={() => void guardar()} disabled={!puede}>
              {guardando ? 'Guardando…' : 'Reportar'}
            </Btn>
          </>}
        >
          <div style={{ fontSize: 11.5, color: '#71717a', marginBottom: 14 }}>
            La coordinación de esta ficha la verá sin tener que entrar a la ficha.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Campo label="Aprendiz">
              <select className="nx-input" value={doc} onChange={e => setDoc(e.target.value)}>
                <option value="">Selecciona…</option>
                {aprendices.map(a => (
                  <option key={a.numero_documento} value={a.numero_documento}>{a.nombre_completo}</option>
                ))}
              </select>
            </Campo>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Campo label="Tipo">
                <select className="nx-input" value={tipo} onChange={e => setTipo(e.target.value as AlertaTipo)}>
                  {(Object.keys(TIPOS) as AlertaTipo[]).map(t => (
                    <option key={t} value={t}>{TIPOS[t].label}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Severidad">
                <select className="nx-input" value={severidad} onChange={e => setSeveridad(e.target.value as AlertaSeveridad)}>
                  {(Object.keys(SEV) as AlertaSeveridad[]).map(s => (
                    <option key={s} value={s}>{SEV[s].label}</option>
                  ))}
                </select>
              </Campo>
            </div>

            <Campo label="Qué pasó">
              <textarea
                className="nx-input"
                rows={4}
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Describe la situación y qué se ha intentado hasta ahora."
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
            </Campo>

            {error && (
              <div style={{ fontSize: 12, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px' }}>
                {error}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#71717a', marginBottom: 5 }}>
        {label}
      </span>
      {children}
    </label>
  )
}
