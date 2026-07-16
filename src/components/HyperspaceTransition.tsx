import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import './HyperspaceTransition.css'

// ── Value noise para camera shake ─────────────────────────────────────────────
function vnoise(t: number): number {
  const ti = Math.floor(t)
  const tf = t - ti
  const s  = tf * tf * (3 - 2 * tf)                          // smoothstep
  const a  = Math.abs(Math.sin(ti       * 127.1 + 311.7) * 43758.5453) % 1
  const b  = Math.abs(Math.sin((ti + 1) * 127.1 + 311.7) * 43758.5453) % 1
  return a + (b - a) * s
}

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT_STARS = /* glsl */`
  attribute float aSize;

  uniform float uSpeed;
  uniform float uTime;

  varying float vAlpha;
  varying vec2  vDir;

  void main() {
    // Mover estrellas hacia la cámara y hacer wrap cada 200 unidades
    float zSpd = uSpeed * uSpeed * 55.0 + uSpeed * 4.0 + 0.6;
    float wz   = mod(position.z + uTime * zSpd, 200.0);  // [0, 200]
    vec3  pos  = vec3(position.xy, -wz);                  // delante: z negativo

    vec4 mv   = modelViewMatrix  * vec4(pos, 1.0);
    vec4 clip = projectionMatrix * mv;

    // Tamaño con perspectiva real
    float dist     = max(-mv.z, 0.1);
    gl_PointSize   = aSize * (280.0 / dist) * (1.0 + uSpeed * 2.8);

    // Dirección radial en espacio de pantalla (para el streak)
    vDir = normalize(clip.xy / max(clip.w, 0.001));

    // Alpha: fade al hacer wrap (wz < 25) y fade si está demasiado cerca
    vAlpha = clamp(wz / 25.0, 0.0, 1.0) * clamp((dist - 0.2) / 1.2, 0.0, 1.0);

    gl_Position = clip;
  }
`

const FRAG_STARS = /* glsl */`
  uniform float uSpeed;

  varying float vAlpha;
  varying vec2  vDir;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;

    // Rotar la elipse hacia el centro de pantalla → streak radial
    float ang = atan(vDir.y, vDir.x);
    float c   = cos(-ang);
    float s   = sin(-ang);
    vec2  rot = vec2(c * uv.x - s * uv.y,
                     s * uv.x + c * uv.y);

    // Elongar en la dirección radial proporcional a speed²
    rot.x /= max(1.0 + uSpeed * uSpeed * 13.0, 1.0);

    float d = length(rot);
    if (d > 0.5) discard;

    float core = 1.0 - d * 2.0;

    // Color: centro blanco → borde azul-violeta
    vec3 col = mix(vec3(0.5, 0.6, 1.0), vec3(1.0, 1.0, 1.0), core * core);
    col += core * core * core * 1.1;       // micro-bloom en el núcleo

    gl_FragColor = vec4(col, core * vAlpha);
  }
`

const VERT_PP = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`

const FRAG_PP = /* glsl */`
  uniform sampler2D uTex;
  uniform float     uAber;
  uniform float     uFlash;

  varying vec2 vUv;

  void main() {
    vec2  dir = vUv - 0.5;
    float ab  = uAber * (0.3 + length(dir) * 2.2);

    // RGB shift en dirección radial → aberración cromática
    float r = texture2D(uTex, vUv + dir * ab).r;
    float g = texture2D(uTex, vUv           ).g;
    float b = texture2D(uTex, vUv - dir * ab).b;

    vec3 col = vec3(r, g, b);

    // Viñeta sutil para profundidad
    col *= 1.0 - smoothstep(0.38, 0.88, length(dir) * 1.25) * 0.4;

    // Flash blanco (salto hiperespacial)
    col = mix(col, vec3(1.0), uFlash);

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Componente ────────────────────────────────────────────────────────────────

interface Props { onComplete: () => void }

export function HyperspaceTransition({ onComplete }: Props) {
  const mountRef     = useRef<HTMLDivElement>(null)
  const doneRef      = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const W = mount.clientWidth
    const H = mount.clientHeight

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 1)
    mount.appendChild(renderer.domElement)

    // ── Escena principal (estrellas) ─────────────────────────────────────────
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.05, 300)

    const STARS = 12000
    const pArr  = new Float32Array(STARS * 3)
    const sArr  = new Float32Array(STARS)

    for (let i = 0; i < STARS; i++) {
      const z   = Math.random() * 200              // profundidad [0, 200]
      const r   = z * 0.82 * Math.random()         // distribución cónica
      const ang = Math.random() * Math.PI * 2
      pArr[i * 3]     = Math.cos(ang) * r
      pArr[i * 3 + 1] = Math.sin(ang) * r
      pArr[i * 3 + 2] = z
      sArr[i] = Math.random() * 1.5 + 0.5
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pArr, 3))
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sArr, 1))

    const starMat = new THREE.ShaderMaterial({
      vertexShader:   VERT_STARS,
      fragmentShader: FRAG_STARS,
      uniforms:   { uSpeed: { value: 0 }, uTime: { value: 0 } },
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthTest:   false,
      depthWrite:  false,
    })
    scene.add(new THREE.Points(geo, starMat))

    // ── Post-processing (aberración + flash) ─────────────────────────────────
    const rt  = new THREE.WebGLRenderTarget(W, H)
    const ppS = new THREE.Scene()
    const ppC = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const ppMat = new THREE.ShaderMaterial({
      vertexShader:   VERT_PP,
      fragmentShader: FRAG_PP,
      uniforms: {
        uTex:   { value: rt.texture },
        uAber:  { value: 0 },
        uFlash: { value: 0 },
      },
    })
    ppS.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ppMat))

    // ── Curva de aceleración ─────────────────────────────────────────────────
    function easeSpeed(p: number): number {
      if (p < 0.12) return Math.pow(p / 0.12, 2.5) * 0.09
      if (p < 0.68) return 0.09 + Math.pow((p - 0.12) / 0.56, 1.9) * 0.76
      if (p < 0.84) return 0.85 + (p - 0.68) / 0.16 * 0.15
      return 1.0
    }

    // ── Loop ─────────────────────────────────────────────────────────────────
    const TOTAL = 4.4   // segundos totales de animación
    const clock = new THREE.Clock()
    let rafId: number

    const tick = () => {
      rafId = requestAnimationFrame(tick)

      const t   = clock.getElapsedTime()
      const p   = Math.min(t / TOTAL, 1.0)
      const spd = easeSpeed(p)

      // Uniforms de estrellas
      starMat.uniforms.uSpeed.value = spd
      starMat.uniforms.uTime.value  = t

      // Camera shake: value noise en múltiples frecuencias
      const shk  = Math.max(0, spd - 0.26) * 1.8
      const freq = 12 + spd * 22
      camera.position.x = (vnoise(t * freq)              - 0.5) * shk * 0.12
      camera.position.y = (vnoise(t * freq + 73.4)       - 0.5) * shk * 0.08
      camera.rotation.z = (vnoise(t * freq * 0.6 + 140)  - 0.5) * shk * 0.030
      // Micro-kick adicional en el eje z (sensación de inercia)
      camera.rotation.x = (vnoise(t * freq * 0.3 + 200)  - 0.5) * shk * 0.012

      // Aberración cromática (aparece al 40% de velocidad)
      ppMat.uniforms.uAber.value  = Math.max(0, spd - 0.38) * 0.042

      // Flash blanco: ease-in cúbico en el último 20%
      const fl = Math.max(0, (p - 0.80) / 0.20)
      ppMat.uniforms.uFlash.value = fl * fl * fl

      // Render → render target → post-process → pantalla
      renderer.setRenderTarget(rt)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      renderer.render(ppS, ppC)

      if (p >= 1.0 && !doneRef.current) {
        doneRef.current = true
        cancelAnimationFrame(rafId)
        onCompleteRef.current()
      }
    }
    tick()

    // ── Resize ───────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      renderer.setSize(w, h)
      rt.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      renderer.dispose()
      rt.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="hyperspace-in hyperspace-mount"
    />
  )
}
