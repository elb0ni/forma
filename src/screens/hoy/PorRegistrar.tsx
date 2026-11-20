// "Por registrar" en Aprendices: los aprendices que la coordinación ya le
// asignó al instructor y que todavía no tienen etapa productiva. Desde cada
// fila se abre directo el formulario de la etapa: no se escoge ficha.
import { useState } from 'react'
import { Panel, Estado, Boton } from '../../ui'
import type { AprendizPorRegistrar } from '../instructor/types'
import { plural } from './comun'

const VISIBLES = 5

function porFicha(l: AprendizPorRegistrar[]) {
  const m = new Map<number, AprendizPorRegistrar[]>()
  for (const a of l) m.set(a.ficha_id, [...(m.get(a.ficha_id) ?? []), a])
  return [...m.values()]
}

export function PorRegistrar({ listos, sinHabilitar, fichaFoco, onRegistrar }: {
  listos: AprendizPorRegistrar[]
  sinHabilitar: AprendizPorRegistrar[]
  fichaFoco: number | null
  onRegistrar: (aprendizId: number) => void
}) {
  const [verOtros, setVerOtros] = useState(false)
  if (!listos.length && !sinHabilitar.length) return null

  return (
    <Panel
      className="preg"
      titulo="Por registrar"
      accion={<span className="fx-texto-3 fx-num">{plural(listos.length, 'aprendiz listo', 'aprendices listos')}</span>}
    >
      {listos.length > 0 ? (
        <>
          <p className="fx-texto-2 preg-intro">
            Tu coordinación te los asignó y SofiaPlus ya los muestra listos para iniciar. Registra su etapa con la empresa, la modalidad y las fechas.
          </p>
          {porFicha(listos).map((l) => (
            <GrupoFicha key={l[0].ficha_id} lista={l} abierto={fichaFoco === l[0].ficha_id} onRegistrar={onRegistrar} boton="Registrar etapa"/>
          ))}
        </>
      ) : (
        <p className="fx-texto-3 preg-intro">Nadie de tus fichas aparece listo para iniciar en SofiaPlus.</p>
      )}

      {sinHabilitar.length > 0 && (
        <div className="preg-otros">
          <button type="button" className="hoy-enlace" onClick={() => setVerOtros(!verOtros)}>
            {verOtros ? 'Ocultar' : `¿Falta alguien? Ver ${plural(sinHabilitar.length, 'aprendiz más', 'aprendices más')} de tus fichas`}
          </button>
          {verOtros && (
            <>
              <p className="hoy-nota">
                SofiaPlus todavía no los muestra habilitados para iniciar. Regístralos solo si ya empezaron su etapa productiva; el juicio se actualiza con el próximo corte.
              </p>
              {porFicha(sinHabilitar).map((l) => (
                <GrupoFicha key={l[0].ficha_id} lista={l} abierto={false} onRegistrar={onRegistrar} boton="Registrar de todos modos" estado/>
              ))}
            </>
          )}
        </div>
      )}
    </Panel>
  )
}

function GrupoFicha({ lista, abierto, onRegistrar, boton, estado }: {
  lista: AprendizPorRegistrar[]; abierto: boolean; onRegistrar: (id: number) => void; boton: string; estado?: boolean
}) {
  const [todos, setTodos] = useState(abierto)
  const visibles = todos ? lista : lista.slice(0, VISIBLES)
  const f = lista[0]
  return (
    <div className="preg-ficha" id={`por-registrar-${f.ficha_id}`}>
      <div className="fx-eyebrow">Ficha {f.numero_ficha}{f.programa_nombre ? ` · ${f.programa_nombre}` : ''}</div>
      {visibles.map((a) => (
        <div key={`${a.ficha_id}-${a.documento}`} className="preg-fila">
          <span className="preg-nombre">
            <strong>{a.nombre}</strong>
            <span className="fx-texto-3 fx-num">{a.documento}{estado && a.estado_formacion ? ` · ${a.estado_formacion.replace(/_/g, ' ').toLowerCase()}` : ''}</span>
          </span>
          {a.aprendiz_id != null
            ? <Boton tipo="suave" onClick={() => onRegistrar(a.aprendiz_id!)}>{boton}</Boton>
            : <Estado tono="aviso" title="Avisa a tu coordinación para que lo carguen desde SofiaPlus.">No está en la copia de SofiaPlus</Estado>}
        </div>
      ))}
      {lista.length > VISIBLES && (
        <button type="button" className="hoy-enlace preg-mas" onClick={() => setTodos(!todos)}>
          {todos ? 'Ver menos' : `Ver los ${lista.length}`}
        </button>
      )}
    </div>
  )
}
