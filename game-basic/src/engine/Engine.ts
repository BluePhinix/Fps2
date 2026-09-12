import { create } from 'zustand'
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware'

// 游戏状态枚举
export enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'gameover',
  VICTORY = 'victory',
  LOADING = 'loading',
}

// 游戏设置
export interface GameSettings {
  musicVolume: number
  sfxVolume: number
  mouseSensitivity: number
  invertY: boolean
  showFPS: boolean
}

// 游戏统计
export interface GameStats {
  score: number
  kills: number
  deaths: number
  playtime: number
}

// ============ FPS 战斗状态 ============
export interface CombatState {
  health: number
  maxHealth: number
  ammo: number
  magSize: number
  reserveAmmo: number
  isReloading: boolean
  enemiesTotal: number
  enemiesKilled: number
}

const defaultCombat: CombatState = {
  health: 100,
  maxHealth: 100,
  ammo: 30,
  magSize: 30,
  reserveAmmo: 90,
  isReloading: false,
  enemiesTotal: 12,
  enemiesKilled: 0,
}

// Store 接口
interface GameStore {
  // 游戏状态
  gameState: GameState
  setGameState: (state: GameState) => void

  // 加载状态
  isLoading: boolean
  loadingProgress: number
  setLoading: (loading: boolean, progress?: number) => void

  // 游戏设置
  settings: GameSettings
  updateSettings: (settings: Partial<GameSettings>) => void

  // 游戏统计
  stats: GameStats
  updateStats: (stats: Partial<GameStats>) => void
  resetStats: () => void

  // 战斗状态
  combat: CombatState
  setHealth: (health: number) => void
  takeDamage: (damage: number) => void
  setAmmo: (ammo: number) => void
  consumeAmmo: () => void
  startReload: () => void
  finishReload: () => void
  setEnemiesTotal: (n: number) => void
  enemyKilled: () => void
  resetCombat: () => void

  // 时间相关
  deltaTime: number
  elapsedTime: number
  setTime: (delta: number, elapsed: number) => void

  // 暂停/恢复
  isPaused: boolean
  togglePause: () => void
  pause: () => void
  resume: () => void

  // 游戏流程控制
  startGame: () => void
  endGame: () => void
  victory: () => void
  restartGame: () => void
}

// 默认设置
const defaultSettings: GameSettings = {
  musicVolume: 0.7,
  sfxVolume: 1.0,
  mouseSensitivity: 1.0,
  invertY: false,
  showFPS: true,
}

// 默认统计
const defaultStats: GameStats = {
  score: 0,
  kills: 0,
  deaths: 0,
  playtime: 0,
}

// 创建 Store - 设置部分使用 persist 中间件持久化
export const useGameStore = create<GameStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // 初始状态
        gameState: GameState.MENU,
        isLoading: false,
        loadingProgress: 0,
        settings: defaultSettings,
        stats: defaultStats,
        combat: { ...defaultCombat },
        deltaTime: 0,
        elapsedTime: 0,
        isPaused: false,

        // 设置游戏状态
        setGameState: (state) => set({ gameState: state }),

        // 设置加载状态
        setLoading: (loading, progress = 0) =>
          set({ isLoading: loading, loadingProgress: progress }),

        // 更新设置
        updateSettings: (newSettings) =>
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          })),

        // 更新统计
        updateStats: (newStats) =>
          set((state) => ({
            stats: { ...state.stats, ...newStats },
          })),

        // 重置统计
        resetStats: () => set({ stats: defaultStats }),

        // ===== 战斗状态操作 =====
        setHealth: (health) =>
          set((state) => ({
            combat: {
              ...state.combat,
              health: Math.max(0, Math.min(state.combat.maxHealth, health)),
            },
          })),

        takeDamage: (damage) =>
          set((state) => {
            const newHealth = Math.max(0, state.combat.health - damage)
            return {
              combat: { ...state.combat, health: newHealth },
              stats: {
                ...state.stats,
                score: state.stats.score - 5, // 受伤扣分
              },
            }
          }),

        setAmmo: (ammo) =>
          set((state) => ({
            combat: { ...state.combat, ammo: Math.max(0, Math.min(state.combat.magSize, ammo)) },
          })),

        consumeAmmo: () =>
          set((state) => ({
            combat: {
              ...state.combat,
              ammo: Math.max(0, state.combat.ammo - 1),
            },
          })),

        startReload: () =>
          set((state) => ({
            combat: { ...state.combat, isReloading: true },
          })),

        finishReload: () =>
          set((state) => {
            const needed = state.combat.magSize - state.combat.ammo
            const taken = Math.min(needed, state.combat.reserveAmmo)
            return {
              combat: {
                ...state.combat,
                isReloading: false,
                ammo: state.combat.ammo + taken,
                reserveAmmo: state.combat.reserveAmmo - taken,
              },
            }
          }),

        setEnemiesTotal: (n) =>
          set((state) => ({
            combat: { ...state.combat, enemiesTotal: n },
          })),

        enemyKilled: () =>
          set((state) => {
            const newKilled = state.combat.enemiesKilled + 1
            return {
              combat: { ...state.combat, enemiesKilled: newKilled },
              stats: {
                ...state.stats,
                kills: state.stats.kills + 1,
                score: state.stats.score + 100,
              },
            }
          }),

        resetCombat: () => set({ combat: { ...defaultCombat } }),

        // 设置时间
        setTime: (delta, elapsed) =>
          set({ deltaTime: delta, elapsedTime: elapsed }),

        // 切换暂停
        togglePause: () => {
          const { isPaused, gameState } = get()
          if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) {
            set({
              isPaused: !isPaused,
              gameState: isPaused ? GameState.PLAYING : GameState.PAUSED,
            })
          }
        },

        pause: () =>
          set({
            isPaused: true,
            gameState: GameState.PAUSED,
          }),

        resume: () =>
          set({
            isPaused: false,
            gameState: GameState.PLAYING,
          }),

        // 开始游戏
        startGame: () => {
          set({
            gameState: GameState.PLAYING,
            isPaused: false,
            stats: { ...defaultStats },
            combat: { ...defaultCombat },
          })
        },

        // 结束游戏 (失败)
        endGame: () => {
          set({
            gameState: GameState.GAME_OVER,
            isPaused: false,
          })
        },

        // 胜利
        victory: () => {
          set({
            gameState: GameState.VICTORY,
            isPaused: false,
          })
        },

        // 重新开始
        restartGame: () => {
          set({
            gameState: GameState.PLAYING,
            isPaused: false,
            stats: { ...defaultStats },
            combat: { ...defaultCombat },
          })
        },
      }),
      {
        name: 'game3d_settings',
        storage: createJSONStorage(() => localStorage),
        // 只持久化设置，不持久化游戏状态
        partialize: (state) => ({
          settings: state.settings,
        }),
      }
    )
  )
)

// 选择器
export const selectGameState = (state: GameStore) => state.gameState
export const selectSettings = (state: GameStore) => state.settings
export const selectStats = (state: GameStore) => state.stats
export const selectIsPaused = (state: GameStore) => state.isPaused
export const selectCombat = (state: GameStore) => state.combat
