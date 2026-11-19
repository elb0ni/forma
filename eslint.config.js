import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Cada carpeta de rol (superadmin/coordinador/instructor) solo puede depender de
// sí misma, de screens/shared o de components/ — nunca de otra carpeta de rol.
// Evita que vuelva a colarse el acoplamiento cruzado que tenía el proyecto antes
// de separar las vistas por rol.
function roleBoundary(ownFolder, otherFolders) {
  return {
    files: [`src/screens/${ownFolder}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: otherFolders.map(folder => ({
          group: [`**/screens/${folder}/*`, `../${folder}/*`, `../../${folder}/*`],
          message: `Las vistas de "${ownFolder}" no deben importar de "${folder}". Si es código compartido, muévelo a screens/shared.`,
        })),
      }],
    },
  }
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  roleBoundary('superadmin', ['coordinador', 'instructor']),
  roleBoundary('coordinador', ['superadmin', 'instructor']),
  roleBoundary('instructor', ['superadmin', 'coordinador']),
  // Rediseño: ningún color escrito a mano en el sistema nuevo. Todo sale de
  // src/ui/tokens.css (var(--fx-*)), para que la paleta y el modo oscuro sean uno solo.
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/screens/expediente/**/*.{ts,tsx}', 'src/screens/hoy/**/*.{ts,tsx}', 'src/screens/panorama/**/*.{ts,tsx}', 'src/screens/publico/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'Literal[value=/#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\\b|rgba?\\(/]',
        message: 'Usa los colores de src/ui/tokens.css (var(--fx-…)), no colores escritos a mano.',
      }],
    },
  },
])
