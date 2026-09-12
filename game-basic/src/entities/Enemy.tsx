import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { useEnemyStore } from './EnemyStore'
import { useGameStore, GameState } from '@/engine'
import { playerPosition, enemyMeshRegistry, dealDamageToPlayer } from './gameRefs'
import { useGameSound } from '@/audio'
import { useEffects } from '@/effects'

const ENEMY_SPEED = 3.2
const ENEMY_SPRINT_DIST = 15
const ATTACK_RANGE = 2.5
const ATTACK_DAMAGE = 12
const ATTACK_COOLDOWN = 1.3
const DEATH_DURATION = 1.0

interface EnemyProps {
  id: string
  initialPosition: [number, number, number]
}

/** A single enemy drone with chase + melee AI. */
export function Enemy({ id, initialPosition }: EnemyProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const meshRef = useRef<THREE.Group>(null)
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const eyeMatRef = useRef<THREE.MeshBasicMaterial>(null)

  const enemy = useEnemyStore((s) => s.enemies.find((e) => e.id === id))
  const removeEnemy = useEnemyStore((s) => s.removeEnemy)
  const enemyKilled = useGameStore((s) => s.enemyKilled)

  const { playFail } = useGameSound()
  const { spawnImpactEffect } = useEffects()

  const dirVec = useRef(new THREE.Vector3())
  const wasAlive = useRef(true)
  const deathTime = useRef(0)
  const attackTimer = useRef(ATTACK_COOLDOWN)
  const bobTime = useRef(Math.random() * Math.PI * 2)
  const lastHitFlash = useRef(0)

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
    bobTime.current += delta * 3

    if (enemy.alive) {
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
        let current = meshRef.current.rotation.y
        let diff = targetYaw - current
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        meshRef.current.rotation.y += diff * Math.min(1, 10 * delta)
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
        const s = 1 - deathProgress * 0.6
        meshRef.current.scale.setScalar(s)
      }

      if (deathProgress >= 1) {
        removeEnemy(id)
      }
    }

    // Hovering bob (only when alive)
    if (meshRef.current && enemy.alive) {
      meshRef.current.position.y = Math.sin(bobTime.current) * 0.12
    }

    // Hit flash on body material
    if (bodyMatRef.current && enemy.hitFlash !== lastHitFlash.current) {
      lastHitFlash.current = enemy.hitFlash
    }
    if (bodyMatRef.current) {
      const flashAge = (performance.now() - enemy.hitFlash) / 1000
      if (flashAge < 0.15 && enemy.hitFlash > 0) {
        bodyMatRef.current.emissive.setHex(0xff2a6d)
        bodyMatRef.current.emissiveIntensity = 2.0
      } else {
        bodyMatRef.current.emissive.setHex(0x9d4edd)
        bodyMatRef.current.emissiveIntensity = 0.25
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
        {/* Body — angular octahedron core */}
        <mesh castShadow>
          <octahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial
            ref={bodyMatRef}
            color="#2a1a4a"
            emissive="#9d4edd"
            emissiveIntensity={0.25}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        {/* Armor plates */}
        <mesh castShadow position={[0, 0.1, 0.15]}>
          <boxGeometry args={[0.3, 0.15, 0.1]} />
          <meshStandardMaterial color="#1a0a3a" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Head */}
        <mesh castShadow position={[0, 0.45, 0]}>
          <boxGeometry args={[0.22, 0.18, 0.22]} />
          <meshStandardMaterial color="#1a0a3a" emissive="#9d4edd" emissiveIntensity={0.15} metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Glowing eye visor */}
        <mesh position={[0, 0.45, 0.12]}>
          <boxGeometry args={[0.16, 0.05, 0.02]} />
          <meshBasicMaterial ref={eyeMatRef} color="#ff2a6d" />
        </mesh>
        {/* Side arms/weapons */}
        <mesh castShadow position={[-0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.28, 8]} />
          <meshStandardMaterial color="#1a0a3a" emissive="#ff2a6d" emissiveIntensity={0.08} metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.28, 8]} />
          <meshStandardMaterial color="#1a0a3a" emissive="#ff2a6d" emissiveIntensity={0.08} metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Core glow */}
        <mesh position={[0, 0, 0.28]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#05d9e8" />
        </mesh>
        {/* Hover thruster glow */}
        <mesh position={[0, -0.35, 0]}>
          <coneGeometry args={[0.12, 0.2, 8]} />
          <meshBasicMaterial color="#05d9e8" transparent opacity={0.6} />
        </mesh>
      </group>
    </RigidBody>
  )
}

// ============================================================

const MAX_ALIVE = 6
const SPAWN_INTERVAL = 1.5
const TOTAL_ENEMIES = 12

/** Manages enemy spawning and victory detection. Renders all active enemies. */
export function EnemyManager() {
  const enemies = useEnemyStore((s) => s.enemies)
  const spawnEnemy = useEnemyStore((s) => s.spawnEnemy)
  const resetEnemies = useEnemyStore((s) => s.reset)

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

    if (spawnedCount < enemiesTotal && aliveCount < MAX_ALIVE) {
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
