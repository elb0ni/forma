import { useState } from 'react'
import { Shell } from '../../components/Shell'
import { InstructorHome } from './InstructorHome'
import { InstFichas } from './InstFichas'
import { InstSesionesList, InstSesionDetalle } from './InstSesiones'
import { SesionWizard } from './SesionWizard'
import { InstReportes } from './InstReportes'

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

export function InstructorDashboard() {
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
