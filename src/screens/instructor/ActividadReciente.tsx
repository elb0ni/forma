import { Ic, Card, Bdg } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { fd } from '../shared/parts'
import { CONCEPTO_META, momentoLabel } from './types'
import type { HistorialEvento, InstructorResumen } from './types'

// ─── Actividad reciente (Home del instructor) ────────────────────────────────
// Los últimos momentos que el instructor registró, en una tarjeta compacta.
// Es la puerta al Historial completo: aquí no hay filtros ni heatmap, solo lo
// último con lo que queda pendiente de cada registro (firma, concepto).

const MOMENTO_ICON: Record<HistorialEvento['tipo_momento'], { icon: IcName; color: string; bg: string }> = {
  PLANEACION:  { icon: 'edit',        color: '#4f46e5', bg: '#eef2ff' },
  SEGUIMIENTO: { icon: 'briefcase',   color: '#0369a1', bg: '#e0f2fe' },
  EVALUACION:  { icon: 'checkCircle', color: '#15803d', bg: '#dcfce7' },
}

function parseFecha(s: string): Date {
  return new Date(s.includes('T') ? s : s.replace(' ', 'T'))
}

// "hace 5 min" · "hace 3 h" · "ayer" · "hace 4 días" · "09 sep 2026"
function haceCuanto(s: string): string {
  const d = parseFecha(s)
  if (isNaN(d.getTime())) return '—'
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const dia = new Date(d); dia.setHours(0, 0, 0, 0)
  const dias = Math.round((hoy.getTime() - dia.getTime()) / 86400000)
  if (dias <= 0) return `hace ${Math.floor(min / 60)} h`
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return fd(s)
}

function fechaHora(s: string): string {
  const d = parseFecha(s)
  if (isNaN(d.getTime())) return s
  return `${fd(s)} · ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}

function EventoItem({ e, onOpen, last }: { e: HistorialEvento; onOpen: () => void; last: boolean }) {
  const meta = MOMENTO_ICON[e.tipo_momento] ?? MOMENTO_ICON.SEGUIMIENTO
  const con = CONCEPTO_META[e.concepto] ?? CONCEPTO_META.PENDIENTE
  return (
    <div
      onClick={onOpen}
      className="nx-row"
      style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid #f1f1f3',
      }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        display: 'grid', placeItems: 'center', background: meta.bg, color: meta.color,
      }}>
        <Ic n={meta.icon} s={14}/>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 600 }}>{momentoLabel(e)}</span>
          <span style={{ color: '#a1a1aa' }}> · </span>
          {e.aprendiz_nombre}
        </div>
        <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}># {e.numero_ficha}</span>
          {e.empresa_nombre ? ` · ${e.empresa_nombre}` : ''}
          {!e.firmado && <span style={{ color: '#c2410c' }}> · firma pendiente</span>}
        </div>
      </div>
      {e.tipo_momento === 'EVALUACION' && e.resultado_final ? (
        <Bdg tone={e.resultado_final === 'APROBADO' ? 'ok' : 'err'}>
          {e.resultado_final === 'APROBADO' ? 'Aprobado' : 'No aprobado'}
        </Bdg>
      ) : e.tipo_momento !== 'PLANEACION' && (
        <Bdg tone={con.tone}>{con.label}</Bdg>
      )}
      <span
        title={fechaHora(e.registrado_at)}
        style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: '#52525b', whiteSpace: 'nowrap', minWidth: 76, textAlign: 'right' }}
      >
        {haceCuanto(e.registrado_at)}
      </span>
      <Ic n="chevronRight" s={14} style={{ color: '#d4d4d8', flexShrink: 0 }}/>
    </div>
  )
}

export function ActividadReciente({ eventos, resumen, onOpenEtapa, onVerHistorial }: {
  eventos: HistorialEvento[]
  resumen: InstructorResumen | null
  onOpenEtapa: (etapaId: number) => void
  onVerHistorial: () => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Actividad reciente</span>
          {resumen && (
            <span style={{ fontSize: 11.5, color: '#a1a1aa' }}>
              {resumen.seguimientos_30d} registro{resumen.seguimientos_30d === 1 ? '' : 's'} en 30 días · {resumen.seguimientos_total} en total
            </span>
          )}
        </div>
        {eventos.length > 0 && (
          <button
            onClick={onVerHistorial}
            style={{
              fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Ver historial <Ic n="arrowRight" s={12}/>
          </button>
        )}
      </div>
      <Card style={{ overflow: 'hidden' }}>
        {eventos.length === 0 ? (
          <div style={{ padding: '14px 16px', fontSize: 12.5, color: '#71717a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic n="clock" s={14} style={{ color: '#a1a1aa' }}/>
            Todavía no has registrado nada. Tus planeaciones, seguimientos y evaluaciones aparecerán aquí.
          </div>
        ) : eventos.map((e, i) => (
          <EventoItem key={e.id} e={e} onOpen={() => onOpenEtapa(e.etapa_id)} last={i === eventos.length - 1}/>
        ))}
      </Card>
    </div>
  )
}
