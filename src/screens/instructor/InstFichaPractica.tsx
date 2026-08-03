import { useEffect, useState } from 'react'
import { Ic, Card, Tag } from '../../components/ui'
import api from '../../lib/api'
import { fd, jornadaLabel, LoadingBlock, CenterState } from '../shared/parts'
import { AprendicesPracticaTable } from '../shared/AprendicesPractica'
import type { AprendizPractica, InstructorPracticaInfo } from '../shared/AprendicesPractica'
import { CrearEtapaProductivaForm } from '../productiva/EtapaProductivaList'
import type { Aprendiz } from '../productiva/types'

interface FichaPracticaData {
  ficha: {
    id: number; numero_ficha: string; estado: string
    programa_nombre: string; programa_codigo: string; nivel_formacion: string
    coordinador_nombre: string; coordinacion_nombre: string
    sede: string | null; jornada: string | null
  }
  kpi: { aprendices_total: number; listos_para_iniciar: number; en_curso: number; concluidos: number }
  aprendices_practica: AprendizPractica[]
  instructor_practica: InstructorPracticaInfo | null
}

function KpiBox({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: any }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        <Ic n={icon} s={14} style={{ color: '#a1a1aa' }}/>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 4 }}>{sub}</div>
    </Card>
  )
}

type Vista =
  | { kind: 'roster' }
  | { kind: 'crear'; aprendiz: Aprendiz }

// Ficha en etapa práctica vista por su instructor de seguimiento (asignacion_practica):
// roster de aprendices, y desde cada uno se entra directo a crear o seguir gestionando
// su etapa productiva -- reutiliza los mismos componentes que el módulo "Etapa productiva".
export function InstFichaPractica({ fichaId, onBack, onOpenEtapa }: {
  fichaId: number; onBack: () => void; onOpenEtapa: (etapaId: number) => void
}) {
  "use no memo"
  const [data, setData] = useState<FichaPracticaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>({ kind: 'roster' })
  const [registrando, setRegistrando] = useState<string | null>(null)

  function cargar() {
    api.get<FichaPracticaData>(`/fichas/${fichaId}/detalle`)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.message ?? 'No se pudo cargar la ficha.'))
  }
  useEffect(cargar, [fichaId])

  async function abrir(row: AprendizPractica) {
    if (registrando) return
    if (row.etapa_id) { onOpenEtapa(row.etapa_id); return }
    if (row.aprendiz_id) {
      const r = await api.get<Aprendiz>(`/aprendices/${row.aprendiz_id}`)
      setVista({ kind: 'crear', aprendiz: r.data })
      return
    }
    // Todavía no existe como aprendiz (solo aparece en el reporte de juicios) -- se
    // registra con lo que ya sabemos de ese reporte, y se sigue directo a la etapa.
    setRegistrando(row.numero_documento)
    try {
      const r = await api.post<Aprendiz>('/aprendices', {
        ficha_id: fichaId,
        tipo_documento: row.tipo_documento,
        numero_documento: row.numero_documento,
        nombre_completo: row.nombre_completo,
      })
      setVista({ kind: 'crear', aprendiz: r.data })
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo registrar el aprendiz.')
    } finally {
      setRegistrando(null)
    }
  }

  const back = (
    <button onClick={onBack} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
      <Ic n="arrowLeft" s={14}/>Volver a mis fichas
    </button>
  )

  if (vista.kind === 'crear') {
    return (
      <div style={{ maxWidth: 720 }}>
        {back}
        <CrearEtapaProductivaForm
          aprendiz={vista.aprendiz}
          onBack={() => setVista({ kind: 'roster' })}
          onCreated={onOpenEtapa}
        />
      </div>
    )
  }

  if (error) return <div style={{ maxWidth: 1200 }}>{back}<Card style={{ padding: 24 }}><CenterState icon="alert" title="Ficha no disponible" sub={error}/></Card></div>
  if (!data) return <div style={{ maxWidth: 1200 }}>{back}<LoadingBlock/></div>

  const { ficha, kpi, aprendices_practica, instructor_practica } = data

  return (
    <div style={{ maxWidth: 1200 }}>
      {back}

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: '#52525b', marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{ficha.programa_codigo}</span>
          <span>·</span><span>{ficha.nivel_formacion}</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>{ficha.programa_nombre}</h2>
        <div style={{ marginTop: 4, display: 'flex', gap: 10, fontSize: 13, color: '#3f3f46', alignItems: 'center', flexWrap: 'wrap' }}>
          <Tag>Ficha {ficha.numero_ficha}</Tag>
          <span>{jornadaLabel(ficha.jornada)}{ficha.sede ? ` · ${ficha.sede}` : ''}</span>
          <span style={{ color: '#a1a1aa' }}>·</span>
          <span>{ficha.coordinacion_nombre}</span>
        </div>
        {instructor_practica && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#3f3f46' }}>
            Instructor de práctica: <strong>{instructor_practica.nombre}</strong> · desde {fd(instructor_practica.fecha_inicio)}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KpiBox label="Aprendices" value={String(kpi.aprendices_total)} sub="en la ficha" icon="users"/>
        <KpiBox label="Listos para iniciar" value={String(kpi.listos_para_iniciar)} sub="sin alternativa, al día en juicios" icon="alert"/>
        <KpiBox label="En curso" value={String(kpi.en_curso)} sub="con etapa productiva activa" icon="briefcase"/>
        <KpiBox label="Concluidos" value={String(kpi.concluidos)} sub="confirmados por Sofia" icon="checkCircle"/>
      </div>

      {registrando && (
        <div style={{ fontSize: 12, color: '#71717a', marginBottom: 10 }}>Registrando aprendiz…</div>
      )}
      <AprendicesPracticaTable aprendices={aprendices_practica} onOpen={abrir}/>
    </div>
  )
}
