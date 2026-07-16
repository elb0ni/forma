import { useState } from 'react'
import { UploadScreen, ProcessingScreen, ReviewScreen } from './importar'
import type { Programa } from '../../types'

type View = 'upload' | 'processing' | 'review'

export function Digitalizacion({ onSaved }: { onSaved?: () => void }) {
  "use no memo"
  const [view,        setView]        = useState<View>('upload')
  const [file,        setFile]        = useState<File | null>(null)
  const [pdfUrl,      setPdfUrl]      = useState('')
  const [programa,    setPrograma]    = useState<Programa | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFile = (f: File) => {
    setFile(f)
    setPdfUrl(URL.createObjectURL(f))
    setUploadError(null)
    setView('processing')
  }

  const handleDone  = (p: Programa) => { setPrograma(p); setView('review') }
  const handleError = (msg: string)  => { setUploadError(msg); setView('upload') }

  const handleBack = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(''); setFile(null); setPrograma(null); setView('upload')
  }

  const handleSaved = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(''); setFile(null); setPrograma(null)
    onSaved?.()
  }

  if (view === 'review' && programa && pdfUrl) {
    return <ReviewScreen programa={programa} pdfUrl={pdfUrl} onBack={handleBack} onSaved={handleSaved}/>
  }
  if (view === 'processing' && file) {
    return <ProcessingScreen file={file} onDone={handleDone} onError={handleError}/>
  }
  return <UploadScreen onFile={handleFile} error={uploadError}/>
}
