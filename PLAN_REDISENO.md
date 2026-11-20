# Plan de rediseño de FORMA

Versión 3, del 19 de noviembre de 2026 (la 2 era del 18). Se marca cada casilla al terminar. Lo nuevo de la versión 3 está en "Versión 3 · Orden y claridad", antes de "Orden". La Fase 19 (20-nov) amplía el menú del instructor a 5 entradas.

## Decisiones tomadas
- **Bitácora:** el instructor lee y comenta, sin aprobar. FORMA registra cuándo la leyó. El instructor puede pedir una corrección, y entonces la bitácora vuelve al aprendiz. Se permite entregar tarde, pero queda marcado.
- **Bitácoras en "Hoy":** sí, de forma compacta.
- **Progreso:** la referencia es la línea "La etapa, dibujada a escala" del artifact FORMA en esencia.
- **Paleta:** blanco con el morado de FORMA y sin café (versión 3; la cálida de la versión 2 queda descartada).
- **Formato GFPI-F-023:** documento editable en una sola columna, con un botón "Ver como documento oficial".
- **Ramas:** el rediseño va en ramas `rediseno/flujo-instructor`, en front y back. El back solo agrega, para que el front anterior siga funcionando y se pueda comparar.
- **Dónde corre:** por ahora todo local. El servidor se decide después.
- **Piloto:** Centro Industrial.
- **Robot de SofiaPlus:** su cuenta está autorizada.
- **Base de desarrollo:** una base local en Docker con copia de la remota. Si en la copia hay catálogos incompletos, se completan con datos de prueba para que todas las coordinaciones tengan fichas.
- **Subdirector:** vuelve como rol. Tiene los poderes del super admin, pero solo dentro de su centro.
- **Capacidad:** el SENA no siempre tiene instructores de seguimiento para todas las fichas. FORMA debe ayudar a decidir a quién asignar cada ficha según la carga, y mostrar a tiempo cuándo faltan instructores.

## Reglas mientras dure el rediseño
- **Dos modos.** El *modo real* usa la base remota y solo lo enciende el usuario. El *modo pruebas* usa la base local, captura los correos sin enviarlos y es el único que enciende Claude.
- **Cambios en la base real** (migraciones, borrados, catálogo): solo con visto bueno explícito.
- **Nunca** `git stash` ni `git reset`. Los commits van por funcionalidad y el push se hace solo cuando el usuario lo pide.
- **La copia local** contiene datos personales: queda solo en este equipo y nunca entra a git.
- **Al cerrar cada fase**, Claude marca las casillas, resume qué quedó y avisa el esfuerzo de la siguiente.

## Quién puede qué
| Rol | Alcance | Puede |
|---|---|---|
| Super admin | Regional | Todo, incluida la carga semanal del PE-04 y la configuración regional |
| Subdirector | Su centro | Lo mismo que el super admin, pero dentro de su centro: ver todo, editar etapas y momentos, asignar y reasignar instructores entre las coordinaciones del centro, gestionar alertas, editar el catálogo del centro, crear y editar usuarios del centro. No puede cargar el PE-04 ni ver otros centros |
| Coordinador | Su coordinación | Ver todo lo de su coordinación, asignar instructores y gestionar alertas |
| Instructor | Sus aprendices | Llevar la etapa de cada aprendiz y leer y comentar sus bitácoras |
| Aprendiz | Su etapa, sin cuenta | Llenar y entregar sus bitácoras y ver su etapa en el portal |

## Fases: 11 (de la 0 a la 10), más un frente paralelo

### Fase 0 · Ambiente local y datos de prueba · esfuerzo **medium**
Objetivo: que todo funcione perfecto acá, sin tocar datos reales.
- [x] MariaDB 10.11 en Docker. Copia de la base remota con `mysqldump --single-transaction`, que solo lee allá y no bloquea nada.
- [x] Proteger la copia:
  - correos de aprendices y usuarios cambiados por direcciones de prueba;
  - Mailpit para ver los correos que FORMA intentaría enviar.
- [x] Usuarios de prueba, uno por rol (super admin, subdirector de Industrial, coordinador e instructor), con contraseñas conocidas y solo en la copia.
- [x] Catálogo de prueba:
  - asignar coordinación a las combinaciones que no la tengan (Industrial y Cedagro), por afinidad del nombre del programa con cada coordinación y repartiendo por cantidad de fichas;
  - si un centro no tiene coordinaciones, crearlas de prueba con su coordinador;
  - todo queda marcado como dato de prueba.
- [x] Modo pruebas:
  - back en el puerto 3100 con `.env.pruebas`;
  - front con `vite --mode pruebas` en el puerto 5180 (el 5174 estaba ocupado); *Desde el 2026-11-20 el modo pruebas usa los puertos de siempre: back 3000 y front 5173, y se enciende con `npm run pruebas`.*
  - extractor de IA en el 8000;
  - un comando para encender todo y otro para apagarlo, documentados en CLAUDE.md.
- [x] Migraciones: la base real ya tiene todas aplicadas. `migracion-roles.sql` NO se debe correr, porque borraría al subdirector.
- [x] El extractor de IA funcionando acá (agregar `python-dotenv` a `requirements.txt`).
- [x] Pruebas unitarias del cronograma y de los juicios (36 pruebas pasan). Las de pendientes pasan a la Fase 7, cuando se toque ese motor.
- [x] Push de los commits de la Fase 0, con visto bueno.

**Listo cuando:** el modo pruebas enciende todo, cada usuario de prueba entra con su rol, una etapa funciona de punta a punta, los correos aparecen en Mailpit y las pruebas pasan.

### Fase 1 · Permisos por alcance y subdirector · esfuerzo **medium**
- [x] Una sola regla de alcance para toda la API: regional, centro, coordinación y propio. Se aplica en todos los endpoints de fichas, aprendices, etapas, seguimientos, visitas, bitácoras, alertas, asignaciones, catálogo y usuarios.
- [x] Cada instructor solo ve y edita lo suyo; la coordinación solo lo de su coordinación.
- [x] El rol de subdirector, con los poderes de la tabla de arriba. Mientras llegan las pantallas nuevas, usa las del super admin filtradas a su centro. *Hecho en la Fase 9:* edita el catálogo de su centro.
- [ ] Decidir si el instructor puede seguir asignándose fichas a sí mismo. *Por ahora* solo puede asignarse a sí mismo y solo fichas de su coordinación.
- [x] Pruebas por rol: `node forma_server/scripts/prueba-alcance.mjs`, con 31 verificaciones que pasan, más 10 pruebas unitarias del alcance.

**Listo cuando:** las pruebas por rol pasan y el subdirector de prueba trabaja su centro completo sin ver los otros.

### Frente paralelo · Datos reales del Centro Industrial · esfuerzo **low**
Empieza ya y debe terminar antes de la Fase 10.
- [x] Excel para llenar: `Data/forma/Industrial_catalogo_para_llenar.xlsx`. Trae los 78 programas, ordenados por fichas vigentes, y hojas para las coordinaciones y la subdirección.
- [ ] La subdirección o las coordinaciones de Industrial lo llenan: qué coordinación lleva cada programa, quién coordina cada una y quién es el subdirector.
- [ ] Claude lo convierte al formato del catálogo (187 combinaciones, 520 fichas) y lo carga en la copia local. Después va a la base real, con visto bueno, reemplazando el catálogo de prueba.
- [ ] Cuentas para el subdirector, los coordinadores y los instructores de Industrial.
- [ ] Un instructor asignado a cada ficha de Industrial que esté en práctica o por entrar.

### Fase 2 · Mockup navegable · esfuerzo **high**
- [ ] Una página interactiva con datos de ejemplo parecidos a los de Industrial. *Se reemplazó por construir cada pantalla directo en el front de pruebas (:5180) y revisarla con capturas; el usuario compara con `scripts/pruebas.sh comparar`.* Incluye:
  - el expediente;
  - la lista de aprendices;
  - "Hoy" del instructor;
  - "Mi coordinación";
  - el panorama del subdirector;
  - el panorama regional;
  - la asignación de instructores con capacidad;
  - el portal "Mi etapa", en celular.
- [x] Paleta cálida con el morado amigable, la línea de la etapa a escala, y estados que se leen por la forma y por la palabra.
- [ ] Ajustes con el usuario hasta que lo apruebe.

**Listo cuando:** el usuario aprueba el mockup. Queda como contrato visual de las fases siguientes.

### Fase 3 · Base visual · esfuerzo **high**
- [x] Crear las ramas `rediseno/flujo-instructor` en front y back, y una carpeta con la versión actual (`git worktree`) para comparar lado a lado.
- [x] Colores, tipografía y espacios en un solo archivo. Modo oscuro de verdad en las pantallas nuevas; las viejas conservan el actual hasta que se migren.
- [x] Componentes base:
  - la frase de estado;
  - la línea de la etapa en sus tres tamaños (fila, tarjeta y expediente);
  - las casillas de bitácoras;
  - la etiqueta de estado;
  - la tabla compacta;
  - el panel de indicadores;
  - el panel lateral.
- [x] Una regla de lint que impida escribir colores sueltos en el código.
- [x] La figura 3D cargada solo en la pantalla de ingreso.

**Listo cuando:** los componentes se ven como en el mockup, en claro y en oscuro, en computador y en celular.

### Fase 4 · Ingesta confiable y habilitación · esfuerzo **high**
- [x] El robot lee todo el ciclo:
  - fichas que entran a práctica: cada semana;
  - fichas en práctica: cada 2 semanas;
  - fichas cerrando: cada semana, hasta 2 meses después del fin.
- [x] Copia fiel en tres capas: el archivo original con su huella digital, las filas tal como vienen y el resumen.
- [x] Historia de habilitación por aprendiz: cambios de estado en SofiaPlus, si puede iniciar y el juicio final. Los datos del aprendiz se actualizan en cada lectura.
- [x] Alertas de conciliación:
  - aprendiz en práctica pero inactivo en SofiaPlus;
  - aprendiz que desaparece de su ficha;
  - dato sin verificar hace más de 14 días.
- [ ] Robot programado en este equipo, con señal de vida, y un panel de "Salud de datos". *Listo `scripts/robot-juicios.sh instalar`; lo activa el usuario porque usa SofiaPlus y la base real.*
- [x] Cada dato de SofiaPlus llega a la pantalla con su fecha.

**Listo cuando:** una corrida programada actualiza la copia local, y en los casos de prueba la habilitación cambia y queda registrada como corresponde.

### Fase 5 · Bitácoras como eje · esfuerzo **medium**
- [x] Estados: próxima, abierta, por entregar, entregada, leída, corrección pedida y atrasada. La entrega tardía queda marcada.
- [x] Lectura registrada, comentario y pedido de corrección. Se retira "aprobar", pero la API vieja sigue respondiendo para el front anterior.
- [x] Señales:
  - dificultades reportadas por el aprendiz;
  - aprendiz con dos quincenas sin entregar (en el motor de pendientes, Fase 7);
  - bitácoras sin leer después de 5 días (en el motor de pendientes, Fase 7).
- [x] Programador de tareas y recordatorios por correo: cuando abre la quincena, cuando faltan 2 días, cuando se atrasa y antes de una visita.
- [x] Portal "Mi etapa" para el aprendiz, pensado primero para celular, con textos corregidos (hoy le dice que espere una revisión que ya no existe).

**Listo cuando:** el ciclo completo de una bitácora funciona en el modo pruebas, con los correos visibles en Mailpit.

### Fase 6 · Expediente del aprendiz · esfuerzo **high**
- [x] Cabecera con la frase de estado y la habilitación con su fecha.
- [x] Línea de la etapa a escala con fechas reales, la marca de hoy, las visitas y las 12 bitácoras.
- [x] El GFPI-F-023 por momentos en una sola columna, reutilizando los formularios actuales, y el botón "Ver como documento oficial".
- [x] Panel de análisis:
  - factores por momento;
  - visitas hechas en su plazo;
  - distancia de las firmas;
  - bitácoras al día y leídas;
  - dificultades.
- [x] Lectura de bitácoras en un panel lateral, agendar visitas desde la línea, y el historial de la etapa a un clic.
- [x] Versión de solo lectura para la coordinación, y completa para el subdirector y el super admin.

**Listo cuando:** un instructor puede llevar una etapa completa sin cambiar de pantalla.

### Fase 7 · Hoy y Aprendices · esfuerzo **medium**
- [x] "Hoy": lo que toca esta semana por ficha, más las bitácoras nuevas y los atrasos, en forma compacta. El calendario queda como segunda vista.
- [x] "Aprendices": una sola lista agrupada por ficha, con la línea mini de cada aprendiz, su próximo paso y filtros.
- [x] Menú del instructor: Hoy y Aprendices; Historial y Reportes en un menú secundario.

**Listo cuando:** el instructor encuentra en dos clics lo que debe hacer y a cualquiera de sus aprendices.

### Fase 8 · Capacidad y asignación de instructores · esfuerzo **high**
- [x] Cupo por instructor: el máximo de aprendices en seguimiento. Cada centro define un valor por defecto y se puede ajustar por instructor. *Por defecto 40 (a confirmar con el centro); cupo 0 = no hace seguimiento. Migración `forma_server/src/capacidad/migracion-capacidad.sql`, aplicada solo en pruebas.*
- [x] Demanda contra cupos para los próximos 3 meses, con las fechas del PE-04 y los aprendices habilitados. Por ejemplo: "En marzo entran 140 aprendices y quedan 90 cupos".
- [x] Cola de fichas sin instructor, ordenada por fecha de inicio de práctica y aprendices habilitados, con los días que faltan.
- [x] Asistente para asignar. Para cada ficha sugiere instructores, explicando el porqué en palabras, en este orden:
  1. con cupo libre;
  2. de la misma coordinación;
  3. con experiencia en el programa;
  4. en el mismo municipio.
- [x] Repartir una ficha entre varios instructores, usando la asignación individual por aprendiz que ya existe. *El asistente enlaza al reparto por aprendiz que ya existe en el detalle de la ficha.*
- [x] El subdirector reasigna entre las coordinaciones de su centro cuando una se queda sin cupo.
- [x] Alertas:
  - instructor por encima de su cupo;
  - ficha que empieza en 15 días o menos sin instructor;
  - mes en el que faltan cupos.

**Listo cuando:** el coordinador asigna una ficha en un paso con la sugerencia, y el subdirector ve con tiempo los meses en que faltan instructores.

### Fase 9 · Coordinación, subdirección y dirección · esfuerzo **high**
- [x] El motor de pendientes, ampliado a coordinación, centro y regional.
- [x] "Mi coordinación":
  - lo que viene, agrupado por instructor;
  - la tabla de instructores: carga contra cupo, esta semana, atrasos, momentos en plazo, visitas en sitio, bitácoras al día y leídas;
  - las fichas por entrar y sin instructor;
  - las alertas.
- [x] Panorama del subdirector: su centro completo, con sus coordinaciones lado a lado y la capacidad del centro.
- [x] Panorama regional: los 4 centros lado a lado, bajando a centro, coordinación, instructor y aprendiz.
- [x] "Datos": salud de la ingesta, catálogo y diseños curriculares. *Más: el subdirector edita el catálogo de su centro (`/catalogo-centro`) y su dashboard ya muestra su centro.*

**Listo cuando:** el super admin controla los 4 centros, el subdirector su centro y cada coordinador su coordinación, cada uno desde una sola pantalla.

### Fase 10 · Piloto en el Centro Industrial · esfuerzo **low**
- [ ] El catálogo real de Industrial cargado, las migraciones aplicadas en la base real (con visto bueno) y el robot programado. *Listo para que lo haga el usuario: `forma_server/scripts/migraciones-piloto.sh real --si-a-la-base-real` (con respaldo antes) y `scripts/robot-juicios.sh instalar`; el catálogo espera el Excel de Industrial.*
- [x] Una guía de una página por rol y una sesión de arranque. *En `docs/guias/` (instructor, aprendiz, coordinación, subdirección y la agenda de arranque).*
- [ ] Dos semanas de uso con soporte, y los ajustes que salgan.
- [ ] Unir el rediseño a la rama principal y abrirlo a los otros 3 centros.

**Listo cuando:** Industrial usa FORMA dos semanas seguidas y los ajustes están hechos.

## Versión 3 · Orden y claridad (fases 11 a 18)

Del 19 de noviembre de 2026. Sale de revisar FORMA completo, con los 4 roles, como si fuera nuestro. Va **antes** de las dos semanas de uso del piloto (Fase 10), para que Industrial estrene la versión ordenada.

### Lo que encontré
- **La misma cifra en muchas pantallas.**
  - "Fichas sin instructor" aparece en 9 pantallas y "fichas en práctica" en otras 9. "Aprendices en práctica" está en 7 y "cobertura" en 6.
  - El super admin tiene dos tableros que responden lo mismo, Dashboard y Panorama. Además, Centros y Programas traen cada uno su propio tablero.
- **Demasiadas entradas en el menú.**
  - Super admin: 10.
  - Coordinador: 7, una de ellas "Dashboard anterior".
  - Instructor: 6. "Calendario" repite los pendientes de Hoy, e "Historial" y "Mis fichas" repiten Aprendices.
- **Pestañas que esconden cosas:** el Dashboard tiene 3, Integridad 3, el detalle del instructor 6, Historial 6 y el seguimiento de aprendices 6.
- **Cuatro listas de instructores:** Usuarios, Instructores de práctica, la tabla del Panorama y la de Asignación. Cada una muestra datos distintos.
- **Asignar por aprendiz existe, pero no se ve.**
  - El back ya permite un instructor por ficha (`asignacion_practica`) y otro para aprendices sueltos (`asignacion_aprendiz`), y los cupos ya cuentan los dos.
  - En el front, la asignación individual está escondida dentro de "Editar ficha", y la pantalla Asignación solo asigna fichas completas.
- **Dos lenguajes visuales.**
  - Las pantallas viejas usan gris, índigo y rojo o verde fuertes, con 2.589 colores escritos a mano.
  - Las nuevas usan papel cálido. Su "atraso" (#9c4a37) y su "aviso" (#8f6a22) se leen como café.
  - El modo oscuro de las pantallas viejas es un filtro que invierte los colores.
- **Un selector que no hace nada:** el recuadro "Centro de formación ⌄" de arriba del menú tiene flecha, pero no abre nada.
- **Nombres que cambian:** se dice "etapa productiva", "práctica" y "etapa práctica"; también "instructor de práctica" e "instructor de seguimiento".
- **Código muerto.** `InstructorHome` y sus piezas (`FichaFolderCards`, `ActividadReciente`, `CalendarioMini`) ya no se usan. `EtapaProductivaDetalle` solo sigue porque el expediente reutiliza sus formularios.

### Reglas de experiencia (para todo lo que se haga)
1. **Un dato, un lugar.** Las cifras y las comparaciones viven en **Inicio**. Las demás pantallas muestran cosas (fichas, personas, aprendices), no tableros.
2. **Sin pestañas para lo principal.** Una página responde una pregunta, en secciones que se leen de arriba abajo. El selector de vista se usa solo cuando es la misma lista vista de otra forma, como Lista o Calendario.
3. **Un solo ámbito para toda la app.** Regional ▸ Centro ▸ Coordinación se elige una vez, arriba. Aplica a Inicio, Fichas, Asignación, Equipo y Reportes, y queda en la URL para poder compartirla.
4. **Todo lleva a algún lado.** Cada fila abre su página. La ruta de arriba (migas) siempre se puede pulsar para volver.
5. **Una acción principal por página,** en morado, arriba a la derecha.
6. **Un nombre por cosa** (ver el glosario), igual en las pantallas, los correos, las guías y los reportes.
7. **Celular primero para el instructor y el aprendiz.** Coordinación y dirección se diseñan para escritorio, pero también deben funcionar en el celular.

### Visual: blanco con el morado de FORMA
- **Fondo blanco.** La página y el menú son blancos y se separan con líneas finas. Las tarjetas se usan solo donde agrupan algo. Para que no quede plano hay dos opciones, que se eligen en la maqueta:
  - **A:** blanco puro.
  - **B:** un halo morado muy suave detrás del encabezado de cada página.
- **Morado FORMA,** el del login:
  - #7c3aed como color principal;
  - #6d28d9 para el texto y el hover;
  - #f5f3ff para los fondos suaves;
  - #ddd6fe para los bordes.

  Va en el menú activo, los botones principales, los enlaces, el foco, la fila elegida y la serie principal de los gráficos, en una escala de morados.
- **Grises fríos** para el texto y las líneas: tinta #18181b, secundaria #52525b, terciaria #71717a y líneas #e4e4e7.
- **Sin café.**
  - Atraso en rojo limpio: #d92d20 sobre #fef3f2.
  - Al día en verde: #079455 sobre #ecfdf3.
  - Aviso en ámbar, solo como punto o marca; el texto queda gris.
  - Información en azul.
  - Los estados siguen llevando una forma y una palabra.
- **Letra:** Inter para todo, con números tabulares. La letra mono queda solo para los números de ficha y de documento.
- **Modo oscuro real,** con los mismos tokens. Se elimina el filtro que invierte los colores.

### Mapa nuevo por rol

**Super admin**
- Menú: Inicio · Fichas · Asignación · Equipo · Reportes. Debajo, en *Administración*: Centros y coordinaciones · Programas y diseños · Datos de SofiaPlus.
- Qué se une o se quita:
  - Dashboard y Panorama se unen en **Inicio**.
  - Usuarios pasa a ser **Equipo**.
  - Integridad y Datos se unen en **Datos de SofiaPlus**.
  - Centros y Programas pierden sus tableros y quedan como catálogos.
  - El menú baja de 10 entradas a 5, más 3 en Administración.

**Subdirector**
- Menú: lo mismo que el super admin, con el ámbito fijo en su centro.
- En Administración tiene el Catálogo del centro y Datos de SofiaPlus, este solo para ver.

**Coordinador**
- Menú: Inicio (Mi coordinación) · Fichas · Asignación · Equipo · Reportes.
- Desaparecen "Dashboard anterior" y "Alertas". Las alertas viven en la página de cada instructor, en Equipo, y las abiertas se ven en Inicio.
- El menú baja de 7 entradas a 5.

**Instructor**
- Menú: Hoy · Aprendices · Reportes.
- "Calendario" pasa a ser una vista dentro de Hoy.
- "Mis fichas" e "Historial" se unen en Aprendices, que queda agrupado por ficha y con los filtros En curso, Por empezar y Terminados.
- Lo guardado de cada aprendiz queda en su expediente.
- El menú baja de 6 entradas a 3.

**Aprendiz (portal)**
- Una sola pantalla, "Mi etapa", con el visual blanco y morado: la línea de su etapa, sus bitácoras y lo siguiente que le toca.

**Ente co-formador**
- Firma en el equipo del instructor, en una pantalla completa y clara que deja a la vista lo que se está firmando.

**Arriba, en todas las pantallas,** van dos cosas:
- **El ámbito,** que reemplaza el recuadro "Centro de formación" que no hacía nada.
- **Un buscador** de aprendices (por nombre o documento), fichas o instructores, que lleva directo a su página.

### Las formas de asignar
Hay una sola acción, **Asignar**. Se abre igual desde la cola de Asignación, desde la página de la ficha y desde la página de un instructor, y ofrece cuatro formas:
1. **Toda la ficha:** un instructor para todos sus aprendices. Es el caso normal.
2. **Aprendices sueltos:** se marcan los aprendices y se elige el instructor. Sirve para fichas que se reparten, aprendices en otra ciudad o un cambio puntual. Esta asignación manda sobre el instructor de la ficha.
3. **Repartir la ficha:** cuando un solo instructor no alcanza. FORMA propone cómo dividirla según los cupos libres, y la división se ajusta a mano.
4. **Reasignar todo lo de un instructor:** para licencias, retiros o vacaciones. Sus fichas y aprendices pasan a la cola, con sugerencias.

En todos los casos se ve el efecto antes de confirmar, por ejemplo "Ana quedaría con 38 de 40". La página de la ficha muestra **quién sigue a quién**: el instructor de la ficha, las excepciones y el historial de quién asignó y cuándo.

### Glosario
- **Etapa productiva,** no "práctica" ni "etapa práctica".
- **Instructor de seguimiento,** no "instructor de práctica".
- **Momento:** la planeación, el seguimiento o la evaluación.
- **Bitácora:** la que llena el aprendiz cada 15 días.
- **Visita:** la cita del instructor con la empresa.
- **Ámbito:** regional, centro o coordinación.

### Fase 11 · Maqueta navegable de la versión 3 · esfuerzo **high**
- [x] El mapa de pantallas por rol y el glosario. *Decididos el 19-nov.*
- [x] ~~Una maqueta (artifact)~~ *Se salta: el usuario delegó las decisiones y se revisa en la app.* Una maqueta (artifact) en blanco y morado, con el fondo A y el B. Incluye:
  - el menú nuevo, con el ámbito y el buscador;
  - el Inicio;
  - la página de una ficha con el panel Asignar y sus 4 formas;
  - Hoy del instructor;
  - el portal del aprendiz.

**Listo cuando:** el usuario aprueba la maqueta y elige el fondo.

### Fase 12 · Sistema visual blanco y morado · esfuerzo **high**
- [x] Tokens nuevos (blanco, morado FORMA, grises fríos y estados sin café) y modo oscuro real. *Con el halo morado (fondo B).*
- [x] Menú nuevo: blanco y morado, agrupado (lo diario arriba; "Administración" o "Más" aparte), con los nombres del glosario. El recuadro de arriba muestra el ámbito de quien entra. *El selector de ámbito y las migas que se pulsan pasan a la Fase 14, y la caja del buscador a la 18, para no poner controles que todavía no hacen nada.*
- [x] *Hechas las que hacían falta: chips de filtro (Equipo), selector de vista (`fx-vistas`), panel lateral, tablas y cifras con tokens; gráficos en morado.* Piezas comunes en el sistema nuevo:
  - tabla;
  - filtros en chips;
  - selector de vista;
  - panel lateral;
  - cifras;
  - estados vacíos y de carga;
  - gráficos en escala de morados.

**Listo cuando:** las pantallas del rediseño se ven en blanco y morado, sin rastro de café, en modo claro y oscuro.

### Fase 13 · Pasar las pantallas viejas al sistema · esfuerzo **medium**
- [x] *Paso previo hecho el 19-nov: 517 colores en 62 archivos pasaron de índigo a morado FORMA y de café/ámbar oscuro a naranja y rojo limpios (siguen escritos a mano).* Un script cambia los colores escritos a mano por los tokens (*hecho: 2.755 cambios en todo `src/`*): los grises por los grises fríos, el índigo por el morado, y el rojo, verde y ámbar por los colores de estado. Después se revisa a ojo, pantalla por pantalla.
- [x] La regla de lint que prohíbe colores sueltos se extiende a todo `src/`. *Más `scripts/sin-colores.mjs` para los .css. Quedan fuera solo el login y su fondo 3D, que tienen paleta propia.*
- [x] Se quita el modo oscuro por inversión. *Los tokens viven en `:root` y cambian con `data-theme`. Las firmas llevan papel blanco en modo oscuro.*

**Listo cuando:** toda la app usa los mismos tokens y el lint no deja meter colores sueltos.

### Fase 14 · Inicio único por ámbito · esfuerzo **high**
- [x] *Se reutilizan `/panorama` (que ya usa `forzarFiltros`) y `/fichas`, filtradas por el ámbito: no hizo falta un endpoint nuevo.* Un endpoint `/inicio`, que usa `forzarFiltros` y trae todo lo del ámbito: cifras, fichas por fase, entradas y cierres por mes, seguimiento, comparación y capacidad.
- [x] *Selector "Viendo" en la barra; se recuerda durante la sesión (no en la URL). Ya acota Inicio, Fichas y Asignación; Equipo y Reportes lo toman en la Fase 16.* El ámbito en la barra de arriba, guardado en la URL y aplicado también a Fichas, Asignación, Equipo y Reportes.
- [x] Inicio en secciones, en este orden:
  1. **Cómo vamos:** la frase y 4 cifras.
  2. **Las fichas:** los datos del Dashboard de antes, que el usuario ya aprobó.
  3. **El seguimiento:** momentos en plazo, bitácoras al día y leídas, firmas en sitio.
  4. **Comparación:** centros, luego coordinaciones, luego instructores. Un clic en una fila acota el ámbito.
  5. **Capacidad** de los próximos 3 meses.
  6. **Lo que viene,** solo cuando el ámbito es una coordinación.
- [x] *Panorama, Dashboard y el resumen anterior del coordinador ya no tienen ruta (redirigen a Inicio); los tableros de Centros y Programas salen en la Fase 16.* Se retiran el Panorama, el Dashboard con pestañas, el "Dashboard anterior" del coordinador y los tableros de Centros y Programas.

**Listo cuando:** cada cifra se ve en un solo lugar y el super admin cambia de centro o de coordinación sin salir de Inicio.

### Fase 15 · Asignar por ficha o por aprendiz · esfuerzo **high**
- [x] El panel Asignar con las 4 formas, que muestra el efecto en los cupos antes de confirmar. *`AsignarPanel` (ficha, sueltos, repartir) en Asignación y en la ficha; "Liberar" en la tabla de instructores de Asignación.*
- [x] En el back, todo pasando por `AlcanceService` (*módulo `asignar`; cada cambio mueve también las etapas en curso*):
  - asignar varios aprendices de una vez;
  - proponer cómo repartir una ficha;
  - reasignar todo lo de un instructor;
  - guardar el historial de asignaciones.
- [x] *La cola ya estaba ordenada por fecha; liberar a un instructor devuelve sus fichas a ella. Los aprendices sueltos que se quedan sin instructor no se listan aparte: vuelven al instructor de su ficha.* La cola de Asignación, ordenada por fecha de inicio, con las fichas sin instructor y los aprendices que quedaron sin instructor, por ejemplo cuando se desactiva un usuario.
- [x] En la página de la ficha, "quién sigue a quién", con las excepciones y su historial.
- [x] Lo que se decida sobre la auto-asignación del instructor. *El instructor pide la ficha (`solicitud_ficha`, migración `src/asignar/migracion-asignar.sql`) y ya no puede usar `POST /asignaciones-practica`.*
- [x] *Prueba nueva `scripts/prueba-asignar.mjs` (17 verificaciones) y `asignar.spec.ts`.* La prueba `prueba-capacidad.mjs` ampliada con los casos nuevos.

**Listo cuando:** se puede asignar una ficha entera, asignar aprendices sueltos, repartir una ficha y reasignar, y los cupos cuadran en todos los casos.

### Fase 16 · Fichas, Equipo, Reportes y Administración · esfuerzo **medium**
- [ ] **Fichas:** una tabla con filtros en chips (fase, programa, con o sin instructor) y la página nueva de la ficha, con sus aprendices y la línea mini de cada uno. *Parcial: la lista se acota por el ámbito y la página de la ficha tiene el botón Asignar; la tabla y la página siguen con su diseño anterior (ya en blanco y morado).*
- [x] **Equipo:** una sola lista de personas, con su carga y cupo, cómo van (momentos en plazo, bitácoras leídas), su último ingreso y sus alertas. La página de cada persona trae:
  - sus aprendices;
  - su calendario;
  - sus alertas;
  - sus asignaciones;
  - la administración de la cuenta (rol, activar, contraseña).
- [x] *Reportes ya era de documentos; ahora arranca con el ámbito de arriba.* **Reportes:** solo descargas (el GFPI-F-023 y los informes por ámbito), sin tableros.
- [ ] *Parcial: Integridad y Datos quedaron en una entrada ("SofiaPlus y datos"); Centros perdió sus cifras y quedó como catálogo; las cuentas de usuario pasaron a Configuración. Falta quitar los indicadores de Programas.* **Administración:**
  - Centros y coordinaciones, solo para editar.
  - Programas y diseños.
  - Datos de SofiaPlus en una sola página: el estado de la copia, las cargas del PE-04, la conciliación y el catálogo.

**Listo cuando:** no queda ninguna lista de instructores repetida ni ningún tablero fuera de Inicio.

### Fase 17 · Instructor, aprendiz y firma · esfuerzo **medium**
- [x] Hoy con la vista Calendario; se retira la Agenda.
- [x] *Aprendices ya tenía los filtros y "Etapas terminadas"; cada ficha se abre desde su grupo.* Aprendices con En curso, Por empezar y Terminados; Mis fichas e Historial salen del menú.
- [x] *Hecho en la Fase 19.1: dos pasos desde "Por registrar".* Iniciar un seguimiento en dos pasos (aprendiz y luego datos), sin elegir ficha ni instructor cuando ya vienen asignados.
- [ ] *Pendiente: el expediente sigue reutilizando los formularios de `EtapaProductivaDetalle`.* El expediente:
  - el cronograma, las bitácoras y la vista previa, hechos con las piezas nuevas;
  - lo guardado (la actividad) como una sección más;
  - sale `EtapaProductivaDetalle`.
- [x] *Con los tokens nuevos ya salen en blanco y morado; no se probaron en un celular real.* El portal "Mi etapa" y la pantalla de firma con el visual nuevo, probados en el celular.

**Listo cuando:** el instructor hace su semana con 3 entradas de menú, y el aprendiz y el ente co-formador ven lo mismo que en la maqueta.

### Fase 18 · Buscador, limpieza y pruebas · esfuerzo **medium**
- [x] El buscador, con un endpoint `/buscar` acotado al alcance (aprendiz por nombre o documento, ficha o instructor) y un atajo de teclado.
- [x] *Borrados: InstructorHome, FichaFolderCards, ActividadReciente, CalendarioMini, CoordinadorHome, InstructoresPractica, AprendicesAsignacion, el Dashboard con pestañas y la asignación duplicada del formulario de ficha. Quedan vivos (aún se usan): AgendaPendientes, InstFichas, InstHistorial, CoordAlertas, CoordinacionDetalle, AprendicesSeguimiento y EtapaProductivaDetalle.* Borrar el código que ya no se usa y dejar las rutas viejas redirigiendo a las nuevas. Por ejemplo: `InstructorHome`, `FichaFolderCards`, `ActividadReciente`, `CalendarioMini`, `AgendaPendientes`, `InstFichas`, `InstHistorial`, `CoordinadorHome`, `CoordAlertas`, `CoordinacionDetalle`, `AprendicesSeguimiento` y `Panorama`.
- [x] *19-nov: tsc, build, jest (75), las 7 `prueba-*.mjs` y capturas con Playwright de los 3 roles en claro y oscuro. El lint del front deja 28 errores viejos en archivos que no se tocaron (había 32); no se revisó en un celular.* Pasar todas las pruebas (`prueba-*.mjs`, jest, tsc, lint y build) y revisar cada rol en escritorio y en celular.
- [x] Actualizar las guías de `docs/guias/` con los nombres y el menú nuevos.

**Listo cuando:** las pruebas pasan, no queda código muerto y las guías coinciden con lo que se ve.

### Decisiones (el usuario las delegó el 19-nov: "decide tú")
1. **Fondo:** B, blanco con un halo morado muy suave arriba de cada página.
2. **Glosario:** "etapa productiva" e "instructor de seguimiento" en todas partes.
3. **Auto-asignación:** el instructor ya no se asigna fichas; las **pide** y la coordinación aprueba con un clic.
4. **Dashboard del super admin:** se une a Inicio y conserva sus datos.
5. **Modo oscuro:** se mantiene, hecho con tokens.
6. **Maqueta:** se salta. Con las decisiones tomadas, los cambios se revisan directo en la app (:5180).

## Fase 19 · Más para el instructor · esfuerzo **medium** (la 19.4, **high**)

Del 20 de noviembre de 2026. Al probar como instructor salieron dos problemas:
- **Registrar una etapa confunde.** El aviso "23 aprendices ya pueden iniciar práctica" lleva a "Nuevo registro". Ahí se escoge una ficha entre **todas** las de la coordinación y luego un aprendiz entre **todos** los de la ficha, aunque ya tengan etapa o los siga otro instructor. Parece que el instructor escoge sus aprendices, cuando la coordinación ya se los asignó. Es la casilla que quedó pendiente en la Fase 17.
- **Tres entradas se quedan cortas.** Con Hoy · Aprendices · Reportes no se ven dos tareas centrales del instructor: leer las bitácoras (con 40 aprendices son unas 40 por quincena) y planear sus visitas. Las dos ya existen, pero escondidas: las bitácoras en un costado de Hoy y el calendario detrás de un botón dentro de Hoy.

### Menú nuevo: 5 entradas
Cada entrada responde una sola pregunta, y ningún dato se repite entre ellas.

| Entrada | Pregunta | Qué trae |
|---|---|---|
| Hoy | ¿Qué hago esta semana? | Atrasado, Esta semana y Para vigilar; al lado, las bitácoras más urgentes y las cifras de tus aprendices. |
| Aprendices | ¿Cómo va cada uno? | La lista por ficha, los que faltan por registrar, los terminados y "Pedir una ficha". |
| Bitácoras | ¿Qué me escribieron? | Una bandeja para leerlas una tras otra. |
| Calendario | ¿Cuándo y a dónde voy? | El calendario que hoy está dentro de Hoy, más las visitas por agendar. |
| Reportes | ¿Qué hice y qué entrego? | Lo hecho en el mes y las descargas. |

Ajustes sigue abajo, en Cuenta. "Mis fichas" e "Historial" no vuelven como entradas: lo de las fichas queda en Aprendices y la actividad en Reportes.

### 19.1 · Registrar una etapa sin escoger ficha · **medium**
- [x] Back: `/instructores/mi/pendientes` devuelve `por_registrar`, los aprendices listos sin etapa, con `aprendiz_id`, documento, ficha y programa. La consulta de los "listos" ya existe, pero no trae el id. Respeta las asignaciones sueltas: si a un aprendiz de mi ficha lo sigue otro instructor, no aparece.
- [x] Aprendices: arriba, "Por registrar" agrupado por ficha. Cada fila tiene "Registrar etapa", que abre directo el formulario de datos (empresa, modalidad y fechas). Quedan dos pasos: el aprendiz y sus datos.
- [x] Si el aprendiz no está en la copia de SofiaPlus, la fila lo dice y no deja registrar: hay que avisar a la coordinación.
- [x] "¿Falta alguien?" muestra los demás aprendices de mis fichas que no tienen etapa, con el aviso "SofiaPlus todavía no lo muestra habilitado". Sirve cuando los juicios llegan tarde.
- [x] El aviso de Hoy lleva a Aprendices, a la ficha del aviso. Se retira el arreglo del 20-nov (`?ficha=` en "Nuevo registro").
- [x] Sale el asistente de tres pasos (`NuevoRegistro`, `PasoFicha` y `PasoAprendiz` en `EtapaProductivaList.tsx`), que solo usa el instructor.

### 19.2 · Pedir una ficha · **low**
- [x] "Pedir una ficha", como botón secundario en Aprendices. Abre un panel con las fichas de mi coordinación sin instructor, ordenadas por la fecha de inicio de la etapa productiva, y una nota opcional. Usa `POST /asignar/solicitudes`, que ya existe.
- [x] *El back solo devuelve las pendientes; las resueltas se ven porque la ficha aparece (o no) en Aprendices.* En el mismo panel, mis solicitudes: las pendientes, con "Retirar", y las ya resueltas.
- [x] Cuando la coordinación aprueba, la ficha aparece en Aprendices y sus aprendices listos, en "Por registrar".

### 19.3 · Menú de 5 y Calendario aparte · **low**
- [x] `Shell.tsx`: Hoy · Aprendices · Bitácoras · Calendario · Reportes.
- [x] Calendario con ruta propia (`/dashboard/instructor/calendario`). `?vista=calendario` y `/agenda` redirigen ahí. Sale de Hoy el selector "Esta semana | Calendario".
- [x] Hoy: salen el selector "Esta semana | Calendario" y el botón "Todos mis aprendices", que ya son entradas del menú. Las bitácoras se quedan, compactas (decisión del 18-nov): las 3 más urgentes y "Leer las N", que abre Bitácoras. Cada cifra de "Tus aprendices" abre Aprendices con ese filtro.
- [x] Vuelve lo que el Inicio viejo tenía y Hoy perdió: las etapas terminadas sin resultado ("Falta juicio", `resultado_final` vacío) salen como pendiente para cerrarlas.
- [x] El buscador y las migas reconocen las entradas nuevas.

### 19.4 · Bitácoras: bandeja de lectura · **high**
- [x] Cuatro grupos, en este orden:
  - Por leer, la más vieja primero;
  - Atrasadas: el aprendiz no la ha entregado;
  - Pediste corrección: está esperando al aprendiz;
  - Leídas, solo las de las últimas dos semanas.
- [x] Al abrir una, se lee ahí mismo con `LecturaBitacora` (leer, comentar y pedir corrección), y "Siguiente" pasa a la próxima por leer sin volver a la lista.
- [x] En las atrasadas va la acción "Escribirle", la misma que hoy sale en Hoy.
- [x] *Solo se agregó al back la fecha de lectura (`leida`) en cada casilla.* Sin back nuevo: los datos salen de `aprendices[].bitacoras` en `/instructores/mi/pendientes` y de los endpoints por etapa que ya existen.
- [x] Pensada primero para el celular.

Va en **high** porque es la pantalla que más va a usar el instructor y define cómo se lee en el celular.

### 19.5 · Calendario: visitas por agendar · **medium**
- [x] Arriba del calendario, "Por agendar": las visitas cuya ventana ya se abrió, o se abre en los próximos 15 días, y que todavía no tienen fecha. Se agendan desde ahí con `POST visitas`, que ya existe.
- [x] Agrupadas por empresa, para armar recorridos: "3 aprendices en la misma empresa: agéndalos el mismo día".
- [x] Sin back nuevo: las ventanas y las visitas ya vienen en `aprendices` de `/instructores/mi/pendientes`.

### 19.6 · Reportes: lo que hice y lo que entrego · **medium**
- [x] "Lo que hiciste" en el mes elegido: momentos registrados, visitas, ediciones y etapas abiertas o cerradas. Reutiliza `InstHistorial` y `GET /instructores/mi/historial`, que hoy no tienen entrada en el menú.
- [x] Agregar al historial las bitácoras leídas (`leida_at` ya existe en el back).
- [x] *El informe del mes es genérico (lo hecho en el mes con la firma) hasta saber qué formato pide Industrial.* Descargas: el GFPI-F-023 de cada aprendiz y un informe del mes con la firma del instructor. Hoy, "Descargar PDF" solo imprime la pantalla.
- [x] *Ya estaba en Ajustes; se quitó de Reportes.* "Mi firma" pasa a Ajustes.

### 19.7 · Cierre · **low**
- [x] `tsc`, `eslint` y `build` en el front; `tsc`, `eslint` y `jest` en el back.
- [x] `prueba-flujo.mjs` y `prueba-bitacoras.mjs`, con una verificación nueva de `por_registrar` en `prueba-flujo.mjs`.
- [x] La guía del instructor (`docs/guias/instructor.md`) con el menú de 5.
- [x] *Capturas con Playwright a 1440 y 390 px; falta probarlo en un celular real.* Revisar cada pantalla en el celular.

**Listo cuando:** el instructor registra la etapa de un aprendiz asignado en dos pasos y sin ver fichas ajenas, lee sus bitácoras una tras otra y arma la semana de visitas desde Calendario.

### Por decidir
1. ~~¿Las cinco entradas?~~ Sí (20-nov).
2. ~~¿Registrar sin habilitación de SofiaPlus?~~ Sí, con el aviso (20-nov).
3. ¿Qué informe mensual les piden a los instructores en Industrial? Por ahora sale uno genérico.

## Orden
1. Fases 0 y 1.
2. Fase 2.
3. Fase 3. La Fase 4 puede ir intercalada con la 3, porque es trabajo del back.
4. Fases 5, 6, 7, 8 y 9, en ese orden.
5. Versión 3: fases 11 a 18, en ese orden. La 13 puede ir intercalada con la 14, porque es mecánica.
6. Fase 19: más para el instructor, en el orden de sus partes (19.1 a 19.7).
7. Fase 10: Industrial estrena la versión 3 con la Fase 19. Las dos semanas de uso empiezan cuando termine la 19.

El frente de Industrial corre en paralelo desde ya.

**Opción de piloto temprano:** si Industrial necesita empezar antes, puede usar la versión actual apenas terminen las Fases 0 y 1 y esté su catálogo real. El rediseño le llegaría por partes.

## Esfuerzo recomendado
| Fases | Esfuerzo | Por qué |
|---|---|---|
| 2, 3, 4, 6, 8, 9 | high | Diseño, modelo de datos y las pantallas centrales |
| 0, 1, 5, 7 | medium | Técnicas, o con las decisiones ya tomadas |
| 10 y frente de Industrial | low | Datos, checklist y soporte |
| 11, 12, 14, 15 | high | Maqueta, sistema visual, Inicio y asignación: diseño y modelo |
| 13, 16, 17, 18 | medium | Con el diseño ya aprobado; la 13 es casi toda mecánica |
| 19 | medium | La 19.4 (bandeja de bitácoras) en high; la 19.2, la 19.3 y la 19.7 en low |
| Preguntas y arreglos sueltos entre fases | low | |
