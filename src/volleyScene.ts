import * as THREE from 'three'

export type ShotKind = 'serve' | 'set' | 'spike' | 'block'

export type VolleyScene = {
  setAim: (aimX: number) => void
  animateShot: (shot: {
    from: THREE.Vector3
    to: THREE.Vector3
    durationMs: number
    height: number
    color: string
    onComplete?: () => void
  }) => void
  flashPoint: () => void
  resize: (width: number, height: number) => void
  dispose: () => void
}

type Motion = {
  from: THREE.Vector3
  to: THREE.Vector3
  startAt: number
  durationMs: number
  height: number
  color: string
  onComplete?: () => void
}

const COURT = {
  width: 14,
  depth: 8.4,
  netX: 0,
}

function arcPoints(from: THREE.Vector3, to: THREE.Vector3, height: number, steps = 36) {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    points.push(
      new THREE.Vector3(
        THREE.MathUtils.lerp(from.x, to.x, t),
        THREE.MathUtils.lerp(from.y, to.y, t) + Math.sin(Math.PI * t) * height,
        THREE.MathUtils.lerp(from.z, to.z, t),
      ),
    )
  }
  return points
}

function makeGlowRing(radius: number, color: number, opacity = 0.35) {
  const geometry = new THREE.CircleGeometry(radius, 48)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const ring = new THREE.Mesh(geometry, material)
  ring.rotation.x = -Math.PI / 2
  ring.renderOrder = 1
  return ring
}

function makePlayer(color: number) {
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.75, 5, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.12, emissive: color, emissiveIntensity: 0.12 }),
  )
  body.position.y = 0.7
  group.add(body)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf5d5c4, roughness: 0.95, metalness: 0 }),
  )
  head.position.y = 1.52
  group.add(head)

  const glow = makeGlowRing(0.7, color, 0.24)
  glow.position.y = 0.03
  group.add(glow)

  return group
}

export function createVolleyScene(canvas: HTMLCanvasElement): VolleyScene {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x07111f, 12, 28)
  scene.background = new THREE.Color(0x07111f)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(0, 11, 14.5)
  camera.lookAt(0, 0.85, 0)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const ambient = new THREE.AmbientLight(0x9ebdff, 1.35)
  scene.add(ambient)

  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(-4, 9, 6)
  key.castShadow = true
  scene.add(key)

  const rim = new THREE.PointLight(0x4ccfff, 2, 30)
  rim.position.set(0, 3.3, 9)
  scene.add(rim)

  const court = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width, COURT.depth, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x9a623f, roughness: 0.9, metalness: 0.04 }),
  )
  court.rotation.x = -Math.PI / 2
  court.receiveShadow = true
  scene.add(court)

  const courtGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width + 2, COURT.depth + 2, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x0ebeff, transparent: true, opacity: 0.08, depthWrite: false }),
  )
  courtGlow.rotation.x = -Math.PI / 2
  courtGlow.position.y = 0.01
  scene.add(courtGlow)

  const netBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 2.1, COURT.depth - 1.1),
    new THREE.MeshStandardMaterial({ color: 0x0d1e3a, roughness: 0.7, metalness: 0.35, emissive: 0x0a2038, emissiveIntensity: 0.5 }),
  )
  netBase.position.set(COURT.netX, 1.05, 0)
  scene.add(netBase)

  const meshNet = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.depth - 1.1, 2.0, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xc8e8ff, wireframe: true, transparent: true, opacity: 0.7 }),
  )
  meshNet.position.set(COURT.netX, 1.05, 0)
  meshNet.rotation.y = Math.PI / 2
  scene.add(meshNet)

  const lines = [
    [-COURT.width / 2, 0.02, -COURT.depth / 2],
    [COURT.width / 2, 0.02, -COURT.depth / 2],
    [COURT.width / 2, 0.02, COURT.depth / 2],
    [-COURT.width / 2, 0.02, COURT.depth / 2],
    [-COURT.width / 2, 0.02, -COURT.depth / 2],
  ].map((p) => new THREE.Vector3(p[0], p[1], p[2]))
  const boundary = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(lines),
    new THREE.LineBasicMaterial({ color: 0xe7f6ff, transparent: true, opacity: 0.9 }),
  )
  scene.add(boundary)

  const centerLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-COURT.width / 2, 0.021, 0),
      new THREE.Vector3(COURT.width / 2, 0.021, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.75 }),
  )
  scene.add(centerLine)

  const serviceLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.021, -COURT.depth / 2 + 1.1),
      new THREE.Vector3(0, 0.021, COURT.depth / 2 - 1.1),
    ]),
    new THREE.LineBasicMaterial({ color: 0x4fc7ff, transparent: true, opacity: 0.32 }),
  )
  scene.add(serviceLine)

  const userTeamColor = 0x3aa9ff
  const aiTeamColor = 0xb86bff

  const userBack = makePlayer(userTeamColor)
  userBack.position.set(-5.8, 0, 2.2)
  scene.add(userBack)

  const userFront = makePlayer(userTeamColor)
  userFront.position.set(-2.2, 0, 0.9)
  scene.add(userFront)

  const aiFront = makePlayer(aiTeamColor)
  aiFront.position.set(2.1, 0, -0.9)
  scene.add(aiFront)

  const aiBack = makePlayer(aiTeamColor)
  aiBack.position.set(5.7, 0, -2.2)
  scene.add(aiBack)

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xf7fbff, emissive: 0x8ee8ff, emissiveIntensity: 1.8, roughness: 0.25, metalness: 0.15 }),
  )
  ball.castShadow = true
  ball.position.set(-5.4, 1.6, 2.2)
  scene.add(ball)

  const ballGlow = new THREE.PointLight(0x8ee8ff, 1.6, 8)
  ballGlow.position.copy(ball.position)
  scene.add(ballGlow)

  const aimRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.52, 42),
    new THREE.MeshBasicMaterial({ color: 0x7df2ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  )
  aimRing.rotation.x = -Math.PI / 2
  aimRing.position.set(2.8, 0.03, -1.9)
  scene.add(aimRing)

  const targetGlow = makeGlowRing(0.7, 0x7df2ff, 0.18)
  targetGlow.position.copy(aimRing.position)
  scene.add(targetGlow)

  const trailMaterial = new THREE.LineBasicMaterial({ color: 0x7df2ff, transparent: true, opacity: 0.95 })
  const trailGeometry = new THREE.BufferGeometry().setFromPoints([ball.position.clone(), ball.position.clone()])
  const trail = new THREE.Line(trailGeometry, trailMaterial)
  scene.add(trail)

  const flashLight = new THREE.PointLight(0xffffff, 0, 10)
  flashLight.position.set(0, 2.8, 0)
  scene.add(flashLight)

  const motionRef = { current: null as Motion | null }
  const aimRef = { current: 2.8 }
  const pulseRef = { current: 0 }
  let alive = true
  let rafId = 0

  const updateBallTrail = (points: THREE.Vector3[], color: string) => {
    trail.geometry.dispose()
    trail.material.dispose()
    trail.material = new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.95 })
    trail.geometry = new THREE.BufferGeometry().setFromPoints(points)
  }

  const resize = (width: number, height: number) => {
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  const animateShot: VolleyScene['animateShot'] = ({ from, to, durationMs, height, color, onComplete }) => {
    motionRef.current = {
      from: from.clone(),
      to: to.clone(),
      durationMs,
      height,
      startAt: performance.now(),
      color,
      onComplete,
    }
    updateBallTrail(arcPoints(from, to, height), color)
  }

  const setAim: VolleyScene['setAim'] = (aimX) => {
    aimRef.current = THREE.MathUtils.clamp(aimX, -2.7, 2.7)
    aimRing.position.set(aimRef.current, 0.03, -2.2)
    targetGlow.position.copy(aimRing.position)
  }

  const flashPoint = () => {
    pulseRef.current = 1
    flashLight.intensity = 5
    flashLight.position.set(0, 3.4, 0)
  }

  const clock = new THREE.Clock()
  const render = () => {
    if (!alive) return

    const dt = clock.getDelta()
    const now = performance.now()
    const t = now * 0.001

    userBack.position.y = Math.sin(t * 2.8) * 0.03
    userFront.position.y = Math.sin(t * 3.2 + 0.5) * 0.03
    aiFront.position.y = Math.sin(t * 3.1 + 1.4) * 0.03
    aiBack.position.y = Math.sin(t * 2.5 + 2.0) * 0.03

    userBack.rotation.y = Math.sin(t * 1.5) * 0.05
    aiBack.rotation.y = Math.cos(t * 1.4) * 0.05

    const motion = motionRef.current
    if (motion) {
      const progress = THREE.MathUtils.clamp((now - motion.startAt) / motion.durationMs, 0, 1)
      const x = THREE.MathUtils.lerp(motion.from.x, motion.to.x, progress)
      const y = THREE.MathUtils.lerp(motion.from.y, motion.to.y, progress) + Math.sin(Math.PI * progress) * motion.height
      const z = THREE.MathUtils.lerp(motion.from.z, motion.to.z, progress)
      ball.position.set(x, y, z)
      ballGlow.position.copy(ball.position)

      const points = arcPoints(motion.from, motion.to, motion.height)
      const traveled = Math.max(2, Math.ceil(points.length * progress))
      trail.geometry.dispose()
      trail.geometry = new THREE.BufferGeometry().setFromPoints(points.slice(0, traveled))

      if (progress >= 1) {
        motionRef.current = null
        motion.onComplete?.()
      }
    } else {
      ball.position.y += Math.sin(t * 4.5) * 0.0008
      ballGlow.position.copy(ball.position)
    }

    if (pulseRef.current > 0) {
      pulseRef.current = Math.max(0, pulseRef.current - dt * 2.6)
      flashLight.intensity = 5 * pulseRef.current
      flashLight.position.y = 2.6 + pulseRef.current * 1.4
    } else {
      flashLight.intensity = Math.max(0, flashLight.intensity - dt * 3)
    }

    renderer.render(scene, camera)
    rafId = requestAnimationFrame(render)
  }

  resize(canvas.clientWidth || 1, canvas.clientHeight || 1)
  setAim(aimRef.current)
  render()

  return {
    setAim,
    animateShot,
    flashPoint,
    resize,
    dispose: () => {
      alive = false
      cancelAnimationFrame(rafId)
      renderer.dispose()
      ;[
        court.geometry,
        courtGlow.geometry,
        netBase.geometry,
        meshNet.geometry,
        boundary.geometry,
        centerLine.geometry,
        serviceLine.geometry,
        ball.geometry,
        trail.geometry,
        aimRing.geometry,
        targetGlow.geometry,
      ].forEach((geometry) => geometry.dispose())
      ;[
        court.material,
        courtGlow.material,
        netBase.material,
        meshNet.material,
        boundary.material,
        centerLine.material,
        serviceLine.material,
        ball.material,
        trail.material,
        aimRing.material,
        targetGlow.material,
      ].forEach((material) => {
        if (Array.isArray(material)) return
        material.dispose()
      })
    },
  }
}
