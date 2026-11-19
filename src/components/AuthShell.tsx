import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Ic } from "./ui";
import "./AuthShell.css";

// La figura 3D (three.js) solo se descarga en la pantalla de ingreso.
const Forma3D = lazy(() =>
  import("./Forma3D").then((m) => ({ default: m.Forma3D })),
);

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      {/* ── Panel izquierdo ── */}
      <div className="auth-shell__left">
        {/* Logo */}
        <div className="auth-shell__logo">
          <div className="auth-shell__logo-inner">
            <img src="/iconos/icon_uno.svg" style={{ height: 30 }} />
            <div>
              <div className="auth-shell__brand-name">FORMA</div>
              <div className="auth-shell__brand-sub">
                Seguimiento etapa productiva
              </div>
            </div>
          </div>
        </div>

        {/* Contenido centrado */}
        <div className="auth-shell__content">
          <div className="auth-shell__content-inner screen-in">{children}</div>
        </div>

        {/* Pie */}
        <div className="auth-shell__footer">
          <span>© SENA · Regional Atlantico · 2026</span>
          <span className="auth-shell__footer-version">v 1.4.2</span>
        </div>
      </div>

      {/* ── Panel derecho 3D ── */}
      <div className="auth-shell__right">
        {/* Halos de fondo */}
        <div className="auth-shell__halo-top" />
        <div className="auth-shell__halo-bottom" />

        {/* Canvas Three.js — ocupa todo el panel */}
        <Suspense fallback={null}>
          <Forma3D />
        </Suspense>

        {/* Overlay UI (encima del canvas, pointer-events none para no bloquear mouse) */}
        <div className="auth-shell__overlay">
          {/* Badge superior */}
          <div className="auth-shell__badge">
            <span className="auth-shell__badge-dot" />
            <span className="auth-shell__badge-text">FORMA · 3D</span>
          </div>

          {/* Texto inferior */}
          <div>
            <div className="auth-shell__tagline">
              Dale forma a cada etapa productiva.
            </div>
            <div className="auth-shell__sub">
              Un sistema vivo de seguimiento al aprendiz en práctica.
            </div>

            {/* Seguridad */}
            <div className="auth-shell__security">
              <Ic
                n="shield"
                s={12}
                style={{ color: "rgba(255,255,255,.25)" }}
              />
              Conexión cifrada · Acceso restringido por rol
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
