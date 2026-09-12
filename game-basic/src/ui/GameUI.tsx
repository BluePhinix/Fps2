import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore, GameState } from '@/engine'
import { useAudioStore, useGameSound } from '@/audio'
import { usePointerLockUI } from '@/entities/pointerLockUI'
import { useQualityStore, TIER_LABELS, type QualitySetting } from '@/engine/quality'
import {
  Button,
  Switch,
  Slider,
  Progress,
  Dialog,
  DialogContent,
  DialogTitle,
  Separator,
  TooltipProvider,
} from '@/components'
import { useState, useEffect } from 'react'
import { cn } from '@/utils'
import {
  Play,
  Pause,
  Settings,
  RotateCcw,
  Volume2,
  Music,
  Monitor,
  Gamepad2,
  MoveUp,
  Heart,
  Star,
  Zap,
  Skull,
  ChevronRight,
  Crosshair as CrosshairIcon,
  Target,
  ArrowLeft,
  Trophy,
  MousePointerClick,
} from 'lucide-react'

// ============================================
// 准星
// ============================================
function Crosshair() {
  return (
    <div className="crosshair">
      <div className="crosshair-line crosshair-top" />
      <div className="crosshair-line crosshair-bottom" />
      <div className="crosshair-line crosshair-left" />
      <div className="crosshair-line crosshair-right" />
      <div className="crosshair-dot" />
    </div>
  )
}

// ============================================
// 血条
// ============================================
function HealthBar({ current, max }: { current: number; max: number }) {
  const percentage = (current / max) * 100
  const isLow = percentage <= 30
  const isCritical = percentage <= 15
  const variant = isCritical ? 'danger' : isLow ? 'warning' : 'default'

  return (
    <div className="w-36 sm:w-52">
      <div className="flex justify-between items-center mb-1">
        <span className="text-label flex items-center gap-1">
          <Heart className="w-3 h-3 text-cyber-pink" /> HEALTH
        </span>
        <span
          className={cn(
            'text-xs font-cyber tracking-wider',
            isCritical ? 'text-cyber-pink animate-flicker' : 'text-cyber-yellow'
          )}
        >
          {Math.ceil(current)}/{max}
        </span>
      </div>
      <div className="hud-bar">
        <div className="hud-bar-glow" />
        <Progress value={percentage} variant={variant} animated={isCritical} />
        <div className="hud-corner-tl" />
        <div className="hud-corner-br" />
      </div>
    </div>
  )
}

// ============================================
// 弹药计数器
// ============================================
function AmmoCounter({ ammo, reserve, reloading }: { ammo: number; reserve: number; reloading: boolean }) {
  return (
    <div className="hud-panel clip-corner px-5 py-2.5">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyber-yellow to-transparent" />
      <div className="flex items-center gap-3">
        <Target className="w-5 h-5 text-cyber-yellow" />
        <div>
          <div className="text-[10px] text-muted tracking-[0.3em] uppercase">Ammo</div>
          {reloading ? (
            <div className="text-lg font-cyber text-cyber-blue animate-pulse tracking-wider">RELOADING...</div>
          ) : (
            <div className="text-lg font-cyber tracking-wider">
              <span className={cn(ammo === 0 ? 'text-cyber-pink' : 'text-cyber-yellow')}>{ammo}</span>
              <span className="text-cyber-blue/50"> / {reserve}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// 击杀追踪
// ============================================
function KillTracker({ killed, total }: { killed: number; total: number }) {
  return (
    <motion.div key={killed} initial={{ scale: 1 }} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 0.2 }}>
      <div className="hud-panel clip-corner px-5 py-2.5">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyber-pink to-transparent" />
        <div className="flex items-center gap-3">
          <CrosshairIcon className="w-5 h-5 text-cyber-pink" />
          <div>
            <div className="text-[10px] text-muted tracking-[0.3em] uppercase">Kills</div>
            <div className="text-lg font-cyber tracking-wider">
              <span className="text-cyber-pink">{killed}</span>
              <span className="text-cyber-blue/50"> / {total}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// 分数显示
// ============================================
function ScoreDisplay({ score }: { score: number }) {
  return (
    <motion.div key={score} initial={{ scale: 1 }} animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.2 }}>
      <div className="hud-panel clip-corner px-5 py-2.5">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyber-yellow to-transparent" />
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-cyber-yellow fill-cyber-yellow" />
          <div>
            <div className="text-[10px] text-muted tracking-[0.3em] uppercase">Score</div>
            <div className="text-lg text-value-pink">{score.toString().padStart(6, '0')}</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// FPS 计数器
// ============================================
function FPSCounter() {
  const [fps, setFps] = useState(0)

  // Measured locally with rAF. Reading it out of the game store meant a
  // zustand write on every single frame just to update this number.
  useEffect(() => {
    let frames = 0
    let last = performance.now()
    let raf = 0
    const tick = () => {
      frames += 1
      const now = performance.now()
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="px-3 py-1 bg-cyber-darker/80 border border-cyber-blue/30 text-xs font-cyber text-cyber-blue tabular-nums flex items-center gap-2">
      <Monitor className="w-3 h-3 text-cyber-pink" /> {fps} FPS
    </div>
  )
}

// ============================================
// 赛博朋克按钮
// ============================================
interface CyberButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  icon?: React.ReactNode
  className?: string
}
const MotionButton = motion(Button)
function CyberButton({ children, onClick, variant = 'primary', icon, className = '' }: CyberButtonProps) {
  const isPrimary = variant === 'primary'
  const isGhost = variant === 'ghost'
  return (
    <MotionButton className={cn('btn group', className)} onClick={onClick} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      {!isGhost && <div className={cn(isPrimary ? 'btn-glow-pink' : 'btn-glow-blue')} />}
      <div className={cn('relative flex items-center justify-center gap-2 clip-corner', isGhost ? 'btn-ghost' : isPrimary ? 'btn-primary' : 'btn-secondary')}>
        <span className={cn('btn-corner', isGhost ? 'btn-corner-tl-purple' : isPrimary ? 'btn-corner-tl-pink' : 'btn-corner-tl-blue')} />
        <span className={cn('btn-corner', isGhost ? 'btn-corner-br-purple' : isPrimary ? 'btn-corner-br-pink' : 'btn-corner-br-blue')} />
        {icon && <span className="w-5 h-5">{icon}</span>}
        <span className="relative z-10">{children}</span>
      </div>
    </MotionButton>
  )
}


// ============================================
// 画质选择 / Graphics quality
// ============================================
function QualityPicker() {
  const preference = useQualityStore((s) => s.preference)
  const setPreference = useQualityStore((s) => s.setPreference)
  const detected = useQualityStore((s) => s.detected)
  const options: QualitySetting[] = ['auto', 'low', 'medium', 'high']

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => setPreference(o)}
            className={cn(
              'px-2 py-1 text-[10px] font-cyber tracking-wider border transition-colors',
              preference === o
                ? 'border-cyber-pink text-cyber-pink bg-cyber-pink/10'
                : 'border-cyber-blue/30 text-cyber-blue/60 hover:border-cyber-blue/60'
            )}
          >
            {TIER_LABELS[o]}
          </button>
        ))}
      </div>
      {preference === 'auto' && detected && (
        <span className="text-[9px] text-muted tracking-wider">detected: {TIER_LABELS[detected]}</span>
      )}
    </div>
  )
}

// ============================================
// 设置对话框
// ============================================
function SettingItem({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-cyber text-cyber-blue tracking-wider flex items-center gap-2">{icon}{label}</span>
      {children}
    </div>
  )
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const settings = useGameStore((s) => s.settings)
  const updateSettings = useGameStore((s) => s.updateSettings)
  const { musicVolume, sfxVolume, muted, setMusicVolume, setSfxVolume, toggleMute } = useAudioStore()
  useEffect(() => { updateSettings({ musicVolume, sfxVolume }) }, [musicVolume, sfxVolume, updateSettings])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogContent className="w-[420px]">
            <DialogTitle><Settings className="w-5 h-5 text-cyber-pink" /> Settings</DialogTitle>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm font-cyber mb-2">
                  <span className="text-cyber-blue tracking-wider flex items-center gap-2"><Music className="w-4 h-4" /> Music</span>
                  <span className="text-cyber-pink">{Math.round(musicVolume * 100)}%</span>
                </div>
                <Slider value={[musicVolume]} onValueChange={([v]) => setMusicVolume(v)} max={1} step={0.01} variant="pink" />
              </div>
              <div>
                <div className="flex justify-between text-sm font-cyber mb-2">
                  <span className="text-cyber-blue tracking-wider flex items-center gap-2"><Volume2 className="w-4 h-4" /> SFX</span>
                  <span className="text-cyber-pink">{Math.round(sfxVolume * 100)}%</span>
                </div>
                <Slider value={[sfxVolume]} onValueChange={([v]) => setSfxVolume(v)} max={1} step={0.01} variant="blue" />
              </div>
              <Separator />
              <SettingItem label="Mute" icon={<Volume2 className="w-4 h-4" />}><Switch checked={muted} onCheckedChange={toggleMute} /></SettingItem>
              <Separator />
              <SettingItem label="Show FPS" icon={<Monitor className="w-4 h-4" />}><Switch checked={settings.showFPS} onCheckedChange={(c) => updateSettings({ showFPS: c })} /></SettingItem>
              <Separator />
              <SettingItem label="Graphics" icon={<Zap className="w-4 h-4" />}><QualityPicker /></SettingItem>
            </div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  )
}

// ============================================
// HUD
// ============================================
function HUD() {
  const combat = useGameStore((s) => s.combat)
  const stats = useGameStore((s) => s.stats)
  const settings = useGameStore((s) => s.settings)
  const isLocked = usePointerLockUI((s) => s.isLocked)
  // Touch devices never get pointer lock, so "locked" is permanently false
  // there — the crosshair and the click prompt both need to know that.
  const isTouch = useQualityStore((s) => s.touch)
  const aiming = isLocked || isTouch

  return (
    <TooltipProvider>
      {/* 准星 — 仅在锁定时（或触屏）显示 */}
      {aiming && <Crosshair />}

      <motion.div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex justify-between items-start" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
        <div className="flex flex-col gap-2 sm:gap-3">
          <HealthBar current={combat.health} max={combat.maxHealth} />
          {settings.showFPS && <FPSCounter />}
        </div>
        <div className="flex flex-col gap-2 sm:gap-3 items-end">
          <ScoreDisplay score={stats.score} />
          <KillTracker killed={combat.enemiesKilled} total={combat.enemiesTotal} />
        </div>
      </motion.div>

      {/* 底部弹药 */}
      <motion.div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
        <AmmoCounter ammo={combat.ammo} reserve={combat.reserveAmmo} reloading={combat.isReloading} />
      </motion.div>

      {/* 点击锁定提示 — 触屏设备没有指针锁定 */}
      {!aiming && <ClickToPlayPrompt />}
    </TooltipProvider>
  )
}

// ============================================
// 点击开始提示
// ============================================
function ClickToPlayPrompt() {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center bg-cyber-darker/50 backdrop-blur-[2px] pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="text-center" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
        <MousePointerClick className="w-12 h-12 text-cyber-blue mx-auto mb-3 animate-pulse" />
        <p className="text-cyber-blue font-cyber text-xl tracking-widest uppercase">Click to Play</p>
        <p className="text-cyber-blue/50 text-xs font-cyber tracking-wider mt-2">Mouse will be locked. Press ESC to pause.</p>
      </motion.div>
    </motion.div>
  )
}

// ============================================
// 主菜单
// ============================================
function MainMenu() {
  const startGame = useGameStore((s) => s.startGame)
  const [showSettings, setShowSettings] = useState(false)
  const { init, playGameplayBgm } = useGameSound()
  const isTouch = useQualityStore((s) => s.touch)

  const handleStart = () => {
    init()
    playGameplayBgm()
    startGame()
  }

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center menu-bg scanline pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 opacity-20 grid-bg" />
      <motion.div className="relative text-center z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="relative mb-2">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Zap className="w-10 h-10 text-cyber-pink animate-pulse" />
            <h1 className="title title-lg glitch-text" data-text="CYBER STRIKE">CYBER STRIKE</h1>
            <Zap className="w-10 h-10 text-cyber-blue animate-pulse" />
          </div>
          <div className="line-gradient mt-2" />
        </div>
        <p className="subtitle mb-10">[ First-Person Arena Combat ]</p>

        <div className="flex flex-col gap-4 items-center mb-12">
          <CyberButton onClick={handleStart} icon={<Play className="w-5 h-5" />}>Start Mission</CyberButton>
          <CyberButton variant="secondary" onClick={() => setShowSettings(true)} icon={<Settings className="w-5 h-5" />}>Settings</CyberButton>
        </div>

        {/* 操作指南 */}
        <motion.div className="relative max-w-sm mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div className="glow-blue" />
          <div className="menu-panel clip-corner-lg">
            <h3 className="menu-title"><Gamepad2 className="w-4 h-4" /> Controls</h3>
            <div className="space-y-3 text-sm font-cyber">
              <div className="menu-item"><span className="menu-item-label"><ChevronRight className="w-3 h-3" /> Move</span><span className="menu-item-value">{isTouch ? 'LEFT STICK' : 'WASD'}</span></div>
              <div className="menu-item"><span className="menu-item-label"><ChevronRight className="w-3 h-3" /> Look</span><span className="menu-item-value">{isTouch ? 'DRAG RIGHT' : 'MOUSE'}</span></div>
              <div className="menu-item"><span className="menu-item-label"><ChevronRight className="w-3 h-3" /> Shoot</span><span className="menu-item-value">{isTouch ? 'FIRE BTN' : 'LEFT CLICK'}</span></div>
              <div className="menu-item"><span className="menu-item-label"><ChevronRight className="w-3 h-3" /> Reload</span><span className="menu-item-value">{isTouch ? 'RELOAD BTN' : 'R'}</span></div>
              <div className="menu-item"><span className="menu-item-label"><MoveUp className="w-3 h-3" /> Jump</span><span className="menu-item-value">{isTouch ? 'JUMP BTN' : 'SPACE'}</span></div>
              <div className="menu-item"><span className="menu-item-label"><Zap className="w-3 h-3" /> Sprint</span><span className="menu-item-value">{isTouch ? 'SPRINT BTN' : 'SHIFT'}</span></div>
              <div className="flex justify-between items-center"><span className="menu-item-label"><Pause className="w-3 h-3" /> Pause</span><span className="menu-item-value">{isTouch ? 'PAUSE BTN' : 'ESC'}</span></div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      <AnimatePresence>{showSettings && <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />}</AnimatePresence>
    </motion.div>
  )
}

// ============================================
// 暂停菜单
// ============================================
function PauseMenu() {
  const resume = useGameStore((s) => s.resume)
  const restartGame = useGameStore((s) => s.restartGame)
  const setGameState = useGameStore((s) => s.setGameState)
  const [showSettings, setShowSettings] = useState(false)
  const { pauseBgm, resumeBgm, stopBgm } = useGameSound()

  useEffect(() => { pauseBgm(); return () => resumeBgm() }, [pauseBgm, resumeBgm])

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center menu-bg pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
        <div className="flex items-center justify-center gap-3 mb-8">
          <Pause className="w-8 h-8 text-cyber-blue" />
          <h2 className="title-md font-cyber font-bold text-cyber-blue tracking-widest uppercase text-neon-blue">PAUSED</h2>
          <Pause className="w-8 h-8 text-cyber-blue" />
        </div>
        <div className="flex flex-col gap-4 items-center">
          <CyberButton onClick={resume} icon={<Play className="w-5 h-5" />}>Resume</CyberButton>
          <CyberButton variant="secondary" onClick={() => setShowSettings(true)} icon={<Settings className="w-5 h-5" />}>Settings</CyberButton>
          <CyberButton variant="secondary" onClick={restartGame} icon={<RotateCcw className="w-5 h-5" />}>Restart</CyberButton>
          <CyberButton variant="ghost" onClick={() => { stopBgm(); setGameState(GameState.MENU) }} icon={<ArrowLeft className="w-5 h-5" />}>Main Menu</CyberButton>
        </div>
      </motion.div>
      <AnimatePresence>{showSettings && <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />}</AnimatePresence>
    </motion.div>
  )
}

// ============================================
// 游戏结束
// ============================================
function GameOverMenu() {
  const stats = useGameStore((s) => s.stats)
  const combat = useGameStore((s) => s.combat)
  const restartGame = useGameStore((s) => s.restartGame)
  const setGameState = useGameStore((s) => s.setGameState)
  const { stopBgm, playFail, playGameplayBgm } = useGameSound()

  useEffect(() => { stopBgm(); playFail() }, [stopBgm, playFail])

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center bg-cyber-darker/90 backdrop-blur-md pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <motion.div className="flex items-center justify-center gap-3 mb-6" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
          <Skull className="w-10 h-10 text-cyber-pink animate-pulse" />
          <h2 className="title-lg font-cyber font-black text-cyber-pink tracking-widest uppercase text-neon-pink animate-flicker">SYSTEM FAILURE</h2>
          <Skull className="w-10 h-10 text-cyber-pink animate-pulse" />
        </motion.div>
        <motion.div className="relative mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="absolute -inset-2 bg-cyber-pink/20 blur-xl" />
          <div className="panel-pink clip-corner-lg relative p-8">
            <div className="text-xs font-cyber text-muted tracking-[0.3em] uppercase mb-2 flex items-center justify-center gap-2"><Star className="w-3 h-3" /> Final Score <Star className="w-3 h-3" /></div>
            <div className="text-5xl text-value-pink mb-3">{stats.score.toString().padStart(6, '0')}</div>
            <div className="text-sm font-cyber text-cyber-blue/70">Eliminated {combat.enemiesKilled} / {combat.enemiesTotal} drones</div>
          </div>
        </motion.div>
        <div className="flex flex-col gap-4 items-center">
          <CyberButton onClick={() => { playGameplayBgm(); restartGame() }} icon={<RotateCcw className="w-5 h-5" />}>Retry</CyberButton>
          <CyberButton variant="ghost" onClick={() => setGameState(GameState.MENU)} icon={<ArrowLeft className="w-5 h-5" />}>Main Menu</CyberButton>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================
// 胜利
// ============================================
function VictoryMenu() {
  const stats = useGameStore((s) => s.stats)
  const restartGame = useGameStore((s) => s.restartGame)
  const setGameState = useGameStore((s) => s.setGameState)
  const { stopBgm, playSuccess } = useGameSound()

  useEffect(() => { stopBgm(); playSuccess() }, [stopBgm, playSuccess])

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center bg-cyber-darker/90 backdrop-blur-md pointer-events-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <motion.div className="flex items-center justify-center gap-3 mb-6" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
          <Trophy className="w-10 h-10 text-cyber-yellow animate-pulse" />
          <h2 className="title-lg font-cyber font-black text-cyber-yellow tracking-widest uppercase" style={{ textShadow: '0 0 20px #d1f7ff, 0 0 40px #d1f7ff' }}>VICTORY</h2>
          <Trophy className="w-10 h-10 text-cyber-yellow animate-pulse" />
        </motion.div>
        <motion.div className="relative mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="absolute -inset-2 bg-cyber-blue/20 blur-xl" />
          <div className="relative p-8 bg-cyber-darker/95 border border-cyber-blue/50 clip-corner-lg">
            <div className="text-xs font-cyber text-muted tracking-[0.3em] uppercase mb-2 flex items-center justify-center gap-2"><Star className="w-3 h-3" /> Mission Complete <Star className="w-3 h-3" /></div>
            <div className="text-5xl text-cyber-yellow font-cyber tabular-nums mb-3">{stats.score.toString().padStart(6, '0')}</div>
            <div className="text-sm font-cyber text-cyber-blue/70">All {stats.kills} hostiles neutralized</div>
          </div>
        </motion.div>
        <div className="flex flex-col gap-4 items-center">
          <CyberButton onClick={restartGame} icon={<RotateCcw className="w-5 h-5" />}>Play Again</CyberButton>
          <CyberButton variant="ghost" onClick={() => setGameState(GameState.MENU)} icon={<ArrowLeft className="w-5 h-5" />}>Main Menu</CyberButton>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ============================================
// 主 UI 组件
// ============================================
export function GameUI() {
  const gameState = useGameStore((s) => s.gameState)
  return (
    // The wrapper must stay click-through: it used to be `pointer-events-auto`,
    // which meant an invisible full-screen div ate every touch and left the
    // mobile controls dead. Only the actual menus opt back into events.
    <div className="fixed inset-0 z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        {gameState === GameState.PLAYING && <HUD key="hud" />}
        {gameState === GameState.MENU && <MainMenu key="menu" />}
        {gameState === GameState.PAUSED && <PauseMenu key="pause" />}
        {gameState === GameState.GAME_OVER && <GameOverMenu key="gameover" />}
        {gameState === GameState.VICTORY && <VictoryMenu key="victory" />}
      </AnimatePresence>
    </div>
  )
}
