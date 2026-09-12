// 后处理特效
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
  Glitch,
} from '@react-three/postprocessing'
import { BlendFunction, GlitchMode } from 'postprocessing'
import * as THREE from 'three'
import { create } from 'zustand'
import { useQualityProfile } from '@/engine/quality'

// ============ 后处理状态 Store ============

interface PostProcessingState {
  // 泛光
  bloomEnabled: boolean
  bloomIntensity: number
  bloomThreshold: number
  bloomSmoothing: number
  
  // 色差
  chromaticEnabled: boolean
  chromaticOffset: [number, number]
  
  // 晕影
  vignetteEnabled: boolean
  vignetteOffset: number
  vignetteDarkness: number
  
  // 噪点
  noiseEnabled: boolean
  noiseOpacity: number
  
  // 故障
  glitchEnabled: boolean
  glitchActive: boolean
  
  // Actions
  setBloom: (config: Partial<Pick<PostProcessingState, 'bloomEnabled' | 'bloomIntensity' | 'bloomThreshold' | 'bloomSmoothing'>>) => void
  setChromatic: (config: Partial<Pick<PostProcessingState, 'chromaticEnabled' | 'chromaticOffset'>>) => void
  setVignette: (config: Partial<Pick<PostProcessingState, 'vignetteEnabled' | 'vignetteOffset' | 'vignetteDarkness'>>) => void
  setNoise: (config: Partial<Pick<PostProcessingState, 'noiseEnabled' | 'noiseOpacity'>>) => void
  triggerGlitch: (duration?: number) => void
}

export const usePostProcessingStore = create<PostProcessingState>((set) => ({
  // 默认值
  bloomEnabled: true,
  bloomIntensity: 0.5,
  bloomThreshold: 0.8,
  bloomSmoothing: 0.3,
  
  chromaticEnabled: false,
  chromaticOffset: [0.002, 0.002],
  
  vignetteEnabled: true,
  vignetteOffset: 0.3,
  vignetteDarkness: 0.5,
  
  noiseEnabled: false,
  noiseOpacity: 0.02,
  
  glitchEnabled: true,
  glitchActive: false,
  
  setBloom: (config) => set(state => ({ ...state, ...config })),
  setChromatic: (config) => set(state => ({ ...state, ...config })),
  setVignette: (config) => set(state => ({ ...state, ...config })),
  setNoise: (config) => set(state => ({ ...state, ...config })),
  
  triggerGlitch: (duration = 0.3) => {
    set({ glitchActive: true })
    setTimeout(() => {
      set({ glitchActive: false })
    }, duration * 1000)
  },
}))

// ============ 后处理效果组件 ============

interface GamePostProcessingProps {
  // 可通过 props 覆盖默认配置
  bloomIntensity?: number
  enableChromatic?: boolean
  enableNoise?: boolean
}

export function GamePostProcessing({
  bloomIntensity: propBloomIntensity,
  enableChromatic: propEnableChromatic,
  enableNoise: propEnableNoise,
}: GamePostProcessingProps = {}) {
  // Post processing is the single most expensive thing on a tile-based mobile
  // GPU (several extra full-screen passes at native resolution), so the whole
  // chain is skipped below the high tier.
  const profile = useQualityProfile()

  const {
    bloomEnabled,
    bloomIntensity,
    bloomThreshold,
    bloomSmoothing,
    chromaticEnabled,
    chromaticOffset,
    vignetteEnabled,
    vignetteOffset,
    vignetteDarkness,
    noiseEnabled,
    noiseOpacity,
    glitchEnabled,
    glitchActive,
  } = usePostProcessingStore()
  
  if (!profile.postProcessing) return null

  const finalBloomIntensity = propBloomIntensity ?? bloomIntensity
  const finalChromaticEnabled = propEnableChromatic ?? chromaticEnabled
  const finalNoiseEnabled = propEnableNoise ?? noiseEnabled
  
  // 收集启用的效果
  const effects = []
  
  if (bloomEnabled) {
    effects.push(
      <Bloom
        key="bloom"
        intensity={finalBloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={bloomSmoothing}
        mipmapBlur
      />
    )
  }
  
  if (finalChromaticEnabled) {
    effects.push(
      <ChromaticAberration
        key="chromatic"
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(...chromaticOffset)}
        radialModulation={false}
        modulationOffset={0}
      />
    )
  }
  
  if (vignetteEnabled) {
    effects.push(
      <Vignette
        key="vignette"
        offset={vignetteOffset}
        darkness={vignetteDarkness}
        blendFunction={BlendFunction.NORMAL}
      />
    )
  }
  
  if (finalNoiseEnabled) {
    effects.push(
      <Noise
        key="noise"
        opacity={noiseOpacity}
        blendFunction={BlendFunction.OVERLAY}
      />
    )
  }
  
  if (glitchEnabled && glitchActive) {
    effects.push(
      <Glitch
        key="glitch"
        delay={new THREE.Vector2(0, 0)}
        duration={new THREE.Vector2(0.1, 0.3)}
        strength={new THREE.Vector2(0.2, 0.4)}
        mode={GlitchMode.SPORADIC}
        active
        ratio={0.85}
      />
    )
  }
  
  // 如果没有启用任何效果，返回空的 EffectComposer
  if (effects.length === 0) {
    return null
  }
  
  return (
    // `multisampling` defaults to 8x MSAA on the composer's render target —
    // brutal for mobile fill rate. 0 keeps a single sample.
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  )
}

// ============ 便捷 Hooks ============

export function usePostProcessing() {
  const store = usePostProcessingStore()
  
  return {
    setBloom: store.setBloom,
    setChromatic: store.setChromatic,
    setVignette: store.setVignette,
    setNoise: store.setNoise,
    triggerGlitch: store.triggerGlitch,
  }
}
