import { create } from 'zustand'

/**
 * Enemy state management store.
 * Tracks enemy instances for spawning, damage, and death.
 * Mesh-level data (positions) is handled by Rapier rigid bodies in useFrame,
 * so this store only changes on discrete events (spawn, damage, death) —
 * keeping re-renders infrequent.
 */

export interface EnemyInstance {
  id: string
  position: [number, number, number]
  health: number
  maxHealth: number
  alive: boolean
  dying: boolean // playing death animation
  hitFlash: number // timestamp of last hit (for visual flash)
}

interface EnemyStore {
  enemies: EnemyInstance[]
  totalSpawned: number
  totalKilled: number

  spawnEnemy: (position: [number, number, number]) => void
  damageEnemy: (id: string, damage: number) => void
  startDeath: (id: string) => void
  removeEnemy: (id: string) => void
  reset: () => void
}

let enemyIdCounter = 0

export const useEnemyStore = create<EnemyStore>((set, get) => ({
  enemies: [],
  totalSpawned: 0,
  totalKilled: 0,

  spawnEnemy: (position) => {
    const id = `enemy_${enemyIdCounter++}`
    const health = 100
    set((state) => ({
      enemies: [
        ...state.enemies,
        {
          id,
          position,
          health,
          maxHealth: health,
          alive: true,
          dying: false,
          hitFlash: 0,
        },
      ],
      totalSpawned: state.totalSpawned + 1,
    }))
  },

  damageEnemy: (id, damage) => {
    set((state) => ({
      enemies: state.enemies.map((e) => {
        if (e.id !== id || !e.alive || e.dying) return e
        const newHealth = e.health - damage
        return {
          ...e,
          health: newHealth,
          hitFlash: performance.now(),
        }
      }),
    }))
    // Check for death
    const enemy = get().enemies.find((e) => e.id === id)
    if (enemy && enemy.health <= 0 && enemy.alive && !enemy.dying) {
      get().startDeath(id)
    }
  },

  startDeath: (id) => {
    set((state) => ({
      enemies: state.enemies.map((e) =>
        e.id === id ? { ...e, alive: false, dying: true } : e
      ),
      totalKilled: state.totalKilled + 1,
    }))
  },

  removeEnemy: (id) => {
    set((state) => ({
      enemies: state.enemies.filter((e) => e.id !== id),
    }))
  },

  reset: () => {
    enemyIdCounter = 0
    set({ enemies: [], totalSpawned: 0, totalKilled: 0 })
  },
}))
