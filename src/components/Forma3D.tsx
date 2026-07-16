import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { meshState } from '../lib/meshState'
import './Forma3D.css'

export function Forma3D() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    // ── Escena / Cámara ───────────────────────────────────────────────────────
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.z = 5.0

    // ── Icosaedro — detail=1 → caras grandes y facetadas ─────────────────────
    const geo = new THREE.IcosahedronGeometry(1.25, 1)

    // Color base muy oscuro: el violeta viene de las luces, no del color
    const mat = new THREE.MeshPhongMaterial({
      color:      new THREE.Color(0.04, 0.03, 0.14),
      emissive:   new THREE.Color(0.04, 0.02, 0.14),
      specular:   new THREE.Color(0.95, 0.90, 1.00),
      shininess:  100,
      flatShading: true,
      transparent: true,
      opacity: 0.44,
      side: THREE.DoubleSide,
    })

    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    // Bordes claros sobre caras oscuras
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xddd6fe, transparent: true, opacity: 0.62 })
    ))

    // Halo exterior
    mesh.add(new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.40, 1),
      new THREE.MeshBasicMaterial({ color: 0x6d28d9, transparent: true, opacity: 0.035, side: THREE.BackSide })
    ))

    // ── Luces: el violeta viene de aquí, no del material ─────────────────────
    scene.add(new THREE.AmbientLight(0x1e1b4b, 1.8))

    const dirLight = new THREE.DirectionalLight(0xffffff, 4.2)
    dirLight.position.set(2, 4, 3)
    scene.add(dirLight)

    // Luz violeta fuerte desde abajo-izquierda → tiñe las caras
    const lPurple = new THREE.PointLight(0x6d28d9, 5.5, 12)
    lPurple.position.set(-3, -2, 1)
    scene.add(lPurple)

    const lBlue = new THREE.PointLight(0x818cf8, 2.5, 10)
    lBlue.position.set(3, -3, -2)
    scene.add(lBlue)

    // ── Red 3D en el mismo espacio que el icosaedro ───────────────────────────
    // netGroup recibe el mismo targetX/Y que mesh → mismo espacio 3D
    const netGroup = new THREE.Group()
    scene.add(netGroup)

    // Nodos flotantes separados de la figura (MIN_RADIUS aleja de la esfera)
    const FLOAT_PTS  = 42
    const MIN_RADIUS = 2.2   // radio mínimo desde el centro → nodos nunca encima de la esfera
    const floatPts: THREE.Vector3[] = []
    let attempts = 0
    while (floatPts.length < FLOAT_PTS && attempts < 3000) {
      attempts++
      const x = (Math.random() - 0.5) * 9.5
      const y = (Math.random() - 0.5) * 12
      const z = (Math.random() - 0.5) * 2.5
      if (Math.sqrt(x * x + y * y + z * z) >= MIN_RADIUS) {
        floatPts.push(new THREE.Vector3(x, y, z))
      }
    }

    // Nodos visibles
    netGroup.add(new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(floatPts),
      new THREE.PointsMaterial({ color: 0x8b5cf6, size: 0.062, transparent: true, opacity: 0.62 })
    ))

    // Conexiones — umbral que da ~40-60 líneas elegantes y bien espaciadas
    const MAX_DIST = 2.3
    const pairs: number[] = []
    for (let i = 0; i < floatPts.length; i++) {
      for (let j = i + 1; j < floatPts.length; j++) {
        if (floatPts[i].distanceTo(floatPts[j]) < MAX_DIST) {
          pairs.push(floatPts[i].x, floatPts[i].y, floatPts[i].z,
                     floatPts[j].x, floatPts[j].y, floatPts[j].z)
        }
      }
    }
    const lnGeo = new THREE.BufferGeometry()
    lnGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pairs), 3))
    netGroup.add(new THREE.LineSegments(lnGeo,
      new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.26 })
    ))

    // ── Mouse ─────────────────────────────────────────────────────────────────
    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0

    const onMouseMove = (e: MouseEvent) => {
      const r = mount.getBoundingClientRect()
      mouseX =  ((e.clientX - r.left) / r.width  - 0.5) * 2
      mouseY = -((e.clientY - r.top)  / r.height - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    // ── Animación ─────────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let rafId: number

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      targetX += (mouseX * 0.42 - targetX) * 0.032
      targetY += (mouseY * 0.30 - targetY) * 0.032

      // Mesh y red comparten la misma reacción al cursor → mismo espacio 3D
      mesh.rotation.y = t * 0.13 + targetX
      mesh.rotation.x = targetY
      // Exportar rotación actual para que SpaceTransition arranque sin salto
      meshState.rotY = mesh.rotation.y
      meshState.rotX = mesh.rotation.x

      // Red: mismo cursor pero auto-rotación algo más lenta → parallax sutil
      netGroup.rotation.y = t * 0.07 + targetX
      netGroup.rotation.x = targetY

      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMouseMove)
      ro.disconnect()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="forma3d-mount"/>
}
