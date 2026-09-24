// Filtros compartidos por Fichas y Programas de formación: la barra (buscador +
// botón), el panel desplegable con grupos de opciones y la línea de resumen,
// más el encabezado de tabla ordenable con clic (asc/desc).
// Estilos en shared/filtros.css. El estado vive en cada pantalla; esto es UI.
import { Ic } from '../../components/ui'
import type { IcName } from '../../components/ui'

export type SortDir = 'asc' | 'desc'

// Flechita dentro de un <th> ordenable: tenue si la columna no es la activa,
// sólida y apuntando según la dirección cuando sí lo es.
export function SortCaret({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span
      className="ff-sort-caret"
      aria-hidden
      style={{
        opacity: active ? 1 : 0.25,
        transform: active && dir === 'asc' ? 'rotate(180deg)' : 'none',
      }}
    >
      <Ic n="chevronDown" s={11}/>
    </span>
  )
}

export interface FiltroOpcion { key: string; label: string; hint?: string; count?: number }

// Grupo del panel: lista de opciones excluyentes (una columna del panel) con el
// conteo de resultados que dejaría cada una. `value === ''` = opción "todas".
export function FiltroGrupo({ title, icon, options, value, onPick }: {
  title: string; icon: IcName; options: FiltroOpcion[]
  value: string; onPick: (key: string) => void
}) {
  return (
    <div className="ff-group">
      <div className="ff-group__title"><Ic n={icon} s={12}/>{title}</div>
      <div className="ff-list">
        {options.map(o => {
          const on = o.key === value
          return (
            <button
              key={o.key || '__all'}
              type="button"
              onClick={() => onPick(o.key)}
              className={`ff-opt${on ? ' ff-opt--on' : ''}`}
            >
              <span className="ff-opt__mark">{on && <Ic n="check" s={10}/>}</span>
              <span className="ff-opt__body">
                <span className="ff-opt__label">{o.label}</span>
                {o.hint && <span className="ff-opt__hint">{o.hint}</span>}
              </span>
              {o.count != null && <span className="ff-opt__count">{o.count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Barra: buscador siempre visible + botón que despliega el panel.
export function FiltrosBar({ search, onSearch, placeholder, activeCount, open, onToggle }: {
  search: string; onSearch: (v: string) => void; placeholder: string
  activeCount: number; open: boolean; onToggle: () => void
}) {
  return (
    <div className="ff-bar">
      <div className="ff-search">
        <span className="ff-search__icon"><Ic n="search" s={15}/></span>
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder={placeholder}/>
        {search && (
          <button className="ff-search__clear" onClick={() => onSearch('')} aria-label="Limpiar búsqueda">
            <Ic n="x" s={12}/>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`ff-trigger${activeCount ? ' ff-trigger--active' : ''}${open ? ' ff-trigger--open' : ''}`}
      >
        <Ic n="filter" s={14}/>
        Filtros
        {activeCount > 0 && <span className="ff-trigger__badge">{activeCount}</span>}
        <Ic n="chevronDown" s={13} className="ff-trigger__chev"/>
      </button>
    </div>
  )
}

// Línea de resumen que se muestra con el panel cerrado y algún filtro activo.
export function FiltrosResumen({ items, onClear }: { items: string[]; onClear: () => void }) {
  if (items.length === 0) return null
  return (
    <div className="ff-summary">
      <span className="ff-summary__lead"><Ic n="filter" s={11}/> Filtrando por</span>
      <span className="ff-summary__text">{items.join('   ·   ')}</span>
      <button className="ff-summary__clear" onClick={onClear}>Limpiar</button>
    </div>
  )
}
