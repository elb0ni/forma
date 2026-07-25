// ─── Tipos: Formato de Planeación, Seguimiento y Evaluación de Etapa Productiva ───
// Basado en GFPI-F-023 V06. Prototipo de planeación: los datos viven solo en el
// navegador (no hay backend todavía), por eso todo el módulo trabaja con estos
// tipos y arreglos en memoria en vez de respuestas de /lib/api.

export type Modalidad = 'PRESENCIAL' | 'VIRTUAL'
export type ModalidadFormacion = 'PRESENCIAL' | 'VIRTUAL' | 'A_DISTANCIA'
export type Valoracion = 'SATISFACTORIO' | 'POR_MEJORAR' | null

export interface FactorItem {
  clave: string
  label: string
  valoracion: Valoracion
  observaciones: string
}

// Las 8 variables técnicas y 5 actitudinales/comportamentales son fijas en el
// formato (se repiten idénticas en Momento 2, Momento 3 y el Anexo).
export const FACTORES_TECNICOS: { clave: string; label: string }[] = [
  { clave: 'aplicacion_conocimiento', label: 'Aplicación de conocimiento' },
  { clave: 'mejora_continua',         label: 'Mejora continua' },
  { clave: 'fortalecimiento_ocup',    label: 'Fortalecimiento ocupacional' },
  { clave: 'oportunidad_calidad',     label: 'Oportunidad y calidad' },
  { clave: 'responsabilidad_amb',     label: 'Responsabilidad ambiental' },
  { clave: 'administracion_recursos', label: 'Administración de recursos' },
  { clave: 'seguridad_salud',         label: 'Seguridad y salud en el trabajo' },
  { clave: 'documentacion_etapa',     label: 'Documentación etapa productiva' },
]

export const FACTORES_ACTITUDINALES: { clave: string; label: string }[] = [
  { clave: 'relaciones_interp', label: 'Relaciones interpersonales' },
  { clave: 'trabajo_equipo',    label: 'Trabajo en equipo' },
  { clave: 'solucion_problemas', label: 'Solución de problemas' },
  { clave: 'cumplimiento',      label: 'Cumplimiento' },
  { clave: 'organizacion',      label: 'Organización' },
]

export function nuevosFactores(base: { clave: string; label: string }[]): FactorItem[] {
  return base.map(f => ({ ...f, valoracion: null, observaciones: '' }))
}

// ─── Información general ──────────────────────────────────────────────────────

export interface DatosAprendiz {
  nombreCompleto:      string
  tipoDocumento:        string
  numeroIdentificacion: string
  contactoTelefonico:   string
  direccion:            string
  correoPersonal:       string
  correoInstitucional:  string
  alternativaEtapaProductiva: string
  fechaRegistroSofiaPlus: string
}

export interface DatosInstructorSeguimiento {
  nombre:              string
  contactoTelefonico:  string
  correoInstitucional: string
}

export interface DatosEnteCoformador {
  nombreEmpresa:          string
  direccion:              string
  nit:                    string
  correoElectronico:      string
  nombreJefeInmediato:    string
  cargo:                  string
  contactoTelefonico:     string
  nombreOtroContacto:     string
  telefonoInstitucional:  string
}

export interface PersonaSituacionDiscapacidad {
  aplica:              boolean
  nombreAsiste:        string
  tipoAsistencia:      string
  contactoTelefonico:  string
}

export interface InfoGeneral {
  regional:              string
  centroFormacion:       string
  nivelFormativo:        string
  programaNombre:        string
  programaCodigo:        string
  numeroFicha:           string
  modalidadFormacion:    ModalidadFormacion
  estrategiaFormativa:   string
  fechaFinEtapaLectiva:  string
  aprendiz:              DatosAprendiz
  instructorSeguimiento: DatosInstructorSeguimiento
  enteCoformador:        DatosEnteCoformador
  discapacidad:          PersonaSituacionDiscapacidad
}

// ─── Momento 1 · Planeación (única vez) ───────────────────────────────────────

export interface Momento1Planeacion {
  completado:            boolean
  fechaInicio:           string
  fechaFin:              string
  fechaAfiliacionArl:    string
  numeroPolizaArl:       string
  horario:               string
  enlaceGrabacion:       string
  competenciasDesarrollar: string
  resultadosAprendizaje:   string
  actividadesDesarrollar:  string
  evidenciasAprendizaje:   string
  observacionesAdicionales: string
  firmaAprendiz:          boolean
  firmaInstructor:        boolean
  firmaEnteCoformador:    boolean
  ciudad:                string
  fechaDiligenciamiento: string
  modalidadDiligenciamiento: Modalidad
}

// ─── Momento 2 · Seguimiento (se repite durante la ejecución) ────────────────

export interface SeguimientoMomento2 {
  id:                       number
  fecha:                    string
  modalidad:                Modalidad
  enlaceGrabacion:          string
  factoresTecnicos:         FactorItem[]
  factoresActitudinales:    FactorItem[]
  observacionesInstructor:  string
  observacionesAprendiz:    string
  observacionesEnteCoformador: string
  firmaAprendiz:            boolean
  firmaInstructor:          boolean
  firmaEnteCoformador:      boolean
  ciudad:                   string
  fechaDiligenciamiento:    string
}

// ─── Momento 3 · Evaluación (única vez, al finalizar) ────────────────────────

export type Juicio = 'APROBADO' | 'NO_APROBADO' | null

export interface Momento3Evaluacion {
  completado:            boolean
  fechaInicio:           string
  fechaFin:              string
  numeroVisitas:         number
  modalidad:             Modalidad
  enlaceGrabacion:       string
  factoresTecnicos:      FactorItem[]
  factoresActitudinales: FactorItem[]
  retroEnteProceso:      string
  retroEnteDesempeno:    string
  retroInstructorProceso:   string
  retroInstructorDesempeno: string
  retroAprendizProceso:     string
  retroAprendizDesempeno:   string
  juicio:                Juicio
  firmaAprendiz:         boolean
  firmaInstructor:       boolean
  firmaEnteCoformador:   boolean
  ciudad:                string
  fechaDiligenciamiento: string
}

// ─── Anexo · Seguimiento extraordinario (opcional, repetible) ────────────────

export interface SeguimientoExtraordinario {
  id:                         number
  fechaSeguimientoAnterior:   string
  fechaExtraordinario:        string
  modalidad:                  Modalidad
  enlaceGrabacion:            string
  motivo:                     string
  factoresTecnicos:           FactorItem[]
  factoresActitudinales:      FactorItem[]
  compromisosInstructor:      string
  compromisosAprendiz:        string
  compromisosEnteCoformador:  string
  firmaAprendiz:              boolean
  firmaInstructor:            boolean
  firmaEnteCoformador:        boolean
  ciudad:                     string
  fechaDiligenciamiento:      string
}

// ─── Registro completo de un aprendiz en etapa productiva ───────────────────

export type EstadoEtapaProductiva =
  | 'PLANEACION_PENDIENTE' | 'EN_SEGUIMIENTO' | 'APROBADO' | 'NO_APROBADO'

export interface EtapaProductivaRecord {
  id:       number
  info:     InfoGeneral
  momento1: Momento1Planeacion
  momento2: SeguimientoMomento2[]
  momento3: Momento3Evaluacion
  anexos:   SeguimientoExtraordinario[]
}

export function estadoDe(r: EtapaProductivaRecord): EstadoEtapaProductiva {
  if (r.momento3.juicio === 'APROBADO')    return 'APROBADO'
  if (r.momento3.juicio === 'NO_APROBADO') return 'NO_APROBADO'
  if (!r.momento1.completado)              return 'PLANEACION_PENDIENTE'
  return 'EN_SEGUIMIENTO'
}

// Registro en blanco para "Nuevo registro" en la lista: todo queda vacío para
// que el instructor lo diligencie desde cero.
export function nuevoRegistro(id: number): EtapaProductivaRecord {
  return {
    id,
    info: {
      regional: '', centroFormacion: '', nivelFormativo: '',
      programaNombre: '', programaCodigo: '', numeroFicha: '',
      modalidadFormacion: 'PRESENCIAL', estrategiaFormativa: '', fechaFinEtapaLectiva: '',
      aprendiz: {
        nombreCompleto: '', tipoDocumento: 'CC', numeroIdentificacion: '', contactoTelefonico: '',
        direccion: '', correoPersonal: '', correoInstitucional: '',
        alternativaEtapaProductiva: '', fechaRegistroSofiaPlus: '',
      },
      instructorSeguimiento: { nombre: '', contactoTelefonico: '', correoInstitucional: '' },
      enteCoformador: {
        nombreEmpresa: '', direccion: '', nit: '', correoElectronico: '',
        nombreJefeInmediato: '', cargo: '', contactoTelefonico: '', nombreOtroContacto: '', telefonoInstitucional: '',
      },
      discapacidad: { aplica: false, nombreAsiste: '', tipoAsistencia: '', contactoTelefonico: '' },
    },
    momento1: {
      completado: false,
      fechaInicio: '', fechaFin: '', fechaAfiliacionArl: '', numeroPolizaArl: '',
      horario: '', enlaceGrabacion: '',
      competenciasDesarrollar: '', resultadosAprendizaje: '', actividadesDesarrollar: '',
      evidenciasAprendizaje: '', observacionesAdicionales: '',
      firmaAprendiz: false, firmaInstructor: false, firmaEnteCoformador: false,
      ciudad: '', fechaDiligenciamiento: '', modalidadDiligenciamiento: 'PRESENCIAL',
    },
    momento2: [],
    momento3: {
      completado: false,
      fechaInicio: '', fechaFin: '', numeroVisitas: 0,
      modalidad: 'PRESENCIAL', enlaceGrabacion: '',
      factoresTecnicos: nuevosFactores(FACTORES_TECNICOS),
      factoresActitudinales: nuevosFactores(FACTORES_ACTITUDINALES),
      retroEnteProceso: '', retroEnteDesempeno: '',
      retroInstructorProceso: '', retroInstructorDesempeno: '',
      retroAprendizProceso: '', retroAprendizDesempeno: '',
      juicio: null,
      firmaAprendiz: false, firmaInstructor: false, firmaEnteCoformador: false,
      ciudad: '', fechaDiligenciamiento: '',
    },
    anexos: [],
  }
}
