// Ámbito de trabajo (PLAN_REDISENO v3, Fase 14): centro y coordinación que se
// eligen una vez, arriba, y aplican a Inicio, Fichas, Asignación y Equipo.
// Se recuerda durante la sesión del navegador. El backend acota igual por
// alcance: elegir aquí nunca amplía lo que un rol puede ver.
import { create } from 'zustand'

interface AmbitoStore {
  centroId: number | null
  coordId: number | null
  setCentro: (id: number | null) => void
  setCoord: (id: number | null) => void
}

const KEY = 'forma-ambito'
function leer(): { centroId: number | null; coordId: number | null } {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (v && typeof v === 'object') return { centroId: v.centroId ?? null, coordId: v.coordId ?? null }
  } catch { /* sin almacenamiento */ }
  return { centroId: null, coordId: null }
}
function guardar(v: { centroId: number | null; coordId: number | null }) {
  try { sessionStorage.setItem(KEY, JSON.stringify(v)) } catch { /* sin almacenamiento */ }
}

export const useAmbito = create<AmbitoStore>((set, get) => ({
  ...leer(),
  setCentro: (id) => { const v = { centroId: id, coordId: null }; guardar(v); set(v) },
  setCoord: (id) => { const v = { centroId: get().centroId, coordId: id }; guardar(v); set(v) },
}))
