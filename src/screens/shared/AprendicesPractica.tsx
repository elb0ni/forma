import { Ic, Card, Ava, Bdg } from '../../components/ui'

// ─── Tipos y helpers compartidos entre la vista de coordinador/admin
// (FichasAdmin) y la del instructor (InstFichas) para el roster de
// aprendices de una ficha en etapa práctica -- viene de
// GET /fichas/:id/detalle (campo aprendices_practica), sin restricción de
// rol en el backend.

export type CasoAprendizPractica = 'SIN_ALTERNATIVA' | 'LISTO_PARA_INICIAR' | 'EN_CURSO' | 'TERMINADA_SIN_JUICIO' | 'CONCLUIDA'

export interface AprendizPractica {
  aprendiz_id: number | null
  etapa_id: number | null
  numero_documento: string; tipo_documento: string; nombre_completo: string
  modalidad: string | null; etapa_estado: string | null; resultado_final: 'APROBADO' | 'NO_APROBADO' | null
  etapa_instructor_nombre: string | null
  total_ra: number | null; ra_aprobados: number | null; ra_no_aprobados: number | null; ra_sin_evaluar: number | null
  fecha_reporte: string | null
  caso: CasoAprendizPractica
}

export interface InstructorPracticaInfo { nombre: string; fecha_inicio: string }

export const MODALIDAD_LABEL: Record<string, string> = {
  CONTRATO_APRENDIZAJE: 'Contrato de aprendizaje',
  VINCULO_LABORAL: 'Vínculo laboral',
  MONITORIA: 'Monitoría',
  UNIDAD_PRODUCTIVA: 'Unidad productiva',
}

export const CASO_META: Record<CasoAprendizPractica, { label: string; tone: 'ok' | 'err' | 'warn' | 'accent' | 'neutral' }> = {
  SIN_ALTERNATIVA: { label: 'Sin alternativa', tone: 'neutral' },
  LISTO_PARA_INICIAR: { label: 'Listo para iniciar', tone: 'warn' },
  EN_CURSO: { label: 'En curso', tone: 'accent' },
  TERMINADA_SIN_JUICIO: { label: 'Falta juicio Sofia', tone: 'warn' },
  CONCLUIDA: { label: 'Concluida', tone: 'ok' },
}

export function casoBadge(r: AprendizPractica) {
  if (r.caso === 'CONCLUIDA' && r.resultado_final) {
    return r.resultado_final === 'APROBADO'
      ? { label: 'Aprobado', tone: 'ok' as const }
      : { label: 'No aprobado', tone: 'err' as const }
  }
  return CASO_META[r.caso]
}

function fdISO(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TH_S = { padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600 }
const TD_S = { padding: '12px 14px' }

// Roster de aprendices de una ficha en etapa práctica: reemplaza la lista de
// competencias (que deja de aplicar una vez cerrada la etapa lectiva).
// Cruza el reporte de juicios de SofiaPlus con la etapa_productiva de cada
// aprendiz (si ya eligió alternativa), ya ordenado por el backend de mayor a
// menor avance de juicios. `onOpen` es opcional: si se pasa, cada fila es
// clicable (usado por el instructor para entrar a gestionar el seguimiento).
export function AprendicesPracticaTable({ aprendices, onOpen }: {
  aprendices: AprendizPractica[]
  onOpen?: (a: AprendizPractica) => void
}) {
  const listos = aprendices.filter(a => a.caso === 'LISTO_PARA_INICIAR').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>
          Aprendices · {aprendices.length}
          {listos > 0 && (
            <span style={{ color: '#a16207', fontWeight: 400 }}> · {listos} listo{listos === 1 ? '' : 's'} para iniciar</span>
          )}
        </div>
      </div>

      {aprendices.length === 0 ? (
        <Card>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Ic n="fileText" s={26} style={{ color: '#a1a1aa' }}/>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>Sin reporte de juicios</div>
            <div style={{ fontSize: 12.5, color: '#71717a', textAlign: 'center' }}>Todavía no se ha cargado un reporte de avance de juicios para esta ficha.</div>
          </div>
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', borderBottom: '1px solid #e4e4e7' }}>
                <th style={TH_S}>Aprendiz</th>
                <th style={TH_S}>Estado</th>
                <th style={TH_S}>Alternativa</th>
                <th style={TH_S}>Aprobados</th>
                <th style={TH_S}>No aprobados</th>
                <th style={TH_S}>Sin evaluar</th>
                <th style={TH_S}>Reporte</th>
              </tr>
            </thead>
            <tbody>
              {aprendices.map((a, i) => {
                const badge = casoBadge(a)
                return (
                <tr
                  key={a.numero_documento}
                  onClick={onOpen ? () => onOpen(a) : undefined}
                  style={{ borderBottom: i < aprendices.length - 1 ? '1px solid #f1f1f3' : 'none', cursor: onOpen ? 'pointer' : 'default' }}
                >
                  <td style={TD_S}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Ava name={a.nombre_completo} size={22}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{a.nombre_completo}</div>
                        <div style={{ fontSize: 10.5, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{a.tipo_documento} {a.numero_documento}</div>
                      </div>
                    </div>
                  </td>
                  <td style={TD_S}><Bdg tone={badge.tone}>{badge.label}</Bdg></td>
                  <td style={TD_S}>
                    {a.modalidad
                      ? <span style={{ fontSize: 12, color: '#3f3f46' }}>{MODALIDAD_LABEL[a.modalidad] ?? a.modalidad}</span>
                      : <span style={{ fontSize: 11.5, color: '#a1a1aa' }}>Sin elegir</span>}
                  </td>
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', color: '#15803d' }}>{a.ra_aprobados ?? '—'}/{a.total_ra ?? '—'}</td>
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', color: (a.ra_no_aprobados ?? 0) > 0 ? '#b91c1c' : '#a1a1aa' }}>{a.ra_no_aprobados ?? '—'}</td>
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', color: (a.ra_sin_evaluar ?? 0) > 0 ? '#a16207' : '#a1a1aa' }}>{a.ra_sin_evaluar ?? '—'}</td>
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: '#52525b', whiteSpace: 'nowrap' }}>{fdISO(a.fecha_reporte)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
