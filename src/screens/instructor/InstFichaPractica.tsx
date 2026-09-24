import { useEffect, useState } from 'react'
import { Ic, Card, Tag } from '../../components/ui'
import api from '../../lib/api'
import { fd, jornadaLabel, LoadingBlock, CenterState } from '../shared/parts'
import { AprendicesPracticaTable, EstadoAprendicesResumen } from '../shared/AprendicesPractica'
import { AlertasInstructorButton, NuevaAlertaButton } from '../shared/AlertasInstructor'
import type { AprendizPractica, InstructorPracticaInfo, KpiAprendicesPractica } from '../shared/AprendicesPractica'
import type { Aprendiz } from '../productiva/types'

interface FichaPracticaData {
  ficha: {
    id: number; numero_ficha: string; estado: string
    programa_nombre: string; programa_codigo: string; nivel_formacion: string
    coordinador_nombre: string; coordinacion_nombre: string
    sede: string | null; jornada: string | null
  }
  kpi: KpiAprendicesPractica
  aprendices: AprendizPractica[]
  instructor_practica: InstructorPracticaInfo | null
}

// Ficha en etapa práctica vista por su instructor de seguimiento (asignacion_practica):
// roster de aprendices, y desde cada uno se entra directo a crear o seguir gestionando
// su etapa productiva -- reutiliza los mismos componentes que el módulo "Etapa productiva".
export function InstFichaPractica({ fichaId, onBack, onOpenEtapa, onCrear }: {
  fichaId: number
  onBack: () => void
  onOpenEtapa: (etapaId: number) => void
  onCrear: (aprendizId: string | number) => void
}) {
  "use no memo"
  const [data, setData] = useState<FichaPracticaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [registrando, setRegistrando] = useState<string | null>(null)
  const [alertasKey, setAlertasKey] = useState(0)

  function cargar() {
    api.get<FichaPracticaData>(`/fichas/${fichaId}/detalle`)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.message ?? 'No se pudo cargar la ficha.'))
  }
  useEffect(cargar, [fichaId])

  async function abrir(row: AprendizPractica) {
    if (registrando) return
    if (row.etapa_id) { onOpenEtapa(row.etapa_id); return }
    if (row.aprendiz_id) { onCrear(row.aprendiz_id); return }
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
      onCrear(r.data.id)
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

  if (error) return <div style={{ maxWidth: 1200 }}>{back}<Card style={{ padding: 24 }}><CenterState icon="alert" title="Ficha no disponible" sub={error}/></Card></div>
  if (!data) return <div style={{ maxWidth: 1200 }}>{back}<LoadingBlock/></div>

  const { ficha, kpi, aprendices, instructor_practica } = data

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

        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <NuevaAlertaButton
            fichaId={ficha.id}
            aprendices={aprendices}
            onCreada={() => setAlertasKey(k => k + 1)}
          />
          <AlertasInstructorButton fichaId={ficha.id} refreshKey={alertasKey}/>
        </div>
      </div>

      <EstadoAprendicesResumen kpi={kpi}/>

      {registrando && (
        <div style={{ fontSize: 12, color: '#71717a', marginBottom: 10 }}>Registrando aprendiz…</div>
      )}
      <AprendicesPracticaTable aprendices={aprendices} onOpen={abrir}/>
    </div>
  )
}
