import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { meshState } from '../lib/meshState'
import './SpaceTransition.css'

// ── Math helpers ──────────────────────────────────────────────────────────────
function vnoise(t: number) {
  const ti = Math.floor(t), tf = t - ti
  const s = tf * tf * (3 - 2 * tf)
  const a = Math.abs(Math.sin(ti * 127.1 + 311.7) * 43758.5453) % 1
  const b = Math.abs(Math.sin((ti + 1) * 127.1 + 311.7) * 43758.5453) % 1
  return a + (b - a) * s
}
function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }
function inv(t: number, a: number, b: number) { return clamp01((t - a) / (b - a)) }
function smoothstep(t: number) { return t * t * (3 - 2 * t) }

// ── Estrellas de fondo (estáticas) ────────────────────────────────────────────
const STARS_VERT = /* glsl */`
  attribute float aSize;
  uniform float uAlpha;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mv.z, 0.1);
    gl_PointSize = clamp(aSize * 90.0 / dist, 1.0, 3.0);
    float inFront = step(0.01, -mv.z);
    vAlpha = uAlpha * inFront;
    gl_Position = projectionMatrix * mv;
  }
`
const STARS_FRAG = /* glsl */`
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.45) discard;
    float core = pow(max(1.0 - d / 0.45, 0.0), 2.0);
    vec3 col = mix(vec3(0.72, 0.82, 1.0), vec3(1.0), core * core);
    gl_FragColor = vec4(col, core * vAlpha);
  }
`

// ── Estrella objetivo (billboard quad con halo + spikes) ──────────────────────
const STAR_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const STAR_FRAG = /* glsl */`
  uniform float uBright;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    float r = length(uv);
    float d = exp(-r * r * 5.0);
    gl_FragColor = vec4(1.0, 1.0, 1.0, clamp(d * uBright, 0.0, 1.0));
  }
`

// ── Post-processing ───────────────────────────────────────────────────────────
const PP_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`
const PP_FRAG = /* glsl */`
  uniform sampler2D uTex;
  uniform float     uAber;
  uniform float     uFlash;
  varying vec2      vUv;
  void main() {
    vec2  dir = vUv - 0.5;
    float ab  = uAber * (0.3 + length(dir) * 2.0);
    float r   = texture2D(uTex, vUv + dir * ab).r;
    float g   = texture2D(uTex, vUv           ).g;
    float b   = texture2D(uTex, vUv - dir * ab).b;
    vec3  col = vec3(r, g, b);
    col      *= 1.0 - smoothstep(0.40, 0.90, length(dir) * 1.2) * 0.35;
    col       = mix(col, vec3(1.0), uFlash);
    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Componente ────────────────────────────────────────────────────────────────
export function SpaceTransition({ onComplete }: { onComplete: () => void }) {
  const mountRef      = useRef<HTMLDivElement>(null)
  const doneRef       = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const [expanded, setExpanded] = useState(false)
  const [ready,    setReady]    = useState(false)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = mount.clientWidth, H = mount.clientHeight

    // ── Renderer ──────────────────────────────────────────────────────────
    // Si no hay WebGL disponible, saltamos la animación y completamos el
    // flujo igual: esto ocurre tras un login exitoso y no debe bloquear
    // la navegación al dashboard.
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      doneRef.current = true
      onCompleteRef.current()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x060610, 1)
    const cvs = renderer.domElement
    cvs.style.position = 'absolute'
    cvs.style.left = '0'
    cvs.style.top  = '0'
    mount.appendChild(cvs)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.01, 500)
    camera.position.set(0, 0, 5)

    // ── Icosaedro (continuidad visual con Forma3D) ────────────────────────
    const icoGeo  = new THREE.IcosahedronGeometry(1.25, 1)
    const icoMat  = new THREE.MeshPhongMaterial({
      color: new THREE.Color(0.04, 0.03, 0.14), emissive: new THREE.Color(0.04, 0.02, 0.14),
      specular: new THREE.Color(0.95, 0.90, 1.00), shininess: 100,
      flatShading: true, transparent: true, opacity: 0.44, side: THREE.DoubleSide,
    })
    const mesh     = new THREE.Mesh(icoGeo, icoMat)
    const edgesMat = new THREE.LineBasicMaterial({ color: 0xddd6fe, transparent: true, opacity: 0.62 })
    const glowMat  = new THREE.MeshBasicMaterial({ color: 0x6d28d9, transparent: true, opacity: 0.035, side: THREE.BackSide })
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(icoGeo), edgesMat))
    mesh.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.40, 1), glowMat))
    scene.add(mesh)

    // ── Luces ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1e1b4b, 1.8))
    const dL = new THREE.DirectionalLight(0xffffff, 4.2); dL.position.set(2, 4, 3); scene.add(dL)
    const pL = new THREE.PointLight(0x6d28d9, 5.5, 12);  pL.position.set(-3, -2, 1); scene.add(pL)
    const bL = new THREE.PointLight(0x818cf8, 2.5, 10);  bL.position.set(3, -3, -2); scene.add(bL)

    // ── Red de partículas ─────────────────────────────────────────────────
    const netPts: THREE.Vector3[] = []
    let tries = 0
    while (netPts.length < 42 && tries++ < 3000) {
      const x = (Math.random()-.5)*9.5, y = (Math.random()-.5)*12, z2 = (Math.random()-.5)*2.5
      if (Math.sqrt(x*x+y*y+z2*z2) >= 2.2) netPts.push(new THREE.Vector3(x,y,z2))
    }
    const netPtsMat   = new THREE.PointsMaterial({ color: 0x8b5cf6, size: 0.062, transparent: true, opacity: 0.62 })
    const netLinesMat = new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.26 })
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(netPts), netPtsMat))
    const lnP: number[] = []
    for (let i=0;i<netPts.length;i++) for (let j=i+1;j<netPts.length;j++)
      if (netPts[i].distanceTo(netPts[j])<2.3) lnP.push(...netPts[i].toArray(),...netPts[j].toArray())
    const lnG = new THREE.BufferGeometry()
    lnG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lnP), 3))
    scene.add(new THREE.LineSegments(lnG, netLinesMat))

    // ── Estrellas de fondo ────────────────────────────────────────────────
    const STAR_COUNT = 5000
    const sPos = new Float32Array(STAR_COUNT * 3)
    const sSiz = new Float32Array(STAR_COUNT)
    for (let i = 0; i < STAR_COUNT; i++) {
      const z   = -(Math.random() * 180 + 15)
      const r   = Math.abs(z) * 0.85 * Math.random()
      const ang = Math.random() * Math.PI * 2
      sPos[i*3]=Math.cos(ang)*r; sPos[i*3+1]=Math.sin(ang)*r; sPos[i*3+2]=z
      sSiz[i] = Math.random() * 0.4 + 0.08
    }
    const starsGeo = new THREE.BufferGeometry()
    starsGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
    starsGeo.setAttribute('aSize',    new THREE.BufferAttribute(sSiz, 1))
    const starsMat = new THREE.ShaderMaterial({
      vertexShader: STARS_VERT, fragmentShader: STARS_FRAG,
      uniforms: { uAlpha: { value: 0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    })
    scene.add(new THREE.Points(starsGeo, starsMat))

    // ── Estrella objetivo ─────────────────────────────────────────────────
    const TARGET_Z  = -85
    const targetGeo = new THREE.PlaneGeometry(8, 8)
    const targetMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
      uniforms: { uBright: { value: 0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    })
    const targetStar = new THREE.Mesh(targetGeo, targetMat)
    targetStar.position.set(0, 0, TARGET_Z)
    scene.add(targetStar)

    // ── Post-processing ───────────────────────────────────────────────────
    const rt    = new THREE.WebGLRenderTarget(W, H)
    const ppS   = new THREE.Scene()
    const ppC   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const ppMat = new THREE.ShaderMaterial({
      vertexShader: PP_VERT, fragmentShader: PP_FRAG,
      uniforms: { uTex: { value: rt.texture }, uAber: { value: 0 }, uFlash: { value: 0 } },
    })
    ppS.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ppMat))

    // ── Animación ──────────────────────────────────────────────────────────
    const TOTAL = 3.2
    const clock = new THREE.Clock()
    let rafId: number
    let rotY = meshState.rotY
    let rotX = meshState.rotX
    mesh.rotation.y = rotY
    mesh.rotation.x = rotX

    renderer.setRenderTarget(rt)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(ppS, ppC)

    setReady(true)
    requestAnimationFrame(() => setExpanded(true))

    let resizedToFull = false

    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const t = clock.getElapsedTime()
      const p = clamp01(t / TOTAL)

      // Canvas crece junto con el div durante la expansión CSS
      if (t < 0.6 || !resizedToFull) {
        const w = mount.clientWidth, h = mount.clientHeight
        renderer.setSize(w, h); rt.setSize(w, h)
        camera.aspect = w / h; camera.updateProjectionMatrix()
        if (t >= 0.6) resizedToFull = true
      }

      // Billboard: estrella objetivo siempre mira a la cámara
      targetStar.lookAt(camera.position)

      // ─ Fase 1+2: hold + pullback (0–2.0s) ────────────────────────────
      if (t < 2.0) {
        const tp = smoothstep(inv(t, 0.5, 2.0))
        camera.position.set(0, 0, 5.0 + tp * 7.0)  // z: 5 → 12

        // Icosaedro y red se desvanecen
        const fadeIco = 1.0 - smoothstep(inv(t, 0.8, 2.0))
        icoMat.opacity      = 0.44  * fadeIco
        edgesMat.opacity    = 0.62  * fadeIco
        glowMat.opacity     = 0.035 * fadeIco
        netPtsMat.opacity   = 0.62  * fadeIco
        netLinesMat.opacity = 0.26  * fadeIco
        if (fadeIco < 0.01) mesh.visible = false

        // Rotación se frena con el pullback
        const spinFade = 1.0 - smoothstep(inv(t, 0.5, 1.8))
        rotY += 0.007 * spinFade
        rotX += 0.002 * spinFade
        mesh.rotation.y = rotY
        mesh.rotation.x = rotX

        // Estrellas de fondo y estrella objetivo aparecen
        starsMat.uniforms.uAlpha.value  = smoothstep(inv(t, 0.6, 1.8))
        targetMat.uniforms.uBright.value = smoothstep(inv(t, 1.2, 2.0)) * 0.25
      }

      // ─ Fase 3: zoom hacia la estrella (2.0–3.0s) ─────────────────────
      if (t >= 2.0 && t < 3.0) {
        const tp    = inv(t, 2.0, 3.0)
        const eased = Math.pow(tp, 2.2)            // ease-in: lento → rápido
        camera.position.z = 12.0 - eased * 67.0   // z: 12 → −55

        const prox = Math.pow(tp, 1.5)             // proximidad normalizada
        targetMat.uniforms.uBright.value = 0.25 + prox * 1.8
        ppMat.uniforms.uAber.value       = prox * prox * 0.045

        // Camera shake orgánico que crece con la proximidad
        const shk  = prox * 0.5
        const freq = 6 + tp * 10
        camera.position.x = (vnoise(t * freq)      - 0.5) * shk * 0.12
        camera.position.y = (vnoise(t * freq + 50) - 0.5) * shk * 0.08
      }

      // ─ Fase 4: flash blanco — arranca en mitad del zoom para cubrir el punto
      ppMat.uniforms.uFlash.value = Math.pow(clamp01(inv(t, 2.2, 3.2)), 1.5)

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

    // ── Resize (post-expansión, cambios de ventana) ───────────────────────
    let resizeReady = false
    setTimeout(() => { resizeReady = true }, 700)
    const ro = new ResizeObserver(() => {
      if (!resizeReady) return
      const w = mount.clientWidth, h = mount.clientHeight
      renderer.setSize(w, h); rt.setSize(w, h)
      camera.aspect = w / h; camera.updateProjectionMatrix()
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(rafId); ro.disconnect()
      renderer.dispose(); rt.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="space-transition-mount"
      style={{
        left: expanded ? '0%' : '58%',
        opacity: ready ? 1 : 0,
      }}
    />
  )
}
