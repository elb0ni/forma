import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ic, Btn, Card, BrandMark } from '../../components/ui'
import { Donut, CenterState } from '../shared/parts'
import { PreviewInstructorShell } from './PreviewInstructorShell'
import './CompetenciaPreview.css'

// ─── Datos de ejemplo (prototipo, sin backend) ───────────────────────────────────
// La guía de sesión es el camino minucioso que sigue el instructor en las 4h de
// clase, no un resumen: "actividad" es una ruta de pasos con tiempos, no un
// párrafo. Sesión 2 (hoy) desarrolla HTTP/HTTPS como el contenido técnico
// concreto dentro de "arquitectura por capas". Sesión 1 (ya dictada) y sesión 3
// (preview) siguen el mismo nivel de detalle para que las tres se vean
// consistentes al cambiar entre ellas.
// 4-7 y la última (84, cierre del programa) son "de relleno": tienen fecha y
// número pero aún sin plan — así la línea de sesiones se ve como lo que es,
// una competencia con muchas sesiones, no solo 3. Las fechas son fijas (no el
// reloj real) para que calcen con el horario declarado (lunes y jueves).

interface PasoActividad {
  paso: string
  duracion: string
  detalle: string
}

interface FaseContenido {
  planteamiento: string
  tema: string
  actividad: PasoActividad[]
  conclusion: string
}

type SesionEstado = 'done' | 'active' | 'preview' | 'sinplanear'

interface SesionData {
  numero: number
  estado: SesionEstado
  fecha?: Date
  chipTop: string
  fechaLabel: string
  fechaCompleta: string
  fases?: FaseContenido
}

const HORAS_MAXIMAS = 336
const HORAS_POR_SESION = 4
const TOTAL_SESIONES = HORAS_MAXIMAS / HORAS_POR_SESION // 84
const SESIONES_COMPLETADAS = 1
const HORAS_EJECUTADAS = SESIONES_COMPLETADAS * HORAS_POR_SESION
const AVANCE_PCT = Math.round((HORAS_EJECUTADAS / HORAS_MAXIMAS) * 100)

const SESIONES: SesionData[] = [
  {
    numero: 1,
    estado: 'done',
    fecha: new Date(2026, 6, 27),
    chipTop: '27 jul',
    fechaLabel: '27 jul',
    fechaCompleta: '27 jul 2026',
    fases: {
      planteamiento: 'Se abre la competencia presentando el proyecto formativo transversal: un sistema de gestión de inventario para una pyme de la región, definido en articulación con el proyecto integrador de ficha. Se plantea a los aprendices la pregunta orientadora "¿qué información del negocio necesitamos representar antes de escribir una sola línea de código?", contextualizada con el caso real de una pyme que perdió ventas por no controlar su stock. El instructor fija desde el inicio la regla que va a regir todo el proyecto: ningún diagrama de esta sesión puede mencionar una tabla, una clase de Java ni un framework — solo el vocabulario que usaría el dueño del negocio.',
      tema: 'Ingeniería de requerimientos: requerimientos funcionales y no funcionales, y técnicas de elicitación (entrevista, observación). Modelo de dominio y su diferencia con el modelo de datos: el primero describe conceptos del negocio, el segundo cómo se almacenan. Notación UML para diagramas de clases: clases, atributos, relaciones de asociación, agregación y composición, y multiplicidad (1, 0..1, 1..*, 0..*). Identificación de entidades, atributos y relaciones a partir de una narrativa de negocio.',
      actividad: [
        { paso: 'Entrevista simulada con el cliente', duracion: '30 min', detalle: 'El instructor, en el rol del dueño de la pyme, responde preguntas de los aprendices sobre cómo funciona hoy el control de inventario (a mano, en una libreta). Cada equipo debe salir con al menos 8 requerimientos funcionales redactados en lenguaje natural.' },
        { paso: 'Depuración de requerimientos', duracion: '20 min', detalle: 'En plenaria se filtran los requerimientos ambiguos o técnicos ("debe tener una tabla de productos") y se reescriben en lenguaje de negocio ("debe permitir registrar los productos que vende la pyme").' },
        { paso: 'Identificación de entidades en equipos', duracion: '40 min', detalle: 'Cada equipo subraya los sustantivos relevantes de sus requerimientos y los agrupa en candidatos a entidad: Producto, Categoría, Movimiento de inventario, Proveedor.' },
        { paso: 'Construcción del diagrama de clases de dominio', duracion: '60 min', detalle: 'Con la herramienta de modelado institucional, cada equipo dibuja las entidades identificadas, sus atributos de negocio (sin tipos técnicos) y las relaciones con su multiplicidad, evitando cualquier término de implementación.' },
        { paso: 'Revisión cruzada entre equipos', duracion: '30 min', detalle: 'Cada equipo intercambia su diagrama con otro y busca conceptos técnicos colados (tablas, IDs autoincrementales, tipos de dato) que deban corregirse antes del cierre.' },
      ],
      conclusion: 'Se cierra con la revisión grupal de los diagramas de dominio de cada equipo y retroalimentación del instructor sobre la separación entre conceptos del negocio y detalles de implementación. Corresponde al criterio 1.3 de la guía de aprendizaje: "Representa el modelo de dominio del proyecto de acuerdo con las reglas y el vocabulario del negocio identificado".',
    },
  },
  {
    numero: 2,
    estado: 'active',
    fecha: new Date(2026, 7, 3),
    chipTop: '3 ago · hoy',
    fechaLabel: '3 ago',
    fechaCompleta: '03 ago 2026',
    fases: {
      planteamiento: 'Con el modelo de dominio ya definido, el reto de hoy es decidir cómo van a conversar entre sí los componentes del sistema: el frontend que usan los vendedores, el backend que valida las reglas de negocio, y el futuro servicio de notificaciones de bajo stock. Se presenta un incidente real de referencia: en una prueba con las herramientas de desarrollador del navegador, un equipo descubre que su prototipo envía usuario y contraseña en texto plano por HTTP. Se dispara la pregunta orientadora: ¿qué decisión de arquitectura evita que esto vuelva a pasar, y por qué no basta con "confiar" en que nadie va a interceptar la conexión?',
      tema: 'Protocolo HTTP: modelo de petición-respuesta sin estado; métodos GET, POST, PUT, PATCH y DELETE y su correspondencia con las operaciones CRUD; estructura de una petición (línea de inicio, cabeceras, cuerpo) y de una respuesta (código de estado, cabeceras, cuerpo); familias de códigos de estado (2xx éxito, 3xx redirección, 4xx error del cliente, 5xx error del servidor). Protocolo HTTPS: HTTP transportado sobre una capa de cifrado TLS/SSL; qué garantiza un certificado digital (autenticidad del servidor y confidencialidad del canal); diferencia entre el puerto 80 (HTTP) y el 443 (HTTPS). Arquitectura por capas: por qué la capa de presentación debe consumir la capa de lógica de negocio exclusivamente a través de peticiones HTTPS cuando viajan credenciales o datos de clientes.',
      actividad: [
        { paso: 'Diagnóstico guiado', duracion: '20 min', detalle: 'En parejas, los aprendices capturan con las herramientas de desarrollador del navegador las peticiones que hace el prototipo actual y confirman que viajan por HTTP sin cifrar. Listan qué datos sensibles quedarían expuestos si alguien interceptara esa conexión.' },
        { paso: 'Explicación dirigida', duracion: '30 min', detalle: 'El instructor formaliza en el tablero el modelo petición-respuesta, los métodos HTTP y la diferencia HTTP/HTTPS, retomando como ejemplo las peticiones capturadas por los aprendices en el paso anterior.' },
        { paso: 'Migración práctica a HTTPS', duracion: '90 min', detalle: 'Cada equipo genera un certificado autofirmado para su entorno de desarrollo, migra los endpoints del prototipo de HTTP a HTTPS y ajusta el cliente para que rechace cualquier respuesta que no venga cifrada. Deben justificar por escrito el método HTTP elegido para cada operación del CRUD de inventario.' },
        { paso: 'Verificación cruzada entre equipos', duracion: '40 min', detalle: 'Cada equipo intercambia su API con otro equipo, que intenta consumirla por HTTP plano y documenta el rechazo, confirmando que la migración quedó correctamente forzada.' },
        { paso: 'Cierre y registro', duracion: '20 min', detalle: 'Se actualiza el diagrama de componentes marcando el protocolo usado en cada conexión y se sustenta ante el instructor en una socialización de 5 minutos por equipo.' },
      ],
      conclusion: 'Cada equipo entrega el diagrama de componentes actualizado —con el protocolo HTTPS marcado en cada conexión entre capas— y el registro de la verificación cruzada. Se evalúa según el criterio 2.1: "Elabora artefactos de diseño de software aplicando patrones y principios de arquitectura, de acuerdo con los requerimientos funcionales y no funcionales del proyecto formativo", tomando la protección de datos en tránsito como requerimiento no funcional obligatorio.',
    },
  },
  {
    numero: 3,
    estado: 'preview',
    fecha: new Date(2026, 7, 6),
    chipTop: 'preview',
    fechaLabel: '6 ago',
    fechaCompleta: '06 ago 2026',
    fases: {
      planteamiento: 'Con la comunicación entre capas ya cifrada, se plantea el siguiente reto: el sistema debe soportar distintos canales para notificar el bajo stock (correo, SMS, panel interno) sin modificar la lógica central del inventario cada vez que se agregue un nuevo canal. Se problematiza el crecimiento descontrolado de condicionales ("si el canal es correo... si el canal es SMS...") como síntoma de un diseño rígido que va a colapsar en cuanto el negocio pida un cuarto o quinto canal.',
      tema: 'Patrones de comportamiento: Observer (para desacoplar quién genera un evento de quién reacciona a él) y Strategy (para intercambiar el algoritmo de envío según el canal sin tocar el código que lo invoca). Principio de abierto/cerrado (Open/Closed): el módulo debe poder extenderse con nuevos canales sin modificar su código existente. Diagramas de secuencia UML para representar el flujo de mensajes entre objetos a lo largo del tiempo.',
      actividad: [
        { paso: 'Análisis del código rígido actual', duracion: '20 min', detalle: 'En equipos, los aprendices leen el módulo de notificaciones del prototipo (con condicionales anidados por canal) e identifican qué pasaría si el negocio pidiera agregar WhatsApp como canal nuevo.' },
        { paso: 'Diseño del patrón Observer', duracion: '40 min', detalle: 'El instructor guía la identificación del sujeto (el evento de bajo stock) y los observadores (cada canal de notificación), y su representación en un diagrama de clases.' },
        { paso: 'Implementación de Observer y Strategy', duracion: '90 min', detalle: 'Cada equipo refactoriza su módulo de notificaciones desacoplando el disparo del evento de los canales concretos mediante Observer, y encapsula la lógica de envío de cada canal como una Strategy intercambiable.' },
        { paso: 'Prueba de extensión', duracion: '40 min', detalle: 'Cada equipo agrega un canal de notificación ficticio nuevo (por ejemplo, un log de auditoría) sin modificar ninguna línea del código ya existente, y documenta cuánto les tomó — evidencia directa del principio abierto/cerrado.' },
        { paso: 'Elaboración del diagrama de secuencia', duracion: '30 min', detalle: 'Se documenta, con un diagrama de secuencia, el flujo comparado del módulo antes y después de la refactorización.' },
      ],
      conclusion: 'Se entrega el módulo refactorizado junto con el diagrama de secuencia comparativo y la evidencia de la prueba de extensión. Corresponde al criterio 2.2: "Aplica patrones de diseño de comportamiento para resolver requerimientos de extensibilidad del sistema, de acuerdo con buenas prácticas de ingeniería de software".',
    },
  },
  { numero: 4, estado: 'sinplanear', fecha: new Date(2026, 7, 10), chipTop: '10 ago', fechaLabel: '10 ago', fechaCompleta: '10 ago 2026' },
  { numero: 5, estado: 'sinplanear', fecha: new Date(2026, 7, 13), chipTop: '13 ago', fechaLabel: '13 ago', fechaCompleta: '13 ago 2026' },
  { numero: 6, estado: 'sinplanear', fecha: new Date(2026, 7, 17), chipTop: '17 ago', fechaLabel: '17 ago', fechaCompleta: '17 ago 2026' },
  { numero: 7, estado: 'sinplanear', fecha: new Date(2026, 7, 20), chipTop: '20 ago', fechaLabel: '20 ago', fechaCompleta: '20 ago 2026' },
  { numero: TOTAL_SESIONES, estado: 'sinplanear', chipTop: 'por programar', fechaLabel: 'por programar', fechaCompleta: 'por programar' },
]

const DIA_NO_REGISTRADO = new Date(2026, 6, 30) // jue 30 jul — clase declarada, sin sesión
const HOY = new Date(2026, 7, 3)

// ─── KPIs (mismo lenguaje visual que FichaDetalleView) ───────────────────────────

function KpiPlain({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: 'clock' | 'calendar' }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        <Ic n={icon} s={14} style={{ color: '#a1a1aa' }}/>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 22, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 4 }}>{sub}</div>
    </Card>
  )
}

function KpiDonut({ label, value, sub, pct, color }: { label: string; value: string; sub: string; pct: number; color: string }) {
  return (
    <Card style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <Donut value={pct} size={48} stroke={5} color={color}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600 }}>{value}</span>
      </Donut>
      <div>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: '#3f3f46', marginTop: 2 }}>{sub}</div>
      </div>
    </Card>
  )
}

// ─── Calendario (lectura del horario declarado, no un control) ──────────────────

type DiaEstado = 'done' | 'active' | 'preview' | 'warn' | 'pendiente' | 'none'

function buildCalendarGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1)
  const startOffset = (first.getDay() + 6) % 7 // días desde el lunes anterior
  const start = new Date(year, monthIndex, 1 - startOffset)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  return Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function estadoDia(d: Date): { estado: DiaEstado; numero?: number } {
  const key = d.toDateString()
  const sesion = SESIONES.find(s => s.fecha?.toDateString() === key)
  if (sesion) return { estado: sesion.estado === 'sinplanear' ? 'pendiente' : sesion.estado, numero: sesion.numero }
  if (key === DIA_NO_REGISTRADO.toDateString()) return { estado: 'warn' }
  const dow = d.getDay()
  if ((dow === 1 || dow === 4) && d > HOY) return { estado: 'pendiente' }
  return { estado: 'none' }
}

const TONE: Record<DiaEstado, { fg: string; dot?: string }> = {
  done:      { fg: '#18181b', dot: '#16a34a' },
  active:    { fg: '#18181b', dot: '#4f46e5' },
  preview:   { fg: '#18181b', dot: '#a1a1aa' },
  warn:      { fg: '#18181b', dot: '#ca8a04' },
  pendiente: { fg: '#a1a1aa' },
  none:      { fg: '#e4e4e7' },
}

function CalendarCell({ date, inMonth, estado, numero, seleccionada, onSelect }: {
  date: Date; inMonth: boolean; estado: DiaEstado; numero?: number
  seleccionada: number; onSelect: (n: number) => void
}) {
  const tone = TONE[estado]
  const selected = numero !== undefined && numero === seleccionada
  const clickable = numero !== undefined

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onSelect(numero)}
      title={clickable ? `Sesión ${numero}` : undefined}
      className="cp-cal-btn"
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10.5, fontWeight: estado === 'active' || selected ? 600 : 400,
        color: selected ? '#fff' : (!inMonth && !clickable && estado !== 'warn') ? '#e4e4e7' : tone.fg,
        background: selected ? '#4f46e5' : 'transparent',
        border: !selected && estado === 'active' ? '1.5px solid #4f46e5' : '1px solid transparent',
      }}>
        {date.getDate()}
      </div>
      {tone.dot && (
        <span style={{ width: 3.5, height: 3.5, borderRadius: '50%', background: selected ? '#4f46e5' : tone.dot }}/>
      )}
    </button>
  )
}

function Legend({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#71717a' }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: ring ? 'transparent' : color,
        border: ring ? `1.5px solid ${color}` : 'none',
      }}/>
      {label}
    </div>
  )
}

function ScheduleCalendar({ seleccionada, onSelect }: { seleccionada: number; onSelect: (n: number) => void }) {
  const cells = buildCalendarGrid(2026, 7) // agosto

  return (
    <Card style={{ padding: '18px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 2 }}>Agosto 2026</div>
      <div style={{ fontSize: 10.5, color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
        <Ic n="lock" s={10}/> horario declarado, solo lectura
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9.5, color: '#a1a1aa', fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map(d => {
          const { estado, numero } = estadoDia(d)
          return (
            <CalendarCell key={d.toISOString()} date={d} inMonth={d.getMonth() === 7}
              estado={estado} numero={numero} seleccionada={seleccionada} onSelect={onSelect}/>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 8, columnGap: 6, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f1f3' }}>
        <Legend color="#16a34a" label="Registrada"/>
        <Legend color="#ca8a04" label="No registrada"/>
        <Legend color="#4f46e5" label="Hoy" ring/>
        <Legend color="#a1a1aa" label="Programada"/>
      </div>
    </Card>
  )
}

function ProximasSesiones({ seleccionada, onSelect }: { seleccionada: number; onSelect: (n: number) => void }) {
  const proximas = SESIONES.filter(s => s.numero !== 1 && s.numero !== TOTAL_SESIONES)
  const restantes = TOTAL_SESIONES - SESIONES.length

  return (
    <Card style={{ padding: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#71717a', margin: '0 0 10px' }}>
        Próximas sesiones
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {proximas.map(s => {
          const active = s.numero === seleccionada
          return (
            <button key={s.numero} onClick={() => onSelect(s.numero)}
              className={`cp-upcoming-btn${active ? ' cp-upcoming-btn--active' : ''}`}>
              <span style={{ fontSize: 12, color: active ? '#4338ca' : '#3f3f46', fontWeight: active ? 600 : 400 }}>Sesión {s.numero}</span>
              <span style={{ fontSize: 11, color: active ? '#4338ca' : '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{s.fechaLabel}</span>
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid #f1f1f3', fontSize: 11, color: '#a1a1aa', textAlign: 'center' }}>
        +{restantes} sesiones más hasta el cierre
      </div>
    </Card>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function CompetenciaPreview() {
  "use no memo"
  const navigate = useNavigate()
  const [seleccionada, setSeleccionada] = useState(2)
  const [aviso, setAviso] = useState(false)

  const sesion = SESIONES.find(s => s.numero === seleccionada) ?? SESIONES[1]

  function accionSesion() {
    if (sesion.estado !== 'active') return
    setAviso(true)
    setTimeout(() => setAviso(false), 2500)
  }

  return (
    <PreviewInstructorShell breadcrumb={['Instructor', 'Mis fichas']} title="Mis fichas">
      <div className="cp-page">
        <button onClick={() => navigate(-1)} style={{
          fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none',
          border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit',
        }}>
          <Ic n="arrowLeft" s={14}/>Volver a la ficha
        </button>

        {/* Fila principal: contenido con límite de ancho (izquierda) + calendario que
            llena el espacio que sobra a la derecha (sin límite, hasta el borde real de
            la pantalla). alignItems por defecto es 'stretch', así que la columna del
            calendario iguala la altura de la columna izquierda — eso es lo que le da
            recorrido al sticky del calendario a través de toda la guía de sesión. */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '0 1 1100px', maxWidth: 1100, minWidth: 0 }}>

            {/* Encabezado — mismo lenguaje que el detalle de ficha: texto plano, sin bloques de color */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 300 }}>
                <div style={{ fontSize: 12, color: '#52525b', marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>220501095</span>
                  <span>·</span><span>Técnica</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Modelado de los artefactos del software</h2>
                <div style={{ marginTop: 4, display: 'flex', gap: 10, fontSize: 13, color: '#3f3f46', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#18181b' }}>Ficha 3410678</span>
                  <span style={{ color: '#a1a1aa' }}>·</span>
                  <span>Mañana · BARRANQUILLA</span>
                  <span style={{ color: '#a1a1aa' }}>·</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#71717a' }}>
                    <Ic n="lock" s={12}/> lunes y jueves · 4h por sesión
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, alignSelf: 'flex-start' }}>
                <Btn variant={sesion.estado === 'active' ? 'accent' : 'secondary'} disabled={sesion.estado !== 'active'} onClick={accionSesion}>
                  {sesion.estado === 'done' && 'Sesión ya registrada'}
                  {sesion.estado === 'active' && `Iniciar sesión ${sesion.numero}`}
                  {sesion.estado === 'preview' && `Disponible el ${sesion.fechaLabel}`}
                  {sesion.estado === 'sinplanear' && 'Sin planear aún'}
                </Btn>
                {aviso && <span style={{ fontSize: 11, color: '#71717a' }}>Prototipo de diseño — sin conexión al backend.</span>}
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 24 }}>
              <KpiDonut label="Avance" value={`${AVANCE_PCT}%`} sub={`${HORAS_EJECUTADAS}/${HORAS_MAXIMAS} h`} pct={AVANCE_PCT} color="#4f46e5"/>
              <KpiPlain label="Horas ejecutadas" value={String(HORAS_EJECUTADAS)} sub={`de ${HORAS_MAXIMAS} h del programa`} icon="clock"/>
              <KpiDonut label="Sesiones" value={`${SESIONES_COMPLETADAS}/${TOTAL_SESIONES}`} sub="completadas" pct={(SESIONES_COMPLETADAS / TOTAL_SESIONES) * 100} color="#16a34a"/>
              <KpiPlain label="Fecha de cierre" value="15 dic 2027" sub="+1 día por sesión no registrada" icon="calendar"/>
            </div>

            {/* Línea de sesiones — navegación principal de la pantalla */}
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 2px 8px' }}>
              {SESIONES.map((s, i) => (
                <span key={s.numero} style={{ display: 'flex', gap: 10 }}>
                  {i === SESIONES.length - 1 && (
                    <span className="cp-chip-ellipsis" aria-hidden="true">···</span>
                  )}
                  <button
                    onClick={() => setSeleccionada(s.numero)}
                    className={`cp-chip cp-chip--${s.estado}${seleccionada === s.numero ? ' cp-chip--selected' : ''}`}
                  >
                    <p style={{
                      fontSize: 11, margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 4,
                      color: s.estado === 'active' ? '#fff' : '#71717a',
                      opacity: s.estado === 'active' ? 0.7 : 1,
                    }}>
                      {s.estado === 'done' && <Ic n="check" s={12}/>}
                      {s.chipTop}
                    </p>
                    <p style={{ fontSize: 13, margin: 0, color: s.estado === 'active' ? '#fff' : '#3f3f46' }}>
                      Sesión {s.numero}
                    </p>
                  </button>
                </span>
              ))}
            </div>

            {/* Guía de sesión — vista de documento, como el preview de Reportes */}
            <div className="cp-doc">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BrandMark size={28}/>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>FORMA</div>
                    <div style={{ fontSize: 10.5, color: '#71717a', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Guía de sesión</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Sesión {sesion.numero} · {sesion.fechaCompleta}</div>
                  <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2 }}>Modelado de los artefactos del software</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 32, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f1f3', flexWrap: 'wrap' }}>
                <div>
                  <p className="cp-doc__label">Ficha</p>
                  <p className="cp-doc__value" style={{ fontWeight: 600 }}>3410678 · Mañana · Barranquilla</p>
                </div>
                <div>
                  <p className="cp-doc__label">Competencia</p>
                  <p className="cp-doc__value" style={{ fontWeight: 600 }}>220501095 · Técnica</p>
                </div>
              </div>

              {sesion.fases ? (
                <div className="cp-doc__timeline">
                  <div className="cp-doc__step">
                    <div className="cp-doc__step-num"><Ic n="target" s={13}/></div>
                    <p className="cp-doc__label">Planteamiento</p>
                    <p className="cp-doc__value">{sesion.fases.planteamiento}</p>
                  </div>

                  <div className="cp-doc__step">
                    <div className="cp-doc__step-num"><Ic n="fileText" s={13}/></div>
                    <p className="cp-doc__label">Tema · saber</p>
                    <p className="cp-doc__value">{sesion.fases.tema}</p>
                  </div>

                  <div className="cp-doc__step">
                    <div className="cp-doc__step-num"><Ic n="edit" s={13}/></div>
                    <p className="cp-doc__label">Actividad · proceso — ruta de la sesión</p>
                    <div className="cp-doc__substeps">
                      {sesion.fases.actividad.map((paso, i) => (
                        <div key={i} className="cp-doc__substep">
                          <span className="cp-doc__substep-num">{i + 1}</span>
                          <div style={{ minWidth: 0 }}>
                            <p className="cp-doc__substep-title">
                              {paso.paso}
                              <span className="cp-doc__substep-dur">{paso.duracion}</span>
                            </p>
                            <p className="cp-doc__value">{paso.detalle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="cp-doc__step">
                    <div className="cp-doc__step-num"><Ic n="checkCircle" s={13}/></div>
                    <p className="cp-doc__label">Conclusión · criterio</p>
                    <p className="cp-doc__value">{sesion.fases.conclusion}</p>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <CenterState icon="edit" title="Sesión aún no planeada"
                    sub="El planteamiento, el tema, la actividad y el criterio se definen más cerca de la fecha de clase."/>
                </div>
              )}

              <div className="cp-doc__foot">
                <span>FORMA · Plataforma de seguimiento curricular</span>
                <span>sesión {sesion.numero} de {TOTAL_SESIONES}</span>
              </div>
            </div>
          </div>

          {/* Calendario — llena lo que sobra a la derecha del contenido limitado, fijo
              mientras se hace scroll por la guía de sesión, sincronizado con la línea
              de sesiones. Al heredar la altura de la columna izquierda (stretch), el
              sticky tiene recorrido a través de todo el documento y se libera solo al
              llegar al final — no flota más allá de eso. */}
          <div style={{
            flex: '1 1 0', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 12,
            position: 'sticky', top: 12,
          }}>
            <ScheduleCalendar seleccionada={seleccionada} onSelect={setSeleccionada}/>
            <ProximasSesiones seleccionada={seleccionada} onSelect={setSeleccionada}/>
          </div>
        </div>
      </div>
    </PreviewInstructorShell>
  )
}
