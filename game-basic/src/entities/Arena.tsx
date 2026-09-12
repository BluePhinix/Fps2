import { useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'

// 程序化地面纹理 - 赛博朋克网格
function useArenaFloorTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#0a0a1a'
    ctx.fillRect(0, 0, 512, 512)

    ctx.strokeStyle = '#05d9e8'
    ctx.lineWidth = 2
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke()
    }

    ctx.strokeStyle = '#ff2a6d22'
    ctx.lineWidth = 1
    for (let i = 32; i < 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke()
    }

    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 40)
      grad.addColorStop(0, '#ff2a6d33')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.fillRect(x - 40, y - 40, 80, 80)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(8, 8)
    return texture
  }, [])
}

// 墙壁纹理
function useArenaWallTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#0d0221'
    ctx.fillRect(0, 0, 256, 256)

    ctx.strokeStyle = '#ff2a6d'
    ctx.lineWidth = 3
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke()
    }

    ctx.strokeStyle = '#05d9e844'
    ctx.lineWidth = 1
    for (let i = 16; i < 256; i += 32) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke()
    }

    ctx.fillStyle = '#9d4edd'
    ctx.fillRect(120, 0, 16, 256)

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    return texture
  }, [])
}

// 箱子纹理
function useCrateTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!

    ctx.fillStyle = '#1a1a3a'
    ctx.fillRect(0, 0, 128, 128)

    ctx.strokeStyle = '#9d4edd'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, 124, 124)

    ctx.strokeStyle = '#9d4edd66'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(10, 10); ctx.lineTo(118, 118)
    ctx.moveTo(118, 10); ctx.lineTo(10, 118)
    ctx.stroke()

    ctx.fillStyle = '#ff2a6d'
    ctx.fillRect(0, 0, 20, 4); ctx.fillRect(0, 0, 4, 20)
    ctx.fillRect(108, 0, 20, 4); ctx.fillRect(124, 0, 4, 20)
    ctx.fillRect(0, 124, 20, 4); ctx.fillRect(0, 108, 4, 20)
    ctx.fillRect(108, 124, 20, 4); ctx.fillRect(124, 108, 4, 20)

    return new THREE.CanvasTexture(canvas)
  }, [])
}

export function ArenaFloor() {
  const texture = useArenaFloorTexture()
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[30, 0.5, 30]} position={[0, -0.5, 0]} />
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          map={texture}
          emissive="#05d9e8"
          emissiveIntensity={0.12}
          metalness={0.5}
          roughness={0.6}
        />
      </mesh>
    </RigidBody>
  )
}

interface WallProps {
  position: [number, number, number]
  size: [number, number, number]
  rotation?: [number, number, number]
}

export function ArenaWall({ position, size, rotation = [0, 0, 0] }: WallProps) {
  const texture = useArenaWallTexture()
  return (
    <RigidBody type="fixed" position={position} rotation={rotation} colliders="cuboid">
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          map={texture}
          emissive="#ff2a6d"
          emissiveIntensity={0.08}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
    </RigidBody>
  )
}

interface CrateProps {
  position: [number, number, number]
  size?: [number, number, number]
  rotation?: [number, number, number]
}

export function Crate({ position, size = [2, 2, 2], rotation = [0, 0, 0] }: CrateProps) {
  const texture = useCrateTexture()
  return (
    <RigidBody type="fixed" position={position} rotation={rotation} colliders="cuboid">
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          map={texture}
          emissive="#9d4edd"
          emissiveIntensity={0.12}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
    </RigidBody>
  )
}

// 竞技场灯光
export function ArenaLighting() {
  return (
    <>
      <ambientLight intensity={0.35} color="#1a1a4e" />
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={100}
        color="#aaccff"
      />
      <hemisphereLight args={['#05d9e8', '#0d0221', 0.3]} />
      <pointLight position={[-20, 6, -20]} intensity={2} distance={25} color="#ff2a6d" />
      <pointLight position={[20, 6, 20]} intensity={2} distance={25} color="#05d9e8" />
      <pointLight position={[0, 10, 0]} intensity={1.5} distance={30} color="#9d4edd" />
    </>
  )
}

// 完整竞技场
export function Arena() {
  return (
    <>
      <ArenaFloor />
      {/* 周边墙壁 */}
      <ArenaWall position={[0, 3, -30]} size={[60, 6, 0.5]} />
      <ArenaWall position={[0, 3, 30]} size={[60, 6, 0.5]} />
      <ArenaWall position={[-30, 3, 0]} size={[0.5, 6, 60]} />
      <ArenaWall position={[30, 3, 0]} size={[0.5, 6, 60]} />
      {/* 掩体箱子 */}
      <Crate position={[8, 1, 8]} size={[3, 2, 3]} />
      <Crate position={[-8, 1, -8]} size={[3, 2, 3]} />
      <Crate position={[12, 1.5, -10]} size={[2, 3, 2]} rotation={[0, 0.5, 0]} />
      <Crate position={[-12, 1.5, 10]} size={[2, 3, 2]} rotation={[0, -0.5, 0]} />
      <Crate position={[0, 1, 15]} size={[4, 2, 2]} />
      <Crate position={[0, 1, -15]} size={[4, 2, 2]} />
      <Crate position={[15, 1, 0]} size={[2, 2, 4]} />
      <Crate position={[-15, 1, 0]} size={[2, 2, 4]} />
      <Crate position={[5, 0.75, -5]} size={[1.5, 1.5, 1.5]} rotation={[0, 0.3, 0]} />
      <Crate position={[-5, 0.75, 5]} size={[1.5, 1.5, 1.5]} rotation={[0, -0.3, 0]} />
    </>
  )
}
