import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore, GameState, consumeTouchReload } from '@/engine'
import { useInputStore } from '@/engine'
import { useQualityProfile } from '@/engine/quality'
import { enemyMeshRegistry, isAimActive } from './gameRefs'
import { useEnemyStore } from './EnemyStore'
import { useGameSound } from '@/audio'
import { useEffects } from '@/effects'

const FIRE_RATE = 0.12 // seconds between shots
const RELOAD_TIME = 1.5 // seconds
const DAMAGE = 25
const MAX_RANGE = 100

/**
 * FPS Weapon Viewmodel — a procedural energy rifle attached to the camera.
 * Handles shooting (hitscan raycast), reloading, muzzle flash, recoil, and bob/sway.
 */
export function Weapon() {
  const { camera } = useThree()
  const profile = useQualityProfile()

  const groupRef = useRef<THREE.Group>(null) // matches camera transform
  const gunRef = useRef<THREE.Group>(null) // holds gun mesh, applies bob/sway/recoil
  const muzzleLightRef = useRef<THREE.PointLight>(null)
  const muzzleMeshRef = useRef<THREE.Mesh>(null)

  // High-frequency state in refs (no re-renders)
  const lastShotTime = useRef(0)
  const muzzleFlashTime = useRef(-1)
  const recoilTime = useRef(-1)
  const reloadStartTime = useRef(-1)
  const bobTime = useRef(0)
  const recoilCurrent = useRef(0)

  // Pre-allocated
  const raycaster = useRef(new THREE.Raycaster())
  const cameraDir = useRef(new THREE.Vector3())

  const consumeAmmo = useGameStore((s) => s.consumeAmmo)
  const startReload = useGameStore((s) => s.startReload)
  const finishReload = useGameStore((s) => s.finishReload)
  const damageEnemy = useEnemyStore((s) => s.damageEnemy)

  const { playShoot, playReload, playHit } = useGameSound()
  const { spawnImpactEffect } = useEffects()

  // === Shoot (hitscan) ===
  const shoot = useCallback(() => {
    const gs = useGameStore.getState()
    if (gs.gameState !== GameState.PLAYING) return
    // Pointer lock on desktop, always-aiming on touch.
    if (!isAimActive()) return
    if (gs.combat.isReloading) return
    if (gs.combat.ammo <= 0) return

    const now = performance.now() / 1000
    if (now - lastShotTime.current < FIRE_RATE) return
    lastShotTime.current = now

    consumeAmmo()
    playShoot()

    // Muzzle flash + recoil
    muzzleFlashTime.current = now
    recoilTime.current = now
    recoilCurrent.current = 0.05

    // Hitscan raycast from camera center
    camera.getWorldDirection(cameraDir.current)
    raycaster.current.set(camera.position, cameraDir.current)
    raycaster.current.far = MAX_RANGE

    const meshes = Array.from(enemyMeshRegistry.values())
    if (meshes.length === 0) return

    const hits = raycaster.current.intersectObjects(meshes, true)
    if (hits.length > 0) {
      const hit = hits[0]
      let obj: THREE.Object3D | null = hit.object
      while (obj && !obj.userData.enemyId) {
        obj = obj.parent
      }
      if (obj?.userData.enemyId) {
        damageEnemy(obj.userData.enemyId as string, DAMAGE)
        spawnImpactEffect([hit.point.x, hit.point.y, hit.point.z])
        playHit()
      }
    }
  }, [consumeAmmo, playShoot, playHit, damageEnemy, spawnImpactEffect, camera])

  // === Reload ===
  const reload = useCallback(() => {
    const gs = useGameStore.getState()
    if (gs.gameState !== GameState.PLAYING) return
    if (gs.combat.isReloading) return
    if (gs.combat.ammo >= gs.combat.magSize) return
    if (gs.combat.reserveAmmo <= 0) return

    startReload()
    playReload()
    reloadStartTime.current = performance.now() / 1000

    window.setTimeout(() => {
      finishReload()
      reloadStartTime.current = -1
    }, RELOAD_TIME * 1000)
  }, [startReload, finishReload, playReload])

  // === Input handlers ===
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) shoot()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') reload()
    }
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shoot, reload])

  useFrame((_state, delta) => {
    if (!groupRef.current || !gunRef.current) return

    // Match camera transform
    groupRef.current.position.copy(camera.position)
    groupRef.current.quaternion.copy(camera.quaternion)

    const gs = useGameStore.getState()
    const isPlaying = gs.gameState === GameState.PLAYING
    gunRef.current.visible = isPlaying

    if (!isPlaying) return

    const now = performance.now() / 1000

    // Auto-fire: left mouse button or the on-screen FIRE button.
    if (useInputStore.getState().isFiring()) {
      shoot()
    }

    // Touch reload button.
    if (consumeTouchReload()) {
      reload()
    }

    // Movement bob
    const movement = useInputStore.getState().getMovementInput()
    const isMoving = Math.abs(movement.x) > 0.01 || Math.abs(movement.y) > 0.01
    const isSprinting = useInputStore.getState().isActionPressed('sprint')
    const bobSpeed = isMoving ? (isSprinting ? 14 : 10) : 2
    bobTime.current += delta * bobSpeed

    const bobX = Math.sin(bobTime.current) * (isMoving ? 0.012 : 0.004)
    const bobY = Math.abs(Math.cos(bobTime.current)) * (isMoving ? 0.018 : 0.006)

    // Recoil decay
    const recoilElapsed = now - recoilTime.current
    if (recoilElapsed < 0.1) {
      recoilCurrent.current = 0.05 * (1 - recoilElapsed / 0.1)
    } else {
      recoilCurrent.current = 0
    }

    // Reload dip animation
    let reloadDip = 0
    let reloadRot = 0
    if (reloadStartTime.current > 0) {
      const rp = (now - reloadStartTime.current) / RELOAD_TIME
      // Dip down in first half, come back up in second half
      reloadDip = Math.sin(rp * Math.PI) * 0.25
      reloadRot = Math.sin(rp * Math.PI) * 0.4
    }

    // Apply transform to gun
    gunRef.current.position.set(
      0.22 + bobX,
      -0.24 + bobY - reloadDip - recoilCurrent.current * 0.5,
      -0.55 + recoilCurrent.current
    )
    gunRef.current.rotation.set(
      recoilCurrent.current * 3 + reloadRot,
      0,
      0
    )

    // Muzzle flash
    const flashAge = now - muzzleFlashTime.current
    const isFlashing = flashAge < 0.06
    if (muzzleLightRef.current) {
      muzzleLightRef.current.intensity = isFlashing ? 6 : 0
    }
    if (muzzleMeshRef.current) {
      const mat = muzzleMeshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = isFlashing ? 1 : 0
      const scale = isFlashing ? 1 + Math.random() * 0.5 : 1
      muzzleMeshRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group ref={groupRef}>
      <group ref={gunRef}>
        {/* Main body */}
        <mesh castShadow position={[0, 0, 0.05]}>
          <boxGeometry args={[0.07, 0.11, 0.45]} />
          <meshStandardMaterial color="#1a1a3a" emissive="#05d9e8" emissiveIntensity={0.08} metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Upper rail / sight */}
        <mesh position={[0, 0.07, 0.05]}>
          <boxGeometry args={[0.04, 0.03, 0.3]} />
          <meshStandardMaterial color="#0d0221" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Front sight */}
        <mesh position={[0, 0.09, -0.12]}>
          <boxGeometry args={[0.015, 0.04, 0.02]} />
          <meshBasicMaterial color="#05d9e8" />
        </mesh>
        {/* Barrel */}
        <mesh position={[0, 0.01, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.025, 0.35, 12]} />
          <meshStandardMaterial color="#0d0221" metalness={0.95} roughness={0.1} />
        </mesh>
        {/* Barrel tip */}
        <mesh position={[0, 0.01, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.022, 0.04, 12]} />
          <meshStandardMaterial color="#1a1a3a" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Grip */}
        <mesh position={[0, -0.08, 0.18]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.05, 0.15, 0.06]} />
          <meshStandardMaterial color="#0d0221" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Magazine */}
        <mesh position={[0, -0.12, 0.05]}>
          <boxGeometry args={[0.045, 0.1, 0.08]} />
          <meshStandardMaterial color="#1a1a3a" emissive="#ff2a6d" emissiveIntensity={0.1} metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Stock */}
        <mesh position={[0, 0, 0.32]}>
          <boxGeometry args={[0.05, 0.08, 0.18]} />
          <meshStandardMaterial color="#0d0221" metalness={0.8} roughness={0.35} />
        </mesh>
        {/* Trim — dropped on the low tier */}
        {profile.viewmodelDetail && (
          <>
            {/* Energy cell glow */}
            <mesh position={[0, -0.12, 0.05]}>
              <boxGeometry args={[0.02, 0.06, 0.03]} />
              <meshBasicMaterial color="#ff2a6d" />
            </mesh>
            {/* Side accent strips */}
            <mesh position={[0.04, 0, 0.05]}>
              <boxGeometry args={[0.005, 0.02, 0.35]} />
              <meshBasicMaterial color="#05d9e8" />
            </mesh>
            <mesh position={[-0.04, 0, 0.05]}>
              <boxGeometry args={[0.005, 0.02, 0.35]} />
              <meshBasicMaterial color="#ff2a6d" />
            </mesh>
          </>
        )}
        {/* Muzzle flash light */}
        <pointLight ref={muzzleLightRef} position={[0, 0.01, -0.5]} color="#ffcc44" intensity={0} distance={6} />
        {/* Muzzle flash mesh */}
        <mesh ref={muzzleMeshRef} position={[0, 0.01, -0.5]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#ffdd55" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
