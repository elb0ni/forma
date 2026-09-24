// Helpers de entrada compartidos entre components/ y screens/. Vive en lib/
// para que ninguna de las dos capas dependa de la otra.

// Deja solo dígitos. Se usa en teléfonos y NIT: son identificadores numéricos,
// y filtrar al escribir evita tener que validar (y rechazar) después.
//
// Nota: el NIT colombiano suele escribirse con el dígito de verificación
// separado por guion (900123456-7). Aquí se descarta el guion; si más adelante
// se necesita guardar el DV, hay que decidir si va en esta misma columna o en
// una aparte, no reabrir el filtro a cualquier carácter.
export function soloDigitos(v: string, max = 20): string {
  return v.replace(/\D/g, '').slice(0, max)
}
