import { useState } from 'react'
import { Shell }          from '../components/Shell'
import { useAuthStore }   from '../store/auth'
import { DashboardHome }  from './superadmin/DashboardHome'
import { Digitalizacion } from './superadmin/Digitalizacion'
import { ProgramasFormacion } from './superadmin/ProgramasFormacion'
import { FichasAdmin }    from './superadmin/FichasAdmin'
import { CentrosCoord }   from './superadmin/CentrosCoord'
import { UsuariosAdmin }  from './superadmin/UsuariosAdmin'
import { ReportesAdmin }  from './superadmin/ReportesAdmin'
import { CoordinadorHome } from './coordinador/CoordinadorHome'
import { CoordInstructores } from './coordinador/CoordInstructores'
import { CoordAlertas } from './coordinador/CoordAlertas'
import { InstructorHome } from './instructor/InstructorHome'
import { InstFichas } from './instructor/InstFichas'
import { InstSesionesList, InstSesionDetalle } from './instructor/InstSesiones'
import { SesionWizard } from './instructor/SesionWizard'
import { InstReportes } from './instructor/InstReportes'
import './Dashboard.css'

// ─── SUPER_ADMIN ──────────────────────────────────────────────────────────────

const ADMIN_TITLES: Record<string, string> = {
  'admin-home':      'Dashboard',
  'admin-dig':       'Digitalización',
  'admin-programas': 'Programas de formación',
  'admin-fichas':    'Gestión de fichas',
  'admin-centros':   'Centros y coordinaciones',
  'admin-usuarios':  'Gestión de usuarios',
  'admin-reportes':  'Reportes ejecutivos',
}

function SuperAdminDashboard() {
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

// ─── COORDINADOR ──────────────────────────────────────────────────────────────

const COORD_TITLES: Record<string, string> = {
  'coord-home':         'Dashboard',
  'coord-fichas':       'Mis fichas',
  'coord-instructores': 'Instructores',
  'coord-reportes':     'Reportes',
  'coord-alertas':      'Alertas',
}

function CoordFichas() {
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
    <FichasAdmin scope={{
      coordinacionId: user.coordinacion_academica_id,
      centroId:       user.centro_formacion_id,
    }}/>
  )
}

function CoordinadorDashboard() {
  "use no memo"
  const [navItem, setNavItem] = useState('coord-home')
  const title = COORD_TITLES[navItem] ?? 'Coordinación'

  return (
    <Shell current={navItem} onNav={setNavItem} title={title} breadcrumb={['Coordinación', title]}>
      {navItem === 'coord-home'         && <CoordinadorHome onNav={setNavItem}/>}
      {navItem === 'coord-fichas'       && <CoordFichas/>}
      {navItem === 'coord-instructores' && <CoordInstructores/>}
      {navItem === 'coord-reportes'     && <ReportesAdmin base="/dashboard/coordinador" allowCentro={false}/>}
      {navItem === 'coord-alertas'      && <CoordAlertas/>}
    </Shell>
  )
}

// ─── INSTRUCTOR ───────────────────────────────────────────────────────────────

const INST_TITLES: Record<string, string> = {
  'inst-home':     'Inicio',
  'inst-fichas':   'Mis fichas',
  'inst-sesiones': 'Sesiones',
  'inst-reportes': 'Reportes',
}

// Vista superpuesta (sobre cualquier sección): wizard de registro o detalle de sesión
type InstModal =
  | { kind: 'wizard'; asignacionId: number }
  | { kind: 'sesion'; id: number; justSaved?: boolean }
  | null

function InstructorDashboard() {
  "use no memo"
  const [section, setSection]   = useState('inst-home')
  const [modal, setModal]       = useState<InstModal>(null)
  const [reporteFicha, setReporteFicha] = useState<number | undefined>(undefined)
  // Cambia al re-montar la lista de fichas/sesiones para resetear su drill-down interno
  const [resetKey, setResetKey] = useState(0)

  function nav(id: string) {
    setModal(null)
    setReporteFicha(undefined)
    setSection(id)
    setResetKey(k => k + 1)
  }

  const openSesion = (id: number) => setModal({ kind: 'sesion', id })
  const openWizard = (asignacionId: number) => setModal({ kind: 'wizard', asignacionId })
  const openReporte = (fichaId: number) => { setReporteFicha(fichaId); setModal(null); setSection('inst-reportes') }

  const title = modal?.kind === 'wizard'
    ? 'Registrar sesión'
    : modal?.kind === 'sesion'
      ? 'Detalle de sesión'
      : INST_TITLES[section] ?? 'Instructor'

  let content
  if (modal?.kind === 'wizard') {
    content = (
      <SesionWizard
        asignacionId={modal.asignacionId}
        onCancel={() => setModal(null)}
        onSaved={id => setModal({ kind: 'sesion', id, justSaved: true })}
      />
    )
  } else if (modal?.kind === 'sesion') {
    content = (
      <InstSesionDetalle
        sesionId={modal.id}
        justSaved={modal.justSaved}
        onBack={() => setModal(null)}
      />
    )
  } else if (section === 'inst-home') {
    content = <InstructorHome onRegistrar={openWizard} onOpenSesion={openSesion}/>
  } else if (section === 'inst-fichas') {
    content = <InstFichas key={resetKey} onRegistrar={openWizard} onOpenSesion={openSesion} onReporte={openReporte}/>
  } else if (section === 'inst-sesiones') {
    content = <InstSesionesList key={resetKey} onOpen={openSesion} onNueva={() => openWizard(0)}/>
  } else {
    content = <InstReportes initialFichaId={reporteFicha}/>
  }

  return (
    <Shell current={section} onNav={nav} title={title} breadcrumb={['Instructor', title]}>
      {content}
    </Shell>
  )
}

// ─── Selector por rol ────────────────────────────────────────────────────────

export function RoleDashboard() {
  const rol = useAuthStore(s => s.user?.rol)
  if (rol === 'SUPER_ADMIN') return <SuperAdminDashboard/>
  if (rol === 'COORD_ACADEMICO' || rol === 'COORD_MISIONAL' || rol === 'SUBDIRECTOR') return <CoordinadorDashboard/>
  return <InstructorDashboard/>
}
