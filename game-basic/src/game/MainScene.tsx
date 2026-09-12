import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Stars, PerspectiveCamera, Bvh } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { useGameStore, GameState } from '@/engine'
import { FPSPlayer, Weapon, Arena, ArenaLighting, EnemyManager, resetGameRefs } from '@/entities'
import { GameControls, PointerLockControls } from '@/systems'
import { GameUI, LoadingScreen, CanvasLoader } from '@/ui'
import { EffectsRenderer, DamageVignette, GamePostProcessing } from '@/effects'

const MIN_LOADING_TIME = 1000

function FPSGameScene({ playerRef }: { playerRef: React.RefObject<RapierRigidBody | null> }) {
  return (
    <Physics gravity={[0, -20, 0]} debug={false}>
      <FPSPlayer ref={playerRef} position={[0, 2, 0]} />
      <Arena />
      <EnemyManager />
    </Physics>
  )
}

function GameEnvironment() {
  return (
    <>
      <color attach="background" args={['#05010d']} />
      <Stars radius={120} depth={60} count={1500} factor={4} fade />
      <fog attach="fog" args={['#05010d', 25, 70]} />
    </>
  )
}

export function MainScene() {
  const gameState = useGameStore((s) => s.gameState)
  const [assetsReady, setAssetsReady] = useState(false)
  const playerRef = useRef<RapierRigidBody | null>(null)

  // Reset shared refs when entering play
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      resetGameRefs()
    }
  }, [gameState])

  // Minimal loading time
  useEffect(() => {
    const timer = setTimeout(() => setAssetsReady(true), MIN_LOADING_TIME)
    return () => clearTimeout(timer)
  }, [])

  const isPlaying = gameState !== GameState.MENU

  return (
    <>
      {!assetsReady && <LoadingScreen />}

      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <Bvh firstHitOnly>
          <PerspectiveCamera makeDefault position={[0, 2, 0]} fov={75} near={0.05} far={200} />

          <Suspense fallback={<CanvasLoader />}>
            <GameEnvironment />
            <ArenaLighting />
            <EffectsRenderer />
            <DamageVignette />

            {assetsReady && isPlaying && (
              <>
                <FPSGameScene playerRef={playerRef} />
                <Weapon />
              </>
            )}
          </Suspense>

          <GameControls />
          <PointerLockControls />

          {isPlaying && <GamePostProcessing />}
        </Bvh>
      </Canvas>

      <GameUI />
    </>
  )
}
