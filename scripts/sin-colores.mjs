// Revisa que ningún .css de la app tenga colores escritos a mano: todo sale de
// src/ui/tokens.css. (El lint cubre los .ts/.tsx; esto cubre los estilos.)
//   node scripts/sin-colores.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PERMITIDOS = ['src/ui/tokens.css', 'src/components/AuthShell.css', 'src/screens/Login.css', 'src/components/Forma3D.css', 'src/components/SpaceTransition.css']
const hex = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/
const malos = []
const recorrer = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) recorrer(p)
    else if (p.endsWith('.css') && !PERMITIDOS.includes(p)) {
      readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (hex.test(l)) malos.push(`${p}:${i + 1}: ${l.trim()}`) })
    }
  }
}
recorrer('src')
if (malos.length) { console.log(malos.join('\n')); console.log(`\n${malos.length} colores escritos a mano. Usa var(--fx-…).`); process.exit(1) }
console.log('Sin colores escritos a mano en los .css.')
