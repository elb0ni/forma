import api from '../../lib/api'
import type { SesionDetalle } from '../instructor/types'

// Genera la "Guía de aprendizaje" de una sesión como documento imprimible (PDF
// vía el diálogo de impresión del navegador). Compartido entre el instructor
// (que ya tiene el detalle) y el super admin/coordinación (que lo trae por id).

const TIPO_LABEL: Record<string, string> = { PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', MIXTA: 'Mixta' }

function esc(v: string | null | undefined): string {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function fechaLarga(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Documento autocontenido (HTML + estilos de impresión).
export function buildGuiaHTML(s: SesionDetalle): string {
  const proceso = s.conocimientos.filter(c => (c.tipo ?? '').toUpperCase() === 'PROCESO')
  const saber   = s.conocimientos.filter(c => (c.tipo ?? '').toUpperCase() === 'SABER')
  const otros   = s.conocimientos.filter(c => !['PROCESO', 'SABER'].includes((c.tipo ?? '').toUpperCase()))

  const idRows: [string, string][] = [
    ['Programa de formación', `${esc(s.programa_nombre)} (${esc(s.programa_codigo)})`],
    ['Ficha', esc(s.numero_ficha)],
    ['Competencia', `${esc(s.codigo_norma)} · ${esc(s.competencia_nombre)}`],
    ['Instructor', esc(s.instructor_nombre)],
    ['Sede', esc(s.sede ?? '—')],
    ['Fecha de la sesión', fechaLarga(s.fecha)],
    ['Duración', `${s.horas_ejecutadas.toFixed(1)} horas`],
    ['Modalidad', esc(TIPO_LABEL[s.tipo_sesion] ?? s.tipo_sesion)],
    ['Estado', esc(s.estado_sesion)],
  ]
  const ident = idRows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')

  const raList = s.resultados_aprendizaje.length
    ? `<ol class="ra">${s.resultados_aprendizaje.map(ra =>
        `<li><span class="mono">${esc(ra.numero)}</span> ${esc(ra.descripcion)}</li>`).join('')}</ol>`
    : `<p class="empty">No se registraron resultados de aprendizaje en esta sesión.</p>`

  const conGroup = (title: string, list: typeof s.conocimientos) =>
    list.length
      ? `<div class="subh">${title}</div><ul class="bul">${list.map(c => `<li>${esc(c.descripcion)}</li>`).join('')}</ul>`
      : ''
  const conBody = s.conocimientos.length
    ? conGroup('De proceso', proceso) + conGroup('Del saber', saber) + conGroup('Conocimientos', otros)
    : `<p class="empty">No se registraron conocimientos en esta sesión.</p>`

  const critBody = s.criterios.length
    ? `<ul class="bul">${s.criterios.map(c => `<li>${esc(c.descripcion)}</li>`).join('')}</ul>`
    : `<p class="empty">No se registraron criterios de evaluación en esta sesión.</p>`

  const obs = s.observaciones?.trim()
    ? `<p class="obs">${esc(s.observaciones).replace(/\n/g, '<br/>')}</p>`
    : `<p class="empty">Sin observaciones registradas.</p>`

  // Materiales de formación agrupados por tipo (clasificación SENA).
  const MAT_LABEL: Record<string, string> = {
    DEVOLUTIVO: 'Devolutivos (equipos y herramientas)',
    CONSUMO: 'De consumo',
    DIDACTICO: 'Medios didácticos / material de apoyo',
    AMBIENTE: 'Ambiente de formación',
  }
  const mats = s.materiales ?? []
  const matGroup = (tipo: string) => {
    const list = mats.filter(m => m.tipo === tipo)
    if (!list.length) return ''
    const rows = list.map(m => {
      const cant = (m.cantidad != null || m.unidad)
        ? ` <span class="mono">(${m.cantidad ?? ''}${m.unidad ? ' ' + esc(m.unidad) : ''})</span>` : ''
      return `<li>${esc(m.nombre)}${cant}</li>`
    }).join('')
    return `<div class="subh">${MAT_LABEL[tipo] ?? tipo}</div><ul class="bul">${rows}</ul>`
  }
  const matBody = mats.length
    ? ['DEVOLUTIVO', 'CONSUMO', 'DIDACTICO', 'AMBIENTE'].map(matGroup).join('')
    : `<p class="empty">No se registraron materiales de formación en esta sesión.</p>`

  const generado = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  // Bloque de firma: imagen real si existe, o línea + "pendiente".
  const firmaBlock = (firma: string | null | undefined, nombre: string, documento: string | null | undefined, rol: string) => {
    const sig = firma && firma.startsWith('data:image')
      ? `<img src="${firma}" alt="firma"/>`
      : `<span class="pend">Pendiente de firma</span>`
    const doc = documento ? `<div class="doc">C.C. ${esc(documento)}</div>` : ''
    return `<div class="firma">
      <div class="sig">${sig}</div>
      <div class="line">&nbsp;</div>
      <div class="nm">${esc(nombre)}</div>
      <div class="rol">${rol}</div>
      ${doc}
    </div>`
  }

  const tieneAmbas = !!(s.instructor_firma && s.coordinador_firma)
  const cert = tieneAmbas
    ? `<div class="cert ok">&#10003; Documento certificado · firmado por el instructor y el coordinador académico.</div>`
    : `<div class="cert pend">&#9888; Documento sin certificar · faltan firmas (${[!s.instructor_firma ? 'instructor' : null, !s.coordinador_firma ? 'coordinador' : null].filter(Boolean).join(' y ')}).</div>`

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/>
<title>Guía de aprendizaje · Ficha ${esc(s.numero_ficha)}</title>
<style>
  @page { size: A4; margin: 16mm 15mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #18181b; font-size: 11.5px; line-height: 1.55; }
  .mono { font-family: "Consolas", "Courier New", monospace; }
  .doc { max-width: 760px; margin: 0 auto; padding: 8px 0 40px; }
  .actions { background: #f1f1f3; border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .actions button { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .actions span { font-size: 11px; color: #71717a; }
  .topband { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; }
  .brand { font-size: 17px; font-weight: 700; letter-spacing: .5px; color: #4f46e5; }
  .brand small { display: block; font-size: 9px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: #71717a; margin-top: 2px; }
  .topright { text-align: right; font-size: 9.5px; color: #71717a; }
  h1 { font-size: 20px; font-weight: 700; margin: 22px 0 2px; color: #0a0a0b; }
  .sub { font-size: 11px; color: #52525b; margin-bottom: 18px; }
  .ident { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  .ident th, .ident td { text-align: left; padding: 6px 10px; border: 1px solid #e4e4e7; vertical-align: top; font-size: 11px; }
  .ident th { width: 32%; background: #f7f7f8; color: #3f3f46; font-weight: 600; }
  section { margin-bottom: 18px; page-break-inside: avoid; }
  .sh { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #4f46e5; border-bottom: 1px solid #e4e4e7; padding-bottom: 5px; margin-bottom: 9px; }
  .subh { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #71717a; margin: 8px 0 3px; }
  ol.ra { margin: 0; padding-left: 20px; } ol.ra li { margin-bottom: 6px; }
  ol.ra .mono { color: #71717a; font-size: 10px; margin-right: 4px; }
  ul.bul { margin: 0; padding-left: 18px; } ul.bul li { margin-bottom: 4px; }
  .obs { margin: 0; }
  .empty { color: #a1a1aa; font-style: italic; margin: 0; }
  .firmas { display: flex; gap: 40px; margin-top: 40px; page-break-inside: avoid; }
  .firma { flex: 1; text-align: center; }
  .firma .sig { height: 60px; display: flex; align-items: flex-end; justify-content: center; }
  .firma .sig img { max-height: 58px; max-width: 90%; }
  .firma .sig .pend { font-size: 10px; color: #c0392b; font-style: italic; align-self: center; }
  .firma .line { border-top: 1px solid #18181b; margin-bottom: 5px; }
  .firma .rol { font-size: 10px; color: #52525b; }
  .firma .nm { font-size: 11px; font-weight: 600; }
  .firma .doc { font-size: 9.5px; color: #71717a; font-family: "Consolas","Courier New",monospace; }
  .cert { margin-top: 18px; border-radius: 8px; padding: 9px 14px; font-size: 10.5px; display: flex; align-items: center; gap: 8px; }
  .cert.ok { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
  .cert.pend { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .foot { margin-top: 30px; padding-top: 8px; border-top: 1px solid #e4e4e7; display: flex; justify-content: space-between; font-size: 9px; color: #a1a1aa; }
  @media print { .actions { display: none !important; } .doc { padding-top: 0; } }
</style></head>
<body><div class="doc">
  <div class="actions">
    <button onclick="window.print()">Imprimir / Guardar como PDF</button>
    <span>Elige "Guardar como PDF" en el destino de impresión.</span>
  </div>

  <div class="topband">
    <div class="brand">FORMA<small>Plataforma de seguimiento curricular</small></div>
    <div class="topright">SENA · Regional Atlántico<br/>Generado el ${generado}</div>
  </div>

  <h1>Guía de aprendizaje</h1>
  <div class="sub">Informe de la sesión de formación</div>

  <table class="ident"><tbody>${ident}</tbody></table>

  <section><div class="sh">Resultados de aprendizaje abordados</div>${raList}</section>
  <section><div class="sh">Conocimientos desarrollados</div>${conBody}</section>
  <section><div class="sh">Criterios de evaluación aplicados</div>${critBody}</section>
  <section><div class="sh">Materiales de formación</div>${matBody}</section>
  <section><div class="sh">Desarrollo y observaciones</div>${obs}</section>

  <div class="firmas">
    ${firmaBlock(s.instructor_firma, s.instructor_nombre, s.instructor_documento, 'Instructor')}
    ${firmaBlock(s.coordinador_firma, s.coordinador_nombre ?? 'Sin coordinador asignado', s.coordinador_documento, 'Coordinador académico')}
  </div>
  ${cert}

  <div class="foot">
    <span>FORMA · Guía de aprendizaje · Ficha ${esc(s.numero_ficha)}</span>
    <span>${esc(s.competencia_nombre)}</span>
  </div>
</div>
<script>
  window.onafterprint = function(){ try { window.close(); } catch (e) {} };
  setTimeout(function(){ window.focus(); window.print(); }, 250);
</script>
</body></html>`
}

// Escribe el documento en una ventana ya abierta y la deja lista para imprimir.
function render(w: Window, s: SesionDetalle) {
  w.document.open()
  w.document.write(buildGuiaHTML(s))
  w.document.close()
}

// Para el INSTRUCTOR: ya tiene el detalle, abre y escribe de forma síncrona.
export function exportarGuia(s: SesionDetalle) {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) return // ventana emergente bloqueada
  render(w, s)
}

// Para SUPER ADMIN/COORDINACIÓN: abre la ventana en el clic (evita el bloqueo de
// pop-ups), trae el detalle de cualquier sesión por id y luego escribe el documento.
export async function descargarGuiaSesion(sesionId: number) {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) return
  w.document.write('<p style="font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#52525b">Generando guía de aprendizaje…</p>')
  try {
    const r = await api.get<SesionDetalle>(`/dashboard/instructor/monitor-sesion/${sesionId}`)
    render(w, r.data)
  } catch {
    w.document.body.innerHTML = '<p style="font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#b91c1c">No se pudo generar la guía de aprendizaje.</p>'
  }
}
