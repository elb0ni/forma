// Tema claro/oscuro. La preferencia se guarda en el navegador (localStorage) y se
// aplica como atributo data-theme en <html>. El modo oscuro se logra con un filtro
// de inversión global (la app usa muchos colores inline), re-invirtiendo imágenes
// y firmas para que se vean correctas. Ver reglas en index.css.

export type Theme = 'light' | 'dark'

const KEY = 'forma-theme'

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem(KEY, theme) } catch { /* almacenamiento no disponible */ }
}
