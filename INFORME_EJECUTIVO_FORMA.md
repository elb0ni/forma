# FORMA — Informe ejecutivo del sistema
### Plataforma de seguimiento curricular · SENA Regional Atlántico
*Documento para Dirección Regional · corte 21 jun 2026*

---

## 1. Qué es FORMA

FORMA es una plataforma web para **planear, ejecutar y hacer seguimiento al diseño curricular** de los programas de formación, fiel a la estructura del SENA:

> **Programa → Competencia → Resultado de Aprendizaje (RA) → {Conocimientos (de proceso / del saber), Criterios de evaluación}**

Sobre esa estructura, el sistema digitaliza el currículo, asigna instructores a las fichas, registra la ejecución sesión por sesión y mide el **avance real** de cada ficha, coordinación y centro.

**Stack:** React + TypeScript (web), NestJS + MySQL/MariaDB (API), y un servicio de IA en Python (FastAPI) para digitalizar los PDF de diseño curricular. Autenticación con JWT y refresh token; contraseñas cifradas (bcrypt).

---

## 2. Cobertura funcional por rol

| Rol | Alcance | Estado |
|---|---|---|
| **Super Admin (Dirección)** | Toda la regional: dashboard, digitalización, programas, fichas, centros/coordinaciones, usuarios y reportes | ✅ Operativo |
| **Coordinador académico** | **Solo su coordinación**: dashboard, fichas, instructores, reportes y alertas | ✅ Operativo |
| **Instructor** | **Solo sus asignaciones**: inicio, fichas, registro de sesiones (asistente), sesiones, reportes | ✅ Operativo |
| **Subdirector / Coord. misional** | Comparten la interfaz del coordinador | 🟡 Parcial (sin vista regional propia) |

---

## 3. Capacidades construidas (objetivo)

**Digitalización del currículo (asistida por IA)** ✅
- Carga del PDF de diseño curricular → extracción automática de competencias, RA, conocimientos y criterios.
- Asignación de cada conocimiento/criterio a su RA por **similitud semántica** (modelo de lenguaje), con reglas de validación SENA (cada RA con ≥1 criterio; sin elementos huérfanos).
- Editor manual para corregir/completar el diseño antes de habilitarlo.

**Gestión operativa** ✅
- Programas, centros, coordinaciones y usuarios con altas/bajas/edición.
- Fichas con asignación de instructores por competencia; **regla de calidad**: no se asignan instructores ni se opera una ficha si su programa no está digitalizado.

**Ejecución y avance** ✅
- Asistente de 6 pasos para que el instructor registre la sesión: RA trabajados, conocimientos y criterios cubiertos, **materiales de formación** (clasificación SENA: devolutivos, de consumo, didácticos, ambiente) y evidencias (archivo o enlace).
- **El avance no es autorreportado**: el porcentaje de cada RA se **deriva** de la cobertura real de sus conocimientos y criterios. Es un indicador riguroso y auditable.

**Trazabilidad y validez documental** ✅
- Evidencias por sesión (producto / desempeño / conocimiento).
- **Guía de aprendizaje y reportes descargables firmados**: la validez nace de que el documento lleva la **firma del instructor y la del coordinador** (no de un botón de "aprobar"). Cada usuario registra su firma en Ajustes.

**Inteligencia de seguimiento** ✅
- Dashboards con KPIs en vivo por regional, centro, coordinación e instructor.
- **8 reportes ejecutivos** (avance por ficha, fichas en riesgo, productividad de instructores, cobertura curricular, digitalización, sesiones sin evidencia, inventario de evidencias, resumen regional), imprimibles a PDF, disponibles también scoped a cada coordinación.
- Semáforo de riesgo por ficha (avance vs. tiempo restante) y alertas de cierre próximo / programa sin digitalizar.

**Experiencia** ✅
- Tema claro/oscuro con preferencia guardada; ajustes de perfil, firma y cambio de contraseña por usuario.

---

## 4. Estado real de los datos (lo más importante para decidir)

Cifras aproximadas tomadas de la base de datos de producción (21 jun 2026):

| Dimensión | Volumen aprox. | Lectura |
|---|---:|---|
| Centros de formación | 4 | Estructura regional cargada |
| Coordinaciones académicas | 21 | Estructura cargada |
| Programas en catálogo | ~192 | **Catálogo regional completo** |
| Fichas (grupos) | ~2.438 | **Operación real masiva ya registrada** |
| Competencias digitalizadas | ~156 | Solo de los programas ya digitalizados |
| RA / Conocimientos / Criterios | ~631 / ~6.377 / ~1.845 | Currículo fino de esos programas |
| Asignaciones instructor–competencia | ~38 | **Incipiente** |
| Sesiones registradas | ~3 | **Casi nulo: la operación apenas inicia** |

**Conclusión objetiva:** la plataforma y su información de referencia están **construidas y cargadas a escala regional** (programas, fichas, estructura). Sin embargo, la **digitalización curricular es parcial** (la mayoría de programas siguen como importación sin diseño detallado) y el **uso operativo —registro de sesiones por los instructores— está en fase piloto/cero**. El motor de avance funciona; falta alimentarlo con la operación diaria.

---

## 5. Madurez por componente

| Componente | Estado |
|---|---|
| Autenticación, roles y alcances | ✅ Operativo |
| Digitalización IA + editor curricular | ✅ Operativo |
| Catálogo de programas / fichas / usuarios / centros | ✅ Operativo |
| Registro de sesiones y motor de avance | ✅ Operativo (sin uso a escala todavía) |
| Evidencias + firmas en documentos | ✅ Operativo |
| Reportes ejecutivos (admin y coordinación) | ✅ Operativo |
| Tema, ajustes de usuario | ✅ Operativo |
| Vista de Subdirección (regional/centro) | 🟡 Parcial |
| Flujo de **revisión** de evidencias (aprobar/rechazar) | ⛔ Pendiente (campo en BD, sin UI) |
| Notificaciones/alertas por correo | ⛔ Pendiente |
| Explotación de **correlaciones curriculares** (IA) | ⛔ Pendiente (datos/infra listos) |
| Precálculo de avance a gran escala (`mv_avance_fichas`) | ⛔ Pendiente (hoy se calcula en vivo) |

---

## 6. Fortalezas diferenciales

1. **Fidelidad al modelo pedagógico SENA**: no es un CRM adaptado; modela el diseño curricular tal cual lo define el SENA.
2. **Avance auditable, no declarativo**: se deriva de la cobertura real de conocimientos y criterios.
3. **Digitalización asistida por IA**: convierte PDF en currículo estructurado, ahorrando semanas de captura manual.
4. **Validez por doble firma**: los soportes descargables quedan firmados por instructor y coordinador, alineado con auditoría.
5. **Gobierno por roles con alcance estricto**: cada quien ve solo lo suyo.
6. **Decisión basada en datos**: reportes y semáforos de riesgo listos para gestión.

---

## 7. Limitaciones y riesgos (honesto)

- **Adopción operativa pendiente**: sin registro de sesiones, los indicadores de avance permanecen en cero. Es el principal riesgo de valor, y es de **gestión del cambio**, no técnico.
- **Cobertura de digitalización baja**: las fichas de programas no digitalizados quedan bloqueadas para seguimiento.
- **Roles de subdirección** sin su propia vista regional/centro.
- **Revisión de evidencias** y **notificaciones automáticas** aún no implementadas.
- **Datos heredados con codificación latin1** (acentos mal representados): requiere migración a UTF‑8 antes de un despliegue formal.
- **Endurecimiento de seguridad**: reforzar que todo acceso se valide contra el token (no solo el front), auditoría de acciones y pruebas automatizadas.

---

## 8. Ruta para convertirlo en referente regional

**Corto plazo (operación)**
1. Campaña de **digitalización** para cerrar la cobertura curricular de los programas activos.
2. **Onboarding de instructores** con meta de registro semanal → activa el motor de avance y los reportes.
3. Migración de **codificación UTF‑8** y checklist de despliegue (variables de entorno, cookies seguras, almacenamiento de evidencias).

**Mediano plazo (valor)**
4. **Vista de Subdirección** (comparativa centro/coordinación/regional).
5. **Notificaciones** automáticas de fichas en riesgo y cierres próximos.
6. **Revisión de evidencias** (aprobar/rechazar) para cerrar el ciclo de calidad.
7. **Precálculo de avance** para tableros instantáneos a gran escala.

**Diferenciación (liderazgo)**
8. Explotar las **correlaciones curriculares** con IA: mapa de prerrequisitos, detección de solapamientos entre programas y recomendaciones de mejora del diseño — un activo que la base de datos ya está preparada para soportar.

---

## 9. Conclusión

FORMA es una base **sólida, coherente con el modelo SENA y técnicamente completa** en sus flujos principales para los tres roles operativos. La estructura regional y el catálogo están cargados a escala; lo que falta no es construir el sistema, sino **ponerlo en operación** (digitalizar lo pendiente y que los instructores registren) y cerrar funciones de gobierno (subdirección, revisión, notificaciones). Con esa adopción, FORMA puede ofrecer a la Regional Atlántico una visibilidad del avance formativo que hoy no existe en una sola herramienta.
