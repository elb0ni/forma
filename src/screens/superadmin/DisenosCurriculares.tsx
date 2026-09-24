import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Ic, Btn, Card, Bdg } from '../../components/ui'
import type { ProgramaResumen } from '../../types'
import { Seg, InlineAlert, CenterState, LoadingBlock } from '../shared/parts'
import api from '../../lib/api'
import '../shared/ProgramasFormacion.css'
import './DisenosCurriculares.css'

// ─── Cobertura de diseños curriculares ───────────────────────────────────────
// Las sugerencias del plan de trabajo (competencias, RA, actividades,
// evidencias) salen del PDF del diseño curricular de cada programa, que lee
// el extractor Python (VITE_API_PYTHON) desde su carpeta de diseños. Esta
// pantalla cruza los programas de FORMA con esa carpeta para saber en cuáles
// funciona y en cuáles el instructor tendrá que escribir el plan a mano.
//
// El PDF se busca como lo hace el extractor: primero <codigo>-v<version>.pdf,
// si no <codigo>.pdf. El diagnóstico dice qué programa trae el PDF según su
// contenido (no su nombre) y si la lectura tiene problemas.

const API_PY = import.meta.env.VITE_API_PYTHON as string | undefined

interface Problema { nivel: 'error' | 'aviso'; mensaje: string; competencia?: string }
interface Diagnostico {
  archivo: string
  codigo: string
  version: string | null
  bytes: number
  modificado: string
  estado: 'ok' | 'alertas' | 'error' | 'ilegible'
  programa: { nombre: string; codigo: string; version: string } | null
  conteos: { competencias: number; ras: number; actividades: number; evidencias: number } | null
  problemas: Problema[]
}

type Estado = 'sin' | 'ilegible' | 'error' | 'version' | 'alertas' | 'ok'

const ESTADO: Record<Estado, { label: string; tone: 'err' | 'warn' | 'ok' | 'neutral'; icon: 'x' | 'alert' | 'checkCircle' | 'fileText'; orden: number }> = {
  sin:      { label: 'Sin diseño',      tone: 'neutral', icon: 'fileText',    orden: 0 },
  ilegible: { label: 'No se pudo leer', tone: 'err',     icon: 'x',           orden: 1 },
  error:    { label: 'Con errores',     tone: 'err',     icon: 'alert',       orden: 2 },
  version:  { label: 'Otra versión',    tone: 'warn',    icon: 'alert',       orden: 3 },
  alertas:  { label: 'Con avisos',      tone: 'warn',    icon: 'alert',       orden: 4 },
  ok:       { label: 'Funciona',        tone: 'ok',      icon: 'checkCircle', orden: 5 },
}

type Filtro = 'todos' | 'sin' | 'problemas' | 'ok'

const soloAlfa = (s: string) => s.replace(/[^0-9a-z]/gi, '').toLowerCase()
const numVer = (v: string | number | null | undefined) => (v == null || v === '' ? null : Number(String(v).replace(/^v/i, '')))

interface Fila {
  p: ProgramaResumen
  diag: Diagnostico | null
  estado: Estado
  otras: Diagnostico[]   // PDFs del mismo código que no aplican a esta versión
}

// Mismo criterio que biblioteca.buscar_pdf: versión exacta, si no la genérica.
function cruzar(p: ProgramaResumen, disenos: Diagnostico[]): Fila {
  const delCodigo = disenos.filter(d => soloAlfa(d.codigo) === soloAlfa(p.codigo))
  const exacto = delCodigo.find(d => d.version != null && numVer(d.version) === numVer(p.version))
  const diag = exacto ?? delCodigo.find(d => d.version == null) ?? null
  const otras = delCodigo.filter(d => d !== diag)
  let estado: Estado
  if (!diag) estado = 'sin'
  else if (diag.estado === 'ilegible' || diag.estado === 'error') estado = diag.estado
  else if (!exacto && diag.programa && numVer(diag.programa.version) !== numVer(p.version)) estado = 'version'
  else estado = diag.estado
  return { p, diag, estado, otras }
}

function fmtBytes(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}

export function DisenosCurriculares() {
  "use no memo"
  const [programas, setProgramas] = useState<ProgramaResumen[] | null>(null)
  const [disenos, setDisenos] = useState<Diagnostico[] | null>(null)
  const [errProg, setErrProg] = useState<string | null>(null)
  const [errPy, setErrPy] = useState<string | null>(
    API_PY ? null : 'Falta configurar VITE_API_PYTHON: FORMA no sabe dónde está el extractor.')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<number | null>(null)
  const [subiendo, setSubiendo] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ id: number; tono: 'ok' | 'err'; texto: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const destino = useRef<Fila | null>(null)

  useEffect(() => {
    api.get<ProgramaResumen[]>('/programas')
      .then(r => setProgramas(r.data))
      .catch(() => setErrProg('No se pudieron cargar los programas de formación.'))
  }, [])

  function pedirEstado() {
    axios.get<{ disenos: Diagnostico[] }>(`${API_PY}/api/disenos/estado`)
      .then(r => setDisenos(r.data.disenos))
      .catch(() => setErrPy(`No se pudo conectar con el extractor de diseños (${API_PY}).`))
  }
  useEffect(() => { if (API_PY) pedirEstado() }, [])
  function reintentar() { setErrPy(null); pedirEstado() }

  const filas = useMemo(() => {
    if (!programas) return []
    const ds = disenos ?? []
    return programas.map(p => cruzar(p, ds)).sort((a, b) =>
      ESTADO[a.estado].orden - ESTADO[b.estado].orden
      || b.p.fichas_en_practica - a.p.fichas_en_practica
      || b.p.fichas_activas - a.p.fichas_activas
      || a.p.nombre.localeCompare(b.p.nombre, 'es'))
  }, [programas, disenos])

  // PDFs de la carpeta que no son de ningún programa de FORMA.
  const huerfanos = useMemo(() => {
    if (!programas || !disenos) return []
    const codigos = new Set(programas.map(p => soloAlfa(p.codigo)))
    return disenos.filter(d => !codigos.has(soloAlfa(d.codigo)))
  }, [programas, disenos])

  const cuenta = {
    todos: filas.length,
    sin: filas.filter(f => f.estado === 'sin').length,
    problemas: filas.filter(f => f.estado !== 'sin' && f.estado !== 'ok').length,
    ok: filas.filter(f => f.estado === 'ok').length,
  }
  const enPracticaSin = filas.filter(f => f.estado === 'sin' && f.p.fichas_en_practica > 0).length

  const qn = soloAlfa(q)
  const visibles = filas.filter(f =>
    (filtro === 'todos'
      || (filtro === 'sin' && f.estado === 'sin')
      || (filtro === 'ok' && f.estado === 'ok')
      || (filtro === 'problemas' && f.estado !== 'sin' && f.estado !== 'ok'))
    && (!qn || soloAlfa(`${f.p.nombre} ${f.p.codigo}`).includes(qn)))

  function elegirArchivo(f: Fila) {
    destino.current = f
    inputRef.current?.click()
  }

  async function subir(file: File) {
    const f = destino.current
    if (!f || !API_PY) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('codigo', f.p.codigo)
    // Si ya hay un PDF genérico de otra versión, este se guarda con su versión
    // para no pisar el que usan las fichas de la otra.
    if (f.estado === 'version') fd.append('version', String(numVer(f.p.version)))
    setSubiendo(f.p.id); setMsg(null)
    try {
      const r = await axios.post<Diagnostico>(`${API_PY}/api/disenos`, fd)
      const d = r.data
      setDisenos(prev => [...(prev ?? []).filter(x => x.archivo !== d.archivo), d])
      setMsg({ id: f.p.id, tono: 'ok', texto: `Cargado como ${d.archivo}: ${d.conteos?.competencias ?? 0} competencias, ${d.conteos?.ras ?? 0} RA.` })
      setAbierto(f.p.id)
    } catch (e) {
      const detalle = axios.isAxiosError(e) ? (e.response?.data as { detail?: string })?.detail : null
      setMsg({ id: f.p.id, tono: 'err', texto: detalle ?? 'No se pudo cargar el PDF.' })
      setAbierto(f.p.id)
    } finally {
      setSubiendo(null)
    }
  }

  if (errProg) return <CenterState icon="alert" title={errProg}/>
  if (!programas) return <LoadingBlock/>

  return (
    <div className="dis">
      <input
        ref={inputRef} type="file" accept="application/pdf,.pdf" hidden
        onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void subir(file) }}
      />

      {errPy ? (
        <InlineAlert tone="risk" icon="alert" title="Extractor no disponible">
          {errPy} Sin él no se sabe qué diseños hay; los instructores diligencian el plan a mano.{' '}
          <button type="button" className="dis-link" onClick={reintentar}>Reintentar</button>
        </InlineAlert>
      ) : !disenos ? (
        <InlineAlert tone="info" icon="sparkles" title="Analizando los diseños curriculares…">
          La primera vez se lee cada PDF completo y puede tardar un poco.
        </InlineAlert>
      ) : (
        <div className="dis-resumen">
          <div className="dis-resumen__barra" aria-hidden>
            {(['ok', 'problemas', 'sin'] as const).map(k => cuenta[k] > 0 && (
              <span key={k} className={`dis-resumen__seg dis-resumen__seg--${k}`} style={{ flexGrow: cuenta[k] }}/>
            ))}
          </div>
          <div className="dis-resumen__txt">
            <b>{cuenta.ok}</b> de {cuenta.todos} programas con diseño funcionando
            {cuenta.problemas > 0 && <> · <b>{cuenta.problemas}</b> con problemas</>}
            {cuenta.sin > 0 && <> · <b>{cuenta.sin}</b> sin diseño</>}
            {enPracticaSin > 0 && <span className="dis-resumen__urg"> · {enPracticaSin} de ellos con fichas en práctica</span>}
          </div>
        </div>
      )}

      <div className="dis-barra">
        <Seg name="dis-filtro" value={filtro} onChange={v => setFiltro(v as Filtro)} options={[
          { value: 'todos', label: `Todos ${cuenta.todos}` },
          { value: 'sin', label: `Sin diseño ${cuenta.sin}` },
          { value: 'problemas', label: `Con problemas ${cuenta.problemas}` },
          { value: 'ok', label: `Funcionan ${cuenta.ok}` },
        ]}/>
        <label className="dis-buscar">
          <Ic n="search" s={13}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar programa o código"/>
        </label>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <div className="prog-table-scroll">
          <table className="prog-table">
            <thead>
              <tr className="prog-table__head-row">
                <th className="prog-table__th">Programa</th>
                <th className="prog-table__th prog-table__th--num">Fichas</th>
                <th className="prog-table__th">Diseño curricular</th>
                <th className="prog-table__th">Estado</th>
                <th className="prog-table__th"/>
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={5} className="dis-vacio">Ningún programa en este filtro.</td></tr>
              )}
              {visibles.map(f => {
                const { p, diag } = f
                const e = ESTADO[f.estado]
                const nProb = diag?.problemas.length ?? 0
                const desplegable = nProb > 0 || f.otras.length > 0 || f.estado === 'version' || msg?.id === p.id
                const open = abierto === p.id && desplegable
                return (
                  <Fragment key={p.id}>
                    <tr
                      className={`nx-row dis-fila${desplegable ? ' dis-fila--click' : ''}`}
                      onClick={() => desplegable && setAbierto(open ? null : p.id)}
                    >
                      <td className="prog-table__td">
                        <div className="prog-table__name">{p.nombre}</div>
                        <div className="prog-table__meta">
                          <span className="prog-code">{p.codigo} · V{numVer(p.version)}</span>
                          {p.estado === 'INACTIVO' && <Bdg tone="neutral">Inactivo</Bdg>}
                        </div>
                      </td>
                      <td className="prog-table__td--num">
                        <div>{p.fichas_activas || <span className="dis-nada">—</span>}</div>
                        {p.fichas_en_practica > 0 && <div className="dis-practica">{p.fichas_en_practica} en práctica</div>}
                      </td>
                      <td className="prog-table__td">
                        {diag ? (
                          <>
                            <div className="dis-archivo"><Ic n="fileText" s={12}/> {diag.archivo}<span className="dis-peso">{fmtBytes(diag.bytes)}</span></div>
                            {diag.conteos && (
                              <div className="dis-conteo">
                                {diag.conteos.competencias} comp. · {diag.conteos.ras} RA · {diag.conteos.actividades} act.
                                {diag.programa && <> · V{numVer(diag.programa.version)} según el PDF</>}
                              </div>
                            )}
                          </>
                        ) : disenos ? (
                          <span className="dis-nada">Falta cargar el PDF</span>
                        ) : <span className="dis-nada">…</span>}
                      </td>
                      <td className="prog-table__td">
                        {disenos && (
                          <span className="dis-estado">
                            <Bdg tone={e.tone} icon={e.icon}>{e.label}</Bdg>
                            {nProb > 0 && <span className="dis-nprob">{nProb}</span>}
                            {desplegable && <Ic n={open ? 'chevronUp' : 'chevronDown'} s={13}/>}
                          </span>
                        )}
                      </td>
                      <td className="prog-table__td" style={{ textAlign: 'right' }} onClick={ev => ev.stopPropagation()}>
                        {disenos && (
                          <Btn
                            size="sm" variant={f.estado === 'sin' ? 'primary' : 'secondary'} icon="upload"
                            disabled={subiendo != null}
                            onClick={() => elegirArchivo(f)}
                          >
                            {subiendo === p.id ? 'Leyendo…' : f.estado === 'sin' ? 'Cargar PDF' : 'Reemplazar'}
                          </Btn>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="dis-det">
                        <td colSpan={5}>
                          {msg?.id === p.id && (
                            <div className={`dis-msg dis-msg--${msg.tono}`}>
                              <Ic n={msg.tono === 'ok' ? 'checkCircle' : 'alert'} s={13}/> {msg.texto}
                            </div>
                          )}
                          {f.estado === 'version' && diag?.programa && (
                            <div className="dis-prob dis-prob--aviso">
                              <Ic n="alert" s={12}/>
                              <span>
                                El PDF es de la versión {numVer(diag.programa.version)} y el programa en FORMA es la {numVer(p.version)}.
                                Las sugerencias pueden no coincidir. Carga el de la versión {numVer(p.version)}: se guarda como {p.codigo}-v{numVer(p.version)}.pdf sin reemplazar el actual.
                              </span>
                            </div>
                          )}
                          {diag?.problemas.map((pr, i) => (
                            <div key={i} className={`dis-prob dis-prob--${pr.nivel}`}>
                              <Ic n={pr.nivel === 'error' ? 'x' : 'alert'} s={12}/>
                              <span>{pr.competencia && <span className="prog-code">{pr.competencia} </span>}{pr.mensaje}</span>
                            </div>
                          ))}
                          {f.otras.length > 0 && (
                            <div className="dis-otras">
                              También en la carpeta, sin usarse para esta versión: {f.otras.map(o => o.archivo).join(', ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {huerfanos.length > 0 && (
        <div className="dis-huerfanos">
          <Ic n="info" s={13}/>
          <span>
            PDFs en la carpeta que no corresponden a ningún programa de FORMA (revisa el nombre del archivo):{' '}
            {huerfanos.map(d => <span key={d.archivo} className="prog-code">{d.archivo} </span>)}
          </span>
        </div>
      )}
    </div>
  )
}
