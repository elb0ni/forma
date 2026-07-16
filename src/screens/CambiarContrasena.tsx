import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../lib/api'
import { useAuthStore } from '../store/auth'
import { AuthShell } from '../components/AuthShell'
import { Ic, Bdg } from '../components/ui'
import './CambiarContrasena.css'

const schema = z.object({
  password_actual: z.string().min(1, 'Contraseña temporal requerida'),
  password_nuevo:  z.string().min(8, 'Mínimo 8 caracteres'),
  confirmar:       z.string().min(1, 'Confirma la contraseña'),
}).refine(d => d.password_nuevo === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar'],
})

type FormData = z.infer<typeof schema>

// ─── Fortaleza de contraseña ──────────────────────────────────────────────────

const STRENGTH_LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte']
const STRENGTH_COLORS = ['#b91c1c', '#b91c1c', '#a16207', '#15803d', '#15803d']

function strengthScore(pwd: string) {
  return [
    pwd.length >= 8,
    /[A-Z]/.test(pwd),
    /\d/.test(pwd),
    /[^A-Za-z0-9]/.test(pwd),
  ].filter(Boolean).length
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label, hint, error, style: s, children,
}: {
  label: string; hint?: string; error?: string; style?: React.CSSProperties; children: React.ReactNode
}) {
  return (
    <div style={s}>
      <div className="field__header">
        <span className="field__label">
          {label}<span className="field__required"> *</span>
        </span>
        {hint && <span className="field__hint">{hint}</span>}
      </div>
      {children}
      {error && (
        <span className="field__error">{error}</span>
      )}
    </div>
  )
}

// ─── CambiarContrasena ────────────────────────────────────────────────────────

export function CambiarContrasena() {
  const navigate  = useNavigate()
  const clearUser = useAuthStore(s => s.clearUser)
  const [apiError, setApiError] = useState<string | null>(null)
  const [showPwd,  setShowPwd]  = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const pwdNuevo = watch('password_nuevo', '')
  const score    = pwdNuevo ? strengthScore(pwdNuevo) : 0

  async function onSubmit(data: FormData) {
    setApiError(null)
    try {
      await api.post('/auth/change-password', {
        password_actual: data.password_actual,
        password_nuevo:  data.password_nuevo,
      })
      clearUser()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401)      setApiError('Contraseña temporal incorrecta')
      else if (status === 429) setApiError('Demasiados intentos, espera un momento')
      else                     setApiError('Error al cambiar la contraseña')
    }
  }

  return (
    <AuthShell>
      <Bdg tone="accent" icon="lock">PRIMER ACCESO</Bdg>

      <div className="cambiar__title">Crea tu contraseña</div>
      <div className="cambiar__subtitle">
        Debes cambiarla antes de continuar.
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>

        {/* Contraseña temporal */}
        <Field
          label="Contraseña temporal"
          error={errors.password_actual?.message}
        >
          <input
            {...register('password_actual')}
            type="password"
            placeholder="La que te dio el administrador"
            autoComplete="current-password"
            autoFocus
            className="nx-input"
            style={errors.password_actual ? { borderColor: '#fecaca' } : undefined}
          />
        </Field>

        {/* Nueva contraseña */}
        <Field
          label="Nueva contraseña"
          hint={pwdNuevo ? `${pwdNuevo.length} car.` : undefined}
          error={errors.password_nuevo?.message}
          style={{ marginTop: 14 }}
        >
          <div className="cambiar__pwd-wrapper">
            <input
              {...register('password_nuevo')}
              type={showPwd ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className="nx-input"
              style={{
                paddingRight: 36,
                ...(errors.password_nuevo ? { borderColor: '#fecaca' } : {}),
              }}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              className="cambiar__pwd-toggle"
            >
              <Ic n="eye" s={14}/>
            </button>
          </div>
        </Field>

        {/* Indicador de fortaleza */}
        {pwdNuevo && (
          <>
            <div className="cambiar__strength-bars">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="cambiar__strength-bar" style={{
                  background: i < score ? STRENGTH_COLORS[score] : '#e4e4e7',
                }}/>
              ))}
            </div>
            <div className="cambiar__strength-label">
              <span>Fortaleza</span>
              <span style={{ fontWeight: 600, color: STRENGTH_COLORS[score] }}>
                {STRENGTH_LABELS[score]}
              </span>
            </div>
          </>
        )}

        {/* Confirmar contraseña */}
        <Field
          label="Confirmar contraseña"
          error={errors.confirmar?.message}
          style={{ marginTop: 14 }}
        >
          <input
            {...register('confirmar')}
            type={showPwd ? 'text' : 'password'}
            placeholder="Repite la nueva contraseña"
            autoComplete="new-password"
            className="nx-input"
            style={errors.confirmar ? { borderColor: '#fecaca' } : undefined}
          />
        </Field>

        {/* Error de API */}
        {apiError && (
          <div className="cambiar__api-error">
            <Ic n="alert" s={13} style={{ flexShrink: 0 }}/>
            {apiError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="cambiar__submit-btn"
          style={{
            background: isSubmitting ? '#a1a1aa' : '#4f46e5',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? (
            <>
              <span className="cambiar__spinner spin"/>
              Guardando…
            </>
          ) : 'Guardar y entrar'}
        </button>
      </form>
    </AuthShell>
  )
}
