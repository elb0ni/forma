import { useState } from 'react'
import { Ic, Card, Ava, Bdg } from '../../components/ui'
import { EtapaProductivaList } from '../productiva/EtapaProductivaList'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'

// ─── Detalle de un instructor de práctica (read-only) ───────────────────────────
// Lo usan SuperAdmin (UsuariosAdmin, CoordinacionDetalle) y Coordinador
// (CoordInstructores) para ver las etapas productivas que sigue un
// instructor. Los datos básicos (nombre/email/activo) los pasa quien abre
// esta vista -- ya los tiene en la fila que se clickeó -- así no hace falta
// un endpoint propio de detalle de usuario.
//
// Riesgo conocido: `GET /etapas-productivas?instructor_id=` (dentro de
// EtapaProductivaList) solo se había usado antes con el id del propio
// usuario logueado. Si el backend no autoriza a un coordinador/admin a
// consultar el id de otro instructor, esa llamada falla con 401/403 y
// EtapaProductivaList ya degrada mostrando su propio estado de error --
// no rompe esta pantalla.

export interface InstructorBasico {
  id: string
  nombre_completo: string
  email: string
  activo: boolean | number
}

export function InstructorDetalle({ instructor, onBack }: { instructor: InstructorBasico; onBack: () => void }) {
  "use no memo"
  const [etapaId, setEtapaId] = useState<number | null>(null)
  const activo = !!instructor.activo

  if (etapaId != null) {
    return <EtapaProductivaDetalle etapaId={etapaId} onBack={() => setEtapaId(null)}/>
  }

  return (
    <div>
      <button onClick={onBack} className="back-btn" style={{
        fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none',
        cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'Inter, sans-serif',
      }}>
        <Ic n="arrowLeft" s={14}/>Volver
      </button>

      <Card style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Ava name={instructor.nombre_completo} size={44}/>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>{instructor.nombre_completo}</span>
              <Bdg tone={activo ? 'ok' : 'neutral'}>{activo ? 'Activo' : 'Inactivo'}</Bdg>
            </div>
            <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 2 }}>{instructor.email}</div>
          </div>
        </div>
      </Card>

      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 12 }}>
        Etapa productiva a su cargo
      </div>
      <EtapaProductivaList instructorId={instructor.id} onOpen={setEtapaId}/>
    </div>
  )
}
