import { Ic } from '../../components/ui'
import { estructurarPlan } from './planTrabajo'
import type { PlanTrabajo } from './types'

// ─── Plan de trabajo concertado, en lectura ──────────────────────────────────
// El plan se guarda como listas de texto (así lo pide el formato), pero ese
// texto trae su estructura: la competencia empieza por su código de norma, el
// RA termina con él, y actividades y evidencias comparten el prefijo "A1.".
// Aquí se reconstruye esa estructura para leerlo de un vistazo:
//   competencia -> sus RA        actividad -> sus evidencias
// Lo que no siga ese patrón (texto escrito a mano) se muestra igual, suelto.

export function PlanTrabajoVista({ plan }: { plan: PlanTrabajo | null | undefined }) {
  const { comps, ras, grupos: numerados, acts, nEv } = estructurarPlan(plan)

  return (
    <div className="g23-col2 ptv">
      <section className="ptv-panel">
        <header className="ptv-panel__cab">
          <span className="ptv-panel__t">Competencias y resultados de aprendizaje</span>
          <span className="ptv-panel__n">{comps.length} comp. · {ras.length} RA</span>
        </header>
        {numerados.length === 0 && <div className="ptv-vacio">Sin diligenciar</div>}
        {numerados.map((g, gi) => (
          <div key={gi} className="ptv-grupo">
            <div className="ptv-comp">
              {g.comp
                ? <>{g.comp.codigo && <span className="ptv-cod">{g.comp.codigo}</span>}<span className="ptv-comp__t">{g.comp.nombre}</span></>
                : <span className="ptv-comp__t ptv-comp__t--suelto">Otros resultados</span>}
            </div>
            {g.ras.length > 0 ? (
              <ol className="ptv-lista">
                {g.ras.map(r => (
                  <li key={r.i} className="ptv-ra">
                    <span className="ptv-ra__n">{r.numero ?? r.i}</span>
                    <span className="ptv-ra__t">{r.texto}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="ptv-vacio ptv-vacio--in">Sin resultados de aprendizaje elegidos</div>
            )}
          </div>
        ))}
      </section>

      <section className="ptv-panel">
        <header className="ptv-panel__cab">
          <span className="ptv-panel__t">Actividades y evidencias</span>
          <span className="ptv-panel__n">{acts.length} act. · {nEv} evid.</span>
        </header>
        {acts.length === 0 && <div className="ptv-vacio">Sin diligenciar</div>}
        {acts.map((a, i) => (
          <div key={i} className="ptv-grupo">
            <div className="ptv-act">
              <span className="ptv-act__n">A{i + 1}</span>
              <span className="ptv-act__t">{a.texto}</span>
            </div>
            {a.evs.length > 0 && (
              <ul className="ptv-evs">
                {a.evs.map((e, j) => (
                  <li key={j} className="ptv-ev">
                    <Ic n="checkCircle" s={12}/>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
