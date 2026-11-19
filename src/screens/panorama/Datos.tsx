// "Datos" (PLAN_REDISENO, Fase 9): qué tan fiel es la copia de SofiaPlus.
// Salud de la ingesta (PE-04 y robot de juicios), cobertura de la lectura por
// segmento del ciclo y conciliación: aprendices en práctica que SofiaPlus ya
// no da por activos o que desaparecieron de su ficha, y fichas sin verificar.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { Lienzo, Frase, Estado, Panel } from '../../ui'
import { diasEntre, fdia, fdiaAnio } from '../../ui/estados'
import { miles } from './formato'
import './panorama.css'

interface Segmento { total: number; al_dia: number }
interface Salud {
  hoy: string
  pe04: { id: number; estado: string; fecha_corte: string | null; created_at: string } | null
  robot: { estado: string; fichas_objetivo: number; fichas_ok: number; fichas_error: number; aprendices: number; iniciada_at: string; terminada_at: string | null; actividad_at: string | null } | null
  robot_detenido: boolean
  cobertura: { total: number; al_dia: number; por_segmento: Record<'ENTRANDO' | 'PRACTICA' | 'CERRANDO', Segmento> }
}
interface AprendizConc { etapa_id: number; nombre_completo: string; numero_documento: string; numero_ficha: string; estado_sofia?: string; fecha_reporte: string | null }
interface Conciliacion {
  inactivos_en_sofia: AprendizConc[]
  desaparecidos: AprendizConc[]
  fichas_sin_verificar: { ficha_id: number; numero_ficha: string; leida: string | null }[]
}

const SEGMENTO: Record<string, { nombre: string; cada: string }> = {
  ENTRANDO: { nombre: 'Por entrar a práctica', cada: 'se leen cada semana' },
  PRACTICA: { nombre: 'En práctica', cada: 'se leen cada 2 semanas' },
  CERRANDO: { nombre: 'Cerrando', cada: 'se leen cada semana, hasta 2 meses después del fin' },
}

export function Datos({ rutaIntegridad }: { rutaIntegridad?: string }) {
  const [salud, setSalud] = useState<Salud | null>(null)
  const [conc, setConc] = useState<Conciliacion | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verFichas, setVerFichas] = useState(false)

  useEffect(() => {
    let vivo = true
    api.get<Salud>('/juicios/salud').then((r) => { if (vivo) setSalud(r.data) })
      .catch((e) => { if (vivo) setErr(e?.response?.data?.message ?? 'No se pudo leer la salud de los datos.') })
    api.get<Conciliacion>('/juicios/conciliacion').then((r) => { if (vivo) setConc(r.data) }).catch(() => undefined)
    return () => { vivo = false }
  }, [])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!salud) return <Lienzo><p className="fx-texto-3">Revisando los datos…</p></Lienzo>

  const pe04Dias = salud.pe04?.fecha_corte ? diasEntre(salud.pe04.fecha_corte, salud.hoy) : null
  const robotDias = salud.robot?.iniciada_at ? diasEntre(salud.robot.iniciada_at.slice(0, 10), salud.hoy) : null
  const cob = salud.cobertura
  const pctCob = cob.total ? Math.round((cob.al_dia / cob.total) * 100) : 0
  const problemas = (conc?.inactivos_en_sofia.length ?? 0) + (conc?.desaparecidos.length ?? 0)

  const frase = [
    salud.pe04 ? `El último PE-04 es del ${fdiaAnio(salud.pe04.fecha_corte)}${pe04Dias != null && pe04Dias > 8 ? ` (hace ${pe04Dias} días: toca cargar el de esta semana)` : ''}.` : 'Todavía no se ha cargado un PE-04.',
    salud.robot ? `El robot de juicios corrió el ${fdia(salud.robot.iniciada_at)}${salud.robot_detenido ? ' y parece detenido' : ''}.` : 'El robot de juicios aún no ha corrido.',
    `${pctCob}% de las fichas del ciclo tienen sus juicios al día.`,
    problemas ? `${problemas} aprendices en práctica no cuadran con SofiaPlus.` : '',
  ].filter(Boolean).join(' ')

  return (
    <Lienzo className="pan">
      <header className="pan-cab">
        <div>
          <div className="fx-eyebrow">Copia fiel de SofiaPlus · {fdia(salud.hoy)}</div>
          <h1 className="fx-titulo">Datos</h1>
        </div>
        {rutaIntegridad && (
          <div className="pan-filtros">
            <Link className="fx-boton" data-tipo="suave" to={`${rutaIntegridad}/sofia`}>PE-04</Link>
            <Link className="fx-boton" data-tipo="suave" to={`${rutaIntegridad}/catalogo`}>Catálogo</Link>
            <Link className="fx-boton" data-tipo="suave" to={`${rutaIntegridad}/disenos`}>Diseños curriculares</Link>
          </div>
        )}
      </header>

      <Frase tono={problemas || salud.robot_detenido || (pe04Dias ?? 0) > 8 ? 'atraso' : 'ok'}>{frase}</Frase>

      <div className="pan-cifras pan-cifras-3">
        <div className="pan-cifra">
          <span className="k">PE-04 (fichas y fechas)</span>
          <span className="v fx-num" data-tono={(pe04Dias ?? 99) > 8 ? 'atraso' : undefined}>{salud.pe04 ? fdia(salud.pe04.fecha_corte) : '—'}</span>
          <span className="n">{salud.pe04 ? `${salud.pe04.estado.toLowerCase()} · lo carga el super admin cada semana` : 'sin cargar'}</span>
        </div>
        <div className="pan-cifra">
          <span className="k">Robot de juicios</span>
          <span className="v fx-num" data-tono={salud.robot_detenido || (robotDias ?? 99) > 8 ? 'atraso' : undefined}>{salud.robot ? fdia(salud.robot.iniciada_at) : '—'}</span>
          <span className="n">
            {salud.robot
              ? `${salud.robot.estado.toLowerCase()} · ${salud.robot.fichas_ok} de ${salud.robot.fichas_objetivo} fichas${salud.robot.fichas_error ? `, ${salud.robot.fichas_error} con error` : ''} · ${miles(salud.robot.aprendices)} aprendices`
              : 'no ha corrido'}
          </span>
        </div>
        <div className="pan-cifra">
          <span className="k">Juicios al día</span>
          <span className="v fx-num" data-tono={pctCob < 80 ? 'atraso' : undefined}>{pctCob}%</span>
          <span className="n">{miles(cob.al_dia)} de {miles(cob.total)} fichas del ciclo</span>
        </div>
      </div>

      <Panel titulo="Lectura de juicios por segmento del ciclo">
        <div className="pan-meses">
          {(['ENTRANDO', 'PRACTICA', 'CERRANDO'] as const).map((k) => {
            const s = cob.por_segmento[k]
            const p = s.total ? (s.al_dia / s.total) * 100 : 0
            return (
              <div key={k} className="pan-mes" title={`${s.al_dia} de ${s.total} al día`}>
                <span className="pan-mes-nombre pan-tal-cual">{SEGMENTO[k].nombre}</span>
                <span className="pan-barra"><i className="pan-cubierto" style={{ width: `${p}%`, borderRadius: 4 }}/></span>
                <span className="pan-mes-cifras fx-num">{miles(s.al_dia)} de {miles(s.total)} al día · <span className="fx-texto-3">{SEGMENTO[k].cada}</span></span>
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel titulo="Conciliación con SofiaPlus" accion={<span className="fx-texto-3">Aprendices con etapa activa en FORMA</span>}>
        {!conc ? <p className="fx-texto-3">Revisando…</p> : (
          <>
            {problemas === 0 && <p className="fx-texto-2" style={{ margin: 0 }}>Todos los aprendices en práctica en FORMA siguen activos en SofiaPlus y en su ficha.</p>}
            {conc.inactivos_en_sofia.length > 0 && (
              <>
                <h4 className="fx-eyebrow pan-sub">En práctica en FORMA, pero no activos en SofiaPlus</h4>
                <ul className="pan-lista">
                  {conc.inactivos_en_sofia.map((a) => (
                    <li key={a.etapa_id}>
                      <Estado tono="atraso">{(a.estado_sofia ?? 'inactivo').toLowerCase()}</Estado>
                      <span><strong>{a.nombre_completo}</strong> · ficha {a.numero_ficha}</span>
                      <span className="fx-texto-3 fx-num">lectura del {fdia(a.fecha_reporte)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {conc.desaparecidos.length > 0 && (
              <>
                <h4 className="fx-eyebrow pan-sub">Ya no aparecen en su ficha en SofiaPlus</h4>
                <ul className="pan-lista">
                  {conc.desaparecidos.map((a) => (
                    <li key={a.etapa_id}>
                      <Estado tono="aviso">no aparece</Estado>
                      <span><strong>{a.nombre_completo}</strong> · ficha {a.numero_ficha}</span>
                      <span className="fx-texto-3 fx-num">lectura del {fdia(a.fecha_reporte)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="fx-texto-3 pan-nota">
              {miles(conc.fichas_sin_verificar.length)} fichas con aprendices en práctica no se han verificado en más de 14 días.{' '}
              {conc.fichas_sin_verificar.length > 0 && (
                <button type="button" className="hoy-enlace" onClick={() => setVerFichas(!verFichas)}>{verFichas ? 'Ocultar' : 'Ver cuáles'}</button>
              )}
            </p>
            {verFichas && (
              <p className="fx-texto-2 fx-num pan-fichas">
                {conc.fichas_sin_verificar.map((f) => `${f.numero_ficha}${f.leida ? ` (${fdia(f.leida)})` : ''}`).join(' · ')}
              </p>
            )}
          </>
        )}
      </Panel>
    </Lienzo>
  )
}
