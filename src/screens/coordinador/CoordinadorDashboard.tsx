import { useState } from 'react'
import { Shell } from '../../components/Shell'
import { useAuthStore } from '../../store/auth'
import { FichasAdmin } from '../shared/FichasAdmin'
import { ReportesAdmin } from '../shared/ReportesAdmin'
import { CoordinadorHome } from './CoordinadorHome'
import { CoordInstructores } from './CoordInstructores'
import { CoordAlertas } from './CoordAlertas'

const COORD_TITLES: Record<string, string> = {
  'coord-home':         'Dashboard',
  'coord-fichas':       'Mis fichas',
  'coord-instructores': 'Instructores',
  'coord-reportes':     'Reportes',
  'coord-alertas':      'Alertas',
}

function CoordFichas({ initialFichaId }: { initialFichaId?: number }) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  if (user?.coordinacion_academica_id == null || user?.centro_formacion_id == null) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 320, gap: 12, textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0b' }}>Sin coordinación asignada</div>
        <div style={{ fontSize: 13, color: '#71717a', maxWidth: 360 }}>
          Tu usuario no tiene una coordinación académica asignada. Pide a un administrador que te la asigne para gestionar fichas.
        </div>
      </div>
    )
  }
  return (
    <FichasAdmin
      scope={{
        coordinacionId: user.coordinacion_academica_id,
        centroId:       user.centro_formacion_id,
      }}
      initialFichaId={initialFichaId}
    />
  )
}

export function CoordinadorDashboard() {
  "use no memo"
  const [navItem, setNavItemRaw] = useState('coord-home')
  // Ficha a abrir directo en el detalle al entrar a "Mis fichas" (p. ej. desde
  // un clic en el dashboard o en alertas). Se limpia en cualquier navegación
  // normal para no reabrir un detalle viejo.
  const [fichaFocusId, setFichaFocusId] = useState<number | null>(null)
  const title = COORD_TITLES[navItem] ?? 'Coordinación'

  function setNavItem(id: string) {
    setFichaFocusId(null)
    setNavItemRaw(id)
  }

  function openFicha(id: number) {
    setFichaFocusId(id)
    setNavItemRaw('coord-fichas')
  }

  return (
    <Shell current={navItem} onNav={setNavItem} title={title} breadcrumb={['Coordinación', title]}>
      {navItem === 'coord-home'         && <CoordinadorHome onNav={setNavItem} onOpenFicha={openFicha}/>}
      {navItem === 'coord-fichas'       && <CoordFichas initialFichaId={fichaFocusId ?? undefined}/>}
      {navItem === 'coord-instructores' && <CoordInstructores/>}
      {navItem === 'coord-reportes'     && <ReportesAdmin base="/dashboard/coordinador" allowCentro={false}/>}
      {navItem === 'coord-alertas'      && <CoordAlertas onOpenFicha={openFicha}/>}
    </Shell>
  )
}
