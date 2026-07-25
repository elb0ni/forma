import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark, Bdg, Ic } from '../../components/ui'
import '../../components/Shell.css'
import { mockRecords } from './mockData'
import { nuevoRegistro } from './types'
import type { EtapaProductivaRecord } from './types'
import { EtapaProductivaList } from './EtapaProductivaList'
import { EtapaProductivaDetalle } from './EtapaProductivaDetalle'

// Módulo de Etapa Productiva (GFPI-F-023 V06), montado en una ruta pública sin
// autenticación mientras se define el diseño junto con el usuario. Todo vive en
// memoria del navegador: no hay backend ni persistencia todavía.

export function EtapaProductivaPreview() {
  "use no memo"
  const [records, setRecords] = useState<EtapaProductivaRecord[]>(() => mockRecords())
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const selected = selectedId != null ? records.find(r => r.id === selectedId) ?? null : null

  function actualizar(next: EtapaProductivaRecord) {
    setRecords(rs => rs.map(r => r.id === next.id ? next : r))
  }

  function crearNuevo() {
    const id = records.reduce((m, r) => Math.max(m, r.id), 0) + 1
    const nuevo = nuevoRegistro(id)
    setRecords(rs => [...rs, nuevo])
    setSelectedId(id)
  }

  return (
    <div className="shell" style={{ background: '#f7f7f8' }}>
      <div className="shell__main">
        <header className="shell-header">
          <div className="shell-header__info">
            <div className="shell-header__breadcrumb">
              <span className="shell-header__breadcrumb-item">
                <BrandMark size={16}/>
                <span>FORMA</span>
              </span>
              <span className="shell-header__breadcrumb-item">
                <Ic n="chevronRight" s={11} style={{ color: '#a1a1aa' }}/>
                <span className="shell-header__breadcrumb-item--last">Etapa productiva</span>
              </span>
            </div>
            <div className="shell-header__title-row">
              <h1 className="shell-header__title">Planeación, seguimiento y evaluación de etapa productiva</h1>
            </div>
          </div>
          <div className="shell-header__actions">
            <Bdg tone="warn" icon="alert">Vista previa · en planeación</Bdg>
            <div className="shell-header__divider"/>
            <Link to="/login" style={{ fontSize: 12.5, color: '#52525b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ic n="logout" s={13}/>Ir a la aplicación
            </Link>
          </div>
        </header>
        <div className="shell__content screen-in">
          {selected
            ? <EtapaProductivaDetalle record={selected} onChange={actualizar} onBack={() => setSelectedId(null)}/>
            : <EtapaProductivaList records={records} onOpen={setSelectedId} onNuevo={crearNuevo}/>}
        </div>
      </div>
    </div>
  )
}
