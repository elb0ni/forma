import { useState } from 'react'
import { Shell } from '../../components/Shell'
import { DashboardHome } from './DashboardHome'
import { ProgramasFormacion } from './ProgramasFormacion'
import { FichasAdmin } from '../shared/FichasAdmin'
import { CentrosCoord } from './CentrosCoord'
import { UsuariosAdmin } from './UsuariosAdmin'
import { ReportesAdmin } from '../shared/ReportesAdmin'

const ADMIN_TITLES: Record<string, string> = {
  'admin-home':      'Dashboard',
  'admin-programas': 'Programas de formación',
  'admin-fichas':    'Fichas en etapa productiva',
  'admin-centros':   'Centros y coordinaciones',
  'admin-usuarios':  'Gestión de usuarios',
  'admin-reportes':  'Reportes ejecutivos',
}

export function SuperAdminDashboard() {
  const [navItem, setNavItemRaw] = useState('admin-home')
  // Ficha a abrir directo en el detalle al entrar a "Fichas" (p. ej. desde un
  // clic en "Fichas que cierran pronto" del Home). Se limpia en cualquier
  // navegación normal para no reabrir un detalle viejo.
  const [fichaFocusId, setFichaFocusId] = useState<number | null>(null)
  const title = ADMIN_TITLES[navItem] ?? navItem
  const breadcrumb = navItem === 'admin-home' ? ['Regional Atlántico'] : ['SUPER ADMIN', title]

  function setNavItem(id: string) {
    setFichaFocusId(null)
    setNavItemRaw(id)
  }

  function openFicha(id: number) {
    setFichaFocusId(id)
    setNavItemRaw('admin-fichas')
  }

  return (
    <Shell current={navItem} onNav={setNavItem} title={title} breadcrumb={breadcrumb}>
      {navItem === 'admin-home'      && <DashboardHome onNav={setNavItem} onOpenFicha={openFicha}/>}
      {navItem === 'admin-programas' && <ProgramasFormacion/>}
      {navItem === 'admin-fichas'    && <FichasAdmin initialFichaId={fichaFocusId ?? undefined}/>}
      {navItem === 'admin-centros'   && <CentrosCoord/>}
      {navItem === 'admin-usuarios'  && <UsuariosAdmin/>}
      {navItem === 'admin-reportes'  && <ReportesAdmin/>}
    </Shell>
  )
}
