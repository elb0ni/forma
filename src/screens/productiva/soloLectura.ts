import { createContext, useContext } from 'react'

// ─── Modo solo lectura del detalle de una etapa productiva ───────────────────
// El coordinador puede ver una etapa (desde Fichas o el detalle de un
// instructor) pero no registrar, editar, firmar, agendar ni revisar nada: eso
// es del instructor y del super admin. EtapaProductivaDetalle lo provee según
// el rol y cada pestaña/bloque con acciones lo consulta aquí, en vez de pasar
// la bandera por todas las props. El backend lo refuerza con @Roles.
export const SoloLecturaCtx = createContext(false)

export function useSoloLectura(): boolean {
  return useContext(SoloLecturaCtx)
}
