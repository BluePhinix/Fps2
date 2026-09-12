import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useInputStore, useGameStore, GameState } from '@/engine'
import { pointerLocked } from '@/entities/gameRefs'
import { usePointerLockUI } from '@/entities/pointerLockUI'
import { defaultSystems } from './GameSystems'

// 键盘输入控制器 (Escape 由 PointerLockControls 统一处理)
export function KeyboardControls() {
  const setKeyDown = useInputStore((state) => state.setKeyDown)
  const setKeyUp = useInputStore((state) => state.setKeyUp)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 阻止空格滚动页面
      if (e.code === 'Space') e.preventDefault()
      setKeyDown(e.code)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeyUp(e.code)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setKeyDown, setKeyUp])

  return null
}

// 鼠标输入控制器
export function MouseControls() {
  const setMousePosition = useInputStore((state) => state.setMousePosition)
  const setMouseDelta = useInputStore((state) => state.setMouseDelta)
  const setMouseButton = useInputStore((state) => state.setMouseButton)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition(e.clientX, e.clientY)
      setMouseDelta(e.movementX, e.movementY)
    }
    const handleMouseDown = (e: MouseEvent) => setMouseButton(e.button, true)
    const handleMouseUp = (e: MouseEvent) => setMouseButton(e.button, false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [setMousePosition, setMouseDelta, setMouseButton])

  return null
}

// 游戏手柄控制器
export function GamepadControls() {
  const setGamepadState = useInputStore((state) => state.setGamepadState)
  const setGamepadConnected = useInputStore((state) => state.setGamepadConnected)

  useEffect(() => {
    const onConnect = () => setGamepadConnected(true)
    const onDisconnect = () => setGamepadConnected(false)
    window.addEventListener('gamepadconnected', onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    return () => {
      window.removeEventListener('gamepadconnected', onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [setGamepadConnected])

  useFrame(() => {
    const gamepads = navigator.getGamepads()
    const gp = gamepads[0]
    if (gp) {
      setGamepadState([...gp.axes], gp.buttons.map((b) => b.pressed))
    }
  })

  return null
}

// ECS 系统更新器
export function SystemsUpdater() {
  const isPaused = useGameStore((state) => state.isPaused)
  const setTime = useGameStore((state) => state.setTime)

  useFrame((state, delta) => {
    setTime(delta, state.clock.elapsedTime)
    if (!isPaused) {
      defaultSystems.update(delta)
    }
  })

  return null
}

/**
 * Pointer Lock 控制器 — 请求指针锁定并处理锁定丢失时的暂停。
 * 鼠标视角由 FPSPlayer 组件直接处理 (mousemove → yaw/pitch)。
 */
export function PointerLockControls() {
  const { gl } = useThree()
  const pause = useGameStore((s) => s.pause)
  const gameState = useGameStore((s) => s.gameState)

  // 进入游戏时自动请求指针锁定（借助开始/继续按钮的点击手势）
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return
    const canvas = gl.domElement
    if (document.pointerLockElement === canvas) return
    try {
      const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined
      if (result && typeof result.catch === 'function') result.catch(() => {})
    } catch {
      /* 浏览器可能拒绝 — 玩家点击画面即可再次请求 */
    }
  }, [gameState, gl])

  useEffect(() => {
    const canvas = gl.domElement

    const handleCanvasClick = () => {
      const gs = useGameStore.getState()
      if (gs.gameState === GameState.PLAYING && !pointerLocked.current) {
        canvas.requestPointerLock()
      }
    }

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === canvas
      pointerLocked.current = locked
      usePointerLockUI.getState().setLocked(locked)

      // 锁定丢失时，如果仍在游戏中 → 暂停
      if (!locked && useGameStore.getState().gameState === GameState.PLAYING) {
        pause()
      }
    }

    canvas.addEventListener('click', handleCanvasClick)
    document.addEventListener('pointerlockchange', handlePointerLockChange)

    return () => {
      canvas.removeEventListener('click', handleCanvasClick)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
    }
  }, [gl, pause])

  return null
}

// 所有控制器组合
export function GameControls() {
  return (
    <>
      <KeyboardControls />
      <MouseControls />
      <GamepadControls />
      <SystemsUpdater />
    </>
  )
}
