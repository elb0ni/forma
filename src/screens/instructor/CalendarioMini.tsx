import { Ic } from '../../components/ui'
import type { MomentoProyectado, TipoMomentoProyectado } from './types'

// ─── Calendario mínimo del Home ──────────────────────────────────────────────
// No es un mes completo: son los próximos 14 días. En el Home lo que importa
// no es navegar el calendario sino saber en dos segundos si estoy atrasado,
// qué viene y a quién. El mes completo vive en la Agenda, y todo el bloque
// lleva allá de un click.
//
// Igual que en la Agenda, un momento PROYECTADO (estimado sobre las fechas de
// la etapa) se dibuja hueco: es una estimación, no una fecha comprometida.

const DOW = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const DIAS = 14

const COLOR: Record<TipoMomentoProyectado, string> = {
  PLANEACION:  '#4f46e5',
  SEGUIMIENTO: '#0891b2',
  EVALUACION:  '#7c3aed',
}

const NOMBRE: Record<TipoMomentoProyectado, string> = {
  PLANEACION:  'Planeación',
  SEGUIMIENTO: 'Seguimiento',
  EVALUACION:  'Evaluación',
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Días entre dos fechas aaaa-mm-dd, sin pasar por la zona horaria del navegador.
function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`)
  const b = Date.parse(`${hasta}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

function cuando(hoy: string, fecha: string): string {
  const d = diasEntre(hoy, fecha)
  if (d === 0) return 'hoy'
  if (d === 1) return 'mañana'
  if (d > 1) return `en ${d} días`
  if (d === -1) return 'ayer'
  return `hace ${Math.abs(d)} días`
}

export function CalendarioMini({ momentos, hoy, onVerAgenda }: {
  momentos: MomentoProyectado[]
  hoy: string
  onVerAgenda: () => void
}) {
  const porDia: Record<string, MomentoProyectado[]> = {}
  for (const m of momentos) (porDia[m.fecha] ??= []).push(m)

  const base = new Date(`${hoy}T00:00:00Z`)
  const dias = Array.from({ length: DIAS }, (_, i) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i))
    return { iso: ymd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), dow: d.getUTCDay(), num: d.getUTCDate() }
  })

  const vencidos = momentos.filter(m => m.estado === 'VENCIDO').length
  const limiteSemana = dias[6]?.iso ?? hoy
  const estaSemana = momentos.filter(
    m => m.estado !== 'HECHO' && m.fecha >= hoy && m.fecha <= limiteSemana,
  ).length

  const proximo = momentos
    .filter(m => m.estado !== 'HECHO' && m.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] ?? null

  const atrasado = momentos
    .filter(m => m.estado === 'VENCIDO')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0] ?? null

  // Lo primero que debe leer el instructor: si hay algo vencido, eso; si no,
  // lo que viene.
  const destacado = atrasado ?? proximo

  return (
    <button className="mini-cal" onClick={onVerAgenda}>
      <span className="mini-cal__top">
        <span className="mini-cal__t">
          <Ic n="calendar" s={13} style={{ color: '#71717a' }}/>
          Tu agenda
        </span>
        <span className="mini-cal__cifras">
          {vencidos > 0 && (
            <span className="mini-cal__venc">{vencidos} vencido{vencidos === 1 ? '' : 's'}</span>
          )}
          <span className="mini-cal__sem">{estaSemana} en 7 días</span>
          <Ic n="arrowRight" s={13} style={{ color: '#a1a1aa' }}/>
        </span>
      </span>

      <span className="mini-cal__strip">
        {dias.map((d, i) => {
          const ms = porDia[d.iso] ?? []
          const pendientes = ms.filter(m => m.estado !== 'HECHO')
          const finde = d.dow === 0 || d.dow === 6
          return (
            <span key={d.iso} className={`mini-dia${i === 0 ? ' mini-dia--hoy' : ''}${finde ? ' mini-dia--finde' : ''}`}>
              <span className="mini-dia__dow">{DOW[d.dow]}</span>
              <span className="mini-dia__num">{d.num}</span>
              <span className="mini-dia__puntos">
                {pendientes.slice(0, 3).map((m, j) => (
                  <span
                    key={j}
                    className={`mini-punto${m.origen === 'PROYECTADO' ? ' mini-punto--proy' : ''}`}
                    style={{
                      background: m.origen === 'PROYECTADO' ? 'transparent' : COLOR[m.tipo],
                      borderColor: COLOR[m.tipo],
                    }}
                  />
                ))}
              </span>
            </span>
          )
        })}
      </span>

      {destacado && (
        <span className="mini-cal__pie">
          <span
            className="mini-cal__pill"
            style={{
              color: atrasado ? '#dc2626' : COLOR[destacado.tipo],
              background: `${atrasado ? '#dc2626' : COLOR[destacado.tipo]}14`,
            }}
          >
            {atrasado ? 'Vencido' : 'Próximo'}
          </span>
          <span className="mini-cal__pie-txt">
            <strong>{destacado.aprendiz_nombre}</strong>
            {' · '}{NOMBRE[destacado.tipo]}
            {' · '}{cuando(hoy, destacado.fecha)}
          </span>
        </span>
      )}
    </button>
  )
}
