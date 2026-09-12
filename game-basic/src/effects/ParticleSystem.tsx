// 粒子特效系统 / Particle effects
//
// Rewritten as a single pooled `THREE.Points`. The old version spawned a React
// component per effect, and each one built its own ShaderMaterial — meaning
// every muzzle impact compiled a fresh GLSL program. On mobile that alone cost
// tens of milliseconds per shot. Now there is one geometry, one material, one
// draw call and zero allocations after startup.

import { useMemo, useRef, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { create } from 'zustand'
import { useQualityProfile } from '@/engine/quality'

// ============ 特效类型定义 ============

export type EffectType = 'collect' | 'dust' | 'impact' | 'sparkle' | 'trail'

interface ParticleConfig {
  count: number
  size: number
  color: string | string[]
  lifetime: number
  speed: number
  spread: number
  gravity: number
  fadeOut: boolean
}

// 预设配置
const effectPresets: Record<EffectType, ParticleConfig> = {
  collect: {
    count: 20, size: 0.15, color: ['#ffff00', '#ffd700', '#ffaa00', '#ffffff'],
    lifetime: 0.8, speed: 4, spread: 1.5, gravity: -2, fadeOut: true,
  },
  dust: {
    count: 12, size: 0.1, color: ['#8b7355', '#a0926a', '#c4b99a'],
    lifetime: 0.6, speed: 2, spread: 0.8, gravity: 1, fadeOut: true,
  },
  impact: {
    count: 15, size: 0.12, color: ['#ff4444', '#ff6666', '#ffffff'],
    lifetime: 0.5, speed: 5, spread: 2, gravity: 3, fadeOut: true,
  },
  sparkle: {
    count: 8, size: 0.08, color: ['#00ffff', '#ff00ff', '#ffffff'],
    lifetime: 1.2, speed: 1, spread: 0.5, gravity: -0.5, fadeOut: true,
  },
  trail: {
    count: 5, size: 0.06, color: ['#00ffff', '#0088ff'],
    lifetime: 0.4, speed: 0.5, spread: 0.2, gravity: 0, fadeOut: true,
  },
}

// ============ 粒子池 / Particle pool ============

const VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uPixelRatio;

  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uPixelRatio * (300.0 / max(0.001, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = (1.0 - smoothstep(0.3, 0.5, dist)) * vAlpha;
    if (alpha <= 0.004) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

class ParticlePool {
  readonly budget: number
  readonly geometry: THREE.BufferGeometry
  readonly material: THREE.ShaderMaterial

  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly sizes: Float32Array
  private readonly alphas: Float32Array
  private readonly velocities: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly gravity: Float32Array
  private cursor = 0

  constructor(budget: number, pixelRatio: number) {
    this.budget = budget

    this.positions = new Float32Array(budget * 3)
    this.colors = new Float32Array(budget * 3)
    this.sizes = new Float32Array(budget)
    this.alphas = new Float32Array(budget)
    this.velocities = new Float32Array(budget * 3)
    this.life = new Float32Array(budget)
    this.maxLife = new Float32Array(budget)
    this.gravity = new Float32Array(budget)

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1))
    // Particles live in world space and are spread across the whole arena.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200)

    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: pixelRatio } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    })
  }

  /** Emit `count` particles at a world position. Oldest particles are recycled. */
  burst(
    origin: [number, number, number],
    config: ParticleConfig,
    countScale: number
  ): void {
    const count = Math.max(1, Math.round(config.count * countScale))
    const palette = Array.isArray(config.color) ? config.color : [config.color]
    const tmp = new THREE.Color()

    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.budget
      const i3 = i * 3

      this.positions[i3] = origin[0] + (Math.random() - 0.5) * 0.2
      this.positions[i3 + 1] = origin[1] + (Math.random() - 0.5) * 0.2
      this.positions[i3 + 2] = origin[2] + (Math.random() - 0.5) * 0.2

      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const speed = config.speed * (0.5 + Math.random() * 0.5)
      this.velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed * config.spread
      this.velocities[i3 + 1] = Math.cos(phi) * speed + Math.random() * speed * 0.5
      this.velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * config.spread

      tmp.set(palette[(Math.random() * palette.length) | 0])
      this.colors[i3] = tmp.r
      this.colors[i3 + 1] = tmp.g
      this.colors[i3 + 2] = tmp.b

      this.sizes[i] = config.size * (0.5 + Math.random() * 0.5)
      this.alphas[i] = 1
      this.maxLife[i] = config.lifetime
      this.life[i] = config.lifetime
      this.gravity[i] = config.gravity
    }

    this.geometry.getAttribute('position').needsUpdate = true
    this.geometry.getAttribute('color').needsUpdate = true
    this.geometry.getAttribute('size').needsUpdate = true
    this.geometry.getAttribute('alpha').needsUpdate = true
  }

  update(delta: number): void {
    // Clamp so a hitch (or a backgrounded tab) doesn't fling particles away.
    const dt = Math.min(delta, 0.05)
    let alive = false

    for (let i = 0; i < this.budget; i++) {
      if (this.life[i] <= 0) continue
      alive = true

      this.life[i] -= dt
      if (this.life[i] <= 0) {
        this.sizes[i] = 0
        this.alphas[i] = 0
        continue
      }

      const i3 = i * 3
      this.velocities[i3 + 1] -= this.gravity[i] * dt
      this.positions[i3] += this.velocities[i3] * dt
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt
      this.alphas[i] = this.life[i] / this.maxLife[i]
    }

    if (alive) {
      this.geometry.getAttribute('position').needsUpdate = true
      this.geometry.getAttribute('size').needsUpdate = true
      this.geometry.getAttribute('alpha').needsUpdate = true
    }
  }

  clear(): void {
    this.life.fill(0)
    this.sizes.fill(0)
    this.alphas.fill(0)
    this.geometry.getAttribute('size').needsUpdate = true
    this.geometry.getAttribute('alpha').needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

let pool: ParticlePool | null = null

function getPool(budget: number): ParticlePool {
  const pixelRatio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)
  if (!pool || pool.budget !== budget) {
    pool?.dispose()
    pool = new ParticlePool(budget, pixelRatio)
  }
  return pool
}

/** How many particles a single effect should emit, scaled by quality tier. */
function countScaleFor(budget: number): number {
  if (budget <= 64) return 0.4
  if (budget <= 140) return 0.7
  return 1
}

// ============ 特效 Store ============

interface EffectsState {
  spawnEffect: (
    type: EffectType,
    position: [number, number, number],
    customConfig?: Partial<ParticleConfig>
  ) => void
  removeEffect: (id: string) => void
  clearEffects: () => void
}

export const useEffectsStore = create<EffectsState>(() => ({
  spawnEffect: (type, position, customConfig) => {
    if (!pool) return
    const config = { ...effectPresets[type], ...customConfig }
    pool.burst(position, config, countScaleFor(pool.budget))
  },

  // Ids are no longer tracked — the pool recycles slots by itself. Kept so
  // existing call sites keep working.
  removeEffect: () => {},

  clearEffects: () => {
    pool?.clear()
  },
}))

// ============ 特效渲染器 ============

export function EffectsRenderer() {
  const profile = useQualityProfile()
  const pointsRef = useRef<THREE.Points>(null)
  const budget = profile.particleBudget

  // Built (and shader-compiled) exactly once per quality tier.
  const activePool = useMemo(() => getPool(budget), [budget])

  useFrame((_, delta) => {
    activePool.update(delta)
  })

  return (
    <points
      ref={pointsRef}
      geometry={activePool.geometry}
      material={activePool.material}
      frustumCulled={false}
    />
  )
}

// ============ 便捷 Hooks ============

export function useEffects() {
  const spawnEffect = useEffectsStore((s) => s.spawnEffect)

  const spawnCollectEffect = useCallback(
    (position: [number, number, number]) => spawnEffect('collect', position),
    [spawnEffect]
  )
  const spawnDustEffect = useCallback(
    (position: [number, number, number]) => spawnEffect('dust', position),
    [spawnEffect]
  )
  const spawnImpactEffect = useCallback(
    (position: [number, number, number]) => spawnEffect('impact', position),
    [spawnEffect]
  )
  const spawnSparkleEffect = useCallback(
    (position: [number, number, number]) => spawnEffect('sparkle', position),
    [spawnEffect]
  )

  return {
    spawnEffect,
    spawnCollectEffect,
    spawnDustEffect,
    spawnImpactEffect,
    spawnSparkleEffect,
  }
}
