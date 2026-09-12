
# Cyber Strike FPS — Game Design Document

## 1. Game Overview
- **Name**: Cyber Strike FPS
- **Concept**: A neon cyberpunk arena FPS where you survive waves of hostile drones.
- **Genre**: First-Person Shooter (FPS)
- **Unique Hook**: Procedural cyberpunk aesthetics + hitscan combat + wave-based drone AI
- **Platform**: Web (WebGL via React Three Fiber)
- **Camera**: First-Person (Pointer Lock)

## 2. Core Mechanics
### Controls
| Action | Input | Logic |
|:---|:---|:---|
| Move | WASD | Rapier dynamic capsule, camera-relative |
| Look | Mouse | Pointer Lock, yaw + pitch (clamped ±85°) |
| Jump | Space | Vertical impulse when grounded |
| Sprint | Shift | 1.6x move speed |
| Shoot | Left Click | Hitscan raycast from camera center |
| Reload | R | Refill magazine from reserve (1.5s) |

### Combat
- **Weapon**: Energy rifle (procedural mesh), 30-round mag, 90 reserve ammo
- **Damage**: 25 per hit (enemy has 100 HP = 4 hits)
- **Muzzle flash**: PointLight + emissive sprite at barrel tip
- **Reload**: 1.5s animation, weapon dips down and back up

### Enemy AI
- **Type**: Hovering combat drone (geometric, retro-style)
- **Health**: 100 HP
- **Behavior**: Detect player distance → move toward player → melee attack when close (15 dmg, 1.2s cooldown)
- **Hit response**: Emissive flash red + small knockback
- **Death**: Spin/fall animation + particle burst, then despawn

### Win/Lose
- **Victory**: Kill all 12 enemies
- **Game Over**: Health reaches 0

## 3. Game Objects
| Object | Geometry | Collider | Notes |
|:---|:---|:---|:---|
| Player | (invisible, capsule) | Capsule(0.35, 0.9) | Camera at eye height 1.6 |
| Enemy | Box body + sphere head + glowing eye | Capsule | Dynamic, locked rotation |
| Floor | Plane 60×60 | Cuboid | Cyber grid texture |
| Wall | Box | Cuboid | Perimeter boundary |
| Crate | Box | Cuboid | Cover obstacles |

## 4. Environment
- **Sky**: Dark cyberpunk gradient + stars
- **Lighting**: Directional light (sun) with shadows + ambient + hemisphere
- **Fog**: Exponential, dark blue
- **Arena**: 60×60 floor, 4 perimeter walls, 8-10 crates for cover
- **Materials**: MeshStandardMaterial with emissive neon accents

## 5. UI/HUD
```
┌──────────────────────────────────┐
│ [HP████████]        [Score: 1000] │
│ [Ammo: 30/90]      [Kills: 3/12] │
│                                   │
│             [+]                   │
│           (crosshair)             │
│                                   │
└──────────────────────────────────┘
```
- Crosshair: centered, expands when shooting
- Health bar: top-left, turns red when low
- Ammo counter: bottom-left
- Score + kills: top-right
- Game Over / Victory: full overlay with restart button

## 6. Art Style
- **Style**: Cyberpunk / synthwave neon
- **Palette**: #ff2a6d (pink), #05d9e8 (blue), #9d4edd (purple), #05010d (dark)
- **Materials**: Dark metallic with emissive neon edges
- **Post-processing**: Bloom for neon glow
