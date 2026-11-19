// La etapa productiva dibujada a escala, con fechas reales. Mismo lenguaje que
// la página "FORMA en esencia": cada marca trae su texto, sin depender de leyenda.
import type { Cronograma, TipoMomentoCron } from '../screens/productiva/cronograma'
import {
  NOMBRE_MOMENTO, NUM_MOMENTO, RELLENO, diasEntre, estadoBitacora, estadoMomento, fdia,
} from './estados'
import type { BitacoraVista } from './estados'

const ANCHO = 1000
const IZQ = 40
const DER = 960
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function LineaEtapa({ crono, onMomento, onBitacora }: {
  crono: Cronograma
  onMomento?: (tipo: TipoMomentoCron) => void
  onBitacora?: (numero: number) => void
}) {
  const inicio = crono.fecha_inicio
  const fin = crono.fecha_fin_estimada
  const total = Math.max(diasEntre(inicio, fin), 1)
  const x = (iso: string) => {
    const d = Math.min(Math.max(diasEntre(inicio, iso), 0), total)
    return IZQ + (d / total) * (DER - IZQ)
  }
  const hoy = crono.hoy
  const hoyDentro = hoy >= inicio && hoy <= fin

  // Marcas de inicio de cada mes dentro de la etapa
  const meses: { x: number; t: string }[] = []
  const d0 = new Date(inicio + 'T00:00:00')
  for (let k = 1; k <= 14; k++) {
    const m = new Date(d0.getFullYear(), d0.getMonth() + k, 1)
    const iso = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
    if (iso >= fin) break
    meses.push({ x: x(iso), t: MESES[m.getMonth()] })
  }

  const momentos = crono.momentos.map((m) => ({ m, e: estadoMomento(m, hoy) }))
  const bitacoras = (crono.bitacoras as BitacoraVista[]).map((b) => ({ b, e: estadoBitacora(b, hoy) }))

  return (
    <div className="fx-linea-envoltura">
      <svg className="fx-linea-etapa" viewBox={`0 0 ${ANCHO} 236`} role="img"
        aria-label={`Etapa del ${fdia(inicio)} al ${fdia(fin)}`}>
        {/* Momentos */}
        {momentos.map(({ m, e }, i) => {
          const x1 = x(m.ventana_desde)
          const x2 = Math.max(x(m.ventana_hasta), x1 + 8)
          const ancla = i === 0 ? 'start' : i === momentos.length - 1 ? 'end' : 'middle'
          const tx = i === 0 ? x1 : i === momentos.length - 1 ? x2 : (x1 + x2) / 2
          const futuro = e.tono === 'futuro'
          return (
            <g key={m.tipo} className={onMomento ? 'clic' : undefined} onClick={() => onMomento?.(m.tipo)}>
              <text className="t-titulo" x={tx} y={18} textAnchor={ancla}>
                {NUM_MOMENTO[m.tipo]} · {NOMBRE_MOMENTO[m.tipo]}
              </text>
              {m.habilitado_desde < m.ventana_desde && (
                <line x1={x(m.habilitado_desde)} x2={x1} y1={41} y2={41}
                  stroke="var(--fx-morado)" strokeWidth={2} strokeDasharray="4 4" />
              )}
              <rect x={x1} y={28} width={x2 - x1} height={26} rx={5}
                fill={futuro ? 'var(--fx-superficie-2)' : RELLENO[e.tono]}
                stroke={futuro ? 'var(--fx-linea-2)' : 'none'} strokeDasharray={futuro ? '4 3' : undefined} />
              {m.fecha_realizada && (
                <circle cx={x(m.fecha_realizada)} cy={41} r={5} fill="var(--fx-superficie)" stroke="var(--fx-tinta)" strokeWidth={2} />
              )}
              <text className="t-sub" x={tx} y={72} textAnchor={ancla}>{e.texto}</text>
            </g>
          )
        })}

        {/* Visitas agendadas y extras */}
        <text className="t-sub" x={IZQ} y={100}>Visitas</text>
        <line x1={IZQ + 52} x2={DER} y1={96} y2={96} stroke="var(--fx-linea)" strokeDasharray="1 5" strokeLinecap="round" strokeWidth={2} />
        {[...crono.visitas.map((v) => ({ f: v.fecha, k: `v${v.id}` })), ...crono.extras.map((v, i) => ({ f: v.fecha, k: `e${i}` }))]
          .filter((v) => v.f >= inicio && v.f <= fin)
          .map((v) => (
            <rect key={v.k} x={x(v.f) - 5} y={91} width={10} height={10} transform={`rotate(45 ${x(v.f)} 96)`}
              fill="var(--fx-info)" />
          ))}

        {/* Bitácoras */}
        <text className="t-sub" x={IZQ} y={128}>
          Bitácoras · {bitacoras.filter(({ e }) => e.tono === 'hecho' || e.tono === 'info').length} de {bitacoras.length} entregadas
        </text>
        {bitacoras.map(({ b, e }) => {
          const x1 = x(b.periodo_inicio)
          const x2 = Math.max(x(b.periodo_fin), x1 + 6)
          const futuro = e.tono === 'futuro' || e.tono === 'neutro'
          return (
            <g key={b.numero} className={onBitacora ? 'clic' : undefined} onClick={() => onBitacora?.(b.numero)}>
              <title>{`Bitácora ${b.numero}: ${e.texto}`}</title>
              <rect x={x1 + 1} y={136} width={x2 - x1 - 2} height={22} rx={3}
                fill={futuro ? 'var(--fx-superficie-2)' : RELLENO[e.tono]}
                stroke={e.tono === 'toca' ? 'var(--fx-morado)' : 'none'} />
              <text className="t-num" x={(x1 + x2) / 2} y={151} textAnchor="middle"
                style={{ fill: futuro ? 'var(--fx-tinta-2)' : 'var(--fx-sobre-morado)' }}>{b.numero}</text>
            </g>
          )
        })}

        {/* Eje con meses */}
        <path className="eje" d={`M${IZQ} 178 H${DER}`} />
        {meses.map((m) => (
          <g key={m.x}>
            <path className="eje" d={`M${m.x} 173 V183`} />
            <text className="t-num" x={m.x} y={198} textAnchor="middle">{m.t}</text>
          </g>
        ))}
        <text className="t-sub" x={IZQ} y={222}>Inicio {fdia(inicio)}</text>
        <text className="t-sub" x={DER} y={222} textAnchor="end">Fin estimado {fdia(fin)}</text>

        {hoyDentro && (
          <g>
            <line className="hoy" x1={x(hoy)} x2={x(hoy)} y1={24} y2={184} />
            <text className="hoy-t" x={x(hoy)} y={212} textAnchor="middle">hoy</text>
          </g>
        )}
      </svg>
    </div>
  )
}

// Versión de una línea para las filas de las listas: 3 momentos y las bitácoras.
export function LineaMini({ momentos, bitacoras }: {
  momentos: { tipo: TipoMomentoCron; tono: keyof typeof RELLENO; texto: string }[]
  bitacoras: { numero: number; tono: keyof typeof RELLENO; texto: string }[]
}) {
  return (
    <span className="fx-mini">
      <span className="fx-mini-momentos">
        {momentos.map((m) => {
          const vacio = m.tono === 'futuro' || m.tono === 'neutro'
          return (
            <span key={m.tipo} className="fx-mini-m" title={`${NOMBRE_MOMENTO[m.tipo]}: ${m.texto}`}
              style={{
                background: vacio ? 'transparent' : RELLENO[m.tono],
                color: vacio ? 'var(--fx-tinta-3)' : 'var(--fx-sobre-morado)',
                border: vacio ? '1.5px dashed var(--fx-linea-2)' : 'none',
              }}>
              {NOMBRE_MOMENTO[m.tipo][0]}
            </span>
          )
        })}
      </span>
      <span className="fx-mini-b" aria-label="Bitácoras">
        {bitacoras.map((b) => (
          <i key={b.numero} title={`Bitácora ${b.numero}: ${b.texto}`}
            style={{ background: b.tono === 'futuro' || b.tono === 'neutro' ? 'var(--fx-superficie-2)' : RELLENO[b.tono] }} />
        ))}
      </span>
    </span>
  )
}
