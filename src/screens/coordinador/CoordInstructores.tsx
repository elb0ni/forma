import { useState, useEffect } from 'react'
import { Ic, Card, Ava, Bdg } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { InstructorDetalle } from '../shared/InstructorDetalle'
import type { InstructorBasico } from '../shared/InstructorDetalle'

type ListState =
  | { status: 'loading' }
  | { status: 'ok'; data: InstructorBasico[] }
  | { status: 'error' }

// Instructores de práctica de la coordinación del usuario -- reutiliza el
// mismo endpoint que ya usan FichaForm.tsx y productiva/EtapaProductivaList.tsx
// (PasoInstructorPractica) para elegir instructor al asignar una ficha.
export function CoordInstructores() {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const coordId = user?.coordinacion_academica_id ?? null
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [sel, setSel] = useState<InstructorBasico | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (coordId == null) return
    api.get<InstructorBasico[]>(`/usuarios?rol=INSTRUCTOR&coordinacion_id=${coordId}`)
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [coordId])

  if (sel) {
    return <InstructorDetalle instructor={sel} onBack={() => setSel(null)}/>
  }

  if (coordId == null) return <Center title="Sin coordinación asignada" sub="Pide a un administrador que te asigne una coordinación académica."/>
  if (state.status === 'error') return <Center title="No se pudieron cargar los instructores" sub="Verifica la conexión con el servidor."/>
  if (state.status === 'loading') return <div style={{ padding: 40 }}><div className="skeleton" style={{ height: 18, width: 240 }}/></div>

  const ql = q.trim().toLowerCase()
  const items = state.data.filter(u =>
    !ql || u.nombre_completo.toLowerCase().includes(ql) || u.email.toLowerCase().includes(ql))

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: '#52525b' }}>
          {state.data.length} instructor{state.data.length === 1 ? '' : 'es'} en tu coordinación.
        </div>
        <div className="inst-search" style={{ position: 'relative' }}>
          <Ic n="search" s={14} style={{ position: 'absolute', left: 10, top: 10, color: '#a1a1aa', pointerEvents: 'none' }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar instructor…"
            style={{ width: 240, height: 34, padding: '0 12px 0 32px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12.5, outline: 'none', fontFamily: 'Inter, sans-serif' }}/>
        </div>
      </div>

      {items.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <Ic n="users" s={24} style={{ color: '#a1a1aa' }}/>
          <div style={{ fontSize: 13, color: '#3f3f46', marginTop: 8 }}>Sin instructores que coincidan.</div>
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e7', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>
                {['Instructor', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(u => (
                <tr key={u.id} className="nx-row" onClick={() => setSel(u)} style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer', opacity: u.activo ? 1 : 0.6 }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Ava name={u.nombre_completo} size={30}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nombre_completo}</div>
                        <div style={{ fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}><Bdg tone={u.activo ? 'ok' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</Bdg></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function Center({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0b' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#71717a', maxWidth: 380 }}>{sub}</div>
    </div>
  )
}
