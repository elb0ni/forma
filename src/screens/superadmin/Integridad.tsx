import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Ic } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { INTEGRIDAD_BASE } from './integridadComun'
import { Catalogo } from './CatalogoVista'
import { SofiaSync } from './SofiaSync'
import { DisenosCurriculares } from './DisenosCurriculares'
import '../shared/ProgramasFormacion.css'
import './DashboardHome.css'
import './SofiaSync.css'
import './Integridad.css'

// ─── Integridad de datos ─────────────────────────────────────────────────────
// Mesa de control de los datos con los que opera FORMA: el PE-04 semanal de
// SofiaPlus, el catálogo que asigna coordinación a las fichas (con sus reglas
// editables en el detalle de cada centro) y los diseños curriculares.

const TABS: { id: string; label: string; icon: IcName }[] = [
  { id: 'sofia',    label: 'SofiaPlus (PE-04)', icon: 'refresh'  },
  { id: 'catalogo', label: 'Catálogo',          icon: 'list'     },
  { id: 'disenos',  label: 'Diseños',           icon: 'fileText' },
]

// ─── Contenedor con pestañas ─────────────────────────────────────────────────

export function Integridad() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const seg = pathname.slice(INTEGRIDAD_BASE.length).replace(/^\/+/, '').split('/')[0]
  const actual = TABS.some(t => t.id === seg) ? seg : 'sofia'
  const ir = (tab: string) => navigate(`${INTEGRIDAD_BASE}/${tab}`)

  return (
    <div className="int">
      <div className="tab-bar int-tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => ir(t.id)} className={`tab-btn${actual === t.id ? ' tab-btn--active' : ' tab-btn--inactive'}`}>
            <Ic n={t.icon} s={14} style={{ color: actual === t.id ? '#0a0a0b' : '#a1a1aa' }}/>
            {t.label}
          </button>
        ))}
      </div>
      <Routes>
        <Route index element={<Navigate to={`${INTEGRIDAD_BASE}/sofia`} replace/>}/>
        {/* "Por asignar" se integró al detalle de cada centro en Catálogo */}
        <Route path="asignar" element={<Navigate to={`${INTEGRIDAD_BASE}/catalogo`} replace/>}/>
        <Route path="catalogo" element={<Catalogo/>}/>
        <Route path="sofia/*" element={<SofiaSync/>}/>
        <Route path="disenos" element={<DisenosCurriculares/>}/>
        <Route path="*" element={<Navigate to={`${INTEGRIDAD_BASE}/sofia`} replace/>}/>
      </Routes>
    </div>
  )
}
