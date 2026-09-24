import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { Ic } from '../../components/ui'
import { nid } from './planTrabajo'
import type { PlanEstado, ActividadPlan, ItemPlan } from './planTrabajo'

// ─── Plan de trabajo del Momento 1, asistido por el diseño curricular ────────
// El plan de trabajo se concierta sobre las competencias del programa.
// Escribirlo a mano invita a que cada instructor lo redacte distinto y a que
// no corresponda al diseño real. Por eso cada campo del plan (competencia, RA,
// actividad, evidencia) es un buscador: al escribir, sugiere solo lo de ese
// tipo que trae el diseño del programa (lo lee el extractor Python,
// VITE_API_PYTHON, del PDF), priorizando lo que encaja con lo ya elegido:
//   · RA de las competencias que ya están en el plan,
//   · actividades de esos RA,
//   · evidencias de esa misma actividad.
//
// El diseño ya trae la cadena completa, sin inventar nada:
//   RA -> conocimientos de proceso (acciones)      = actividades
//      -> criterios de evaluación (lo que se mide) = evidencias
// Al elegir una actividad del diseño entran sus evidencias; al elegir un RA
// entra su competencia si faltaba. Todo sigue siendo texto editable, y un
// programa sin PDF cargado no bloquea: los campos se escriben a mano.

const API_PY = import.meta.env.VITE_API_PYTHON as string | undefined

interface ActividadDis { texto: string; evidencias: string[] }
interface RA { numero: string; descripcion: string; etiqueta: string; actividades: ActividadDis[] }
interface CompetenciaDis {
  codigo_norma: string
  nombre: string
  enunciado: string
  tipo: string
  etiqueta: string
  resultados_aprendizaje: RA[]
}
interface Diseno {
  programa: { nombre: string; codigo: string; version: string }
  competencias: CompetenciaDis[]
}

// Una sugerencia: el texto que se pone en el campo, una línea de contexto y
// cuánto encaja con lo ya elegido en el plan (se ordena por eso). Un RA lleva
// además su competencia, que entra al plan si faltaba. `titulo` es lo que se
// muestra en la lista cuando no es el mismo texto que entra al campo.
interface Sug { texto: string; titulo?: string; meta?: string; peso: number; competencia?: string }

// "FISICA" -> "Fisica": los nombres del diseño vienen a veces en mayúsculas.
function oracion(s: string): string {
  const t = s.trim()
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t
}

// Los diseños antiguos no traen la norma aparte: su nombre ya es el enunciado.
function tieneNorma(c: CompetenciaDis): boolean {
  return normalizar(c.nombre) !== normalizar(c.enunciado)
}

function nombreCompetencia(c: CompetenciaDis): string {
  return tieneNorma(c) ? `${c.codigo_norma} - ${oracion(c.nombre)}` : c.etiqueta
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Todas las palabras escritas deben aparecer (en cualquier orden).
function filtrar(sugs: Sug[], q: string, yaUsados: Set<string>): Sug[] {
  const ws = normalizar(q).split(/\s+/).filter(w => w.length >= 2)
  const vistos = new Set<string>()
  const out: (Sug & { orden: number })[] = []
  for (const s of sugs) {
    const n = normalizar(s.texto)
    if (yaUsados.has(n) || vistos.has(n)) continue
    const hay = normalizar(`${s.texto} ${s.titulo ?? ''} ${s.meta ?? ''}`)
    if (!ws.every(w => hay.includes(w))) continue
    vistos.add(n)
    out.push({ ...s, orden: s.peso + (ws.length && n.startsWith(ws[0]) ? 1 : 0) })
  }
  return out.sort((a, b) => b.orden - a.orden).slice(0, 8)
}

export function PlanTrabajoEditor({ codigo, version, value, onChange, errores }: {
  codigo?: string
  version?: string | number
  value: PlanEstado
  onChange: (next: PlanEstado) => void
  errores: { competencias?: string; actividades?: string; evidencias?: string }
}) {
  "use no memo"
  const puedeLeer = !!API_PY && !!codigo
  const [diseno, setDiseno] = useState<Diseno | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(puedeLeer)

  useEffect(() => {
    if (!puedeLeer) return
    let vivo = true
    const q = version ? `?version=${version}` : ''
    axios.get<Diseno>(`${API_PY}/api/programa/${codigo}/sugerencias${q}`)
      .then(r => { if (vivo) { setDiseno(r.data); setError(null) } })
      .catch(e => {
        if (!vivo) return
        const detalle = axios.isAxiosError(e) ? (e.response?.data as { detail?: string })?.detail : null
        setError(detalle ?? 'No se pudo conectar con el extractor de diseños curriculares.')
      })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [puedeLeer, codigo, version])

  // ── Contexto: qué del diseño ya está en el plan ──
  const enPlan = (items: { texto: string }[]) => new Set(items.map(i => normalizar(i.texto)).filter(Boolean))
  const compsPlan = enPlan(value.competencias)
  const rasPlan = enPlan(value.resultados)
  const actsPlan = enPlan(value.actividades)

  const todo = diseno?.competencias ?? []
  // Una competencia entra al plan por su nombre; la etiqueta con la norma
  // también cuenta, que es como quedaron los planes guardados antes.
  const esComp = (c: CompetenciaDis, set: Set<string>) =>
    set.has(normalizar(nombreCompetencia(c))) || set.has(normalizar(c.etiqueta))
  const compsElegidas = todo.filter(c => esComp(c, compsPlan))
  const compsValidas = new Set(todo.flatMap(c => [normalizar(nombreCompetencia(c)), normalizar(c.etiqueta)]))
  // Los RA se numeran con un conteo simple sobre todo el programa (1, 2, 3…,
  // sin repetirse entre competencias) y entran al plan con ese número:
  // "5 - Solucionar problemas… - 220201501". El número del RA en la norma
  // (02, 04…) solo se muestra de descripción.
  const numRa = new Map<RA, string>()
  for (const c of todo) for (const ra of c.resultados_aprendizaje) {
    numRa.set(ra, `${numRa.size + 1} - ${ra.descripcion} - ${c.codigo_norma}`)
  }
  const textoRa = (ra: RA) => numRa.get(ra) ?? ra.etiqueta
  // La etiqueta con el número de la norma también cuenta (planes guardados antes).
  const rasElegidos = todo.flatMap(c => c.resultados_aprendizaje)
    .filter(ra => rasPlan.has(normalizar(textoRa(ra))) || rasPlan.has(normalizar(ra.etiqueta)))

  // ── Fuentes de sugerencias por tipo de campo ──
  // La competencia se ve y entra al plan por su nombre ("220201501 - Fisica");
  // la norma queda de descripción.
  const sugCompetencias = (): Sug[] => todo.map(c => {
    const datos = `${c.tipo.toLowerCase()} · ${c.resultados_aprendizaje.length} RA`
    return {
      texto: nombreCompetencia(c),
      meta: tieneNorma(c) ? `${datos} · ${c.enunciado}` : datos,
      peso: c.tipo === 'TRANSVERSAL' ? 0 : 1,
    }
  })

  const sugResultados = (): Sug[] => todo.flatMap(c => c.resultados_aprendizaje.map(ra => ({
    texto: textoRa(ra),
    titulo: textoRa(ra).replace(/\s*-\s*\d+$/, ''),
    meta: `${oracion(c.nombre)} · RA ${ra.numero} de la norma ${c.codigo_norma}`,
    peso: (compsElegidas.includes(c) ? 4 : 0) + (c.tipo === 'TRANSVERSAL' ? 0 : 1),
    competencia: nombreCompetencia(c),
  })))

  const sugActividades = (): Sug[] => todo.flatMap(c => c.resultados_aprendizaje.flatMap(ra => ra.actividades.map(a => ({
    texto: a.texto,
    meta: textoRa(ra),
    peso: (rasElegidos.includes(ra) ? 4 : 0) + (compsElegidas.includes(c) ? 2 : 0),
  }))))

  // Evidencias: primero las que el diseño asocia a esta misma actividad.
  const evidenciasDe = (textoAct: string) => {
    const t = normalizar(textoAct)
    const out: string[] = []
    for (const c of todo) for (const ra of c.resultados_aprendizaje) for (const a of ra.actividades) {
      if (normalizar(a.texto) === t) for (const e of a.evidencias) if (!out.includes(e)) out.push(e)
    }
    return out
  }
  const sugEvidencias = (textoAct: string): Sug[] => {
    const propias = new Set(evidenciasDe(textoAct))
    return todo.flatMap(c => c.resultados_aprendizaje.flatMap(ra => ra.actividades.flatMap(a => a.evidencias.map(e => ({
      texto: e,
      meta: propias.has(e) ? 'De esta actividad' : textoRa(ra),
      peso: (propias.has(e) ? 8 : 0) + (rasElegidos.includes(ra) ? 2 : 0),
    })))))
  }

  // ── Edición ──
  const [enfocar, setEnfocar] = useState<string | null>(null)
  const setActs = (actividades: ActividadPlan[]) => onChange({ ...value, actividades })
  const editarAct = (id: string, f: (a: ActividadPlan) => ActividadPlan) =>
    setActs(value.actividades.map(a => a.id === id ? f(a) : a))
  const moverAct = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= value.actividades.length) return
    const next = [...value.actividades]; [next[i], next[j]] = [next[j], next[i]]
    setActs(next)
  }

  function elegirRA(id: string, s: Sug) {
    const resultados = value.resultados.map(x => x.id === id ? { ...x, texto: s.texto } : x)
    const falta = s.competencia && !compsElegidas.some(c => nombreCompetencia(c) === s.competencia)
    const competencias = falta
      ? [...value.competencias.filter(c => c.texto.trim()), { id: nid(), texto: s.competencia! }]
      : value.competencias
    onChange({ ...value, resultados, competencias })
  }

  // Elegir una actividad del diseño llena sus evidencias (sin pisar las que
  // ya se hayan escrito).
  function elegirActividad(id: string, texto: string) {
    editarAct(id, a => {
      const escritas = a.evidencias.filter(e => e.texto.trim())
      const ya = new Set(escritas.map(e => normalizar(e.texto)))
      const nuevas = evidenciasDe(texto).filter(e => !ya.has(normalizar(e))).map(e => ({ id: nid(), texto: e }))
      return { ...a, texto, evidencias: [...escritas, ...nuevas].length ? [...escritas, ...nuevas] : a.evidencias }
    })
  }

  const conDiseno = !!diseno
  const nEv = value.actividades.reduce((s, a) => s + a.evidencias.length, 0)

  return (
    <div className="pte-plan">
      {puedeLeer && (
        <div className={`pte-estado${error ? ' pte-estado--warn' : ''}`}>
          <Ic n={error ? 'alert' : 'sparkles'} s={12}/>
          {cargando && 'Leyendo el diseño curricular…'}
          {error && `${error} Los campos se llenan a mano.`}
          {diseno && <>Escribe en cada campo y elige una sugerencia de <b>{diseno.programa.nombre}</b>.</>}
        </div>
      )}

      <SeccionLista
        titulo="Competencias a desarrollar" requerido error={errores.competencias}
        items={value.competencias} agregar="Agregar competencia" enfocar={enfocar} setEnfocar={setEnfocar}
        placeholder={conDiseno ? 'Busca una competencia del programa…' : 'Competencia'}
        sugerencias={conDiseno ? sugCompetencias : undefined}
        soloDe={conDiseno ? compsValidas : undefined}
        onChange={items => onChange({ ...value, competencias: items })}
      />
      <SeccionLista
        titulo="Resultados de aprendizaje"
        items={value.resultados} agregar="Agregar resultado" enfocar={enfocar} setEnfocar={setEnfocar}
        placeholder={conDiseno ? 'Busca un resultado de aprendizaje…' : 'Resultado de aprendizaje'}
        sugerencias={conDiseno ? sugResultados : undefined}
        onElegir={elegirRA}
        onChange={items => onChange({ ...value, resultados: items })}
      />

      <section className={`pte-sec${errores.actividades || errores.evidencias ? ' pte-sec--err' : ''}`}>
        <header className="pte-sec__cab">
          <span className="pte-sec__t">Actividades y evidencias<span className="g23-campo__req">*</span></span>
          <span className="pte-sec__n">{value.actividades.length} act. · {nEv} evid.</span>
        </header>
        {value.actividades.length === 0 && <div className="pte-vacio">Cada actividad lleva debajo las evidencias que genera.</div>}
        {value.actividades.map((a, i) => {
          const sinEv = a.texto.trim() && !a.evidencias.some(e => e.texto.trim())
          const usadasAqui = enPlan(a.evidencias)
          return (
            <div key={a.id} className={`pte-act${sinEv ? ' pte-act--err' : ''}`}>
              <div className="pte-fila">
                <span className="pte-num">A{i + 1}</span>
                <Buscador
                  valor={a.texto} autoFocus={enfocar === a.id}
                  placeholder={conDiseno ? 'Busca una actividad…' : 'Actividad'}
                  sugerencias={conDiseno ? sugActividades : undefined}
                  yaUsados={actsPlan}
                  onChange={t => editarAct(a.id, x => ({ ...x, texto: t }))}
                  onElegir={s => elegirActividad(a.id, s.texto)}
                />
                <div className="pte-acc">
                  <button type="button" title="Subir" disabled={i === 0} onClick={() => moverAct(i, -1)}><Ic n="chevronUp" s={13}/></button>
                  <button type="button" title="Bajar" disabled={i === value.actividades.length - 1} onClick={() => moverAct(i, 1)}><Ic n="chevronDown" s={13}/></button>
                  <button type="button" title="Quitar actividad" onClick={() => setActs(value.actividades.filter(x => x.id !== a.id))}><Ic n="x" s={13}/></button>
                </div>
              </div>
              <div className="pte-evs">
                {a.evidencias.map(e => (
                  <div key={e.id} className="pte-fila">
                    <span className="sug-ev__tag">Evidencia</span>
                    <Buscador
                      valor={e.texto} autoFocus={enfocar === e.id}
                      placeholder={conDiseno ? 'Busca una evidencia…' : 'Evidencia'}
                      sugerencias={conDiseno ? () => sugEvidencias(a.texto) : undefined}
                      yaUsados={usadasAqui}
                      onChange={t => editarAct(a.id, x => ({ ...x, evidencias: x.evidencias.map(y => y.id === e.id ? { ...y, texto: t } : y) }))}
                    />
                    <div className="pte-acc">
                      <button type="button" title="Quitar evidencia" onClick={() => editarAct(a.id, x => ({ ...x, evidencias: x.evidencias.filter(y => y.id !== e.id) }))}><Ic n="x" s={13}/></button>
                    </div>
                  </div>
                ))}
                <button type="button" className="pte-add pte-add--min" onClick={() => {
                  const ev = { id: nid(), texto: '' }
                  editarAct(a.id, x => ({ ...x, evidencias: [...x.evidencias, ev] })); setEnfocar(ev.id)
                }}>
                  <Ic n="plus" s={12}/> Evidencia
                </button>
              </div>
            </div>
          )
        })}
        <button type="button" className="pte-add" onClick={() => {
          const a: ActividadPlan = { id: nid(), texto: '', evidencias: [] }
          setActs([...value.actividades, a]); setEnfocar(a.id)
        }}>
          <Ic n="plus" s={12}/> Agregar actividad
        </button>
        {(errores.actividades || errores.evidencias) && (
          <div className="pte-err">{errores.actividades ?? errores.evidencias}</div>
        )}
      </section>
    </div>
  )
}

// Con `soloDe`, el campo solo acepta valores de esa lista: lo que se elige
// queda fijo (solo se puede quitar) y lo escrito sin elegir se borra al salir.
function SeccionLista({ titulo, requerido, error, items, agregar, placeholder, enfocar, setEnfocar, sugerencias, soloDe, onElegir, onChange }: {
  titulo: string; requerido?: boolean; error?: string
  items: ItemPlan[]; agregar: string; placeholder: string
  enfocar: string | null; setEnfocar: (id: string) => void
  sugerencias?: () => Sug[]
  soloDe?: Set<string>
  onElegir?: (id: string, s: Sug) => void
  onChange: (items: ItemPlan[]) => void
}) {
  const usados = new Set(items.map(i => normalizar(i.texto)).filter(Boolean))
  return (
    <section className={`pte-sec${error ? ' pte-sec--err' : ''}`}>
      <header className="pte-sec__cab">
        <span className="pte-sec__t">{titulo}{requerido && <span className="g23-campo__req">*</span>}</span>
        <span className="pte-sec__n">{items.length}</span>
      </header>
      {items.map(it => (
        <div key={it.id} className="pte-fila">
          {soloDe?.has(normalizar(it.texto)) ? (
            <span className="pte-fijo">{it.texto}</span>
          ) : (
            <Buscador
              valor={it.texto} placeholder={placeholder} autoFocus={enfocar === it.id}
              sugerencias={sugerencias} yaUsados={usados}
              onChange={t => onChange(items.map(x => x.id === it.id ? { ...x, texto: t } : x))}
              onElegir={onElegir ? s => onElegir(it.id, s) : undefined}
              onSalir={soloDe ? () => onChange(items.map(x => x.id === it.id ? { ...x, texto: '' } : x)) : undefined}
            />
          )}
          <div className="pte-acc">
            <button type="button" title="Quitar" onClick={() => onChange(items.filter(x => x.id !== it.id))}><Ic n="x" s={13}/></button>
          </div>
        </div>
      ))}
      <button type="button" className="pte-add" onClick={() => {
        const it = { id: nid(), texto: '' }
        onChange([...items, it]); setEnfocar(it.id)
      }}>
        <Ic n="plus" s={12}/> {agregar}
      </button>
      {error && <div className="pte-err">{error}</div>}
    </section>
  )
}

// ─── Campo con buscador ──────────────────────────────────────────────────────
// Texto que crece con el contenido. Si hay `sugerencias`, al enfocar o escribir
// despliega las que coinciden; flechas + Enter eligen, Esc cierra. La lista se
// pinta en un portal porque los bloques del formato recortan su contenido.

function Buscador({ valor, placeholder, autoFocus, sugerencias, yaUsados, onChange, onElegir, onSalir }: {
  valor: string; placeholder: string; autoFocus?: boolean
  sugerencias?: () => Sug[]
  yaUsados?: Set<string>
  onChange: (v: string) => void
  onElegir?: (s: Sug) => void
  /** Al perder el foco sin haber elegido una sugerencia. */
  onSalir?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const elegido = useRef(false)
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [valor])
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])

  // Las propias del campo no cuentan como "ya usadas".
  const lista = useMemo(() => {
    if (!abierto || !sugerencias) return []
    const usados = new Set(yaUsados)
    usados.delete(normalizar(valor))
    return filtrar(sugerencias(), valor, usados)
  }, [abierto, sugerencias, valor, yaUsados])

  const visible = abierto && lista.length > 0

  useLayoutEffect(() => {
    if (!visible) return
    const medir = () => {
      const r = ref.current?.getBoundingClientRect()
      if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 320) })
    }
    medir()
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)
    return () => { window.removeEventListener('scroll', medir, true); window.removeEventListener('resize', medir) }
  }, [visible, valor])

  function elegir(s: Sug) {
    elegido.current = true
    onChange(s.texto)
    onElegir?.(s)
    setAbierto(false)
  }

  return (
    <>
      <textarea
        ref={ref}
        rows={1}
        className="pte-txt"
        value={valor}
        placeholder={placeholder}
        onFocus={() => { setAbierto(true); setActivo(0) }}
        onBlur={() => { setAbierto(false); if (!elegido.current && valor.trim()) onSalir?.() }}
        onChange={e => { elegido.current = false; onChange(e.target.value.replace(/\n/g, ' ')); setAbierto(true); setActivo(0) }}
        onKeyDown={e => {
          if (!visible) {
            if (e.key === 'Enter') e.preventDefault()
            return
          }
          if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(i => (i + 1) % lista.length) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(i => (i - 1 + lista.length) % lista.length) }
          else if (e.key === 'Enter') { e.preventDefault(); elegir(lista[Math.min(activo, lista.length - 1)]) }
          else if (e.key === 'Escape') { e.preventDefault(); setAbierto(false) }
        }}
      />
      {visible && pos && createPortal(
        <div className="pte-sug portal-flotante" style={{ left: pos.left, top: pos.top, width: pos.width }}>
          {lista.map((s, i) => (
            <button
              key={s.texto}
              type="button"
              className={`pte-sug__it${i === activo ? ' pte-sug__it--on' : ''}`}
              // mousedown en vez de click: se elige antes de que el blur la cierre.
              onMouseDown={e => { e.preventDefault(); elegir(s) }}
              onMouseEnter={() => setActivo(i)}
            >
              <span className="pte-sug__t">{s.titulo ?? s.texto}</span>
              {s.meta && <span className="pte-sug__m">{s.meta}</span>}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
