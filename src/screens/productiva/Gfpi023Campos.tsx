import type { ReactNode } from 'react'
import { Ic } from '../../components/ui'
import './gfpi023.css'

// ─── Piezas del formulario GFPI-F-023 ────────────────────────────────────────
// Dos estados posibles para un dato del formato: o FORMA ya lo sabe (y se
// muestra bloqueado, apagado, con candado) o hay que diligenciarlo (y va en
// blanco, con contraste). Esa diferencia es la que hace legible el formulario:
// de un vistazo se ve qué falta sin leer etiqueta por etiqueta.

const TIPO_DOC_LABEL: Record<string, string> = {
  CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad', PP: 'Pasaporte',
}

// Encabezado del documento. Es el mismo en la creación y en el detalle a
// propósito: el instructor debe reconocer que está en el mismo formato, no en
// dos pantallas distintas que casualmente piden lo mismo.
export function Gfpi023Head({ nombre, tipoDocumento, documento, ficha, pct }: {
  nombre: string
  tipoDocumento?: string | null
  documento?: string | null
  ficha?: string | null
  pct: number
}) {
  const sub = [
    documento ? `${TIPO_DOC_LABEL[tipoDocumento ?? ''] ?? tipoDocumento ?? 'Doc.'} ${documento}` : null,
    ficha ? `Ficha ${ficha}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="g23-head">
      <div style={{ minWidth: 0 }}>
        <div className="g23-head__codigo">GFPI-F-023 V6 · INFORMACIÓN GENERAL</div>
        <div className="g23-head__t">{nombre}</div>
        {sub && <div className="g23-head__sub">{sub}</div>}
      </div>
      <div className="g23-prog">
        <div style={{ textAlign: 'right' }}>
          <div className="g23-prog__n">{pct}%</div>
          <div className="g23-prog__l">diligenciado</div>
        </div>
      </div>
    </div>
  )
}

// `medio`: bloque corto que, con la pantalla libre (sin vista previa), se
// acomoda al lado de otro en vez de ocupar una fila entera.
export function Bloque({ n, titulo, origen, cols, medio, children }: {
  n: number
  titulo: string
  origen?: string
  cols?: 2 | 3
  medio?: boolean
  children: ReactNode
}) {
  const bloqueado = !!origen
  return (
    <section className={`g23-bloque${bloqueado ? ' g23-bloque--lock' : ''}${medio ? ' g23-bloque--medio' : ''}`}>
      <header className="g23-bloque__head">
        <span className="g23-bloque__n">{n}</span>
        <span className="g23-bloque__t">{titulo}</span>
        {origen && (
          <span className="g23-bloque__tag">
            <Ic n="lock" s={10}/> {origen}
          </span>
        )}
      </header>
      <div className={`g23-bloque__body${cols === 3 ? ' g23-bloque__body--3' : ''}`}>
        {children}
      </div>
    </section>
  )
}

export function Campo({ label, required, ancho, error, children }: {
  label: string
  required?: boolean
  ancho?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <label className={`g23-campo${ancho ? ' g23-col2' : ''}${error ? ' g23-campo--err' : ''}`}>
      <span className="g23-campo__l">
        {label}
        {required && <span className="g23-campo__req">*</span>}
      </span>
      {children}
      {error && <span className="g23-campo__err">{error}</span>}
    </label>
  )
}

// Aviso dentro de un bloque: explica de dónde sale un dato que falta, en vez
// de dejar un "Sin registrar" mudo que el instructor no sabe cómo resolver.
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <span className="g23-aviso g23-col2">
      <Ic n="info" s={13} style={{ color: '#a16207', flexShrink: 0 }}/>
      <span>{children}</span>
    </span>
  )
}

// Dato que ya tiene el sistema. No es un input deshabilitado a propósito:
// un input gris invita a hacer click y frustra; esto se lee como una ficha.
export function Dato({ valor, mono, ancho }: {
  valor: string | null | undefined
  mono?: boolean
  ancho?: boolean
}) {
  const vacio = !valor
  return (
    <span
      className={`g23-lock${vacio ? ' g23-lock--vacio' : ''}${mono && !vacio ? ' g23-mono' : ''}${ancho ? ' g23-col2' : ''}`}
      title={valor ?? undefined}
    >
      <Ic n="lock" s={11} className="g23-lock__ic"/>
      {valor ?? 'Sin registrar'}
    </span>
  )
}

// Igual que `Dato` pero para texto de varias líneas (plan de trabajo,
// observaciones): conserva los saltos y no trunca.
export function DatoLargo({ valor, ancho }: { valor: string | null | undefined; ancho?: boolean }) {
  const vacio = !valor?.trim()
  return (
    <span className={`g23-largo${vacio ? ' g23-largo--vacio' : ''}${ancho ? ' g23-col2' : ''}`}>
      {vacio ? 'Sin diligenciar' : valor}
    </span>
  )
}
