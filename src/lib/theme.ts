// Tema claro/oscuro. La preferencia se guarda en el navegador (localStorage) y se
// aplica como atributo data-theme en <html>, y los tokens de src/ui/tokens.css
// cambian de valor (modo oscuro real, sin invertir la pantalla).

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
