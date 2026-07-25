import { useState } from 'react'
import { Ic, Card, Btn, Tag, Bdg } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { fd, Seg, InlineAlert } from '../shared/parts'
import { Field, SectionIntro, FactoresBlock, FirmaRow, MetaRow, EmptyHint, EstadoBdg } from './parts'
import { estadoDe, nuevosFactores, FACTORES_TECNICOS, FACTORES_ACTITUDINALES } from './types'
import type {
  EtapaProductivaRecord, SeguimientoMomento2, SeguimientoExtraordinario,
  Modalidad, InfoGeneral,
} from './types'

type TabId = 'general' | 'm1' | 'm2' | 'm3' | 'anexo'

const MODALIDAD_OPTS = [
  { value: 'PRESENCIAL', label: 'Presencial', icon: 'pin' as IcName },
  { value: 'VIRTUAL', label: 'Virtual', icon: 'external' as IcName },
]

// ─── Contenedor: tabs + enrutamiento entre las 5 secciones del formato ──────────

export function EtapaProductivaDetalle({ record, onChange, onBack }: {
  record: EtapaProductivaRecord
  onChange: (next: EtapaProductivaRecord) => void
  onBack: () => void
}) {
  "use no memo"
  const [tab, setTab] = useState<TabId>('general')
  const estado = estadoDe(record)

  const TABS: { id: TabId; label: string; icon: IcName; badge?: ReactNodeBadge }[] = [
    { id: 'general', label: 'Información general', icon: 'user' },
    { id: 'm1', label: 'Momento 1 · Planeación', icon: 'target', badge: record.momento1.completado ? 'ok' : 'warn' },
    { id: 'm2', label: 'Momento 2 · Seguimiento', icon: 'list', badge: record.momento2.length ? 'count' : undefined },
    { id: 'm3', label: 'Momento 3 · Evaluación', icon: 'checkCircle', badge: record.momento3.completado ? 'ok' : 'warn' },
    { id: 'anexo', label: 'Anexo · Extraordinario', icon: 'fileText', badge: record.anexos.length ? 'count' : undefined },
  ]

  return (
    <div style={{ maxWidth: 1100 }}>
      <button onClick={onBack} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
        <Ic n="arrowLeft" s={14}/>Etapa productiva
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0b' }}>{record.info.aprendiz.nombreCompleto}</h2>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#52525b' }}>
            <Tag>{record.info.programaCodigo}</Tag>
            <span>{record.info.programaNombre}</span>
            <span style={{ color: '#d4d4d8' }}>·</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>Ficha {record.info.numeroFicha}</span>
            <span style={{ color: '#d4d4d8' }}>·</span>
            <EstadoBdg estado={estado}/>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e4e4e7', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 4px', marginBottom: -1,
              background: 'none', border: 'none', borderBottom: `2px solid ${active ? '#4f46e5' : 'transparent'}`,
              color: active ? '#0a0a0b' : '#71717a', fontSize: 12.5, fontWeight: active ? 600 : 500,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
              <Ic n={t.icon} s={13} style={{ color: active ? '#4f46e5' : '#a1a1aa' }}/>
              {t.label}
              {t.badge === 'ok' && <Ic n="checkCircle" s={12} style={{ color: '#15803d' }}/>}
              {t.badge === 'warn' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ca8a04' }}/>}
              {t.badge === 'count' && (
                <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', background: '#f1f1f3', borderRadius: 10, padding: '1px 6px', color: '#52525b' }}>
                  {t.id === 'm2' ? record.momento2.length : record.anexos.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'general' && <GeneralTab info={record.info} onChange={info => onChange({ ...record, info })}/>}
      {tab === 'm1' && (
        <Momento1Tab
          record={record}
          onChange={m1 => onChange({ ...record, momento1: m1 })}
        />
      )}
      {tab === 'm2' && (
        <Momento2Tab
          record={record}
          onChange={m2 => onChange({ ...record, momento2: m2 })}
        />
      )}
      {tab === 'm3' && (
        <Momento3Tab
          record={record}
          onChange={m3 => onChange({ ...record, momento3: m3 })}
        />
      )}
      {tab === 'anexo' && (
        <AnexoTab
          record={record}
          onChange={anexos => onChange({ ...record, anexos })}
        />
      )}
    </div>
  )
}

type ReactNodeBadge = 'ok' | 'warn' | 'count'

// ─── Tab: Información general ───────────────────────────────────────────────────

function GeneralTab({ info, onChange }: { info: InfoGeneral; onChange: (next: InfoGeneral) => void }) {
  function set<K extends keyof InfoGeneral>(k: K, v: InfoGeneral[K]) { onChange({ ...info, [k]: v }) }
  function setAprendiz<K extends keyof InfoGeneral['aprendiz']>(k: K, v: InfoGeneral['aprendiz'][K]) {
    onChange({ ...info, aprendiz: { ...info.aprendiz, [k]: v } })
  }
  function setInstructor<K extends keyof InfoGeneral['instructorSeguimiento']>(k: K, v: InfoGeneral['instructorSeguimiento'][K]) {
    onChange({ ...info, instructorSeguimiento: { ...info.instructorSeguimiento, [k]: v } })
  }
  function setEnte<K extends keyof InfoGeneral['enteCoformador']>(k: K, v: InfoGeneral['enteCoformador'][K]) {
    onChange({ ...info, enteCoformador: { ...info.enteCoformador, [k]: v } })
  }
  function setDisc<K extends keyof InfoGeneral['discapacidad']>(k: K, v: InfoGeneral['discapacidad'][K]) {
    onChange({ ...info, discapacidad: { ...info.discapacidad, [k]: v } })
  }

  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ padding: 20 }}>
        <SectionIntro title="Datos de la formación" sub="Regional, centro, programa y modalidad en la que se registró el aprendiz."/>
        <div style={grid2}>
          <Field label="Regional"><input className="nx-input" value={info.regional} onChange={e => set('regional', e.target.value)}/></Field>
          <Field label="Centro de formación"><input className="nx-input" value={info.centroFormacion} onChange={e => set('centroFormacion', e.target.value)}/></Field>
          <Field label="Nivel formativo"><input className="nx-input" value={info.nivelFormativo} onChange={e => set('nivelFormativo', e.target.value)}/></Field>
          <Field label="No. de ficha"><input className="nx-input" value={info.numeroFicha} onChange={e => set('numeroFicha', e.target.value)}/></Field>
          <Field label="Programa de formación" style={{ gridColumn: '1 / -1' }}><input className="nx-input" value={info.programaNombre} onChange={e => set('programaNombre', e.target.value)}/></Field>
          <Field label="Código del programa"><input className="nx-input" value={info.programaCodigo} onChange={e => set('programaCodigo', e.target.value)}/></Field>
          <Field label="Estrategia formativa" hint="Contrato, pasantía, vínculo laboral…"><input className="nx-input" value={info.estrategiaFormativa} onChange={e => set('estrategiaFormativa', e.target.value)}/></Field>
        </div>
        <Field label="Modalidad de formación" style={{ marginTop: 16 }}>
          <Seg name="modFormacion" value={info.modalidadFormacion} onChange={v => set('modalidadFormacion', v as InfoGeneral['modalidadFormacion'])}
            options={[
              { value: 'PRESENCIAL', label: 'Presencial' },
              { value: 'VIRTUAL', label: 'Virtual' },
              { value: 'A_DISTANCIA', label: 'A distancia' },
            ]}/>
        </Field>
        <Field label="Fecha fin de la etapa lectiva" style={{ marginTop: 16, maxWidth: 240 }}>
          <input type="date" className="nx-input" value={info.fechaFinEtapaLectiva} onChange={e => set('fechaFinEtapaLectiva', e.target.value)}/>
        </Field>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Datos del aprendiz"/>
        <div style={grid2}>
          <Field label="Nombre completo" style={{ gridColumn: '1 / -1' }}><input className="nx-input" value={info.aprendiz.nombreCompleto} onChange={e => setAprendiz('nombreCompleto', e.target.value)}/></Field>
          <Field label="Tipo de documento"><input className="nx-input" value={info.aprendiz.tipoDocumento} onChange={e => setAprendiz('tipoDocumento', e.target.value)}/></Field>
          <Field label="N.º de identificación"><input className="nx-input" value={info.aprendiz.numeroIdentificacion} onChange={e => setAprendiz('numeroIdentificacion', e.target.value)}/></Field>
          <Field label="Contacto telefónico"><input className="nx-input" value={info.aprendiz.contactoTelefonico} onChange={e => setAprendiz('contactoTelefonico', e.target.value)}/></Field>
          <Field label="Dirección"><input className="nx-input" value={info.aprendiz.direccion} onChange={e => setAprendiz('direccion', e.target.value)}/></Field>
          <Field label="Correo electrónico personal"><input className="nx-input" value={info.aprendiz.correoPersonal} onChange={e => setAprendiz('correoPersonal', e.target.value)}/></Field>
          <Field label="Correo electrónico institucional"><input className="nx-input" value={info.aprendiz.correoInstitucional} onChange={e => setAprendiz('correoInstitucional', e.target.value)}/></Field>
          <Field label="Alternativa de etapa productiva registrada"><input className="nx-input" value={info.aprendiz.alternativaEtapaProductiva} onChange={e => setAprendiz('alternativaEtapaProductiva', e.target.value)}/></Field>
          <Field label="Fecha de registro en SofiaPlus"><input type="date" className="nx-input" value={info.aprendiz.fechaRegistroSofiaPlus} onChange={e => setAprendiz('fechaRegistroSofiaPlus', e.target.value)}/></Field>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Datos del instructor de seguimiento"/>
        <div style={grid2}>
          <Field label="Nombre" style={{ gridColumn: '1 / -1' }}><input className="nx-input" value={info.instructorSeguimiento.nombre} onChange={e => setInstructor('nombre', e.target.value)}/></Field>
          <Field label="Contacto telefónico"><input className="nx-input" value={info.instructorSeguimiento.contactoTelefonico} onChange={e => setInstructor('contactoTelefonico', e.target.value)}/></Field>
          <Field label="Correo electrónico institucional"><input className="nx-input" value={info.instructorSeguimiento.correoInstitucional} onChange={e => setInstructor('correoInstitucional', e.target.value)}/></Field>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Datos del ente co-formador" sub="Jefe inmediato o tutor y empresa u organización donde el aprendiz realiza su etapa productiva."/>
        <div style={grid2}>
          <Field label="Nombre empresa o entidad co-formadora" style={{ gridColumn: '1 / -1' }}><input className="nx-input" value={info.enteCoformador.nombreEmpresa} onChange={e => setEnte('nombreEmpresa', e.target.value)}/></Field>
          <Field label="Dirección"><input className="nx-input" value={info.enteCoformador.direccion} onChange={e => setEnte('direccion', e.target.value)}/></Field>
          <Field label="NIT"><input className="nx-input" value={info.enteCoformador.nit} onChange={e => setEnte('nit', e.target.value)}/></Field>
          <Field label="Correo electrónico" style={{ gridColumn: '1 / -1' }}><input className="nx-input" value={info.enteCoformador.correoElectronico} onChange={e => setEnte('correoElectronico', e.target.value)}/></Field>
          <Field label="Nombre del jefe inmediato / co-formador / tutor"><input className="nx-input" value={info.enteCoformador.nombreJefeInmediato} onChange={e => setEnte('nombreJefeInmediato', e.target.value)}/></Field>
          <Field label="Cargo"><input className="nx-input" value={info.enteCoformador.cargo} onChange={e => setEnte('cargo', e.target.value)}/></Field>
          <Field label="Contacto telefónico"><input className="nx-input" value={info.enteCoformador.contactoTelefonico} onChange={e => setEnte('contactoTelefonico', e.target.value)}/></Field>
          <Field label="Nombre otro contacto" hint="Opcional"><input className="nx-input" value={info.enteCoformador.nombreOtroContacto} onChange={e => setEnte('nombreOtroContacto', e.target.value)}/></Field>
          <Field label="Teléfono institucional (fijo/móvil)"><input className="nx-input" value={info.enteCoformador.telefonoInstitucional} onChange={e => setEnte('telefonoInstitucional', e.target.value)}/></Field>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: info.discapacidad.aplica ? 16 : 0 }}>
          <SectionIntro title="Persona en situación de discapacidad" sub="Solo si aplica."/>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#3f3f46', cursor: 'pointer' }}>
            <input type="checkbox" className="nx-check" checked={info.discapacidad.aplica} onChange={e => setDisc('aplica', e.target.checked)}/>
            Aplica
          </label>
        </div>
        {info.discapacidad.aplica && (
          <div style={grid2}>
            <Field label="Nombre de la persona que asiste al aprendiz"><input className="nx-input" value={info.discapacidad.nombreAsiste} onChange={e => setDisc('nombreAsiste', e.target.value)}/></Field>
            <Field label="Tipo de asistencia" hint="Lenguaje de señas, apoyo visual, otros"><input className="nx-input" value={info.discapacidad.tipoAsistencia} onChange={e => setDisc('tipoAsistencia', e.target.value)}/></Field>
            <Field label="Contacto telefónico"><input className="nx-input" value={info.discapacidad.contactoTelefonico} onChange={e => setDisc('contactoTelefonico', e.target.value)}/></Field>
          </div>
        )}
      </Card>

      <InlineAlert tone="neutral" icon="info">
        Con el diligenciamiento de este formato se autoriza al SENA para la recolección y tratamiento de datos personales, conforme a la política GOR-POL-006.
      </InlineAlert>
    </div>
  )
}

// ─── Tab: Momento 1 · Planeación (única vez) ────────────────────────────────────

function Momento1Tab({ record, onChange }: {
  record: EtapaProductivaRecord
  onChange: (next: EtapaProductivaRecord['momento1']) => void
}) {
  "use no memo"
  const m1 = record.momento1
  const [editing, setEditing] = useState(!m1.completado)

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <InlineAlert tone="ok" icon="checkCircle" title="Planeación registrada">
          El plan de trabajo de la etapa productiva quedó concertado entre el aprendiz, el instructor de seguimiento y el ente co-formador.
        </InlineAlert>
        <Card style={{ padding: 16 }}>
          <MetaRow label="Fecha inicio etapa productiva" value={fd(m1.fechaInicio)}/>
          <MetaRow label="Fecha fin etapa productiva" value={fd(m1.fechaFin)}/>
          <MetaRow label="Fecha afiliación a la ARL" value={fd(m1.fechaAfiliacionArl)}/>
          <MetaRow label="N.º póliza ARL" value={m1.numeroPolizaArl || '—'}/>
          <MetaRow label="Horario" value={m1.horario || '—'}/>
        </Card>
        <Card style={{ padding: 16 }}>
          {([
            ['Competencias a desarrollar', m1.competenciasDesarrollar],
            ['Resultados de aprendizaje', m1.resultadosAprendizaje],
            ['Actividades a desarrollar', m1.actividadesDesarrollar],
            ['Evidencias de aprendizaje', m1.evidenciasAprendizaje],
            ['Observaciones adicionales', m1.observacionesAdicionales],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: value ? '#18181b' : '#a1a1aa', lineHeight: 1.5 }}>{value || 'Sin diligenciar'}</div>
            </div>
          ))}
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>Firmas</div>
          <FirmaRow items={[
            { label: 'Aprendiz', firmado: m1.firmaAprendiz },
            { label: 'Instructor de seguimiento', firmado: m1.firmaInstructor },
            { label: 'Ente co-formador', firmado: m1.firmaEnteCoformador },
          ]}/>
          <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 12 }}>
            {m1.ciudad || '—'} · {fd(m1.fechaDiligenciamiento)} · {m1.modalidadDiligenciamiento === 'PRESENCIAL' ? 'Presencial' : 'Virtual'}
          </div>
        </Card>
        <div><Btn variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar planeación</Btn></div>
      </div>
    )
  }

  return <Momento1Form m1={m1} onCancel={() => setEditing(false)} onSave={next => { onChange(next); setEditing(false) }}/>
}

function Momento1Form({ m1, onCancel, onSave }: {
  m1: EtapaProductivaRecord['momento1']
  onCancel: () => void
  onSave: (next: EtapaProductivaRecord['momento1']) => void
}) {
  "use no memo"
  const [draft, setDraft] = useState(m1)
  function set<K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) { setDraft(d => ({ ...d, [k]: v })) }

  const puedeGuardar = !!draft.fechaInicio && !!draft.fechaFin && !!draft.competenciasDesarrollar.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionIntro title="Planeación de la etapa productiva" sub="Se realiza por una única vez, al inicio de la etapa productiva."/>

      <Card style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Fecha inicio etapa productiva" required><input type="date" className="nx-input" value={draft.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}/></Field>
          <Field label="Fecha fin etapa productiva" required><input type="date" className="nx-input" value={draft.fechaFin} onChange={e => set('fechaFin', e.target.value)}/></Field>
          <Field label="Fecha de afiliación a la ARL"><input type="date" className="nx-input" value={draft.fechaAfiliacionArl} onChange={e => set('fechaAfiliacionArl', e.target.value)}/></Field>
          <Field label="N.º póliza ARL" hint="Si aplica"><input className="nx-input" value={draft.numeroPolizaArl} onChange={e => set('numeroPolizaArl', e.target.value)}/></Field>
          <Field label="Horario" hint="Diurno/nocturno, días y hora" style={{ gridColumn: 'span 2' }}><input className="nx-input" value={draft.horario} onChange={e => set('horario', e.target.value)}/></Field>
        </div>
        <Field label="Enlace de grabación" hint="Si se realiza de forma virtual" style={{ marginTop: 14 }}>
          <input className="nx-input" placeholder="https://…" value={draft.enlaceGrabacion} onChange={e => set('enlaceGrabacion', e.target.value)}/>
        </Field>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Concertación del plan de trabajo"/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Competencias a desarrollar" required hint="Competencias del programa relacionadas">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.competenciasDesarrollar} onChange={e => set('competenciasDesarrollar', e.target.value)}/>
          </Field>
          <Field label="Resultados de aprendizaje">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.resultadosAprendizaje} onChange={e => set('resultadosAprendizaje', e.target.value)}/>
          </Field>
          <Field label="Actividades a desarrollar" hint="Durante los meses de etapa productiva">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.actividadesDesarrollar} onChange={e => set('actividadesDesarrollar', e.target.value)}/>
          </Field>
          <Field label="Evidencias de aprendizaje" hint="Que generará el aprendiz de acuerdo con cada actividad">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.evidenciasAprendizaje} onChange={e => set('evidenciasAprendizaje', e.target.value)}/>
          </Field>
          <Field label="Observaciones adicionales" hint="Opcional">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.observacionesAdicionales} onChange={e => set('observacionesAdicionales', e.target.value)}/>
          </Field>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Firmas y diligenciamiento"/>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          {([
            ['firmaAprendiz', 'Firma del aprendiz'],
            ['firmaInstructor', 'Firma del instructor de seguimiento'],
            ['firmaEnteCoformador', 'Firma del ente co-formador'],
          ] as const).map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer' }}>
              <input type="checkbox" className="nx-check" checked={draft[k]} onChange={e => set(k, e.target.checked)}/>
              {label}
            </label>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Ciudad"><input className="nx-input" value={draft.ciudad} onChange={e => set('ciudad', e.target.value)}/></Field>
          <Field label="Fecha de diligenciamiento"><input type="date" className="nx-input" value={draft.fechaDiligenciamiento} onChange={e => set('fechaDiligenciamiento', e.target.value)}/></Field>
        </div>
        <Field label="Forma de diligenciamiento" style={{ marginTop: 14 }}>
          <Seg name="modM1" value={draft.modalidadDiligenciamiento} onChange={v => set('modalidadDiligenciamiento', v as Modalidad)} options={MODALIDAD_OPTS}/>
        </Field>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={!puedeGuardar} onClick={() => onSave({ ...draft, completado: true })}>Guardar planeación</Btn>
      </div>
    </div>
  )
}

// ─── Tab: Momento 2 · Seguimiento (se repite durante la ejecución) ──────────────

function Momento2Tab({ record, onChange }: {
  record: EtapaProductivaRecord
  onChange: (next: SeguimientoMomento2[]) => void
}) {
  "use no memo"
  const [openNew, setOpenNew] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  if (!record.momento1.completado) {
    return <Card style={{ padding: 24 }}><EmptyHint icon="lock" text="Completa primero el Momento 1 · Planeación para poder registrar seguimientos."/></Card>
  }

  const items = [...record.momento2].sort((a, b) => b.fecha.localeCompare(a.fecha))

  function agregar(item: SeguimientoMomento2) {
    onChange([...record.momento2, item])
    setOpenNew(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionIntro title="Seguimientos a la etapa productiva" sub="Se registra un momento por cada visita o contacto de seguimiento durante la ejecución."/>
        {!openNew && <Btn variant="accent" icon="plus" onClick={() => setOpenNew(true)}>Nuevo seguimiento</Btn>}
      </div>

      {openNew && (
        <Momento2Form
          numero={record.momento2.length + 1}
          onCancel={() => setOpenNew(false)}
          onSave={agregar}
        />
      )}

      {items.length === 0 && !openNew ? (
        <Card style={{ padding: 24 }}><EmptyHint icon="list" text="Aún no hay seguimientos registrados. Agrega el primero cuando realices la visita."/></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((s, i) => (
            <Momento2Item key={s.id} s={s} numero={items.length - i} open={openId === s.id} onToggle={() => setOpenId(o => o === s.id ? null : s.id)}/>
          ))}
        </div>
      )}
    </div>
  )
}

function Momento2Item({ s, numero, open, onToggle }: { s: SeguimientoMomento2; numero: number; open: boolean; onToggle: () => void }) {
  const satisfactorios = [...s.factoresTecnicos, ...s.factoresActitudinales].filter(f => f.valoracion === 'SATISFACTORIO').length
  const total = s.factoresTecnicos.length + s.factoresActitudinales.length
  return (
    <Card style={{ overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef2ff', color: '#4f46e5', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>#{numero}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b', fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fecha)}</span>
            <Bdg tone="neutral">{s.modalidad === 'PRESENCIAL' ? 'Presencial' : 'Virtual'}</Bdg>
            <span style={{ fontSize: 11.5, color: '#71717a' }}>{satisfactorios}/{total} satisfactorio</span>
          </div>
        </div>
        <Ic n={open ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #f1f1f3', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {s.enlaceGrabacion && (
            <a href={s.enlaceGrabacion} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ic n="external" s={12}/>Grabación del momento
            </a>
          )}
          <FactoresBlock titulo="Factores técnicos" items={s.factoresTecnicos} readOnly/>
          <FactoresBlock titulo="Factores actitudinales y comportamentales" items={s.factoresActitudinales} readOnly/>
          {([
            ['Observaciones complementarias del instructor', s.observacionesInstructor],
            ['Observaciones del aprendiz', s.observacionesAprendiz],
            ['Observaciones del responsable del ente co-formador', s.observacionesEnteCoformador],
          ] as [string, string][]).map(([label, value]) => value && (
            <div key={label}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}
          <FirmaRow items={[
            { label: 'Aprendiz', firmado: s.firmaAprendiz },
            { label: 'Instructor de seguimiento', firmado: s.firmaInstructor },
            { label: 'Ente co-formador', firmado: s.firmaEnteCoformador },
          ]}/>
          <div style={{ fontSize: 11.5, color: '#71717a' }}>{s.ciudad || '—'} · {fd(s.fechaDiligenciamiento)}</div>
        </div>
      )}
    </Card>
  )
}

function Momento2Form({ numero, onCancel, onSave }: {
  numero: number
  onCancel: () => void
  onSave: (item: SeguimientoMomento2) => void
}) {
  "use no memo"
  const [fecha, setFecha] = useState('')
  const [modalidad, setModalidad] = useState<Modalidad>('PRESENCIAL')
  const [enlace, setEnlace] = useState('')
  const [tecnicos, setTecnicos] = useState(nuevosFactores(FACTORES_TECNICOS))
  const [actitudinales, setActitudinales] = useState(nuevosFactores(FACTORES_ACTITUDINALES))
  const [obsInstructor, setObsInstructor] = useState('')
  const [obsAprendiz, setObsAprendiz] = useState('')
  const [obsEnte, setObsEnte] = useState('')
  const [firmaAprendiz, setFirmaAprendiz] = useState(false)
  const [firmaInstructor, setFirmaInstructor] = useState(false)
  const [firmaEnte, setFirmaEnte] = useState(false)
  const [ciudad, setCiudad] = useState('')
  const [fechaDilig, setFechaDilig] = useState('')

  const puedeGuardar = !!fecha

  function guardar() {
    onSave({
      id: numero, fecha, modalidad, enlaceGrabacion: enlace,
      factoresTecnicos: tecnicos, factoresActitudinales: actitudinales,
      observacionesInstructor: obsInstructor, observacionesAprendiz: obsAprendiz, observacionesEnteCoformador: obsEnte,
      firmaAprendiz, firmaInstructor, firmaEnteCoformador: firmaEnte,
      ciudad, fechaDiligenciamiento: fechaDilig,
    })
  }

  return (
    <Card style={{ padding: 20, border: '1px solid #c7d2fe' }}>
      <SectionIntro title={`Seguimiento #${numero}`}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Field label="Fecha del momento de seguimiento" required><input type="date" className="nx-input" value={fecha} onChange={e => setFecha(e.target.value)}/></Field>
        <Field label="Enlace de grabación" hint="Si se hace de forma virtual"><input className="nx-input" placeholder="https://…" value={enlace} onChange={e => setEnlace(e.target.value)}/></Field>
      </div>
      <Field label="Modalidad del seguimiento" style={{ marginBottom: 16 }}>
        <Seg name={`modM2-${numero}`} value={modalidad} onChange={v => setModalidad(v as Modalidad)} options={MODALIDAD_OPTS}/>
      </Field>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <FactoresBlock titulo="Factores técnicos" items={tecnicos} onChange={setTecnicos}/>
        <FactoresBlock titulo="Factores actitudinales y comportamentales" items={actitudinales} onChange={setActitudinales}/>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <Field label="Observaciones complementarias del instructor de seguimiento">
          <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={obsInstructor} onChange={e => setObsInstructor(e.target.value)}/>
        </Field>
        <Field label="Observaciones del aprendiz">
          <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={obsAprendiz} onChange={e => setObsAprendiz(e.target.value)}/>
        </Field>
        <Field label="Observaciones del responsable del ente co-formador">
          <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={obsEnte} onChange={e => setObsEnte(e.target.value)}/>
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer' }}>
          <input type="checkbox" className="nx-check" checked={firmaAprendiz} onChange={e => setFirmaAprendiz(e.target.checked)}/>Firma del aprendiz
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer' }}>
          <input type="checkbox" className="nx-check" checked={firmaInstructor} onChange={e => setFirmaInstructor(e.target.checked)}/>Firma del instructor de seguimiento
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer' }}>
          <input type="checkbox" className="nx-check" checked={firmaEnte} onChange={e => setFirmaEnte(e.target.checked)}/>Firma del ente co-formador
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <Field label="Ciudad"><input className="nx-input" value={ciudad} onChange={e => setCiudad(e.target.value)}/></Field>
        <Field label="Fecha de diligenciamiento"><input type="date" className="nx-input" value={fechaDilig} onChange={e => setFechaDilig(e.target.value)}/></Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={!puedeGuardar} onClick={guardar}>Guardar seguimiento</Btn>
      </div>
    </Card>
  )
}

// ─── Tab: Momento 3 · Evaluación final (única vez) ──────────────────────────────

function Momento3Tab({ record, onChange }: {
  record: EtapaProductivaRecord
  onChange: (next: EtapaProductivaRecord['momento3']) => void
}) {
  "use no memo"
  const m3 = record.momento3
  const [editing, setEditing] = useState(!m3.completado)

  if (!record.momento1.completado) {
    return <Card style={{ padding: 24 }}><EmptyHint icon="lock" text="Completa primero el Momento 1 · Planeación para habilitar la evaluación final."/></Card>
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <InlineAlert tone={m3.juicio === 'APROBADO' ? 'ok' : 'crit'} icon={m3.juicio === 'APROBADO' ? 'checkCircle' : 'alert'}
          title={m3.juicio === 'APROBADO' ? 'Etapa productiva aprobada' : 'Etapa productiva no aprobada'}>
          Evaluación final registrada con {m3.numeroVisitas} visita{m3.numeroVisitas === 1 ? '' : 's'} realizadas durante la ejecución.
        </InlineAlert>
        <Card style={{ padding: 16 }}>
          <MetaRow label="Fecha inicio etapa productiva" value={fd(m3.fechaInicio)}/>
          <MetaRow label="Fecha fin de la ejecución" value={fd(m3.fechaFin)}/>
          <MetaRow label="Número de visitas realizadas" value={m3.numeroVisitas}/>
          <MetaRow label="Modalidad de la evaluación" value={m3.modalidad === 'PRESENCIAL' ? 'Presencial' : 'Virtual'}/>
        </Card>
        <FactoresBlock titulo="Factores técnicos" items={m3.factoresTecnicos} readOnly/>
        <FactoresBlock titulo="Factores actitudinales y comportamentales" items={m3.factoresActitudinales} readOnly/>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>Retroalimentación</div>
          {([
            ['Ente co-formador · proceso de formación', m3.retroEnteProceso],
            ['Ente co-formador · desempeño de competencias', m3.retroEnteDesempeno],
            ['Instructor de seguimiento · proceso de formación', m3.retroInstructorProceso],
            ['Instructor de seguimiento · desempeño de competencias', m3.retroInstructorDesempeno],
            ['Aprendiz · proceso de formación', m3.retroAprendizProceso],
            ['Aprendiz · desempeño de competencias', m3.retroAprendizDesempeno],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#52525b', fontWeight: 600, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: value ? '#18181b' : '#a1a1aa', lineHeight: 1.5 }}>{value || 'Sin diligenciar'}</div>
            </div>
          ))}
        </Card>
        <Card style={{ padding: 16 }}>
          <FirmaRow items={[
            { label: 'Aprendiz', firmado: m3.firmaAprendiz },
            { label: 'Instructor de seguimiento', firmado: m3.firmaInstructor },
            { label: 'Ente co-formador', firmado: m3.firmaEnteCoformador },
          ]}/>
          <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 12 }}>{m3.ciudad || '—'} · {fd(m3.fechaDiligenciamiento)}</div>
        </Card>
        <div><Btn variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar evaluación</Btn></div>
      </div>
    )
  }

  return <Momento3Form m3={m3} seguimientosRealizados={record.momento2.length} fechaInicioSugerida={record.momento1.fechaInicio}
    onCancel={() => setEditing(false)} onSave={next => { onChange(next); setEditing(false) }}/>
}

function Momento3Form({ m3, seguimientosRealizados, fechaInicioSugerida, onCancel, onSave }: {
  m3: EtapaProductivaRecord['momento3']
  seguimientosRealizados: number
  fechaInicioSugerida: string
  onCancel: () => void
  onSave: (next: EtapaProductivaRecord['momento3']) => void
}) {
  "use no memo"
  const [draft, setDraft] = useState({
    ...m3,
    fechaInicio: m3.fechaInicio || fechaInicioSugerida,
    numeroVisitas: m3.numeroVisitas || seguimientosRealizados,
  })
  function set<K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) { setDraft(d => ({ ...d, [k]: v })) }

  const puedeGuardar = !!draft.fechaFin && !!draft.juicio

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionIntro title="Evaluación de la etapa productiva" sub="Se diligencia una única vez, al finalizar la etapa productiva."/>

      <Card style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Fecha inicio etapa productiva"><input type="date" className="nx-input" value={draft.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}/></Field>
          <Field label="Fecha fin de la ejecución" required><input type="date" className="nx-input" value={draft.fechaFin} onChange={e => set('fechaFin', e.target.value)}/></Field>
          <Field label="N.º de visitas realizadas"><input type="number" min={0} className="nx-input" value={draft.numeroVisitas} onChange={e => set('numeroVisitas', Number(e.target.value))}/></Field>
        </div>
        <Field label="La evaluación se realizó de forma" style={{ marginTop: 14 }}>
          <Seg name="modM3" value={draft.modalidad} onChange={v => set('modalidad', v as Modalidad)} options={MODALIDAD_OPTS}/>
        </Field>
        <Field label="Enlace de grabación" hint="Si se hace de forma virtual" style={{ marginTop: 14 }}>
          <input className="nx-input" placeholder="https://…" value={draft.enlaceGrabacion} onChange={e => set('enlaceGrabacion', e.target.value)}/>
        </Field>
      </Card>

      <FactoresBlock titulo="Factores técnicos" items={draft.factoresTecnicos} onChange={v => set('factoresTecnicos', v)}/>
      <FactoresBlock titulo="Factores actitudinales y comportamentales" items={draft.factoresActitudinales} onChange={v => set('factoresActitudinales', v)}/>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Retroalimentación ente co-formador" sub="O reconocimientos especiales."/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Proceso de formación del aprendiz"><textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.retroEnteProceso} onChange={e => set('retroEnteProceso', e.target.value)}/></Field>
          <Field label="Desempeño de las competencias técnicas y actitudinales"><textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.retroEnteDesempeno} onChange={e => set('retroEnteDesempeno', e.target.value)}/></Field>
        </div>
      </Card>
      <Card style={{ padding: 20 }}>
        <SectionIntro title="Retroalimentación instructor de seguimiento" sub="O reconocimientos especiales."/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Proceso de formación del aprendiz"><textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.retroInstructorProceso} onChange={e => set('retroInstructorProceso', e.target.value)}/></Field>
          <Field label="Desempeño de las competencias técnicas y actitudinales"><textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.retroInstructorDesempeno} onChange={e => set('retroInstructorDesempeno', e.target.value)}/></Field>
        </div>
      </Card>
      <Card style={{ padding: 20 }}>
        <SectionIntro title="Retroalimentación del aprendiz"/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Proceso de formación"><textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.retroAprendizProceso} onChange={e => set('retroAprendizProceso', e.target.value)}/></Field>
          <Field label="Desempeño de las competencias técnicas y actitudinales"><textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={draft.retroAprendizDesempeno} onChange={e => set('retroAprendizDesempeno', e.target.value)}/></Field>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Juicio de evaluación de la etapa productiva" sub="Selecciona uno de los dos para poder guardar la evaluación."/>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => set('juicio', 'APROBADO')} style={{
            flex: 1, padding: '14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            border: `2px solid ${draft.juicio === 'APROBADO' ? '#86efac' : '#e4e4e7'}`,
            background: draft.juicio === 'APROBADO' ? '#dcfce7' : '#fff',
            color: draft.juicio === 'APROBADO' ? '#15803d' : '#3f3f46', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}><Ic n="checkCircle" s={15}/>Aprobado</button>
          <button onClick={() => set('juicio', 'NO_APROBADO')} style={{
            flex: 1, padding: '14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            border: `2px solid ${draft.juicio === 'NO_APROBADO' ? '#fecaca' : '#e4e4e7'}`,
            background: draft.juicio === 'NO_APROBADO' ? '#fee2e2' : '#fff',
            color: draft.juicio === 'NO_APROBADO' ? '#b91c1c' : '#3f3f46', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}><Ic n="x" s={15}/>No aprobado</button>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Firmas y diligenciamiento"/>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          {([
            ['firmaAprendiz', 'Firma del aprendiz'],
            ['firmaInstructor', 'Firma del instructor de seguimiento'],
            ['firmaEnteCoformador', 'Firma del ente co-formador'],
          ] as const).map(([k, label]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer' }}>
              <input type="checkbox" className="nx-check" checked={draft[k]} onChange={e => set(k, e.target.checked)}/>
              {label}
            </label>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Ciudad"><input className="nx-input" value={draft.ciudad} onChange={e => set('ciudad', e.target.value)}/></Field>
          <Field label="Fecha de diligenciamiento"><input type="date" className="nx-input" value={draft.fechaDiligenciamiento} onChange={e => set('fechaDiligenciamiento', e.target.value)}/></Field>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={!puedeGuardar} onClick={() => onSave({ ...draft, completado: true })}>Guardar evaluación</Btn>
      </div>
    </div>
  )
}

// ─── Tab: Anexo · Seguimiento extraordinario (opcional, repetible) ─────────────

function AnexoTab({ record, onChange }: {
  record: EtapaProductivaRecord
  onChange: (next: SeguimientoExtraordinario[]) => void
}) {
  "use no memo"
  const [openNew, setOpenNew] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  if (!record.momento1.completado) {
    return <Card style={{ padding: 24 }}><EmptyHint icon="lock" text="Completa primero el Momento 1 · Planeación."/></Card>
  }

  const items = [...record.anexos].sort((a, b) => b.fechaExtraordinario.localeCompare(a.fechaExtraordinario))
  const ultimaFechaSeguimiento = [...record.momento2].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.fecha ?? record.momento1.fechaInicio

  function agregar(item: SeguimientoExtraordinario) {
    onChange([...record.anexos, item])
    setOpenNew(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionIntro title="Seguimiento extraordinario" sub="Anexo opcional: se usa cuando ocurre una novedad fuera de los seguimientos regulares del Momento 2."/>
        {!openNew && <Btn variant="secondary" icon="plus" onClick={() => setOpenNew(true)}>Nuevo seguimiento extraordinario</Btn>}
      </div>

      {openNew && (
        <AnexoForm
          numero={record.anexos.length + 1}
          fechaSeguimientoAnterior={ultimaFechaSeguimiento}
          onCancel={() => setOpenNew(false)}
          onSave={agregar}
        />
      )}

      {items.length === 0 && !openNew ? (
        <Card style={{ padding: 24 }}><EmptyHint icon="info" text="No se han registrado seguimientos extraordinarios. Este anexo solo aplica si ocurre una novedad."/></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((s, i) => (
            <AnexoItem key={s.id} s={s} numero={items.length - i} open={openId === s.id} onToggle={() => setOpenId(o => o === s.id ? null : s.id)}/>
          ))}
        </div>
      )}
    </div>
  )
}

function AnexoItem({ s, numero, open, onToggle }: { s: SeguimientoExtraordinario; numero: number; open: boolean; onToggle: () => void }) {
  return (
    <Card style={{ overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ffedd5', color: '#c2410c', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>#{numero}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b', fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fechaExtraordinario)}</span>
            <Bdg tone="warn">Extraordinario</Bdg>
          </div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.motivo || 'Sin motivo registrado'}</div>
        </div>
        <Ic n={open ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #f1f1f3', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 4 }}>Motivo del seguimiento extraordinario</div>
            <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.5 }}>{s.motivo || '—'}</div>
          </div>
          <FactoresBlock titulo="Factores técnicos" items={s.factoresTecnicos} readOnly/>
          <FactoresBlock titulo="Factores actitudinales y comportamentales" items={s.factoresActitudinales} readOnly/>
          {([
            ['Compromisos del instructor de seguimiento', s.compromisosInstructor],
            ['Compromisos del aprendiz', s.compromisosAprendiz],
            ['Compromisos del responsable del ente co-formador', s.compromisosEnteCoformador],
          ] as [string, string][]).map(([label, value]) => value && (
            <div key={label}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}
          <FirmaRow items={[
            { label: 'Aprendiz', firmado: s.firmaAprendiz },
            { label: 'Instructor de seguimiento', firmado: s.firmaInstructor },
            { label: 'Ente co-formador', firmado: s.firmaEnteCoformador },
          ]}/>
          <div style={{ fontSize: 11.5, color: '#71717a' }}>{s.ciudad || '—'} · {fd(s.fechaDiligenciamiento)}</div>
        </div>
      )}
    </Card>
  )
}

function AnexoForm({ numero, fechaSeguimientoAnterior, onCancel, onSave }: {
  numero: number
  fechaSeguimientoAnterior: string
  onCancel: () => void
  onSave: (item: SeguimientoExtraordinario) => void
}) {
  "use no memo"
  const [fechaExtraordinario, setFechaExtraordinario] = useState('')
  const [modalidad, setModalidad] = useState<Modalidad>('PRESENCIAL')
  const [enlace, setEnlace] = useState('')
  const [motivo, setMotivo] = useState('')
  const [tecnicos, setTecnicos] = useState(nuevosFactores(FACTORES_TECNICOS))
  const [actitudinales, setActitudinales] = useState(nuevosFactores(FACTORES_ACTITUDINALES))
  const [compInstructor, setCompInstructor] = useState('')
  const [compAprendiz, setCompAprendiz] = useState('')
  const [compEnte, setCompEnte] = useState('')
  const [firmaAprendiz, setFirmaAprendiz] = useState(false)
  const [firmaInstructor, setFirmaInstructor] = useState(false)
  const [firmaEnte, setFirmaEnte] = useState(false)
  const [ciudad, setCiudad] = useState('')
  const [fechaDilig, setFechaDilig] = useState('')

  const puedeGuardar = !!fechaExtraordinario && !!motivo.trim()

  function guardar() {
    onSave({
      id: numero, fechaSeguimientoAnterior, fechaExtraordinario, modalidad, enlaceGrabacion: enlace, motivo,
      factoresTecnicos: tecnicos, factoresActitudinales: actitudinales,
      compromisosInstructor: compInstructor, compromisosAprendiz: compAprendiz, compromisosEnteCoformador: compEnte,
      firmaAprendiz, firmaInstructor, firmaEnteCoformador: firmaEnte,
      ciudad, fechaDiligenciamiento: fechaDilig,
    })
  }

  return (
    <Card style={{ padding: 20, border: '1px solid #fed7aa' }}>
      <SectionIntro title={`Seguimiento extraordinario #${numero}`}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Field label="Fecha del momento de seguimiento anterior"><input type="date" className="nx-input" value={fechaSeguimientoAnterior} disabled style={{ opacity: 0.7 }}/></Field>
        <Field label="Fecha del seguimiento extraordinario" required><input type="date" className="nx-input" value={fechaExtraordinario} onChange={e => setFechaExtraordinario(e.target.value)}/></Field>
      </div>
      <Field label="Motivo del seguimiento extraordinario" required style={{ marginBottom: 14 }}>
        <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={motivo} onChange={e => setMotivo(e.target.value)}/>
      </Field>
      <Field label="Modalidad del seguimiento" style={{ marginBottom: 14 }}>
        <Seg name={`modAnexo-${numero}`} value={modalidad} onChange={v => setModalidad(v as Modalidad)} options={MODALIDAD_OPTS}/>
      </Field>
      <Field label="Enlace de grabación" hint="Si se hace de forma virtual" style={{ marginBottom: 16 }}>
        <input className="nx-input" placeholder="https://…" value={enlace} onChange={e => setEnlace(e.target.value)}/>
      </Field>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <FactoresBlock titulo="Factores técnicos" items={tecnicos} onChange={setTecnicos}/>
        <FactoresBlock titulo="Factores actitudinales y comportamentales" items={actitudinales} onChange={setActitudinales}/>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <Field label="Compromisos por parte del instructor de seguimiento">
          <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={compInstructor} onChange={e => setCompInstructor(e.target.value)}/>
        </Field>
        <Field label="Compromisos por parte del aprendiz">
          <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={compAprendiz} onChange={e => setCompAprendiz(e.target.value)}/>
        </Field>
        <Field label="Compromisos por parte del responsable del ente co-formador">
          <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={compEnte} onChange={e => setCompEnte(e.target.value)}/>
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer' }}>
          <input type="checkbox" className="nx-check" checked={firmaAprendiz} onChange={e => setFirmaAprendiz(e.target.checked)}/>Firma del aprendiz
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer' }}>
          <input type="checkbox" className="nx-check" checked={firmaInstructor} onChange={e => setFirmaInstructor(e.target.checked)}/>Firma del instructor de seguimiento
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer' }}>
          <input type="checkbox" className="nx-check" checked={firmaEnte} onChange={e => setFirmaEnte(e.target.checked)}/>Firma del ente co-formador
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <Field label="Ciudad"><input className="nx-input" value={ciudad} onChange={e => setCiudad(e.target.value)}/></Field>
        <Field label="Fecha de diligenciamiento"><input type="date" className="nx-input" value={fechaDilig} onChange={e => setFechaDilig(e.target.value)}/></Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={!puedeGuardar} onClick={guardar}>Guardar seguimiento extraordinario</Btn>
      </div>
    </Card>
  )
}
