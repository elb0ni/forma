import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { Ic, Btn, Bdg, BrandMark } from '../../components/ui'
import { ESTADO_BITACORA_META, fdia, mensajeError } from '../productiva/cronograma'
import type {
  ActividadBitacora, Bitacora, DocumentoBitacora, ResumenBitacoras, TipoMomentoCron,
} from '../productiva/cronograma'
import { Boton, Estado, Frase, Lienzo, LineaMini, Panel } from '../../ui'
import { NOMBRE_MOMENTO, NUM_MOMENTO, estadoBitacora, fdia as fdiaN } from '../../ui/estados'
import type { BitacoraVista } from '../../ui/estados'
import { BitacoraDocumentoModal } from '../productiva/BitacoraDocumento'
import './portal.css'

// ─── Portal público del aprendiz: bitácoras quincenales ────────────────────────
// Sin cuenta: escribe su documento, le llega un código de 6 dígitos al correo
// (vale 5 minutos, un solo uso) y con él el backend responde un token corto
// (4 h) que va en Authorization; se guarda
// en sessionStorage (se pierde al cerrar la pestaña, a propósito).
//
// Cliente HTTP propio: el `api` de la app intenta refrescar la sesión de staff
// y redirige a /login ante un 401, que aquí no aplica.

const http = axios.create({ baseURL: `${import.meta.env.VITE_API_DB}/api/publico/bitacoras` })
const TOKEN_KEY = 'forma.bitacoras.token'

function leerToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}
function guardarToken(t: string | null) {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* sin almacenamiento: dura mientras la página esté abierta */ }
}

interface Portal {
  etapa: {
    aprendiz_nombre: string
    aprendiz_documento: string
    programa_nombre: string
    numero_ficha: string
    empresa_nombre: string | null
    jefe_inmediato_nombre: string | null
    instructor_nombre: string
    fecha_inicio: string
    fecha_fin_estimada: string
  }
  hoy: string
  bitacoras: BitacoraVista[]
  resumen: ResumenBitacoras & { entregadas?: number; leidas?: number }
  momentos?: { tipo: TipoMomentoCron; desde: string; hasta: string }[]
  momentos_hechos?: { tipo: string; fecha: string }[]
  visitas?: { fecha: string; hora: string | null; modalidad: string; tipo: string }[]
}

// "Mi etapa": lo primero que ve el aprendiz es qué le toca, en una frase.
function fraseDelDia(d: Portal): { texto: string; tono?: 'atraso' | 'ok' } {
  const devuelta = d.bitacoras.find(b => b.estado === 'DEVUELTA')
  if (devuelta) return { texto: `Tu instructor te pidió corregir la bitácora ${devuelta.numero}. Ábrela, ajusta lo que te indica y vuelve a entregarla.`, tono: 'atraso' }
  const atrasadas = d.bitacoras.filter(b => b.vencida)
  if (atrasadas.length) {
    return {
      texto: `Tienes ${atrasadas.length === 1 ? 'la bitácora ' + atrasadas[0].numero : atrasadas.length + ' bitácoras'} sin entregar y ya pasó el plazo. Todavía puedes entregar${atrasadas.length === 1 ? 'la' : 'las'}; quedará${atrasadas.length === 1 ? '' : 'n'} marcada${atrasadas.length === 1 ? '' : 's'} como tarde.`,
      tono: 'atraso',
    }
  }
  const toca = d.bitacoras.find(b => b.estado !== 'FUTURA' && b.estado !== 'ENTREGADA' && b.estado !== 'APROBADA')
  if (toca) return { texto: `Te toca la bitácora ${toca.numero} (quincena del ${fdiaN(toca.periodo_inicio)} al ${fdiaN(toca.periodo_fin)}). Puedes entregarla hasta el ${fdiaN(toca.fecha_limite)}.` }
  const proxima = d.bitacoras.find(b => b.estado === 'FUTURA')
  return proxima
    ? { texto: `Vas al día. La bitácora ${proxima.numero} abre el ${fdiaN(proxima.periodo_inicio)}.`, tono: 'ok' }
    : { texto: 'Entregaste todas tus bitácoras.', tono: 'ok' }
}

export function PortalBitacoras() {
  const [token, setToken] = useState<string | null>(leerToken)
  const [data, setData] = useState<Portal | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [doc, setDoc] = useState<DocumentoBitacora | null>(null)

  const auth = { headers: { Authorization: `Bearer ${token}` } }

  function salir(msg?: string) {
    guardarToken(null); setToken(null); setData(null); setSel(null)
    if (msg) setErr(msg)
  }

  useEffect(() => {
    if (!token) return
    let vivo = true
    http.get<Portal>('', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (vivo) setData(r.data) })
      .catch(e => {
        if (!vivo) return
        if (e?.response?.status === 401) salir('Tu sesión venció. Ingresa de nuevo.')
        else setErr(mensajeError(e, 'No se pudo cargar tu información.'))
      })
    return () => { vivo = false }
  }, [token])

  if (!token) {
    return (
      <Ingreso
        errInicial={err}
        onIngreso={t => { guardarToken(t); setErr(null); setToken(t) }}
      />
    )
  }

  if (!data) {
    return (
      <Lienzo className="mi-etapa">
        <p className="fx-texto-2">{err ?? 'Cargando tu etapa…'}</p>
      </Lienzo>
    )
  }

  const actual = data.bitacoras.find(b => b.numero === sel) ?? null

  async function descargar(numero: number) {
    setErr(null)
    try {
      const r = await http.get<DocumentoBitacora>(`/${numero}/documento`, auth)
      setDoc(r.data)
    } catch (e) {
      if ((e as { response?: { status?: number } })?.response?.status === 401) salir('Tu sesión venció. Ingresa de nuevo.')
      else setErr(mensajeError(e, 'No se pudo descargar la bitácora.'))
    }
  }
  const e = data.etapa
  const hoy = data.hoy
  const frase = fraseDelDia(data)
  const entregadas = data.bitacoras.filter(b => b.estado === 'ENTREGADA' || b.estado === 'APROBADA').length
  const leidas = data.bitacoras.filter(b => b.leida_at || b.estado === 'APROBADA').length
  const hechos = new Map((data.momentos_hechos ?? []).map(m => [m.tipo, m.fecha]))

  if (actual) {
    return (
      <div className="ptl">
        <Editor
          key={actual.numero}
          b={actual}
          auth={auth}
          onVolver={() => setSel(null)}
          onDescargar={() => void descargar(actual.numero)}
          onGuardado={p => setData(p as Portal)}
          onSesionVencida={() => salir('Tu sesión venció. Ingresa de nuevo.')}
        />
        {doc && <BitacoraDocumentoModal doc={doc} onClose={() => setDoc(null)}/>}
      </div>
    )
  }

  return (
    <Lienzo className="mi-etapa">
      <header className="mi-etapa__top">
        <span className="fx-eyebrow">FORMA · Mi etapa productiva</span>
        <Boton tipo="suave" onClick={() => salir()}>Salir</Boton>
      </header>

      <h1 className="fx-titulo">{e.aprendiz_nombre}</h1>
      <p className="fx-texto-3" style={{ margin: '4px 0 16px' }}>
        {e.programa_nombre} · Ficha {e.numero_ficha}{e.empresa_nombre ? ` · ${e.empresa_nombre}` : ''}<br/>
        Tu instructor: {e.instructor_nombre} · del {fdiaN(e.fecha_inicio)} al {fdiaN(e.fecha_fin_estimada)}
      </p>

      <Frase tono={frase.tono}>{frase.texto}</Frase>

      <Panel titulo="Tus bitácoras" accion={<span className="fx-texto-3">{entregadas} de {data.bitacoras.length} entregadas · {leidas} leídas por tu instructor</span>} sinCuerpo>
        <div className="mi-etapa__casillas">
          <LineaMini momentos={[]} bitacoras={data.bitacoras.map(b => ({ numero: b.numero, ...estadoBitacora(b, hoy) }))}/>
        </div>
        <ul className="mi-etapa__lista">
          {data.bitacoras.map(b => {
            const est = estadoBitacora(b, hoy)
            const habilitada = b.estado !== 'FUTURA'
            return (
              <li key={b.numero}>
                <button type="button" className="mi-etapa__bit fx-clicable" disabled={!habilitada} onClick={() => setSel(b.numero)}>
                  <span className="mi-etapa__bit-n">Bitácora {b.numero}</span>
                  <span className="fx-texto-3">{fdiaN(b.periodo_inicio)} – {fdiaN(b.periodo_fin)}</span>
                </button>
                <Estado tono={est.tono} title={est.texto}>{est.corto}</Estado>
                {habilitada && <Boton tipo="suave" onClick={() => void descargar(b.numero)} title="Descargar">Descargar</Boton>}
                {b.observacion_instructor && (
                  <p className="mi-etapa__comentario"><strong>Tu instructor:</strong> {b.observacion_instructor}</p>
                )}
              </li>
            )
          })}
        </ul>
      </Panel>

      <div className="mi-etapa__dos">
        <Panel titulo="Tus momentos con el instructor">
          <ul className="mi-etapa__simple">
            {(data.momentos ?? []).map(m => {
              const hecho = hechos.get(m.tipo)
              return (
                <li key={m.tipo}>
                  <span>{NUM_MOMENTO[m.tipo]}. {NOMBRE_MOMENTO[m.tipo]}</span>
                  {hecho
                    ? <Estado tono="hecho">Hecho el {fdiaN(hecho)}</Estado>
                    : hoy > m.hasta
                      ? <Estado tono="aviso">Pendiente</Estado>
                      : <Estado tono={hoy >= m.desde ? 'toca' : 'futuro'}>{fdiaN(m.desde)} – {fdiaN(m.hasta)}</Estado>}
                </li>
              )
            })}
          </ul>
        </Panel>
        <Panel titulo="Próximas visitas">
          {(data.visitas ?? []).length === 0
            ? <p className="fx-texto-3" style={{ margin: 0 }}>Tu instructor todavía no ha agendado visitas.</p>
            : (
              <ul className="mi-etapa__simple">
                {(data.visitas ?? []).map(v => (
                  <li key={v.fecha + v.tipo}>
                    <span>{fdiaN(v.fecha)}{v.hora ? `, ${v.hora}` : ''}</span>
                    <Estado tono="info">{v.modalidad === 'VIRTUAL' ? 'Virtual' : 'Presencial'}</Estado>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </div>
      {err && <p className="fx-frase" data-tono="atraso">{err}</p>}
      {doc && <BitacoraDocumentoModal doc={doc} onClose={() => setDoc(null)}/>}
    </Lienzo>
  )
}

// ─── Ingreso: documento → código que llega al correo (vale 5 min) ───────────────

function Ingreso({ errInicial, onIngreso }: { errInicial: string | null; onIngreso: (token: string) => void }) {
  const [documento, setDocumento] = useState('')
  const [codigo, setCodigo] = useState('')
  const [envio, setEnvio] = useState<{ destinos: string[]; vence: number } | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(errInicial)

  // Cuenta regresiva del código (y para habilitar el reenvío tras 60 s).
  useEffect(() => {
    if (!envio) return
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [envio])

  const restante = envio ? Math.max(0, Math.round((envio.vence - ahora) / 1000)) : 0
  const puedeReenviar = envio ? restante <= 5 * 60 - 60 : true
  const mmss = `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`

  async function pedirCodigo(ev?: FormEvent) {
    ev?.preventDefault()
    if (!documento.trim()) { setErr('Escribe tu número de documento.'); return }
    setBusy(true); setErr(null)
    try {
      const r = await http.post<{ destinos: string[]; vence_en_minutos: number }>('/solicitar-codigo', { documento: documento.trim() })
      const t = Date.now()
      setAhora(t)
      setEnvio({ destinos: r.data.destinos, vence: t + r.data.vence_en_minutos * 60_000 })
      setCodigo('')
    } catch (e) {
      setErr(mensajeError(e, 'No se pudo enviar el código.'))
    } finally { setBusy(false) }
  }

  async function ingresar(ev: FormEvent) {
    ev.preventDefault()
    if (codigo.length !== 6) { setErr('El código tiene 6 dígitos.'); return }
    if (restante === 0) { setErr('El código venció. Pide uno nuevo.'); return }
    setBusy(true); setErr(null)
    try {
      const r = await http.post<{ token: string }>('/ingresar', { documento: documento.trim(), codigo })
      onIngreso(r.data.token)
    } catch (e) {
      setErr(mensajeError(e, 'No se pudo ingresar.'))
    } finally { setBusy(false) }
  }

  return (
    <div className="ptl ptl--ingreso">
      {!envio ? (
        <form className="ptl-card ptl-ingreso" onSubmit={e => void pedirCodigo(e)}>
          <div className="ptl-marca"><BrandMark size={26}/> <span>FORMA</span></div>
          <h1>Bitácoras de etapa productiva</h1>
          <p>Escribe tu número de documento. Te enviaremos un código de acceso a tu correo registrado.</p>
          <label>
            <span>Número de documento</span>
            <input className="nx-input" inputMode="numeric" autoComplete="username" value={documento} autoFocus
              onChange={e => setDocumento(e.target.value.replace(/\D/g, ''))} maxLength={20}/>
          </label>
          {err && <div className="ptl-aviso ptl-aviso--err">{err}</div>}
          <button className="btn btn--accent btn--md ptl-ingreso__btn" type="submit" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviarme el código'}
          </button>
          <p className="ptl-ayuda">¿No te llega o cambiaste de correo? Pídele a tu instructor que actualice tu correo en FORMA.</p>
        </form>
      ) : (
        <form className="ptl-card ptl-ingreso" onSubmit={e => void ingresar(e)}>
          <div className="ptl-marca"><BrandMark size={26}/> <span>FORMA</span></div>
          <h1>Revisa tu correo</h1>
          <p>Enviamos un código de 6 dígitos a <strong>{envio.destinos.join(' y ')}</strong>. Revisa también la carpeta de spam.</p>
          <label>
            <span>Código de acceso</span>
            <input className="nx-input ptl-codigo" inputMode="numeric" autoComplete="one-time-code" value={codigo} autoFocus
              onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••"/>
          </label>
          <div className={`ptl-reloj${restante === 0 ? ' ptl-reloj--fin' : ''}`}>
            <Ic n="clock" s={13}/> {restante > 0 ? `El código vence en ${mmss}` : 'El código venció'}
          </div>
          {err && <div className="ptl-aviso ptl-aviso--err">{err}</div>}
          <button className="btn btn--accent btn--md ptl-ingreso__btn" type="submit" disabled={busy || restante === 0}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
          <div className="ptl-ingreso__otros">
            <button type="button" className="ptl-enlace" disabled={!puedeReenviar || busy} onClick={() => void pedirCodigo()}>
              {puedeReenviar ? 'Enviar un código nuevo' : `Reenviar en ${restante - (5 * 60 - 60)} s`}
            </button>
            <button type="button" className="ptl-enlace" onClick={() => { setEnvio(null); setErr(null); setCodigo('') }}>
              Cambiar documento
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Editor de una bitácora ─────────────────────────────────────────────────────

const VACIA = (desde: string, hasta: string): ActividadBitacora => ({
  descripcion: '', fecha_inicio: desde, fecha_fin: hasta, evidencia: '', observaciones: '',
})

function Editor({ b, auth, onVolver, onDescargar, onGuardado, onSesionVencida }: {
  b: Bitacora
  auth: { headers: { Authorization: string } }
  onVolver: () => void
  onDescargar: () => void
  onGuardado: (p: Portal) => void
  onSesionVencida: () => void
}) {
  const editable = b.estado === 'PENDIENTE' || b.estado === 'BORRADOR' || b.estado === 'DEVUELTA'
  const [acts, setActs] = useState<ActividadBitacora[]>(
    b.actividades && b.actividades.length ? b.actividades : editable ? [VACIA(b.periodo_inicio, b.periodo_fin)] : [],
  )
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const cambiar = (i: number, k: keyof ActividadBitacora, v: string) =>
    setActs(xs => xs.map((a, j) => (j === i ? { ...a, [k]: v } : a)))

  function validar(entregar: boolean): string | null {
    const llenas = acts.filter(a => a.descripcion.trim())
    if (entregar && llenas.length === 0) return 'Registra al menos una actividad antes de entregar.'
    for (const [i, a] of acts.entries()) {
      if (!a.descripcion.trim()) continue
      if (!a.fecha_inicio || !a.fecha_fin) return `Actividad ${i + 1}: faltan las fechas.`
      if (a.fecha_fin < a.fecha_inicio) return `Actividad ${i + 1}: la fecha fin es anterior a la de inicio.`
      if (a.fecha_inicio < b.periodo_inicio || a.fecha_fin > b.periodo_fin) {
        return `Actividad ${i + 1}: las fechas deben estar entre el ${fdia(b.periodo_inicio)} y el ${fdia(b.periodo_fin)}.`
      }
    }
    return null
  }

  async function guardar(entregar: boolean) {
    const v = validar(entregar)
    if (v) { setErr(v); return }
    if (entregar && !confirm('Al entregarla ya no podrás editarla, salvo que tu instructor te pida una corrección. ¿Entregar?')) return
    setBusy(true); setErr(null); setOk(null)
    try {
      const r = await http.put<Portal>(`/${b.numero}`, {
        actividades: acts.filter(a => a.descripcion.trim()),
        entregar,
      }, auth)
      onGuardado(r.data)
      setOk(entregar ? 'Bitácora entregada. Tu instructor la revisará.' : 'Borrador guardado.')
      if (entregar) onVolver()
    } catch (e) {
      if ((e as { response?: { status?: number } })?.response?.status === 401) onSesionVencida()
      else setErr(mensajeError(e, 'No se pudo guardar.'))
    } finally { setBusy(false) }
  }

  const meta = ESTADO_BITACORA_META[b.estado]

  return (
    <section className="ptl-card ptl-editor">
      <button className="ptl-volver" onClick={onVolver}><Ic n="arrowLeft" s={14}/> Mis bitácoras</button>
      <div className="ptl-editor__head">
        <div>
          <div className="ptl-nombre">Bitácora {b.numero}</div>
          <div className="ptl-meta">{fdia(b.periodo_inicio)} – {fdia(b.periodo_fin)} · entrega hasta el {fdia(b.fecha_limite)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Bdg tone={b.vencida ? 'err' : meta.tone}>{b.vencida ? 'Vencida' : meta.label}</Bdg>
          <Btn variant="secondary" size="sm" icon="download" onClick={onDescargar}>Descargar</Btn>
        </div>
      </div>

      {b.estado === 'DEVUELTA' && b.observacion_instructor && (
        <div className="ptl-aviso"><strong>Tu instructor pidió corregir:</strong> {b.observacion_instructor}</div>
      )}
      {b.estado === 'ENTREGADA' && <div className="ptl-aviso ptl-aviso--info">Entregada. Está en revisión por tu instructor.</div>}
      {b.estado === 'APROBADA' && (
        <div className="ptl-aviso ptl-aviso--ok">Aprobada por tu instructor{b.observacion_instructor ? `: ${b.observacion_instructor}` : '.'}</div>
      )}

      {acts.map((a, i) => (
        <div key={i} className="ptl-act">
          <div className="ptl-act__head">
            <span>Actividad {i + 1}</span>
            {editable && acts.length > 1 && (
              <button className="ptl-quitar" onClick={() => setActs(xs => xs.filter((_, j) => j !== i))}>
                <Ic n="trash" s={13}/> Quitar
              </button>
            )}
          </div>
          {editable ? (
            <>
              <label>
                <span>Descripción de la actividad</span>
                <textarea className="nx-input" rows={3} value={a.descripcion} maxLength={1000}
                  onChange={e => cambiar(i, 'descripcion', e.target.value)}
                  placeholder="¿Qué hiciste? Ej.: Apoyo en el inventario semanal del almacén"/>
              </label>
              <div className="ptl-fechas">
                <label>
                  <span>Fecha inicio</span>
                  <input type="date" className="nx-input" value={a.fecha_inicio} min={b.periodo_inicio} max={b.periodo_fin}
                    onChange={e => cambiar(i, 'fecha_inicio', e.target.value)}/>
                </label>
                <label>
                  <span>Fecha fin</span>
                  <input type="date" className="nx-input" value={a.fecha_fin} min={b.periodo_inicio} max={b.periodo_fin}
                    onChange={e => cambiar(i, 'fecha_fin', e.target.value)}/>
                </label>
              </div>
              <label>
                <span>Evidencia de cumplimiento</span>
                <input className="nx-input" value={a.evidencia} maxLength={500}
                  onChange={e => cambiar(i, 'evidencia', e.target.value)}
                  placeholder="Ej.: Informe, registro fotográfico, formato diligenciado"/>
              </label>
              <label>
                <span>Observaciones, inasistencias y/o dificultades</span>
                <textarea className="nx-input" rows={2} value={a.observaciones} maxLength={1000}
                  onChange={e => cambiar(i, 'observaciones', e.target.value)}/>
              </label>
            </>
          ) : (
            <div className="ptl-act__lectura">
              <p>{a.descripcion}</p>
              <span>{fdia(a.fecha_inicio, false)} – {fdia(a.fecha_fin)}</span>
              {a.evidencia && <span><strong>Evidencia:</strong> {a.evidencia}</span>}
              {a.observaciones && <span><strong>Observaciones:</strong> {a.observaciones}</span>}
            </div>
          )}
        </div>
      ))}

      {editable && (
        <button className="ptl-agregar" onClick={() => setActs(xs => [...xs, VACIA(b.periodo_inicio, b.periodo_fin)])}>
          <Ic n="plus" s={14}/> Agregar actividad
        </button>
      )}

      {err && <div className="ptl-aviso ptl-aviso--err">{err}</div>}
      {ok && <div className="ptl-aviso ptl-aviso--ok">{ok}</div>}

      {editable && (
        <div className="ptl-acciones">
          <Btn variant="secondary" onClick={() => void guardar(false)} disabled={busy}>Guardar borrador</Btn>
          <Btn variant="accent" icon="check" onClick={() => void guardar(true)} disabled={busy}>
            {busy ? 'Guardando…' : 'Entregar al instructor'}
          </Btn>
        </div>
      )}

    </section>
  )
}
