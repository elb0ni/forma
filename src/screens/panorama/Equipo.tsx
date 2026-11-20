// Equipo (PLAN_REDISENO v3, Fase 16): una sola lista de instructores para
// coordinación, subdirección y regional. Junta lo que antes estaba repartido
// en Usuarios, Instructores de seguimiento, la tabla del Panorama y la de
// Asignación: carga contra cupo, cómo van con sus aprendices y si entran a
// FORMA. Un clic abre su página (pendientes, calendario, historial).
// Las cuentas (crear, roles, contraseñas) viven en Administración.
import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { InstructorDetalleRoute } from '../shared/InstructorDetalle'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { useAmbito } from '../../store/ambito'
import { Lienzo, Frase, Estado, Panel } from '../../ui'
import { fdia } from '../../ui/estados'
import { Medidor } from './comun'

interface Ind {
  aprendices: number; urgentes: number; esta_semana: number; momentos_hechos: number; momentos_en_plazo: number
  con_ubicacion: number; en_sitio: number; bitacoras_esperadas: number; bitacoras_al_dia: number
  bitacoras_entregadas: number; bitacoras_leidas: number; bitacoras_sin_leer: number
}
interface InstructorP { id: string; nombre: string; coordinacion: string | null; cupo: number | null; carga: number; ind: Ind }
interface Usuario { id: string; email: string; activo: boolean; ultimo_acceso: string | null; semaforo: 'ACTIVO' | 'TIBIO' | 'INACTIVO' | 'NUNCA_ENTRO' | null }

const SEM: Record<string, { t: string; tono: 'hecho' | 'aviso' | 'atraso' | 'neutro' }> = {
  ACTIVO: { t: 'entra seguido', tono: 'hecho' },
  TIBIO: { t: 'entra poco', tono: 'aviso' },
  INACTIVO: { t: 'no entra hace rato', tono: 'atraso' },
  NUNCA_ENTRO: { t: 'nunca ha entrado', tono: 'atraso' },
}

function Fraccion({ a, b, bajo }: { a: number; b: number; bajo: number }) {
  if (!b) return <span className="fx-texto-3">—</span>
  const p = Math.round((a / b) * 100)
  return <span className="fx-num" data-tono={p < bajo ? 'atraso' : undefined} title={`${a} de ${b}`}>{p}%<span className="fx-texto-3"> · {a}/{b}</span></span>
}

export function Equipo({ rutaCuentas }: { rutaCuentas?: string }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const rol = user?.rol
  const amb = useAmbito()
  const centroId = rol === 'SUPER_ADMIN' ? amb.centroId : null
  const coordId = rol === 'SUPER_ADMIN' || rol === 'SUBDIRECTOR' ? amb.coordId : null
  const [lista, setLista] = useState<InstructorP[] | null>(null)
  const [usuarios, setUsuarios] = useState<Map<string, Usuario>>(new Map())
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'' | 'ATRASOS' | 'SIN_LEER' | 'NO_ENTRA' | 'SOBRE_CUPO'>('')

  useEffect(() => {
    let vivo = true
    const p = new URLSearchParams()
    if (centroId) p.set('centro_id', String(centroId))
    if (coordId) p.set('coordinacion_id', String(coordId))
    api.get<{ instructores: InstructorP[] }>(`/panorama?${p}`)
      .then((r) => { if (vivo) { setLista(r.data.instructores); setErr(null) } })
      .catch((e) => { if (vivo) setErr(e?.response?.data?.message ?? 'No se pudo leer el equipo.') })
    const u = rol === 'COORD_ACADEMICO' ? `/usuarios?rol=INSTRUCTOR&coordinacion_id=${user?.coordinacion_academica_id}` : '/usuarios?rol=INSTRUCTOR'
    api.get<Usuario[]>(u).then((r) => { if (vivo) setUsuarios(new Map(r.data.map((x) => [x.id, x]))) }).catch(() => undefined)
    return () => { vivo = false }
  }, [centroId, coordId, rol, user?.coordinacion_academica_id])

  const filas = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return (lista ?? [])
      .filter((i) => usuarios.get(i.id)?.activo !== false)
      .filter((i) => !ql || i.nombre.toLowerCase().includes(ql) || (i.coordinacion ?? '').toLowerCase().includes(ql))
      .filter((i) => {
        const s = usuarios.get(i.id)?.semaforo
        if (filtro === 'ATRASOS') return i.ind.urgentes > 0
        if (filtro === 'SIN_LEER') return i.ind.bitacoras_sin_leer > 0
        if (filtro === 'NO_ENTRA') return s === 'INACTIVO' || s === 'NUNCA_ENTRO'
        if (filtro === 'SOBRE_CUPO') return i.cupo != null && i.carga > i.cupo
        return true
      })
      .sort((a, b) => b.ind.urgentes - a.ind.urgentes || b.ind.bitacoras_sin_leer - a.ind.bitacoras_sin_leer || b.carga - a.carga || a.nombre.localeCompare(b.nombre))
  }, [lista, usuarios, q, filtro])

  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!lista) return <Lienzo><p className="fx-texto-3">Leyendo el equipo…</p></Lienzo>

  const activos = lista.filter((i) => usuarios.get(i.id)?.activo !== false)
  const cuenta = {
    ATRASOS: activos.filter((i) => i.ind.urgentes > 0).length,
    SIN_LEER: activos.filter((i) => i.ind.bitacoras_sin_leer > 0).length,
    NO_ENTRA: activos.filter((i) => ['INACTIVO', 'NUNCA_ENTRO'].includes(usuarios.get(i.id)?.semaforo ?? '')).length,
    SOBRE_CUPO: activos.filter((i) => i.cupo != null && i.carga > i.cupo).length,
  }
  const frase = [
    `${activos.length} instructores de seguimiento.`,
    cuenta.ATRASOS ? `${cuenta.ATRASOS} tienen momentos atrasados.` : 'Ninguno tiene momentos atrasados.',
    cuenta.SIN_LEER ? `${cuenta.SIN_LEER} tienen bitácoras sin leer.` : '',
    cuenta.NO_ENTRA ? `${cuenta.NO_ENTRA} casi no entran a FORMA.` : '',
  ].filter(Boolean).join(' ')
  const chips: [typeof filtro, string, number][] = [
    ['', 'Todos', activos.length], ['ATRASOS', 'Con atrasos', cuenta.ATRASOS], ['SIN_LEER', 'Bitácoras sin leer', cuenta.SIN_LEER],
    ['NO_ENTRA', 'Casi no entran', cuenta.NO_ENTRA], ['SOBRE_CUPO', 'Sobre su cupo', cuenta.SOBRE_CUPO],
  ]

  return (
    <Lienzo className="pan">
      <header className="pan-cab">
        <div>
          <div className="fx-eyebrow">Instructores de seguimiento</div>
          <h1 className="fx-titulo">Equipo</h1>
        </div>
        {rutaCuentas && (
          <div className="pan-filtros">
            <Link className="fx-boton" data-tipo="suave" to={rutaCuentas}>Cuentas de usuario</Link>
          </div>
        )}
      </header>

      <Frase tono={cuenta.ATRASOS || cuenta.NO_ENTRA ? 'atraso' : undefined}>{frase}</Frase>

      <div className="eq-barra">
        <div className="eq-chips" role="group" aria-label="Filtrar">
          {chips.map(([k, t, n]) => (
            <button key={k || 'todos'} type="button" data-on={filtro === k || undefined} onClick={() => setFiltro(k)}>
              {t} <span className="fx-num">{n}</span>
            </button>
          ))}
        </div>
        <input className="eq-buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar instructor…" aria-label="Buscar instructor"/>
      </div>

      <Panel titulo={`${filas.length} ${filas.length === 1 ? 'instructor' : 'instructores'}`} accion={<span className="fx-texto-3">Clic para ver sus pendientes, calendario e historial</span>}>
        <div className="fx-tabla-envoltura">
          <table className="fx-tabla pan-tabla pan-tabla-inst">
            <thead>
              <tr><th>Instructor</th><th>Carga</th><th>Atrasos</th><th>Momentos en plazo</th><th>Firmas en sitio</th><th>Bitácoras al día</th><th>Leídas</th><th>En FORMA</th></tr>
            </thead>
            <tbody>
              {filas.length === 0 && <tr><td colSpan={8} className="fx-texto-3">Nadie con ese filtro.</td></tr>}
              {filas.map((i) => {
                const u = usuarios.get(i.id)
                const sem = u?.semaforo ? SEM[u.semaforo] : null
                return (
                  <tr key={i.id} className="pan-fila-clic" tabIndex={0} onClick={() => navigate(i.id)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(i.id) }}>
                    <td>
                      <div className="pan-prog">{i.nombre}</div>
                      {rol !== 'COORD_ACADEMICO' && i.coordinacion && <div className="fx-texto-3">{i.coordinacion}</div>}
                    </td>
                    <td>
                      {i.cupo != null
                        ? <span className="pan-carga"><Medidor carga={i.carga} cupo={i.cupo}/><span className="fx-num fx-texto-2">{i.carga}/{i.cupo}</span></span>
                        : <span className="fx-texto-3">otra coordinación</span>}
                    </td>
                    <td className="fx-num">{i.ind.urgentes ? <Estado tono="atraso">{i.ind.urgentes}</Estado> : <span className="fx-texto-3">0</span>}</td>
                    <td><Fraccion a={i.ind.momentos_en_plazo} b={i.ind.momentos_hechos} bajo={80}/></td>
                    <td><Fraccion a={i.ind.en_sitio} b={i.ind.con_ubicacion} bajo={80}/></td>
                    <td><Fraccion a={i.ind.bitacoras_al_dia} b={i.ind.bitacoras_esperadas} bajo={70}/></td>
                    <td><Fraccion a={i.ind.bitacoras_leidas} b={i.ind.bitacoras_entregadas} bajo={70}/></td>
                    <td>
                      {sem ? <Estado tono={sem.tono}>{sem.t}</Estado> : <span className="fx-texto-3">—</span>}
                      {u?.ultimo_acceso && <div className="fx-texto-3 fx-num">{fdia(u.ultimo_acceso)}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </Lienzo>
  )
}

// Rutas de Equipo: la lista y la página de cada instructor.
export function EquipoRutas({ rutaCuentas }: { rutaCuentas?: string }) {
  return (
    <Routes>
      <Route index element={<Equipo rutaCuentas={rutaCuentas}/>}/>
      <Route path=":instructorId/*" element={<InstructorDetalleRoute/>}/>
    </Routes>
  )
}
