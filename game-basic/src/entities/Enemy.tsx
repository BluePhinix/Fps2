import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useEnemyStore } from './EnemyStore'
import { useGameStore, GameState } from '@/engine'
import { useQualityProfile } from '@/engine/quality'
import { playerPosition, enemyMeshRegistry, dealDamageToPlayer } from './gameRefs'
import { useGameSound } from '@/audio'
import { useEffects } from '@/effects'

const ENEMY_SPEED = 3.2
const ENEMY_SPRINT_DIST = 15
const ATTACK_RANGE = 2.5
const ATTACK_DAMAGE = 12
const ATTACK_COOLDOWN = 1.3
const DEATH_DURATION = 1.0
const FLASH_MS = 150

// ---------------------------------------------------------------------------
// Shared geometry
//
// The original drone was 7 separate meshes each with `castShadow`, so six
// drones meant 42 draw calls (plus a second pass through all of them for the
// shadow map). The hull parts are merged into one geometry and the emissive
// trim into a second one with baked vertex colours — 2-3 draw calls per drone.
// ---------------------------------------------------------------------------

let hullGeometry: THREE.BufferGeometry | null = null
let trimGeometry: THREE.BufferGeometry | null = null
let thrusterGeometry: THREE.BufferGeometry | null = null
let trimMaterial: THREE.MeshBasicMaterial | null = null
let thrusterMaterial: THREE.MeshBasicMaterial | null = null

function getHullGeometry(): THREE.BufferGeometry {
  if (hullGeometry) return hullGeometry

  const core = new THREE.OctahedronGeometry(0.35, 0).toNonIndexed()

  const plate = new THREE.BoxGeometry(0.3, 0.15, 0.1).toNonIndexed()
  plate.translate(0, 0.1, 0.15)

  const head = new THREE.BoxGeometry(0.22, 0.18, 0.22).toNonIndexed()
  head.translate(0, 0.45, 0)

  const armL = new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8).toNonIndexed()
  armL.rotateZ(Math.PI / 2)
  armL.translate(-0.4, 0, 0)

  const armR = new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8).toNonIndexed()
  armR.rotateZ(Math.PI / 2)
  armR.translate(0.4, 0, 0)

  hullGeometry = mergeGeometries([core, plate, head, armL, armR]) ?? core
  ;[core, plate, head, armL, armR].forEach((g) => g.dispose())
  return hullGeometry
}

/** Emissive visor + core, baked into vertex colours so they share one material. */
function getTrimGeometry(): THREE.BufferGeometry {
  if (trimGeometry) return trimGeometry

  const visor = new THREE.BoxGeometry(0.16, 0.05, 0.02).toNonIndexed()
  visor.translate(0, 0.45, 0.12)
  paint(visor, new THREE.Color('#ff2a6d'))

  const core = new THREE.SphereGeometry(0.07, 8, 6).toNonIndexed()
  core.translate(0, 0, 0.28)
  paint(core, new THREE.Color('#05d9e8'))

  trimGeometry = mergeGeometries([visor, core]) ?? visor
  ;[visor, core].forEach((g) => g.dispose())
  return trimGeometry
}

function getThrusterGeometry(): THREE.BufferGeometry {
  if (!thrusterGeometry) thrusterGeometry = new THREE.ConeGeometry(0.12, 0.2, 8)
  return thrusterGeometry
}

function getTrimMaterial(): THREE.MeshBasicMaterial {
  if (!trimMaterial) trimMaterial = new THREE.MeshBasicMaterial({ vertexColors: true })
  return trimMaterial
}

function getThrusterMaterial(): THREE.MeshBasicMaterial {
  if (!thrusterMaterial) {
    thrusterMaterial = new THREE.MeshBasicMaterial({
      color: '#05d9e8',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
  }
  return thrusterMaterial
}

function paint(geometry: THREE.BufferGeometry, color: THREE.Color): void {
  const count = geometry.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

// ---------------------------------------------------------------------------

interface EnemyProps {
  id: string
  initialPosition: [number, number, number]
}

/** A single enemy drone with chase + melee AI. */
export function Enemy({ id, initialPosition }: EnemyProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const meshRef = useRef<THREE.Group>(null)
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null)

  const enemy = useEnemyStore((s) => s.enemies.find((e) => e.id === id))
  const removeEnemy = useEnemyStore((s) => s.removeEnemy)
  const enemyKilled = useGameStore((s) => s.enemyKilled)
  const profile = useQualityProfile()

  const { playFail } = useGameSound()
  const { spawnImpactEffect } = useEffects()

  const dirVec = useRef(new THREE.Vector3())
  const wasAlive = useRef(true)
  const deathTime = useRef(0)
  const attackTimer = useRef(ATTACK_COOLDOWN)
  const bobTime = useRef(Math.random() * Math.PI * 2)
  const isFlashing = useRef(false)

  // Register mesh for hitscan raycasting
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData.enemyId = id
      enemyMeshRegistry.set(id, meshRef.current)
    }
    return () => {
      enemyMeshRegistry.delete(id)
    }
  }, [id])

  useFrame((state, delta) => {
    if (!rigidBodyRef.current || !enemy) return

    const rb = rigidBodyRef.current
    const pos = rb.translation()
    const time = state.clock.elapsedTime

    if (enemy.alive) {
      bobTime.current += delta * 3

      // Chase the player
      dirVec.current.set(playerPosition.x - pos.x, 0, playerPosition.z - pos.z)
      const dist = dirVec.current.length()
      dirVec.current.normalize()

      const speed = dist > ENEMY_SPRINT_DIST ? ENEMY_SPEED * 1.4 : ENEMY_SPEED
      const vel = rb.linvel()

      if (dist > ATTACK_RANGE) {
        rb.setLinvel({
          x: dirVec.current.x * speed,
          y: vel.y,
          z: dirVec.current.z * speed,
        }, true)
      } else {
        // Stop and attack
        rb.setLinvel({ x: vel.x * 0.5, y: vel.y, z: vel.z * 0.5 }, true)
        attackTimer.current += delta
        if (attackTimer.current >= ATTACK_COOLDOWN) {
          attackTimer.current = 0
          dealDamageToPlayer(ATTACK_DAMAGE)
        }
      }

      // Face the player
      if (meshRef.current) {
        const targetYaw = Math.atan2(dirVec.current.x, dirVec.current.z)
        const current = meshRef.current.rotation.y
        let diff = targetYaw - current
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < Math.PI) diff += Math.PI * 2
        meshRef.current.rotation.y += diff * Math.min(1, 10 * delta)
        meshRef.current.position.y = Math.sin(bobTime.current) * 0.12
      }
    } else if (enemy.dying) {
      // Death animation — spin, fall, shrink
      if (wasAlive.current) {
        wasAlive.current = false
        deathTime.current = time
        enemyKilled()
        playFail()
        spawnImpactEffect([pos.x, pos.y + 0.3, pos.z])
      }

      const deathProgress = Math.min(1, (time - deathTime.current) / DEATH_DURATION)
      if (meshRef.current) {
        meshRef.current.rotation.z = deathProgress * Math.PI * 2
        meshRef.current.rotation.x = deathProgress * 0.8
        meshRef.current.position.y = -deathProgress * 1.2
        meshRef.current.scale.setScalar(1 - deathProgress * 0.6)
      }

      if (deathProgress >= 1) {
        removeEnemy(id)
      }
    }

    // Hit flash — only touch the material when the flash state actually flips.
    // Writing `emissive` every frame dirtied uniforms on every drone, every
    // frame, for no visual change.
    const mat = bodyMatRef.current
    if (mat) {
      const flashing = enemy.hitFlash > 0 && performance.now() - enemy.hitFlash < FLASH_MS
      if (flashing !== isFlashing.current) {
        isFlashing.current = flashing
        if (flashing) {
          mat.emissive.setHex(0xff2a6d)
          mat.emissiveIntensity = 2.0
        } else {
          mat.emissive.setHex(0x9d4edd)
          mat.emissiveIntensity = 0.25
        }
      }
    }
  })

  if (!enemy) return null

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={initialPosition}
      enabledRotations={[false, false, false]}
      linearDamping={3}
      mass={0.5}
      type="dynamic"
      colliders={false}
    >
      <CapsuleCollider args={[0.35, 0.3]} />
      <group ref={meshRef}>
        {/* Merged hull: core + armour plate + head + arms (1 draw call) */}
        <mesh
          geometry={getHullGeometry()}
          castShadow={profile.enemyShadows}
        >
          <meshStandardMaterial
            ref={bodyMatRef}
            color="#2a1a4a"
            emissive="#9d4edd"
            emissiveIntensity={0.25}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        {/* Emissive visor + core (1 draw call, vertex-coloured) */}
        <mesh
          geometry={getTrimGeometry()}
          material={getTrimMaterial()}
          position={[0, 0, 0]}
        />
        {/* Hover thruster — dropped on the low tier */}
        {profile.enemyDetail && (
          <mesh
            geometry={getThrusterGeometry()}
            material={getThrusterMaterial()}
            position={[0, -0.35, 0]}
          />
        )}
      </group>
    </RigidBody>
  )
}

// ============================================================

const SPAWN_INTERVAL = 1.5
const TOTAL_ENEMIES = 12

/** Manages enemy spawning and victory detection. Renders all active enemies. */
export function EnemyManager() {
  const enemies = useEnemyStore((s) => s.enemies)
  const spawnEnemy = useEnemyStore((s) => s.spawnEnemy)
  const resetEnemies = useEnemyStore((s) => s.reset)
  const profile = useQualityProfile()

  const gameState = useGameStore((s) => s.gameState)
  const setEnemiesTotal = useGameStore((s) => s.setEnemiesTotal)
  const enemiesKilled = useGameStore((s) => s.combat.enemiesKilled)
  const enemiesTotal = useGameStore((s) => s.combat.enemiesTotal)
  const victory = useGameStore((s) => s.victory)

  const spawnTimer = useRef(0)
  const hasInit = useRef(false)

  // On game start: reset and configure
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      resetEnemies()
      setEnemiesTotal(TOTAL_ENEMIES)
      hasInit.current = true
      spawnTimer.current = 0
    } else {
      hasInit.current = false
    }
  }, [gameState, resetEnemies, setEnemiesTotal])

  // Victory check
  useEffect(() => {
    if (
      gameState === GameState.PLAYING &&
      enemiesTotal > 0 &&
      enemiesKilled >= enemiesTotal
    ) {
      victory()
    }
  }, [enemiesKilled, enemiesTotal, gameState, victory])

  // Spawn logic
  useFrame((_, delta) => {
    if (gameState !== GameState.PLAYING || !hasInit.current) return

    const es = useEnemyStore.getState()
    const aliveCount = es.enemies.filter((e) => e.alive || e.dying).length
    const spawnedCount = es.totalSpawned

    if (spawnedCount < enemiesTotal && aliveCount < profile.maxAliveEnemies) {
      spawnTimer.current += delta
      if (spawnTimer.current >= SPAWN_INTERVAL) {
        spawnTimer.current = 0
        const angle = Math.random() * Math.PI * 2
        const dist = 20 + Math.random() * 8
        const x = Math.cos(angle) * dist
        const z = Math.sin(angle) * dist
        spawnEnemy([x, 1.5, z])
      }
    }
  })

  return (
    <>
      {enemies.map((e) => (
        <Enemy key={e.id} id={e.id} initialPosition={e.position} />
      ))}
    </>
  )
}
