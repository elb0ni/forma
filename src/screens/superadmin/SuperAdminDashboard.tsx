import { useState } from 'react'
import { Shell } from '../../components/Shell'
import { DashboardHome } from './DashboardHome'
import { Digitalizacion } from './Digitalizacion'
import { ProgramasFormacion } from './ProgramasFormacion'
import { FichasAdmin } from '../shared/FichasAdmin'
import { CentrosCoord } from './CentrosCoord'
import { UsuariosAdmin } from './UsuariosAdmin'
import { ReportesAdmin } from '../shared/ReportesAdmin'

const ADMIN_TITLES: Record<string, string> = {
  'admin-home':      'Dashboard',
  'admin-dig':       'Digitalización',
  'admin-programas': 'Programas de formación',
  'admin-fichas':    'Gestión de fichas',
  'admin-centros':   'Centros y coordinaciones',
  'admin-usuarios':  'Gestión de usuarios',
  'admin-reportes':  'Reportes ejecutivos',
}

export function SuperAdminDashboard() {
  const [navItem,     setNavItem]     = useState('admin-home')
  const [drillNombre, setDrillNombre] = useState<string | null>(null)

  function handleNav(id: string) {
    setNavItem(id)
    setDrillNombre(null)
  }

  const breadcrumb = navItem === 'admin-home'
    ? drillNombre
      ? ['Regional Atlántico', drillNombre]
      : ['Regional Atlántico']
    : ['SUPER ADMIN', ADMIN_TITLES[navItem] ?? navItem]

  const title = navItem === 'admin-home'
    ? (drillNombre ?? 'Dashboard')
    : (ADMIN_TITLES[navItem] ?? navItem)

  return (
    <Shell current={navItem} onNav={handleNav} title={title} breadcrumb={breadcrumb}>
      {navItem === 'admin-home'      && <DashboardHome onDrillDown={setDrillNombre} onNav={handleNav}/>}
      {navItem === 'admin-dig'       && <Digitalizacion onSaved={() => handleNav('admin-programas')}/>}
      {navItem === 'admin-programas' && <ProgramasFormacion onDigitalizar={() => handleNav('admin-dig')}/>}
      {navItem === 'admin-fichas'    && <FichasAdmin onDigitalizar={() => handleNav('admin-dig')}/>}
      {navItem === 'admin-centros'   && <CentrosCoord onDigitalizar={() => handleNav('admin-dig')}/>}
      {navItem === 'admin-usuarios'  && <UsuariosAdmin/>}
      {navItem === 'admin-reportes'  && <ReportesAdmin/>}
    </Shell>
  )
}
