# FORMA — mapa del sistema

Plataforma web para el **seguimiento a la etapa productiva** del aprendiz SENA (Regional Atlántico).
Digitaliza el formato oficial **GFPI-F-023 V06** (planeación → seguimientos → evaluación) y las
bitácoras **GFPI-F-147**. Esta carpeta (el front) es la carpeta principal de trabajo: desde aquí se
atienden peticiones de todo el sistema. El acceso a los otros repos está en `.claude/settings.local.json`.

## Repos y piezas

| Pieza | Ruta | Stack | Rama de trabajo |
|---|---|---|---|
| Front (este repo) | `~/Desktop/Proyectos/Javascript/forma` | React 19 + Vite + TS, react-router 7, zustand, axios, react-hook-form + zod, three.js (fondo 3D del login) | `refactor/solo-etapa-productiva` |
| Back | `~/Desktop/Proyectos/Javascript/forma_server` | NestJS 11, `mysql2/promise` **sin ORM** (servicios extienden `BaseService`), JWT en cookies httpOnly, nodemailer, exceljs | `forma-practica` |
| Extractor IA | `~/Desktop/Proyectos/Python/forma_digitalizer` | FastAPI + sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`) + `pdftotext` | `main` |
| Scraper de juicios | `~/Desktop/Proyectos/Python/reporte_juicios` | Python + Playwright → `POST /api/juicios/*` con `x-api-key` | solo local |
| Datos | `~/Desktop/Proyectos/Data/forma` | Catálogos Excel (`catalogos/`, espejo automático del back), PE-04, scripts de carga | — |

Flujo: Front → Back (`VITE_API_DB`, prefijo `/api`) y Front → Python **directo** (`VITE_API_PYTHON`) para
sugerir competencias/RA y gestionar diseños. El Back lee el PE-04 de SofiaPlus (subido por el super
admin) y recibe los juicios del scraper. La BD es MariaDB **remota** (`DB_NAME=tesoros_forma_dev`)
y, desde el 2026-10-01, sus datos son **reales**.

## Roles
- `SUPER_ADMIN` (dirección regional): todo.
- `COORD_ACADEMICO`: lee su coordinación; solo escribe asignaciones de instructor y alertas.
- `INSTRUCTOR`: sus fichas/etapas; registra momentos, firmas y visitas.
- Sin cuenta: **aprendiz** (portal público `/bitacoras` con documento + código de 6 dígitos por correo)
  y **ente co-formador** (firma en la app). "No todos entran a FORMA, pero todos quedan en FORMA".

## Modo pruebas (el único que Claude enciende)
- `npm run pruebas` / `npm run pruebas:apagar` / `npm run pruebas:estado` (desde `forma/`; por debajo, `scripts/pruebas.sh`). Enciende la base local en Docker (`forma-pruebas-db`, 127.0.0.1:3307, copia de la real del 2026-11-18), Mailpit (`forma-pruebas-mail`, web en http://localhost:8025), el back en **:3000** (`npm run start:pruebas`, con `forma_server/.env.pruebas`), el extractor de IA en :8000 y el front en **:5173** (`npm run dev:pruebas`). Usa los mismos puertos que el modo real (decisión del usuario, 2026-11-20): no pueden estar encendidos a la vez, y `npm run pruebas` se niega si los puertos están ocupados.
- En la copia, los correos están cambiados por `@prueba.forma.local` y el catálogo incompleto se llenó con reglas marcadas `[PRUEBA]` (`catalogo_coordinacion.coordinador_nombre`).
- Usuarios de prueba, contraseña `Pruebas2026!`: `admin@`, `subdirector@` (Industrial), `coordinador@` e `instructor@` (Tecnología e Innovación de Industrial), todos `@prueba.forma.local`.
- Pruebas contra el modo pruebas (desde `forma_server/`, correrlas después de tocar la API):
  - `node scripts/prueba-flujo.mjs` (flujo de punta a punta) y luego `node scripts/prueba-bitacoras.mjs` (ciclo de la bitácora; usa la etapa que crea la anterior);
  - `node scripts/prueba-alcance.mjs` (permisos por rol), `node scripts/prueba-capacidad.mjs` (cupos y asignación), `node scripts/prueba-asignar.mjs` (las formas de asignar y las solicitudes) y `node scripts/prueba-panorama.mjs` (panoramas y catálogo del centro);
  - `node scripts/prueba-ingesta.mjs` (robot de juicios contra la base de pruebas).
  Todas dejan la base como estaba, salvo flujo/bitácoras, que agregan una etapa de prueba. Antes de escribir, cada una confirma que el back de :3000 es el de pruebas (`scripts/solo-pruebas.mjs`).
- Permisos: todo pasa por `forma_server/src/common/alcance.ts` y `alcance.service.ts`. Un endpoint nuevo que reciba ids debe llamar a `AlcanceService`, y uno que liste debe usar `forzarFiltros`. Lo que el subdirector no debe tocar se marca con `@SoloRegional()`.
- Para conectarse a la base local: `mariadb -h127.0.0.1 -P3307 -uroot -pforma_pruebas_root --skip-ssl forma_pruebas`.

## Reglas de oro
- **Nunca encender el modo real** (el `.env` normal apunta a la BD remota con datos reales). Lo enciende solo el usuario. Claude usa solo el modo pruebas.
- **No correr `forma_server/src/usuario/migracion-roles.sql`**: borraría el rol SUBDIRECTOR.
- La BD remota no tiene TLS: el cliente `mariadb` necesita `--skip-ssl`.
- **Nunca `git stash` / `checkout` / `reset`**: hay mucho trabajo sin commitear en front y back.
- No commitear ni pushear sin que el usuario lo pida.
- No mandar correos al probar. Borrados destructivos en BD → entregar script al usuario.
- No imprimir valores del `.env`.

## Verificación
- Front: `npx tsc -b --force`, `npx eslint .`, `npm run build` (ejecutar desde este directorio).
- Back: `npx --no-install tsc --noEmit` y `npx eslint "src/**/*.ts"` (**sin** `npm run lint`, que trae `--fix`); `npx jest`.
- Python: no levantar uvicorn; basta revisar sintaxis e imports con `venv/bin/python`.
- Smoke test de render sin backend: ver la memoria `forma-verificacion-workflow`.

## Pantallas del rediseño (rama `rediseno/flujo-instructor`)
- Sistema visual en `src/ui/` (tokens, `Lienzo`, `Frase`, `Estado`, `Panel`, `PanelLateral`, `LineaEtapa`, `LineaMini`). Sin colores sueltos: lo impide el lint en `src/ui`, `screens/expediente`, `screens/hoy`, `screens/panorama` y `screens/publico`.
- **Versión 3 (blanco + morado FORMA):** los tokens viven en `:root` (`src/ui/tokens.css`) para toda la app; modo oscuro real (sin invertir); ningún color escrito a mano en `src/` (lint) ni en los `.css` (`node scripts/sin-colores.mjs`), salvo el login.
- Instructor: **Hoy** (con vista Calendario, `?vista=calendario`) y **Aprendices** (`screens/hoy`), **Expediente** (`screens/expediente`, reutiliza formularios de `EtapaProductivaDetalle`). Menú (Fase 19): Hoy, Aprendices (con "Por registrar" y "Pedir una ficha"), Bitácoras (bandeja), Calendario (con "Por agendar") y Reportes.
- Coordinación, subdirección y regional: **Inicio** (`panorama/Panorama.tsx`: une el Dashboard y el Panorama), **Asignación** (con `AsignarPanel`: ficha, aprendices sueltos, repartir; solicitudes; liberar), **Equipo** (`panorama/Equipo.tsx`) y **SofiaPlus y datos** (`Datos`). Ámbito "Viendo" arriba (`store/ambito.ts`, `components/Ambito.tsx`) y buscador (`components/Buscador.tsx`, `/buscar`).
- Back: módulos `capacidad`, `panorama`, `asignar` (migración `src/asignar/migracion-asignar.sql`: `solicitud_ficha` y `asignacion_practica.asignada_por`) y `buscar`; `/catalogo-centro`; señales de bitácora en `instructores/pendientes.ts`. El instructor ya no usa `POST /asignaciones-practica`: pide la ficha.
- Migraciones del rediseño (solo agregan; aplicadas en pruebas, la real con visto bueno): `forma_server/scripts/migraciones-piloto.sh`.
- Guías por rol del piloto: `docs/guias/`.

## Plan vigente
- `PLAN_REDISENO.md`: versión 3, fases 0 a 18 más el frente de datos del Centro Industrial (el piloto). Las 11 a 18 (orden, blanco y morado, asignación) se hicieron el 2026-11-19; quedan casillas parciales anotadas. Marcar las casillas al terminar cada tarea y no saltarse sus reglas: dos modos (real y pruebas), base real solo con visto bueno, ramas `rediseno/flujo-instructor`.

## Documentos
- `DISCURSO_FORMA.md` — visión actual (pitch). `INFORME_EJECUTIVO_FORMA.md` — **desactualizado** (jun-2026, antes del recorte a etapa productiva).
- `forma_server/BACKEND.md` — módulos, endpoints, modelo de datos, sync SofiaPlus.
- `.docx` de arquitectura y política de seguridad en la raíz de este repo.
