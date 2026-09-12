import { create } from 'zustand'

/**
 * UI-facing pointer-lock state.
 * Separated from the high-frequency `pointerLocked` ref so only UI components
 * that subscribe re-render when the lock state changes.
 */
interface PointerLockUIState {
  isLocked: boolean
  setLocked: (locked: boolean) => void
}

export const usePointerLockUI = create<PointerLockUIState>((set) => ({
  isLocked: false,
  setLocked: (locked) => set({ isLocked: locked }),
}))
