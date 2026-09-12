// 运行时分辨率缩放 / Runtime resolution scaling
//
// Static quality settings (shadows, light count, post processing) can't safely
// change mid-session because toggling them forces shader recompiles. Pixel
// ratio can, though — and on a fill-rate-bound mobile GPU it's the one dial
// that actually matters. This watches real frame rate and slides resolution
// between the tier's min and max.

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useQualityProfile } from './quality'

export function AdaptiveDpr() {
  const profile = useQualityProfile()
  const setDpr = useThree((s) => s.setDpr)
  const currentDpr = useRef(profile.dpr[1])
  const frames = useRef(0)
  const elapsed = useRef(0)
  const lastChange = useRef(0)

  useFrame((_, delta) => {
    frames.current += 1
    elapsed.current += delta
    lastChange.current += delta

    // Sample roughly once a second.
    if (elapsed.current < 1) return

    const fps = frames.current / elapsed.current
    frames.current = 0
    elapsed.current = 0
    // Give the renderer time to settle after a change before reacting again.
    if (lastChange.current < 1.5) return

    const [min, max] = profile.dpr
    const target = profile.targetFps
    let next = currentDpr.current

    if (fps < target * 0.8) {
      next = Math.max(min, currentDpr.current - 0.2)
    } else if (fps > target * 1.02) {
      next = Math.min(max, currentDpr.current + 0.1)
    }

    if (Math.abs(next - currentDpr.current) > 0.01) {
      currentDpr.current = next
      lastChange.current = 0
      setDpr(next)
    }
  })

  return null
}
