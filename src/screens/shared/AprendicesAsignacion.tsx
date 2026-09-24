import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { Ic, Card, Ava } from '../../components/ui'
import api from '../../lib/api'

// ─── Asignar instructor a aprendices sueltos ─────────────────────────────────
// Complementa a la asignación por ficha, no la reemplaza: por defecto todos
// los aprendices dependen del instructor de práctica de su ficha, y acá se
// puede sacar a uno de esa regla y dárselo a otro instructor.
//
// Solo aparecen los que ya están LISTOS PARA PRÁCTICA -- sin etapa productiva
// creada y con un solo RA pendiente en el último reporte de juicios. Es el
// mismo criterio del Caso 4 en el modal de casos, y es justo el momento en que
// tiene sentido repartirlos.

interface Candidato {
  numero_documento: string
  nombre_completo: string
  aprendiz_id: number | null
  asignacion_id: number | null
  instructor_id: string | null
  instructor_nombre: string | null
}

interface InstructorOpt { id: string; nombre_completo: string }

const selectStyle: React.CSSProperties = {
  fontSize: 12, padding: '5px 7px', border: '1px solid #e4e4e7',
  borderRadius: 6, fontFamily: 'Inter, sans-serif', background: '#fff',
  color: '#3f3f46', maxWidth: 190,
}

export function AprendicesAsignacion({ fichaId, instructores, instructorFicha }: {
  fichaId: number
  instructores: InstructorOpt[]
  instructorFicha?: string | null
}) {
  "use no memo"
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(() => {
    api.get<Candidato[]>(`/asignaciones-aprendiz/candidatos?ficha_id=${fichaId}`)
      .then(r => setCandidatos(r.data))
      .catch(() => setCandidatos([]))
  }, [fichaId])

  useEffect(cargar, [cargar])

  async function asignar(c: Candidato, instructorId: string) {
    setBusy(c.numero_documento)
    setError(null)
    try {
      if (!instructorId) {
        // Volver al instructor de la ficha: se cierra el override.
        if (c.asignacion_id) await api.delete(`/asignaciones-aprendiz/${c.asignacion_id}`)
      } else {
        await api.post('/asignaciones-aprendiz', {
          ficha_id: fichaId,
          aprendiz_id: c.aprendiz_id ?? undefined,
          numero_documento: c.numero_documento,
          aprendiz_nombre: c.nombre_completo,
          instructor_id: instructorId,
          fecha_inicio: new Date().toISOString().slice(0, 10),
        })
      }
      cargar()
    } catch (e) {
      const m = axios.isAxiosError(e)
        ? (e.response?.data as { message?: string | string[] })?.message ?? e.message
        : 'No se pudo asignar.'
      setError(Array.isArray(m) ? m.join(' · ') : String(m))
    } finally {
      setBusy(null)
    }
  }

  const asignados = (candidatos ?? []).filter(c => c.instructor_id).length

  return (
    <Card style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600 }}>
            Aprendices listos para práctica
          </div>
          <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>
            Puedes darle uno a otro instructor sin partir la ficha. Los que dejes en
            blanco siguen con el instructor de la ficha.
          </div>
        </div>
        {candidatos && candidatos.length > 0 && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#52525b',
            background: '#f4f4f5', borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap',
          }}>
            {asignados}/{candidatos.length}
          </span>
        )}
      </div>

      {candidatos === null ? (
        <div style={{ fontSize: 12.5, color: '#a1a1aa', marginTop: 16 }}>Cargando…</div>
      ) : candidatos.length === 0 ? (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: '#71717a' }}>
          <Ic n="info" s={14} style={{ color: '#a1a1aa' }}/>
          Ningún aprendiz de esta ficha está listo para iniciar práctica todavía.
        </div>
      ) : (
        <div style={{ marginTop: 16, border: '1px solid #f1f1f3', borderRadius: 10, overflow: 'hidden' }}>
          {candidatos.map((c, i) => (
            <div
              key={c.numero_documento}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderBottom: i < candidatos.length - 1 ? '1px solid #f1f1f3' : 'none',
                opacity: busy === c.numero_documento ? 0.5 : 1,
              }}
            >
              <Ava name={c.nombre_completo} size={26}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.nombre_completo}
                </div>
                <div style={{ fontSize: 11, color: '#a1a1aa', fontFamily: '"JetBrains Mono", monospace' }}>
                  {c.numero_documento}
                </div>
              </div>
              <select
                value={c.instructor_id ?? ''}
                disabled={busy !== null}
                onChange={e => void asignar(c, e.target.value)}
                style={selectStyle}
              >
                <option value="">
                  {instructorFicha ? `Instructor de la ficha` : 'Sin asignar'}
                </option>
                {instructores.map(i2 => (
                  <option key={i2.id} value={i2.id}>{i2.nombre_completo}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 10 }}>{error}</div>
      )}

      {candidatos && candidatos.length > 0 && (
        <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Ic n="info" s={12}/>
          El instructor queda fijado cuando se cree la etapa productiva del aprendiz.
        </div>
      )}
    </Card>
  )
}
