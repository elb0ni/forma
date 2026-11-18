import { Fragment, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Btn, Modal } from '../../components/ui'
import { fd } from '../shared/parts'
import type { ModalidadEtapaProductiva } from './types'
import { fdia } from './cronograma'
import type { DocumentoBitacora } from './cronograma'
import './bitacora.css'

// ─── Bitácora quincenal lista para imprimir / guardar como PDF ─────────────────
// Las firmas no se capturan en cada bitácora: el backend estampa las de la
// planeación (aprendiz y jefe inmediato) y, si la aprobó, la del instructor.

// Casillas de "tipo de modalidad" tal como vienen en el GFPI-F-147; las
// alternativas de FORMA se marcan en la que corresponde.
const MODALIDADES_FORMATO: { label: string; de?: ModalidadEtapaProductiva }[] = [
  { label: 'Contrato de aprendizaje', de: 'CONTRATO_APRENDIZAJE' },
  { label: 'Vínculo laboral o contractual', de: 'VINCULO_LABORAL' },
  { label: 'Proyecto productivo' },
  { label: 'Apoyo a una unidad productiva familiar', de: 'UNIDAD_PRODUCTIVA' },
  { label: 'Apoyo a institución estatal nacional, territorial, o a una ONG, o a entidad sin ánimo de lucro' },
  { label: 'Monitoría', de: 'MONITORIA' },
  { label: 'Pasantía' },
]

// Mínimo de filas en la tabla de actividades, como el formato impreso.
const FILAS_MIN = 8

function FirmaImg({ src, alt }: { src: string | null; alt: string }) {
  return <div className="bitdoc-firma__img">{src ? <img src={src} alt={alt} data-keep-color/> : null}</div>
}

export function BitacoraHoja({ doc }: { doc: DocumentoBitacora }) {
  const { etapa: e, bitacora: b, firmas } = doc
  const actividades = b.actividades ?? []
  const vacias = Math.max(0, FILAS_MIN - actividades.length)
  return (
    <div className="bitdoc">
      <table className="bitdoc-cab">
        <tbody>
          <tr>
            <td className="bitdoc-cab__logo" rowSpan={2}><span>SENA</span></td>
            <td className="bitdoc-cab__meta">Versión: 03</td>
          </tr>
          <tr><td className="bitdoc-cab__meta">Código:<br/>GFPI-F-147</td></tr>
        </tbody>
      </table>
      <div className="bitdoc-banda">
        Proceso Gestión de Formación Profesional Integral<br/>
        Formato Bitácora seguimiento Etapa productiva
      </div>
      <div className="bitdoc-linea bitdoc-linea--b">REGIONAL {(e.regional ?? '').toUpperCase()}</div>
      <div className="bitdoc-linea">{e.centro_nombre ?? ''}</div>
      <div className="bitdoc-linea bitdoc-linea--b">BITÁCORA DE SEGUIMIENTO ETAPA PRODUCTIVA</div>

      <table className="bitdoc-t">
        <tbody>
          <tr className="bitdoc-t__h">
            <th style={{ width: '48%' }}>Nombre de la empresa donde está realizando la etapa productiva</th>
            <th style={{ width: '16%' }}>NIT</th>
            <th style={{ width: '12%' }}>Bitácora N.º</th>
            <th>Periodo</th>
          </tr>
          <tr>
            <td>{e.empresa_nombre ?? ''}</td>
            <td>{e.empresa_nit ?? ''}</td>
            <td className="bitdoc-c">{b.numero}</td>
            <td className="bitdoc-c">{fdia(b.periodo_inicio)} – {fdia(b.periodo_fin)}</td>
          </tr>
        </tbody>
      </table>

      <table className="bitdoc-t">
        <tbody>
          <tr className="bitdoc-t__h">
            <th style={{ width: '40%' }}>Nombre del jefe inmediato/Responsable</th>
            <th style={{ width: '25%' }}>Teléfono de contacto</th>
            <th>Correo electrónico</th>
          </tr>
          <tr>
            <td>{e.jefe_inmediato_nombre ?? ''}</td>
            <td>{e.jefe_inmediato_telefono ?? ''}</td>
            <td>{e.jefe_inmediato_email ?? ''}</td>
          </tr>
        </tbody>
      </table>

      <div className="bitdoc-sub">Seleccione con una “X” el tipo de modalidad de etapa productiva</div>
      <table className="bitdoc-t bitdoc-mod">
        <tbody>
          <tr>
            {MODALIDADES_FORMATO.map(m => (
              <Fragment key={m.label}>
                <td className="bitdoc-mod__l">{m.label}</td>
                <td className="bitdoc-mod__x">{m.de && m.de === e.modalidad ? 'X' : ''}</td>
              </Fragment>
            ))}
          </tr>
        </tbody>
      </table>

      <table className="bitdoc-t">
        <tbody>
          <tr className="bitdoc-t__h">
            <th style={{ width: '37%' }}>Nombre del aprendiz</th>
            <th style={{ width: '21%' }}>Documento Id.</th>
            <th style={{ width: '18%' }}>Teléfono de contacto</th>
            <th>Correo electrónico institucional</th>
          </tr>
          <tr>
            <td>{e.aprendiz_nombre}</td>
            <td>{e.aprendiz_tipo_documento ? `${e.aprendiz_tipo_documento} ` : ''}{e.aprendiz_documento}</td>
            <td>{e.aprendiz_telefono ?? ''}</td>
            <td>{e.aprendiz_email_institucional ?? ''}</td>
          </tr>
        </tbody>
      </table>

      <table className="bitdoc-t">
        <tbody>
          <tr className="bitdoc-t__h">
            <th style={{ width: '42%' }}>Número de ficha</th>
            <th>Programa de formación</th>
          </tr>
          <tr>
            <td>{e.numero_ficha}</td>
            <td>{e.programa_nombre}</td>
          </tr>
        </tbody>
      </table>

      <table className="bitdoc-t bitdoc-act">
        <thead>
          <tr>
            <th style={{ width: '37%' }}>Descripción de la actividad</th>
            <th style={{ width: '9%' }}>Fecha inicio</th>
            <th style={{ width: '9%' }}>Fecha fin</th>
            <th style={{ width: '23%' }}>Evidencia de cumplimiento</th>
            <th>Observaciones, inasistencias y/o dificultades presentadas</th>
          </tr>
        </thead>
        <tbody>
          {actividades.map((a, i) => (
            <tr key={i}>
              <td>{a.descripcion}</td>
              <td className="bitdoc-c">{fdia(a.fecha_inicio)}</td>
              <td className="bitdoc-c">{fdia(a.fecha_fin)}</td>
              <td>{a.evidencia}</td>
              <td>{a.observaciones}</td>
            </tr>
          ))}
          {Array.from({ length: vacias }, (_, i) => (
            <tr key={`v${i}`} className="bitdoc-act__vacia"><td/><td/><td/><td/><td/></tr>
          ))}
        </tbody>
      </table>
      <div className="bitdoc-nota-aprendiz">
        <strong>Aprendiz:</strong> recuerde diligenciar completamente el informe y entregarlo o subirlo al espacio asignado para este.
      </div>

      {b.observacion_instructor && (
        <div className="bitdoc-obs"><strong>Observaciones del instructor:</strong> {b.observacion_instructor}</div>
      )}

      <div className="bitdoc-firmas">
        <div className="bitdoc-firma">
          <FirmaImg src={null} alt=""/>
          <div className="bitdoc-firma__linea">{e.aprendiz_nombre}</div>
          <div className="bitdoc-firma__rol">Nombre del aprendiz</div>
        </div>
        <div className="bitdoc-firma">
          <FirmaImg src={firmas.aprendiz} alt="Firma del aprendiz"/>
          <div className="bitdoc-firma__linea"/>
          <div className="bitdoc-firma__rol">Firma del aprendiz</div>
        </div>
        <div className="bitdoc-firma">
          <FirmaImg src={null} alt=""/>
          <div className="bitdoc-firma__linea">{b.entregada_at ? fd(b.entregada_at) : ''}</div>
          <div className="bitdoc-firma__rol">Fecha entrega bitácora</div>
        </div>
        <div className="bitdoc-firma">
          <FirmaImg src={null} alt=""/>
          <div className="bitdoc-firma__linea">{e.instructor_nombre}</div>
          <div className="bitdoc-firma__rol">Nombre del instructor de seguimiento</div>
        </div>
        <div className="bitdoc-firma">
          <FirmaImg src={firmas.instructor} alt="Firma del instructor"/>
          <div className="bitdoc-firma__linea"/>
          <div className="bitdoc-firma__rol">Firma de instructor de seguimiento</div>
        </div>
        <div className="bitdoc-firma">
          <FirmaImg src={firmas.jefe} alt="Firma del jefe inmediato"/>
          <div className="bitdoc-firma__linea"/>
          <div className="bitdoc-firma__rol">Firma del jefe inmediato (si es del caso)</div>
        </div>
      </div>

      <div className="bitdoc-pie">
        Nota: Los datos proporcionados serán tratados de acuerdo con la política de tratamiento de datos personales del SENA y a la Ley 1581 de 2012.
      </div>
      {b.estado !== 'APROBADA' && (
        <div className="bitdoc-borrador">Aún sin aprobar: la firma del instructor aparece cuando la aprueba.</div>
      )}
    </div>
  )
}

// window.print() con una clase en <body> que oculta todo menos una copia de la
// hoja montada directo en <body> (fuera del modal: sin transform ni el filtro
// del tema oscuro).
function imprimir() {
  document.body.classList.add('imprimiendo-bitacora')
  const quitar = () => {
    document.body.classList.remove('imprimiendo-bitacora')
    window.removeEventListener('afterprint', quitar)
  }
  window.addEventListener('afterprint', quitar)
  window.print()
}

export function BitacoraDocumentoModal({ doc, onClose }: { doc: DocumentoBitacora; onClose: () => void }) {
  useEffect(() => () => document.body.classList.remove('imprimiendo-bitacora'), [])
  return (
    <Modal
      title={`Bitácora N.º ${doc.bitacora.numero}`}
      icon="fileText"
      onClose={onClose}
      width={900}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cerrar</Btn>
          <Btn variant="accent" icon="download" onClick={imprimir}>Descargar PDF / imprimir</Btn>
        </>
      }
    >
      <div className="bitdoc-scroll">
        <BitacoraHoja doc={doc}/>
      </div>
      {createPortal(<div className="bitdoc-print-host"><BitacoraHoja doc={doc}/></div>, document.body)}
    </Modal>
  )
}
