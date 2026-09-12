// 自适应画质系统 / Adaptive quality system
//
// Mobile GPUs are fill-rate bound, not vertex bound. The single biggest win is
// shrinking the framebuffer (dpr) and killing full-screen passes (post
// processing) and shadow-map re-renders. Everything here is derived from one
// "quality tier" so a single switch can turn the whole budget down at once.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type QualityTier = 'low' | 'medium' | 'high'
export type QualitySetting = 'auto' | QualityTier

export interface QualityProfile {
  /** [min, max] device pixel ratio handed to the renderer. */
  dpr: [number, number]
  /** MSAA. Very expensive on tile-based mobile GPUs. */
  antialias: boolean
  shadows: boolean
  shadowMapSize: number
  /** Full-screen post processing chain. */
  postProcessing: boolean
  bloom: boolean
  /** Extra decorative point lights (0 kills them entirely). */
  pointLights: number
  starCount: number
  /** Max simultaneously live particles in the pooled system. */
  particleBudget: number
  maxAliveEnemies: number
  /** Full detail enemy model vs. reduced. */
  enemyDetail: boolean
  /** Extra trim meshes on the first-person weapon. */
  viewmodelDetail: boolean
  crateCount: number
  /** Physics runs at 60Hz on high, 30Hz otherwise (halves WASM step cost). */
  physicsTimeStep: number
  enemyShadows: boolean
  /** Target used by the runtime resolution scaler. */
  targetFps: number
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  low: {
    dpr: [0.6, 1],
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    postProcessing: false,
    bloom: false,
    pointLights: 0,
    starCount: 250,
    particleBudget: 48,
    maxAliveEnemies: 4,
    enemyDetail: false,
    viewmodelDetail: false,
    crateCount: 6,
    physicsTimeStep: 1 / 30,
    enemyShadows: false,
    targetFps: 45,
  },
  medium: {
    dpr: [0.75, 1.5],
    antialias: false,
    shadows: true,
    shadowMapSize: 1024,
    postProcessing: false,
    bloom: false,
    pointLights: 2,
    starCount: 700,
    particleBudget: 120,
    maxAliveEnemies: 6,
    enemyDetail: true,
    viewmodelDetail: true,
    crateCount: 8,
    physicsTimeStep: 1 / 60,
    enemyShadows: false,
    targetFps: 55,
  },
  high: {
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    postProcessing: true,
    bloom: true,
    pointLights: 3,
    starCount: 1500,
    particleBudget: 260,
    maxAliveEnemies: 6,
    enemyDetail: true,
    viewmodelDetail: true,
    crateCount: 10,
    physicsTimeStep: 1 / 60,
    enemyShadows: true,
    targetFps: 60,
  },
}

// ============ Device detection ============

/** Coarse pointer + real touch points == phone/tablet, not a touchscreen laptop. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const maxTouchPoints = navigator.maxTouchPoints || 0
  if (maxTouchPoints === 0) return false
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const fine = window.matchMedia?.('(pointer: fine)').matches ?? false
  return coarse || !fine
}

function getGpuName(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return String(name || '').toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Best-effort tier guess. Deliberately conservative on phones: a wrong guess
 * upwards costs frames, a wrong guess downwards costs a little sharpness.
 */
export function detectQualityTier(): QualityTier {
  if (typeof window === 'undefined') return 'high'

  const gpu = getGpuName()
  // Software rasterisers / blocklisted drivers.
  if (/swiftshader|software|basic render|llvmpipe|mesa offscreen/i.test(gpu)) {
    return 'low'
  }

  const cores = navigator.hardwareConcurrency || 4
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  const touch = isTouchDevice()
  const shortSide = Math.min(window.screen?.width || 0, window.screen?.height || 0)
  const isTablet = touch && shortSide >= 700

  if (!touch) {
    if (cores >= 8 && memory >= 8) return 'high'
    if (cores >= 4) return 'medium'
    return 'low'
  }

  // Mobile GPUs. Regexes cover Adreno 6xx+, Apple A12+, Mali-G57+ / Immortalis.
  const strong =
    /apple a1[5-9]|apple m\d|adreno \(tm\) [78]\d\d|adreno \(tm\) 6[4-9]\d|mali-g7[2-9]|mali-g[89]\d\d|immortalis|xclipse 9/i
  const mid =
    /apple a1[2-4]|adreno \(tm\) 6[0-3]\d|mali-g(5[7-9]|6\d|7[01])|xclipse/i

  if (strong.test(gpu) && (cores >= 8 || memory >= 6)) return isTablet ? 'high' : 'medium'
  if (mid.test(gpu) || isTablet) return 'medium'
  return 'low'
}

// ============ Store ============

interface QualityStore {
  /** User preference. 'auto' follows detection. */
  preference: QualitySetting
  /** Resolved tier actually in use. */
  tier: QualityTier
  /** Locked once detected so `auto` never changes mid-session. */
  detected: QualityTier | null
  touch: boolean
  setPreference: (p: QualitySetting) => void
  init: () => void
}

export const useQualityStore = create<QualityStore>()(
  persist(
    (set, get) => ({
      preference: 'auto',
      tier: 'high',
      detected: null,
      touch: false,

      setPreference: (preference) =>
        set((s) => ({
          preference,
          tier: preference === 'auto' ? (s.detected ?? 'medium') : preference,
        })),

      init: () => {
        if (get().detected) return
        const touch = isTouchDevice()
        const detected = detectQualityTier()
        const preference = get().preference
        set({
          touch,
          detected,
          tier: preference === 'auto' ? detected : preference,
        })
      },
    }),
    {
      name: 'fps2_quality',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ preference: state.preference }),
    }
  )
)

/** Resolved profile for the current tier. */
export function useQualityProfile(): QualityProfile {
  const tier = useQualityStore((s) => s.tier)
  return QUALITY_PROFILES[tier] ?? QUALITY_PROFILES.medium
}

export function getQualityProfile(): QualityProfile {
  return QUALITY_PROFILES[useQualityStore.getState().tier] ?? QUALITY_PROFILES.medium
}

export const TIER_LABELS: Record<QualitySetting, string> = {
  auto: 'Auto',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
