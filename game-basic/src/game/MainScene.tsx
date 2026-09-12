import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars, PerspectiveCamera, Bvh } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { useGameStore, GameState } from '@/engine'
import { useQualityProfile, useQualityStore } from '@/engine/quality'
import { AdaptiveDpr } from '@/engine/AdaptiveDpr'
import { FPSPlayer, Weapon, Arena, ArenaLighting, EnemyManager, resetGameRefs } from '@/entities'
import { isTouchMode } from '@/entities/gameRefs'
import { GameControls, PointerLockControls } from '@/systems'
import { TouchControls } from '@/systems/TouchControls'
import { GameUI, LoadingScreen, CanvasLoader } from '@/ui'
import { CanvasErrorBoundary, WebGLUnsupported, isWebGLAvailable } from '@/ui/WebGLFallback'
import { EffectsRenderer, DamageVignette, GamePostProcessing } from '@/effects'

const MIN_LOADING_TIME = 1000

function FPSGameScene({ playerRef, physicsStep }: { playerRef: React.RefObject<RapierRigidBody | null>; physicsStep: number }) {
  return (
    // A 30Hz physics step on weak hardware halves the WASM solve cost without
    // any visible difference for this kind of movement.
    <Physics gravity={[0, -20, 0]} debug={false} timeStep={physicsStep}>
      <FPSPlayer ref={playerRef} position={[0, 2, 0]} />
      <Arena />
      <EnemyManager />
    </Physics>
  )
}

function GameEnvironment({ starCount }: { starCount: number }) {
  return (
    <>
      <color attach="background" args={['#05010d']} />
      <Stars radius={120} depth={60} count={starCount} factor={4} fade />
      <fog attach="fog" args={['#05010d', 25, 70]} />
    </>
  )
}

export function MainScene() {
  const gameState = useGameStore((s) => s.gameState)
  const [assetsReady, setAssetsReady] = useState(false)
  const playerRef = useRef<RapierRigidBody | null>(null)

  const profile = useQualityProfile()
  const tier = useQualityStore((s) => s.tier)
  const touch = useQualityStore((s) => s.touch)

  // Touch devices have no pointer lock — tell the rest of the game to stop
  // waiting for it (shooting and the crosshair are gated on "is aiming").
  useEffect(() => {
    isTouchMode.current = touch
  }, [touch])

  // Reset shared refs when entering play
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      resetGameRefs()
      isTouchMode.current = touch
    }
  }, [gameState, touch])

  // Minimal loading time
  useEffect(() => {
    const timer = setTimeout(() => setAssetsReady(true), MIN_LOADING_TIME)
    return () => clearTimeout(timer)
  }, [])

  const isPlaying = gameState !== GameState.MENU

  // No WebGL at all — don't even try to mount the renderer.
  if (!isWebGLAvailable()) return <WebGLUnsupported />

  return (
    <>
      {!assetsReady && <LoadingScreen />}

      <CanvasErrorBoundary>
      {/* Keyed by tier: switching quality remounts the renderer so shader-level
          settings (shadows, MSAA) are applied cleanly instead of half-applied. */}
      <Canvas
        key={tier}
        shadows={profile.shadows}
        dpr={profile.dpr}
        gl={{
          antialias: profile.antialias,
          powerPreference: 'high-performance',
          // Keeps the backbuffer after compositing — cheaper on mobile, and we
          // never rely on reading the previous frame.
          preserveDrawingBuffer: false,
          stencil: false,
          depth: true,
          alpha: false,
        }}
        camera={{ position: [0, 2, 0], fov: 75, near: 0.05, far: 200 }}
      >
        <Bvh firstHitOnly>
          <PerspectiveCamera makeDefault position={[0, 2, 0]} fov={75} near={0.05} far={200} />

          <Suspense fallback={<CanvasLoader />}>
            <GameEnvironment starCount={profile.starCount} />
            <ArenaLighting />
            <EffectsRenderer />
            <DamageVignette />

            {assetsReady && isPlaying && (
              <>
                <FPSGameScene playerRef={playerRef} physicsStep={profile.physicsTimeStep} />
                <Weapon />
              </>
            )}
          </Suspense>

          <GameControls />

          {/* Pointer lock is desktop-only; on touch it would just fail and
              immediately pause the game. */}
          {!touch && <PointerLockControls />}

          {isPlaying && <GamePostProcessing />}

          {/* Scales resolution to hold a playable frame rate. */}
          <AdaptiveDpr />
        </Bvh>
      </Canvas>
      </CanvasErrorBoundary>

      {touch && <TouchControls />}
      <GameUI />
    </>
  )
}
