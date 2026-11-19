// Componentes base del rediseño. Ver tokens.css y ui.css.
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './tokens.css'
import './ui.css'
import type { Tono } from './estados'

export { LineaEtapa, LineaMini } from './LineaEtapa'
export * from './estados'

// Envuelve cada pantalla nueva: aplica la paleta y el modo oscuro real.
export function Lienzo({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-ui="nuevo" className={`fx-lienzo${className ? ' ' + className : ''}`}>
      {children}
    </div>
  )
}

export function Frase({ children, tono }: { children: ReactNode; tono?: 'atraso' | 'ok' }) {
  return <p className="fx-frase" data-tono={tono}>{children}</p>
}

export function Estado({ tono, children, title }: { tono: Tono; children: ReactNode; title?: string }) {
  return <span className="fx-estado" data-tono={tono} title={title}>{children}</span>
}

export function Panel({ titulo, accion, children, className, sinCuerpo }: {
  titulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string; sinCuerpo?: boolean
}) {
  return (
    <section className={`fx-panel${className ? ' ' + className : ''}`}>
      {(titulo || accion) && (
        <div className="fx-panel-cab">
          {titulo && <h3 className="fx-subtitulo">{titulo}</h3>}
          {accion}
        </div>
      )}
      {sinCuerpo ? children : <div className="fx-panel-cuerpo">{children}</div>}
    </section>
  )
}

export interface DatoIndicador {
  k: string
  v: ReactNode
  nota?: ReactNode
  tono?: 'atraso' | 'ok'
}

export function Indicadores({ items }: { items: DatoIndicador[] }) {
  return (
    <div className="fx-indicadores">
      {items.map((it) => (
        <div className="fx-indicador" key={it.k}>
          <span className="k">{it.k}</span>
          <span className="v" data-tono={it.tono}>{it.v}</span>
          {it.nota && <span className="n">{it.nota}</span>}
        </div>
      ))}
    </div>
  )
}

export function Boton({ children, tipo, onClick, disabled, title }: {
  children: ReactNode; tipo?: 'principal' | 'suave'; onClick?: () => void; disabled?: boolean; title?: string
}) {
  return (
    <button type="button" className="fx-boton" data-tipo={tipo} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

// Detalle a un clic: panel que entra por la derecha. Se portalea a <body> para
// no quedar atrapado por el transform del Shell.
export function PanelLateral({ abierto, titulo, sub, onCerrar, children }: {
  abierto: boolean; titulo: ReactNode; sub?: ReactNode; onCerrar: () => void; children: ReactNode
}) {
  useEffect(() => {
    if (!abierto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierto, onCerrar])
  if (!abierto) return null
  return createPortal(
    <div data-ui="nuevo" className="portal-flotante">
      <div className="fx-lateral-fondo" onClick={onCerrar} />
      <aside className="fx-lateral" role="dialog" aria-modal="true">
        <div className="fx-lateral-cab">
          <div>
            <h3 className="fx-subtitulo">{titulo}</h3>
            {sub && <div className="fx-texto-3" style={{ marginTop: 4 }}>{sub}</div>}
          </div>
          <Boton tipo="suave" onClick={onCerrar}>Cerrar</Boton>
        </div>
        <div className="fx-lateral-cuerpo">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}
