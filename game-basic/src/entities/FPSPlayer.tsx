import { useRef, useEffect, forwardRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier'
import type { RapierRigidBody } from '@react-three/rapier'
import { Ray } from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { useInputStore, useGameStore, GameState } from '@/engine'
import { playerPosition, pointerLocked, onPlayerDamage } from './gameRefs'
import { useDamageEffect } from '@/effects'
import { useGameSound } from '@/audio'

interface FPSPlayerProps {
  position?: [number, number, number]
  speed?: number
  sprintMultiplier?: number
  jumpForce?: number
}

const EYE_HEIGHT = 0.75 // camera offset above rigidbody center

export const FPSPlayer = forwardRef<RapierRigidBody | null, FPSPlayerProps>(function FPSPlayer({
  position = [0, 2, 0],
  speed = 6,
  sprintMultiplier = 1.6,
  jumpForce = 7,
}, forwardedRef) {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const { camera } = useThree()
  const { world: rapierWorld } = useRapier()

  const yaw = useRef(0)
  const pitch = useRef(0)
  const isGrounded = useRef(true)
  const wasGrounded = useRef(true)
  const footstepTimer = useRef(0)

  const forwardVec = useRef(new THREE.Vector3())
  const rightVec = useRef(new THREE.Vector3())
  const moveDir = useRef(new THREE.Vector3())

  const getMovementInput = useInputStore((state) => state.getMovementInput)
  const isActionPressed = useInputStore((state) => state.isActionPressed)
  const gameState = useGameStore((state) => state.gameState)
  const takeDamage = useGameStore((state) => state.takeDamage)
  const endGame = useGameStore((state) => state.endGame)
  const health = useGameStore((state) => state.combat.health)

  const { playJump, playLand, playFootstep } = useGameSound()
  const { triggerDamage } = useDamageEffect()

  // 暴露刚体引用
  useEffect(() => {
    if (typeof forwardedRef === 'function') {
      forwardedRef(rigidBodyRef.current)
    } else if (forwardedRef) {
      forwardedRef.current = rigidBodyRef.current
    }
  })

  // 注册受伤回调
  useEffect(() => {
    const unsubscribe = onPlayerDamage((damage) => {
      takeDamage(damage)
      triggerDamage(0.4, '#ff2a6d')
    })
    return unsubscribe
  }, [takeDamage, triggerDamage])

  // 死亡检测
  useEffect(() => {
    if (health <= 0 && gameState === GameState.PLAYING) {
      endGame()
    }
  }, [health, gameState, endGame])

  // 鼠标视角控制 (指针锁定)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!pointerLocked.current) return
      if (useGameStore.getState().gameState !== GameState.PLAYING) return

      const sens = useGameStore.getState().settings.mouseSensitivity * 0.0022
      const invertY = useGameStore.getState().settings.invertY

      yaw.current -= e.movementX * sens
      pitch.current -= e.movementY * sens * (invertY ? -1 : 1)

      const maxPitch = Math.PI / 2 - 0.05
      pitch.current = Math.max(-maxPitch, Math.min(maxPitch, pitch.current))
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useFrame((_state, delta) => {
    if (!rigidBodyRef.current) return

    const rb = rigidBodyRef.current

    // 即使非游戏状态也同步相机到刚体位置（保持视角）
    const pos = rb.translation()
    playerPosition.set(pos.x, pos.y + 0.4, pos.z)
    camera.position.set(pos.x, pos.y + EYE_HEIGHT, pos.z)
    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw.current
    camera.rotation.x = pitch.current

    if (gameState !== GameState.PLAYING) return

    const movement = getMovementInput()
    const isSprinting = isActionPressed('sprint')
    const currentSpeed = isSprinting ? speed * sprintMultiplier : speed

    // 相机方向计算移动
    camera.getWorldDirection(forwardVec.current)
    forwardVec.current.y = 0
    forwardVec.current.normalize()
    rightVec.current.crossVectors(forwardVec.current, camera.up).normalize()

    moveDir.current.set(0, 0, 0)
    moveDir.current.addScaledVector(rightVec.current, movement.x)
    moveDir.current.addScaledVector(forwardVec.current, movement.y)
    if (moveDir.current.lengthSq() > 0) moveDir.current.normalize()

    const velocity = rb.linvel()
    const targetVX = moveDir.current.x * currentSpeed
    const targetVZ = moveDir.current.z * currentSpeed

    const lerpFactor = 1 - Math.exp(-12 * delta)
    const moveX = velocity.x + (targetVX - velocity.x) * lerpFactor
    const moveZ = velocity.z + (targetVZ - velocity.z) * lerpFactor

    // 跳跃
    if (isActionPressed('jump') && isGrounded.current) {
      rb.setLinvel({ x: moveX, y: jumpForce, z: moveZ }, true)
      isGrounded.current = false
      playJump()
    } else {
      rb.setLinvel({ x: moveX, y: velocity.y, z: moveZ }, true)
    }

    // 地面检测
    const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
    const ray = new Ray(rayOrigin, { x: 0, y: -1, z: 0 })
    const hit = rapierWorld.castRay(ray, 0.95, true, undefined, undefined, undefined, rb)

    wasGrounded.current = isGrounded.current
    isGrounded.current = hit !== null

    if (!wasGrounded.current && isGrounded.current) {
      playLand()
    }

    // 脚步声
    if (isGrounded.current && moveDir.current.lengthSq() > 0.1) {
      footstepTimer.current += delta
      const interval = isSprinting ? 0.3 : 0.45
      if (footstepTimer.current >= interval) {
        footstepTimer.current = 0
        playFootstep()
      }
    } else {
      footstepTimer.current = 0
    }
  })

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={position}
      enabledRotations={[false, false, false]}
      linearDamping={0.5}
      mass={1}
      type="dynamic"
      colliders={false}
    >
      <CapsuleCollider args={[0.5, 0.35]} />
    </RigidBody>
  )
})
