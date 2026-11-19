// "Hoy" del instructor: lo que toca esta semana, ficha por ficha, con las
// bitácoras nuevas y los atrasos al lado. El calendario queda como segunda vista.
import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { Lienzo, Frase, Estado, Panel, Indicadores, Boton } from '../../ui'
import { fdia } from '../../ui/estados'
import type { Pendiente, PendientesInstructor, SenalBitacora, TabEtapa } from '../instructor/types'
import { GRUPO, fechaLarga, plural } from './comun'
import './hoy.css'

const CATEGORIA: Record<Pendiente['categoria'], string> = {
  MOMENTO: 'Momento', VISITA: 'Visita', FICHA: 'Ficha', ALERTA: 'Alerta',
}

export function Hoy({ onAbrir, onFicha, onNuevo, onCalendario, onAprendices }: {
  onAbrir: (etapaId: number, tab?: TabEtapa | null) => void
  onFicha: (fichaId: number) => void
  onNuevo: () => void
  onCalendario: () => void
  onAprendices: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const [d, setD] = useState<PendientesInstructor | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verVigilar, setVerVigilar] = useState(false)

  useEffect(() => {
    let vivo = true
    api.get<PendientesInstructor>('/instructores/mi/pendientes')
      .then((r) => { if (vivo) setD(r.data) })
      .catch((e) => { if (vivo) setErr(e?.response?.data?.message ?? 'No se pudo cargar lo de hoy.') })
    return () => { vivo = false }
  }, [])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!d) return <Lienzo><p className="fx-texto-3">Cargando lo de hoy…</p></Lienzo>

  const urgentes = d.pendientes.filter((p) => p.grupo === 'URGENTE')
  const toca = d.pendientes.filter((p) => p.grupo === 'TE_TOCA')
  const vigilar = d.pendientes.filter((p) => p.grupo === 'VIGILAR')
  const senales = d.bitacoras ?? []
  const porLeer = senales.filter((s) => s.tipo === 'POR_LEER').reduce((n, s) => n + s.numeros.length, 0)
  const atrasados = d.aprendices.filter((a) => a.situacion === 'ATRASADO').length

  const abrir = (p: Pendiente) => {
    if (p.etapa_id) onAbrir(p.etapa_id, p.tab)
    else if (p.id.endsWith('-LISTOS')) onNuevo()
    else if (p.ficha_id) onFicha(p.ficha_id)
  }

  const partes: string[] = []
  if (urgentes.length) partes.push(plural(urgentes.length, 'cosa atrasada', 'cosas atrasadas'))
  if (toca.length) partes.push(`${plural(toca.length, 'cosa', 'cosas')} por hacer esta semana`)
  if (porLeer) partes.push(plural(porLeer, 'bitácora por leer', 'bitácoras por leer'))
  const nombre = user?.nombre_completo?.split(' ')[0] ?? ''
  const saludo = nombre ? `${nombre}, ` : ''
  const frase = partes.length
    ? `${saludo}tienes ${partes.join(', ').replace(/, ([^,]*)$/, ' y $1')}.`
    : `${saludo}no tienes nada pendiente para hoy. ${d.aprendices.length ? 'Tus aprendices están al día.' : ''}`

  return (
    <Lienzo className="hoy">
      <header className="hoy-cab">
        <div>
          <div className="fx-eyebrow">{fechaLarga(d.hoy)}</div>
          <h1 className="fx-titulo">Hoy</h1>
        </div>
        <div className="hoy-acciones">
          <Boton tipo="suave" onClick={onCalendario}>Ver calendario</Boton>
          <Boton onClick={onAprendices}>Todos mis aprendices</Boton>
        </div>
      </header>

      <Frase tono={urgentes.length ? 'atraso' : partes.length ? undefined : 'ok'}>{frase}</Frase>
      {d.fallos.length > 0 && <p className="hoy-nota">No se pudo revisar: {d.fallos.join(', ')}. Lo demás está completo.</p>}

      <div className="hoy-rejilla">
        <div className="hoy-col">
          {urgentes.length > 0 && (
            <Panel titulo="Atrasado" accion={<span className="fx-texto-3 fx-num">{urgentes.length}</span>}>
              <ListaPorFicha items={urgentes} onAbrir={abrir}/>
            </Panel>
          )}
          <Panel titulo="Esta semana" accion={<span className="fx-texto-3 fx-num">{toca.length}</span>}>
            {toca.length === 0
              ? <p className="fx-texto-3">Nada nuevo por hacer esta semana.</p>
              : <ListaPorFicha items={toca} onAbrir={abrir}/>}
          </Panel>
          {vigilar.length > 0 && (
            <Panel
              titulo="Para vigilar"
              accion={<Boton tipo="suave" onClick={() => setVerVigilar(!verVigilar)}>{verVigilar ? 'Ocultar' : `Ver (${vigilar.length})`}</Boton>}
            >
              {verVigilar
                ? <ListaPorFicha items={vigilar} onAbrir={abrir}/>
                : <p className="fx-texto-3">Lo que depende de otros: alertas en manos de coordinación y fichas por arrancar.</p>}
            </Panel>
          )}
        </div>

        <aside className="hoy-lado">
          <Panel titulo="Bitácoras" accion={<span className="fx-texto-3 fx-num">{porLeer} por leer</span>}>
            {senales.length === 0
              ? <p className="fx-texto-3">Nada nuevo: no hay bitácoras por leer ni aprendices atrasados en sus entregas.</p>
              : <Senales senales={senales} onAbrir={(id) => onAbrir(id, 'bitacoras')}/>}
          </Panel>
          <Panel titulo="Tus aprendices">
            <Indicadores items={[
              { k: 'En etapa productiva', v: String(d.aprendices.length) },
              { k: 'Atrasados', v: String(atrasados), tono: atrasados ? 'atraso' : undefined, nota: atrasados ? 'algún momento venció' : undefined },
              { k: 'Al día', v: String(d.aprendices.filter((a) => a.situacion === 'AL_DIA' || a.situacion === 'COMPLETO').length) },
            ]}/>
          </Panel>
        </aside>
      </div>
    </Lienzo>
  )
}

function ListaPorFicha({ items, onAbrir }: { items: Pendiente[]; onAbrir: (p: Pendiente) => void }) {
  const grupos = new Map<string, Pendiente[]>()
  for (const p of items) {
    const k = p.numero_ficha ?? '—'
    grupos.set(k, [...(grupos.get(k) ?? []), p])
  }
  return (
    <div className="hoy-fichas">
      {[...grupos].map(([ficha, l]) => (
        <div key={ficha} className="hoy-ficha">
          <div className="fx-eyebrow">Ficha {ficha}</div>
          {l.map((p) => (
            <button key={p.id} type="button" className="hoy-item" onClick={() => onAbrir(p)}>
              <Estado tono={GRUPO[p.grupo]}>{CATEGORIA[p.categoria]}</Estado>
              <span className="hoy-item-txt">
                <strong>{p.titulo}</strong>
                <span className="fx-texto-2">{p.texto}</span>
              </span>
              <span className="hoy-item-fecha fx-num fx-texto-3">{p.fecha ? fdia(p.fecha) : ''}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function Senales({ senales, onAbrir }: { senales: SenalBitacora[]; onAbrir: (etapaId: number) => void }) {
  return (
    <div className="hoy-senales">
      {senales.map((s) => (
        <button key={s.id} type="button" className="hoy-item" onClick={() => onAbrir(s.etapa_id)}>
          <Estado tono={s.tipo === 'POR_LEER' ? (s.grupo === 'URGENTE' ? 'atraso' : 'info') : 'aviso'}>
            {s.tipo === 'POR_LEER' ? 'Leer' : 'Escribirle'}
          </Estado>
          <span className="hoy-item-txt">
            <strong>{s.aprendiz_nombre}</strong>
            <span className="fx-texto-2">{s.texto}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
