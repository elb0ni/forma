import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../lib/api'
import { useAuthStore } from '../store/auth'
import { AuthShell } from '../components/AuthShell'
import { SpaceTransition } from '../components/SpaceTransition'
import { Ic } from '../components/ui'
import type { AuthUser } from '../types'
import './Login.css'

const schema = z.object({
  email:    z.string().email('Correo inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})

type FormData = z.infer<typeof schema>

const API_ERRORS: Record<number, string> = {
  401: 'Credenciales inválidas',
  403: 'Tu cuenta está desactivada',
  429: 'Demasiados intentos, espera un momento',
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label, error, style: s, children,
}: {
  label: string; error?: string; style?: React.CSSProperties; children: React.ReactNode
}) {
  return (
    <div style={s}>
      <div className="field__header">
        <span className="field__label">
          {label}<span className="field__required"> *</span>
        </span>
      </div>
      {children}
      {error && (
        <span className="field__error">{error}</span>
      )}
    </div>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────

export function Login() {
  const navigate = useNavigate()
  const setUser  = useAuthStore(s => s.setUser)
  const [apiError, setApiError] = useState<string | null>(null)

  const [warpPayload, setWarpPayload] = useState<{ user: AuthUser; target: string } | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setApiError(null)
    try {
      const res = await api.post<AuthUser>('/auth/login', data)
      const target = res.data.primer_login ? '/cambiar-contrasena' : '/dashboard'
      setWarpPayload({ user: res.data, target })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setApiError((status && API_ERRORS[status]) || 'Error al iniciar sesión')
    }
  }

  return (
    <>
    <AuthShell>
      <div className="login__title">Inicia sesión</div>
      <div className="login__subtitle">
        Usa tu cuenta institucional asignada.
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Correo institucional" error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            placeholder="usuario@sena.edu.co"
            autoFocus
            autoComplete="email"
            className="nx-input"
            style={errors.email ? { borderColor: '#fecaca' } : undefined}
          />
        </Field>

        <Field label="Contraseña" error={errors.password?.message} style={{ marginTop: 14 }}>
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            className="nx-input"
            style={errors.password ? { borderColor: '#fecaca' } : undefined}
          />
        </Field>

        {apiError && (
          <div className="login__api-error">
            <Ic n="alert" s={13} style={{ flexShrink: 0 }}/>
            {apiError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="login__submit-btn"
          style={{ opacity: isSubmitting ? 0.75 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
        >
          {isSubmitting ? (
            <>
              <span className="login__spinner spin"/>
              Verificando…
            </>
          ) : (
            <>Continuar <Ic n="arrowRight" s={14}/></>
          )}
        </button>
      </form>

      <div className="login__info-box">
        <Ic n="info" s={13} style={{ color: '#71717a', marginTop: 2, flexShrink: 0 }}/>
        <div>
          ¿No tienes cuenta? Solicítalo a tu{' '}
          <strong style={{ color: '#18181b' }}>coordinador académico</strong>.
        </div>
      </div>
    </AuthShell>

    {warpPayload && (
      <SpaceTransition
        onComplete={() => {
          setUser(warpPayload.user)
          navigate(warpPayload.target, { replace: true })
        }}
      />
    )}
    </>
  )
}
