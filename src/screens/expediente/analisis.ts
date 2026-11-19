// Lo que el expediente resume de una etapa: la frase del día y los indicadores.
// Funciones puras sobre los datos que ya trae la API (etapa, cronograma y
// habilitación), para que la pantalla solo pinte.
import type { Cronograma } from '../productiva/cronograma'
import type { EtapaConSeguimientos, SeguimientoProductivo } from '../productiva/types'
import { NOMBRE_MOMENTO, diasEntre, estadoMomento, fdia } from '../../ui/estados'
import type { BitacoraVista } from '../../ui/estados'

export interface Habilitacion {
  habilitado: boolean
  estado_sofia: string | null
  verificado_el: string | null
  sin_verificar: boolean
  eventos: { campo: string; antes: string | null; despues: string | null; fecha_reporte: string }[]
}

// "la planeación", "el seguimiento", "la evaluación"
const EL: Record<string, string> = { PLANEACION: 'la planeación', SEGUIMIENTO: 'el seguimiento', EVALUACION: 'la evaluación' }
const ELM = (t: string) => EL[t] ?? NOMBRE_MOMENTO[t as keyof typeof NOMBRE_MOMENTO].toLowerCase()
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function fraseExpediente(crono: Cronograma, hab: Habilitacion | null): { texto: string; tono?: 'atraso' | 'ok' } {
  const partes: string[] = []
  let tono: 'atraso' | 'ok' | undefined
  if (hab && hab.estado_sofia && !hab.habilitado) {
    partes.push(`Atención: SofiaPlus lo reporta como ${hab.estado_sofia.toLowerCase()} (lectura del ${fdia(hab.verificado_el)}).`)
    tono = 'atraso'
  }
  const total = Math.max(diasEntre(crono.fecha_inicio, crono.fecha_fin_estimada), 1)
  const dia = diasEntre(crono.fecha_inicio, crono.hoy)
  const mes = Math.min(Math.max(Math.ceil((dia + 1) / 30.4), 1), Math.ceil(total / 30.4))
  if (dia >= 0 && dia <= total) partes.push(`Va en el mes ${mes} de ${Math.round(total / 30.4)}.`)

  const estados = crono.momentos.map((m) => ({ m, e: estadoMomento(m, crono.hoy) }))
  const atrasado = estados.find((x) => x.e.tono === 'atraso')
  const toca = estados.find((x) => x.e.tono === 'toca')
  if (atrasado) {
    partes.push(`${cap(ELM(atrasado.m.tipo))} está ${atrasado.m.tipo === 'SEGUIMIENTO' ? 'atrasado' : 'atrasada'}: su plazo era hasta el ${fdia(atrasado.m.ventana_hasta)}.`)
    tono = 'atraso'
  } else if (toca) {
    const quedan = diasEntre(crono.hoy, toca.m.ventana_hasta)
    partes.push(`Le toca ${ELM(toca.m.tipo)}${quedan >= 0 ? `: quedan ${quedan} días (hasta el ${fdia(toca.m.ventana_hasta)})` : ''}.`)
  } else {
    const prox = estados.find((x) => x.e.tono === 'futuro')
    partes.push(prox ? `Todo al día. Lo próximo es ${ELM(prox.m.tipo)}, desde el ${fdia(prox.m.habilitado_desde)}.` : 'Los tres momentos están registrados.')
    if (!tono && !prox) tono = 'ok'
  }

  const bits = crono.bitacoras as BitacoraVista[]
  const sinLeer = bits.filter((b) => b.estado === 'ENTREGADA' && !b.leida_at).length
  const atrasadas = bits.filter((b) => b.vencida).length
  if (sinLeer) partes.push(`Tiene ${sinLeer} bitácora${sinLeer > 1 ? 's' : ''} por leer.`)
  if (atrasadas) partes.push(`El aprendiz tiene ${atrasadas} bitácora${atrasadas > 1 ? 's' : ''} atrasada${atrasadas > 1 ? 's' : ''}.`)
  return { texto: partes.join(' '), tono }
}

const NOMBRE_SEG = (s: SeguimientoProductivo) =>
  s.tipo_momento === 'EVALUACION' ? 'Evaluación'
    : s.motivo_extraordinario ? `Extraordinario ${s.numero_seguimiento ?? ''}`.trim()
    : `Seguimiento ${s.numero_seguimiento ?? ''}`.trim()

export function factoresPorMomento(etapa: EtapaConSeguimientos) {
  return etapa.seguimientos
    .filter((s) => s.valoracion_json && (s.tipo_momento === 'SEGUIMIENTO' || s.tipo_momento === 'EVALUACION'))
    .map((s) => {
      const items = [...(s.valoracion_json?.tecnicos ?? []), ...(s.valoracion_json?.actitudinales ?? [])]
      const valorados = items.filter((i) => i.valor)
      return {
        nombre: NOMBRE_SEG(s),
        satisfactorios: valorados.filter((i) => i.valor === 'SATISFACTORIO').length,
        total: items.length,
        porMejorar: valorados.filter((i) => i.valor === 'POR_MEJORAR').map((i) => i.variable),
      }
    })
}

export function resumenFirmas(etapa: EtapaConSeguimientos) {
  const con = etapa.seguimientos.filter((s) => s.distancia_empresa_m != null)
  const lejana = con.reduce<SeguimientoProductivo | null>((a, s) => (!a || (s.distancia_empresa_m ?? 0) > (a.distancia_empresa_m ?? 0) ? s : a), null)
  return {
    conUbicacion: con.length,
    firmados: etapa.seguimientos.filter((s) => s.firmado_at).length,
    momentos: etapa.seguimientos.length,
    fueraDeRango: con.filter((s) => s.ubicacion_alerta).length,
    masLejana: lejana?.distancia_empresa_m ?? null,
  }
}

export function momentosEnPlazo(crono: Cronograma) {
  const hechos = crono.momentos.filter((m) => m.estado === 'REALIZADO')
  return { hechos: hechos.length, enPlazo: hechos.filter((m) => !m.realizado_fuera_de_ventana).length }
}

// "Lo que pasó": todo lo registrado en la etapa, del más reciente al más viejo.
export function historiaEtapa(etapa: EtapaConSeguimientos, crono: Cronograma | null) {
  const ev: { fecha: string; texto: string }[] = []
  for (const s of etapa.seguimientos) {
    if (s.fecha_realizada) ev.push({ fecha: s.fecha_realizada.slice(0, 10), texto: `${NOMBRE_SEG(s) === 'Evaluación' ? 'Evaluación' : s.tipo_momento === 'PLANEACION' ? 'Planeación' : NOMBRE_SEG(s)} registrada${s.firmado_at ? ' y firmada' : ''}` })
  }
  for (const v of crono?.visitas ?? []) ev.push({ fecha: v.fecha, texto: `Visita agendada (${v.modalidad === 'VIRTUAL' ? 'virtual' : 'presencial'})` })
  for (const b of (crono?.bitacoras ?? []) as BitacoraVista[]) {
    if (b.entregada_at) ev.push({ fecha: String(b.entregada_at).slice(0, 10), texto: `El aprendiz entregó la bitácora ${b.numero}` })
    if (b.leida_at) ev.push({ fecha: String(b.leida_at).slice(0, 10), texto: `El instructor leyó la bitácora ${b.numero}` })
  }
  ev.push({ fecha: etapa.fecha_inicio.slice(0, 10), texto: 'Inicio de la etapa productiva' })
  return ev.sort((a, b) => b.fecha.localeCompare(a.fecha))
}
