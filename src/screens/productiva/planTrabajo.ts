import { numeroActividad } from './types'
import type { PlanTrabajo } from './types'

// Modelo del plan de trabajo que edita PlanTrabajoEditor, y su conversión
// a/desde el PlanTrabajo en texto libre que persiste el backend.

// ─── Estado del plan (lo que edita el instructor) ────────────────────────────
// Cada evidencia cuelga de su actividad; el `id` solo sirve de key en React.

export interface ItemPlan { id: string; texto: string }
export interface ActividadPlan { id: string; texto: string; evidencias: ItemPlan[] }
export interface PlanEstado { competencias: ItemPlan[]; resultados: ItemPlan[]; actividades: ActividadPlan[] }

let seq = 0
export const nid = () => `p${++seq}`

export function planDesdeGuardado(p: PlanTrabajo | null | undefined): PlanEstado {
  const actividades: ActividadPlan[] = []
  const porNumero = new Map<number, ActividadPlan>()
  for (const l of p?.actividades ?? []) {
    const a: ActividadPlan = { id: nid(), texto: quitarNum(l), evidencias: [] }
    const n = numeroActividad(l)
    if (n != null) porNumero.set(n, a)
    actividades.push(a)
  }
  // Evidencias sin número (escritas a mano antes): quedan en la última actividad.
  for (const l of p?.evidencias ?? []) {
    const n = numeroActividad(l)
    let dueña = n != null ? porNumero.get(n) : undefined
    if (!dueña) {
      dueña = actividades[actividades.length - 1]
      if (!dueña) { dueña = { id: nid(), texto: '', evidencias: [] }; actividades.push(dueña) }
    }
    dueña.evidencias.push({ id: nid(), texto: quitarNum(l) })
  }
  return {
    competencias: (p?.competencias ?? []).map(texto => ({ id: nid(), texto })),
    resultados: (p?.resultados_aprendizaje ?? []).map(texto => ({ id: nid(), texto })),
    actividades,
  }
}

export function planAGuardar(p: PlanEstado): PlanTrabajo {
  const limpio = (s: string) => s.replace(/\s+/g, ' ').trim()
  const actividades: string[] = []
  const evidencias: string[] = []
  let n = 0
  for (const a of p.actividades) {
    const t = limpio(a.texto)
    if (!t) continue
    n++
    actividades.push(`A${n}. ${t}`)
    for (const e of a.evidencias) { const te = limpio(e.texto); if (te) evidencias.push(`A${n}. ${te}`) }
  }
  return {
    competencias: p.competencias.map(c => limpio(c.texto)).filter(Boolean),
    resultados_aprendizaje: p.resultados.map(r => limpio(r.texto)).filter(Boolean),
    actividades,
    evidencias,
  }
}

/** Lo que el formato exige del plan, por campo. */
export function erroresPlan(p: PlanEstado): { competencias?: string; actividades?: string; evidencias?: string } {
  const out: { competencias?: string; actividades?: string; evidencias?: string } = {}
  if (!p.competencias.some(c => c.texto.trim())) out.competencias = 'El plan se concierta sobre las competencias del programa.'
  const acts = p.actividades.filter(a => a.texto.trim())
  if (acts.length === 0) out.actividades = 'Sin actividades no hay nada que evaluar después.'
  const sinEv = acts.filter(a => !a.evidencias.some(e => e.texto.trim())).length
  if (sinEv > 0) out.evidencias = `${sinEv} actividad${sinEv === 1 ? '' : 'es'} sin evidencia: cada una debe generar al menos una.`
  return out
}

// ─── Plan guardado, agrupado para leerlo ─────────────────────────────────────
// El texto guardado trae su estructura: la competencia empieza por su código
// de norma, el RA termina con él, y actividades y evidencias comparten el
// prefijo "A1.". Lo usan PlanTrabajoVista y la vista previa del reporte; lo
// que no siga ese patrón (texto escrito a mano) queda suelto.

export interface Comp { codigo: string | null; nombre: string }
export interface Ra { numero: string | null; texto: string; codigo: string | null }

const RE_COMP = /^(\d{6,})\s*-\s*(.+)$/
const RE_RA = /^(\d{1,3})\s*-\s*(.+?)\s*-\s*(\d{6,})$/
const quitarNum = (l: string) => l.replace(/^A\d+\.\s*/, '')

function leerComp(t: string): Comp {
  const m = RE_COMP.exec(t.trim())
  return m ? { codigo: m[1], nombre: m[2] } : { codigo: null, nombre: t.trim() }
}

function leerRa(t: string): Ra {
  const m = RE_RA.exec(t.trim())
  return m ? { numero: m[1], texto: m[2], codigo: m[3] } : { numero: null, texto: t.trim(), codigo: null }
}

/** El plan agrupado: competencias con sus RA, actividades con sus evidencias.
 *  Lo usan esta vista y la vista previa del reporte. */
export function estructurarPlan(plan: PlanTrabajo | null | undefined) {
  const comps = (plan?.competencias ?? []).map(leerComp)
  const ras = (plan?.resultados_aprendizaje ?? []).map(leerRa)

  // Cada RA bajo la competencia de su norma; los que no casan van aparte.
  const grupos = comps.map(c => ({ comp: c as Comp | null, ras: ras.filter(r => r.codigo && r.codigo === c.codigo) }))
  const sueltos = ras.filter(r => !r.codigo || !comps.some(c => c.codigo === r.codigo))
  if (sueltos.length) grupos.push({ comp: null, ras: sueltos })

  // El RA ya trae su número de conteo (lo pone el editor); si no lo trae
  // (texto escrito a mano), se numera en el orden en que se muestra.
  let n = 0
  const numerados = grupos.map(g => ({ ...g, ras: g.ras.map(r => ({ ...r, i: ++n })) }))

  // Evidencias bajo su actividad por el prefijo "A1."; sin prefijo, a la última.
  const acts = (plan?.actividades ?? []).map(l => ({ num: numeroActividad(l), texto: quitarNum(l), evs: [] as string[] }))
  for (const l of plan?.evidencias ?? []) {
    const k = numeroActividad(l)
    const dueña = (k != null ? acts.find(a => a.num === k) : undefined) ?? acts[acts.length - 1]
    if (dueña) dueña.evs.push(quitarNum(l))
  }
  const nEv = acts.reduce((s, a) => s + a.evs.length, 0)

  return { comps, ras, grupos: numerados, acts, nEv }
}
