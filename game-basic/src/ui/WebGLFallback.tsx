// WebGL 支持检测与降级提示
//
// A missing or unavailable WebGL context used to throw inside <Canvas> and
// leave a completely blank page with no explanation — which is exactly what a
// user sees on an old phone or a browser with hardware acceleration disabled.

import { Component, type ReactNode } from 'react'

export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    )
  } catch {
    return false
  }
}

export function WebGLUnsupported() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        textAlign: 'center',
        background: '#05010d',
        color: '#05d9e8',
        fontFamily: "'Orbitron', sans-serif",
        letterSpacing: '0.15em',
        zIndex: 100,
      }}
    >
      <div style={{ fontSize: 40 }}>⚠</div>
      <div style={{ fontSize: 15, textTransform: 'uppercase' }}>WebGL unavailable</div>
      <div style={{ fontSize: 11, opacity: 0.65, maxWidth: 380, lineHeight: 1.7 }}>
        This game needs WebGL. Try enabling hardware acceleration in your browser
        settings, updating your browser, or opening the page on a different device.
      </div>
    </div>
  )
}

interface State {
  failed: boolean
}

/** Catches renderer construction errors so the page explains itself. */
export class CanvasErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('[CyberStrike] renderer failed to start:', error)
  }

  render() {
    if (this.state.failed) return <WebGLUnsupported />
    return this.props.children
  }
}
