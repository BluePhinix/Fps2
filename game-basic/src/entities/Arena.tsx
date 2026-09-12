import { useEffect, useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { useQualityStore } from '@/engine/quality'

// ---------------------------------------------------------------------------
// Shared textures & materials
//
// The previous version called `useArenaWallTexture()` inside every <ArenaWall>,
// so 4 walls built 4 identical 256x256 canvases and 10 crates built 10 more —
// 14 textures, 14 materials and 14 shader permutations for 3 surface types.
// Everything below is a lazily-built module singleton instead.
// ---------------------------------------------------------------------------

const textureCache = new Map<string, THREE.Texture>()
const materialCache = new Map<string, THREE.MeshStandardMaterial>()

/** Procedural cyberpunk grid floor. */
function getFloorTexture(size: number): THREE.Texture {
  const key = `floor:${size}`
  const cached = textureCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0a0a1a'
  ctx.fillRect(0, 0, size, size)

  const step = size / 8
  ctx.strokeStyle = '#05d9e8'
  ctx.lineWidth = 2
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }

  ctx.strokeStyle = '#ff2a6d22'
  ctx.lineWidth = 1
  for (let i = step / 2; i < size; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }

  for (let i = 0; i < 15; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size / 12)
    grad.addColorStop(0, '#ff2a6d33')
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.fillRect(x - size / 12, y - size / 12, size / 6, size / 6)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(8, 8)
  texture.anisotropy = 1
  textureCache.set(key, texture)
  return texture
}

/** Procedural wall panel texture. */
function getWallTexture(size: number): THREE.Texture {
  const key = `wall:${size}`
  const cached = textureCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0d0221'
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = '#ff2a6d'
  ctx.lineWidth = 3
  for (let i = 0; i < size; i += size / 8) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }

  ctx.strokeStyle = '#05d9e844'
  ctx.lineWidth = 1
  for (let i = size / 16; i < size; i += size / 8) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }

  ctx.fillStyle = '#9d4edd'
  ctx.fillRect(size / 2 - size / 32, 0, size / 16, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 1
  textureCache.set(key, texture)
  return texture
}

/** Procedural crate texture. */
function getCrateTexture(size: number): THREE.Texture {
  const key = `crate:${size}`
  const cached = textureCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#1a1a3a'
  ctx.fillRect(0, 0, size, size)

  const b = size / 64 // border scale
  ctx.strokeStyle = '#9d4edd'
  ctx.lineWidth = 4 * b
  ctx.strokeRect(2, 2, size - 4, size - 4)

  ctx.strokeStyle = '#9d4edd66'
  ctx.lineWidth = 2 * b
  ctx.beginPath()
  ctx.moveTo(10 * b, 10 * b); ctx.lineTo(size - 10 * b, size - 10 * b)
  ctx.moveTo(size - 10 * b, 10 * b); ctx.lineTo(10 * b, size - 10 * b)
  ctx.stroke()

  ctx.fillStyle = '#ff2a6d'
  const c = 20 * b
  ctx.fillRect(0, 0, c, 4 * b)
  ctx.fillRect(0, 0, 4 * b, c)
  ctx.fillRect(size - c, 0, c, 4 * b)
  ctx.fillRect(size - 4 * b, 0, 4 * b, c)
  ctx.fillRect(0, size - 4 * b, c, 4 * b)
  ctx.fillRect(0, size - c, 4 * b, c)
  ctx.fillRect(size - c, size - 4 * b, c, 4 * b)
  ctx.fillRect(size - 4 * b, size - c, 4 * b, c)

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 1
  textureCache.set(key, texture)
  return texture
}

function getMaterial(
  key: string,
  factory: () => THREE.MeshStandardMaterial
): THREE.MeshStandardMaterial {
  const cached = materialCache.get(key)
  if (cached) return cached
  const mat = factory()
  materialCache.set(key, mat)
  return mat
}

function getFloorMaterial(texSize: number) {
  return getMaterial(`floor:${texSize}`, () => new THREE.MeshStandardMaterial({
    map: getFloorTexture(texSize),
    emissive: '#05d9e8',
    emissiveIntensity: 0.12,
    metalness: 0.5,
    roughness: 0.6,
  }))
}

function getWallMaterial(texSize: number) {
  return getMaterial(`wall:${texSize}`, () => new THREE.MeshStandardMaterial({
    map: getWallTexture(texSize),
    emissive: '#ff2a6d',
    emissiveIntensity: 0.08,
    metalness: 0.6,
    roughness: 0.4,
  }))
}

function getCrateMaterial(texSize: number) {
  return getMaterial(`crate:${texSize}`, () => new THREE.MeshStandardMaterial({
    map: getCrateTexture(texSize),
    emissive: '#9d4edd',
    emissiveIntensity: 0.12,
    metalness: 0.7,
    roughness: 0.3,
  }))
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface BoxDef {
  position: [number, number, number]
  size: [number, number, number]
  rotationY?: number
}

const WALLS: BoxDef[] = [
  { position: [0, 3, -30], size: [60, 6, 0.5] },
  { position: [0, 3, 30], size: [60, 6, 0.5] },
  { position: [-30, 3, 0], size: [0.5, 6, 60] },
  { position: [30, 3, 0], size: [0.5, 6, 60] },
]

// Ordered so that slicing the first N (quality tier) keeps good arena coverage.
const CRATES: BoxDef[] = [
  { position: [8, 1, 8], size: [3, 2, 3] },
  { position: [-8, 1, -8], size: [3, 2, 3] },
  { position: [12, 1.5, -10], size: [2, 3, 2], rotationY: 0.5 },
  { position: [-12, 1.5, 10], size: [2, 3, 2], rotationY: -0.5 },
  { position: [0, 1, 15], size: [4, 2, 2] },
  { position: [0, 1, -15], size: [4, 2, 2] },
  { position: [15, 1, 0], size: [2, 2, 4] },
  { position: [-15, 1, 0], size: [2, 2, 4] },
  { position: [5, 0.75, -5], size: [1.5, 1.5, 1.5], rotationY: 0.3 },
  { position: [-5, 0.75, 5], size: [1.5, 1.5, 1.5], rotationY: -0.3 },
]

function buildInstanced(
  boxes: BoxDef[],
  material: THREE.Material,
  castShadow: boolean,
  receiveShadow: boolean
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, boxes.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const euler = new THREE.Euler()

  boxes.forEach((b, i) => {
    pos.set(b.position[0], b.position[1], b.position[2])
    euler.set(0, b.rotationY ?? 0, 0)
    q.setFromEuler(euler)
    scale.set(b.size[0], b.size[1], b.size[2])
    m.compose(pos, q, scale)
    mesh.setMatrixAt(i, m)
  })

  mesh.instanceMatrix.needsUpdate = true
  mesh.castShadow = castShadow
  mesh.receiveShadow = receiveShadow
  // Instance bounds aren't reflected in the geometry bounding sphere, so let
  // the driver skip culling rather than pop in and out.
  mesh.frustumCulled = false
  return mesh
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** Floor + all static colliders for the arena. */
export function Arena() {
  const tier = useQualityStore((s) => s.tier)
  const shadows = tier === 'high'
  const texSize = tier === 'low' ? 128 : tier === 'medium' ? 256 : 512

  const floorMaterial = useMemo(() => getFloorMaterial(tier === 'low' ? 256 : 512), [tier])
  const wallMesh = useMemo(
    () => buildInstanced(WALLS, getWallMaterial(texSize), shadows, shadows),
    [texSize, shadows]
  )
  const crates = useMemo(
    () => CRATES.slice(0, tier === 'low' ? 6 : tier === 'medium' ? 8 : 10),
    [tier]
  )
  const crateMesh = useMemo(
    () => buildInstanced(crates, getCrateMaterial(tier === 'low' ? 64 : 128), shadows, shadows),
    [crates, shadows, tier]
  )

  // Release the instanced buffers when the tier changes. Materials are cached
  // module-wide and intentionally kept alive.
  useEffect(
    () => () => {
      wallMesh.geometry.dispose()
      crateMesh.geometry.dispose()
    },
    [wallMesh, crateMesh]
  )

  return (
    <>
      {/* One fixed body for the floor instead of one per prop. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[30, 0.5, 30]} position={[0, -0.5, 0]} />
        <mesh
          receiveShadow={shadows}
          rotation-x={-Math.PI / 2}
          position={[0, 0, 0]}
          material={floorMaterial}
        >
          <planeGeometry args={[60, 60]} />
        </mesh>
      </RigidBody>

      {/* Walls: 1 draw call + 1 body with 4 colliders (was 4 + 4). */}
      <RigidBody type="fixed" colliders={false}>
        {WALLS.map((w, i) => (
          <CuboidCollider
            key={i}
            args={[w.size[0] / 2, w.size[1] / 2, w.size[2] / 2]}
            position={w.position}
          />
        ))}
        <primitive object={wallMesh} />
      </RigidBody>

      {/* Crates: 1 draw call + 1 body with N colliders (was N + N). */}
      <RigidBody type="fixed" colliders={false}>
        {crates.map((c, i) => (
          <CuboidCollider
            key={i}
            args={[c.size[0] / 2, c.size[1] / 2, c.size[2] / 2]}
            position={c.position}
            rotation={[0, c.rotationY ?? 0, 0]}
          />
        ))}
        <primitive object={crateMesh} />
      </RigidBody>
    </>
  )
}

// 竞技场灯光 — light count scales with tier because every extra light is extra
// per-fragment work in every material's shader.
export function ArenaLighting() {
  const tier = useQualityStore((s) => s.tier)
  const shadows = tier !== 'low'
  const shadowMapSize = tier === 'high' ? 2048 : 1024

  return (
    <>
      <ambientLight intensity={0.35} color="#1a1a4e" />
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.0}
        castShadow={shadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={100}
        color="#aaccff"
      />
      <hemisphereLight args={['#05d9e8', '#0d0221', 0.3]} />
      {tier !== 'low' && (
        <pointLight position={[-20, 6, -20]} intensity={2} distance={25} color="#ff2a6d" />
      )}
      {tier !== 'low' && (
        <pointLight position={[20, 6, 20]} intensity={2} distance={25} color="#05d9e8" />
      )}
      {tier === 'high' && (
        <pointLight position={[0, 10, 0]} intensity={1.5} distance={30} color="#9d4edd" />
      )}
    </>
  )
}
