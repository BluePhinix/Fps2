// 移动端触屏控制 / On-screen touch controls
//
// A DOM overlay (not part of the R3F tree). Left half is an analogue movement
// stick, right half is a look-drag surface, plus FIRE / JUMP / RELOAD / SPRINT
// and a pause button since phones have no ESC key.
//
// All state goes straight into the `touchInput` plain object — never through
// React state — so dragging never triggers a render. Only the visual position
// of the stick knob is React state.

import { useRef, useState, useEffect } from 'react'
import { touchInput, resetTouchInput } from '@/engine'
import { useGameStore, GameState } from '@/engine'
import { useQualityStore } from '@/engine/quality'
import { Crosshair, Target, MoveUp, Zap, RotateCcw, Pause } from 'lucide-react'

const STICK_RADIUS = 56
const DEAD_ZONE = 0.12

type Point = { x: number; y: number }

export function TouchControls() {
  const isTouch = useQualityStore((s) => s.touch)
  const gameState = useGameStore((s) => s.gameState)
  const pause = useGameStore((s) => s.pause)

  const [stickOrigin, setStickOrigin] = useState<Point | null>(null)
  const [knob, setKnob] = useState<Point>({ x: 0, y: 0 })

  const movePointer = useRef<number | null>(null)
  const moveOrigin = useRef<Point>({ x: 0, y: 0 })
  const lookPointer = useRef<number | null>(null)
  const lookLast = useRef<Point>({ x: 0, y: 0 })

  // Never leave a key stuck down if the component unmounts mid-touch.
  useEffect(() => {
    return () => resetTouchInput()
  }, [])

  useEffect(() => {
    if (gameState !== GameState.PLAYING) resetTouchInput()
  }, [gameState])

  if (!isTouch || gameState !== GameState.PLAYING) return null

  // ---- Movement stick -----------------------------------------------------
  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (movePointer.current !== null) return
    e.preventDefault()
    movePointer.current = e.pointerId
    moveOrigin.current = { x: e.clientX, y: e.clientY }
    setStickOrigin({ x: e.clientX, y: e.clientY })
    setKnob({ x: 0, y: 0 })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (movePointer.current !== e.pointerId) return
    let dx = e.clientX - moveOrigin.current.x
    let dy = e.clientY - moveOrigin.current.y
    const dist = Math.hypot(dx, dy)
    if (dist > STICK_RADIUS) {
      const k = STICK_RADIUS / dist
      dx *= k
      dy *= k
    }
    setKnob({ x: dx, y: dy })

    let nx = dx / STICK_RADIUS
    let ny = dy / STICK_RADIUS
    if (Math.hypot(nx, ny) < DEAD_ZONE) {
      nx = 0
      ny = 0
    }
    touchInput.moveX = nx
    touchInput.moveY = -ny // screen-down is backwards
  }

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (movePointer.current !== e.pointerId) return
    movePointer.current = null
    setStickOrigin(null)
    setKnob({ x: 0, y: 0 })
    touchInput.moveX = 0
    touchInput.moveY = 0
  }

  // ---- Look drag ----------------------------------------------------------
  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointer.current !== null) return
    e.preventDefault()
    lookPointer.current = e.pointerId
    lookLast.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointer.current !== e.pointerId) return
    touchInput.lookX += e.clientX - lookLast.current.x
    touchInput.lookY += e.clientY - lookLast.current.y
    lookLast.current = { x: e.clientX, y: e.clientY }
  }

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointer.current !== e.pointerId) return
    lookPointer.current = null
  }

  // ---- Buttons ------------------------------------------------------------
  const btnDown = (apply: () => void) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    apply()
  }
  const btnUp = (apply: () => void) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    apply()
  }

  const baseBtn =
    'touch-btn absolute flex items-center justify-center rounded-full border font-cyber tracking-wider active:scale-95 transition-transform select-none'

  return (
    <div className="touch-overlay">
      {/* Movement zone (left half) */}
      <div
        className="touch-zone"
        style={{ left: 0, right: '50%' }}
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickUp}
        onPointerCancel={handleStickUp}
      >
        {stickOrigin && (
          <>
            <div
              className="touch-stick-base"
              style={{ left: stickOrigin.x, top: stickOrigin.y }}
            />
            <div
              className="touch-stick-knob"
              style={{ left: stickOrigin.x + knob.x, top: stickOrigin.y + knob.y }}
            />
          </>
        )}
      </div>

      {/* Look zone (right half) */}
      <div
        className="touch-zone"
        style={{ left: '50%', right: 0 }}
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
      />

      {/* Pause — phones have no ESC key */}
      <button
        className={`${baseBtn} touch-btn-pause`}
        onPointerDown={btnDown(() => pause())}
        aria-label="Pause"
      >
        <Pause className="w-4 h-4" />
      </button>

      {/* Fire */}
      <button
        className={`${baseBtn} touch-btn-fire`}
        onPointerDown={btnDown(() => { touchInput.fire = true })}
        onPointerUp={btnUp(() => { touchInput.fire = false })}
        onPointerCancel={btnUp(() => { touchInput.fire = false })}
        onPointerLeave={btnUp(() => { touchInput.fire = false })}
        aria-label="Fire"
      >
        <Crosshair className="w-8 h-8" />
      </button>

      {/* Jump */}
      <button
        className={`${baseBtn} touch-btn-jump`}
        onPointerDown={btnDown(() => { touchInput.jump = true })}
        onPointerUp={btnUp(() => { touchInput.jump = false })}
        onPointerCancel={btnUp(() => { touchInput.jump = false })}
        onPointerLeave={btnUp(() => { touchInput.jump = false })}
        aria-label="Jump"
      >
        <MoveUp className="w-5 h-5" />
      </button>

      {/* Reload */}
      <button
        className={`${baseBtn} touch-btn-reload`}
        onPointerDown={btnDown(() => { touchInput.reloadRequested = true })}
        aria-label="Reload"
      >
        <RotateCcw className="w-5 h-5" />
      </button>

      {/* Sprint */}
      <button
        className={`${baseBtn} touch-btn-sprint`}
        onPointerDown={btnDown(() => { touchInput.sprint = true })}
        onPointerUp={btnUp(() => { touchInput.sprint = false })}
        onPointerCancel={btnUp(() => { touchInput.sprint = false })}
        onPointerLeave={btnUp(() => { touchInput.sprint = false })}
        aria-label="Sprint"
      >
        <Zap className="w-5 h-5" />
      </button>

      <div className="touch-hint">
        <Target className="w-3 h-3" /> drag right side to aim
      </div>
    </div>
  )
}
