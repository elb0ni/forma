// Piezas compartidas por los panoramas y la asignación.
import { Estado } from '../../ui'
import { miles } from './formato'
import type { Mes } from './formato'

// Carga contra cupo: lo que cabe en morado, lo que pasa del cupo en atraso.
export function Medidor({ carga, cupo }: { carga: number; cupo: number }) {
  const escala = Math.max(cupo, carga, 1)
  return (
    <span className="pan-medidor" title={`${carga} de ${cupo}`}>
      <i style={{ width: `${(Math.min(carga, cupo) / escala) * 100}%` }}/>
      {carga > cupo && <i className="pan-faltan" style={{ width: `${((carga - cupo) / escala) * 100}%` }}/>}
    </span>
  )
}

// Demanda contra cupos: una barra por mes en una sola escala (aprendices), con
// la marca del total de cupos y el faltante dicho en palabras.
export function MesesCapacidad({ meses }: { meses: Mes[] }) {
  const escala = Math.max(1, ...meses.map((m) => Math.max(m.en_practica, m.capacidad)))
  return (
    <>
      <div className="pan-meses" role="table" aria-label="Aprendices en práctica contra cupos, por mes">
        {meses.map((m) => {
          const cubiertos = Math.min(m.en_practica, m.capacidad)
          return (
            <div key={m.mes} className="pan-mes" role="row" title={m.frase}>
              <span className="pan-mes-nombre" role="cell">{m.nombre}</span>
              <span className="pan-barra" role="cell" aria-label={m.frase}>
                <i className="pan-cubierto" style={{ width: `${(cubiertos / escala) * 100}%` }}/>
                {m.faltan > 0 && <i className="pan-faltan" style={{ width: `${(m.faltan / escala) * 100}%` }}/>}
                <b className="pan-cupo" style={{ left: `${(m.capacidad / escala) * 100}%` }}/>
              </span>
              <span className="pan-mes-cifras fx-num" role="cell">
                {miles(m.en_practica)} en práctica · entran {miles(m.entran)}
                {m.faltan > 0 ? <Estado tono="atraso">faltan {miles(m.faltan)}</Estado> : <Estado tono="hecho">alcanza</Estado>}
              </span>
            </div>
          )
        })}
      </div>
      <div className="pan-leyenda">
        <span><i className="pan-cubierto"/>Con cupo</span>
        <span><i className="pan-faltan"/>Sin cupo</span>
        <span><b className="pan-cupo-mini"/>Total de cupos</span>
      </div>
    </>
  )
}
