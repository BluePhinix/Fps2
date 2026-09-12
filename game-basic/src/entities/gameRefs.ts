import * as THREE from 'three'

/**
 * Shared mutable game refs — updated every frame, never trigger React re-renders.
 * Used for high-frequency data that needs to be shared between components
 * (player position for enemy AI, enemy meshes for hitscan raycasting, etc.)
 */

// Player world position (updated by FPSPlayer each frame, read by enemies)
export const playerPosition = new THREE.Vector3(0, 1.6, 0)

// Whether the pointer is locked (FPS look active)
export const pointerLocked = { current: false }

// Registry of enemy root meshes for hitscan raycasting.
// Key: enemyId, Value: the enemy's root Object3D (with userData.enemyId set)
export const enemyMeshRegistry = new Map<string, THREE.Object3D>()

// Player damage callback — set by FPSPlayer, called by enemies to deal damage
export const playerDamageCallbacks = new Set<(damage: number) => void>()

// Register a callback to receive damage (player)
export function onPlayerDamage(cb: (damage: number) => void): () => void {
  playerDamageCallbacks.add(cb)
  return () => playerDamageCallbacks.delete(cb)
}

// Deal damage to the player
export function dealDamageToPlayer(damage: number): void {
  playerDamageCallbacks.forEach((cb) => cb(damage))
}

// Reset all shared state (on game restart)
export function resetGameRefs(): void {
  playerPosition.set(0, 1.6, 0)
  pointerLocked.current = false
  enemyMeshRegistry.clear()
  playerDamageCallbacks.clear()
}
