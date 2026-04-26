# Mini World

A WorldBox-inspired 3D life simulation that runs entirely in your browser. Plants spread, herbivores graze, predators hunt, and humans grow up, form tribes, build huts, and wage wars — all while the sun rises, the moon arcs overhead, and fireflies drift through the night.

And if you watch long enough, the world starts watching you back.

**Live at [jmbt25.github.io](https://jmbt25.github.io)**

No installer, no account, no backend — just open the page and the world starts breathing.

## What you can do

- **Watch a world unfold.** A procedurally-generated map of forests, mountains, lakes and beaches seeds itself with creatures and runs continuously.
- **Shape the terrain.** Paint water, grass, forest, dirt, sand, or mountains with an adjustable brush.
- **Spawn life.** Drop plants, herbivores, predators, or humans anywhere and watch them interact.
- **Inspect anyone.** Click any creature, plant, or hut to see its name, tribe, life stage, hunger, energy, traits, skills, and current state of mind.
- **Control time.** Pause, slow, or fast-forward up to 5×; reset the world for a new seed.

## Living systems

| System | Behaviour |
|---|---|
| **Plants** | Grow through three stages, spread seeds onto fertile tiles, age slower in forests, spread faster on grass. |
| **Herbivores** | Graze plants, flee predators (panic-sprint), seek mates, give birth. Herd Instinct lets a flock take a second flee step when together. |
| **Predators** | Hunt herbivores and humans. Successful kills trigger a Blood Frenzy — a temporary speed buff with a red coat tint. |
| **Humans** | Live through three life stages — **child → adult → elder**. Children render small and grow visibly; only adults reproduce, fight, and build; elders grey and retire from civic life. Adults form tribes (with at least one buddy), mate within their tribe, build huts, and declare war on neighbours. Some are named **Joshua** and inherit unique skills (Pathfinder, Architect, Ascendant, Patriarch, Champion). |
| **Tribes** | A tribe is a *band*, not a person — organic founding requires co-founders nearby (Sage humans excepted). Tribes need at least 4 living members to declare or maintain a war; fallen tribes (huts standing, no members) are marked as ruins. |
| **Migration** | When a species fully dies out and the ecology can support its return, a small band arrives at the world edge as a story event — no silent respawning. |

Some creatures are **special** — a 5% chance at birth gives them a trait (Swift, Hardy, Giant, Sage, Warrior, etc.) marked by a glowing gold octahedron above their head. Skills (Joshua-only) are marked by a cyan ring at their feet.

Above every creature, a small glyph telegraphs what they're feeling: **!** for fear, **♥** for courtship, **⚔** for combat, **⚒** for building, **+** for gestation, **z** for resting, **…** for hunger, **◉** for *aware of you*.

Particle bursts punctuate every event: green sparkles for birth, grey puffs for death, leaves when a plant is eaten, red splatter when prey is taken, yellow sparks for combat hits, brown footstep dust under a sprinting predator.

## Thronglet awareness

A Black Mirror-inspired emergent behaviour layer. The longer the world runs, the more aware its inhabitants become of *you*, the watcher. Awareness grows with sim time, population, and civilisation milestones; it persists across visits via `localStorage`. When awareness crosses a threshold, behaviours unlock in stages — each one quieter than the next, captioned as it happens so screenshots tell the story.

| Stage | What happens |
|---|---|
| **1 · Noticing** | Small waves of humans pause and tilt their heads up at the camera. An eye glyph (◉) appears above each. |
| **2 · Offerings** | A small mound of stones materialises near where you're looking, with a glowing pillar to draw the eye. |
| **3 · Symbols** | Stones arrange themselves into geometric shapes, then crude glyphs, then short English words — `HELLO`, `WE SEE`, `STAY`, `HELP`, `WHO`, `THANKS`. |
| **4 · Direct contact** | A single chosen one walks out from their tribe to the closest point to the camera, freezes, and stares. The screen vignettes; a subtitle appears with their name. |
| **5 · Persistence** | Awareness, milestones, visit count, and elapsed time are remembered. A returning visitor is greeted differently. |

Every stage event triggers a cinematic subtitle at the bottom of the canvas (Black Mirror caption energy), so any screenshot reads as a story without context. The HUD shows a glowing **stage badge** when the awareness layer is active.

**Don't want to wait through the awareness ramp while testing?** Open the browser console:

```js
window.__thronglets.status()         // current awareness, stage, visit count
window.__thronglets.forceStage(1)    // immediate noticing wave
window.__thronglets.forceStage(2)    // offering pile + caption
window.__thronglets.forceStage(3)    // glyph or word
window.__thronglets.forceStage(4)    // chosen one walks to camera
window.__thronglets.reset()          // wipe persistence and start fresh
```

**Want it off entirely?** Append `?normal=1` to the URL, or press `Ctrl+Shift+T`, or run `window.__thronglets.disable()` in the console. The setting persists.

## Controls

### Mouse

| Action | What it does |
|---|---|
| Right-drag | Pan the world |
| Middle-drag | Orbit the camera |
| Scroll | Zoom |
| Left-click / drag | Apply the active tool |
| Click on minimap | Snap camera to that area |

### Keyboard

| Key | Action |
|---|---|
| `1` – `4` | Spawn plant / herbivore / predator / human |
| `Q` | Inspect mode |
| `E` | Erase mode |
| `Space` | Pause / resume |
| `[` &nbsp; `]` | Slower / faster simulation |
| `F` | Reset camera |
| `R` | Generate a new world |
| `H` &nbsp; `?` | Toggle controls panel |
| `Ctrl+Shift+T` | Toggle Thronglet awareness on / off |
| `Esc` | Close any open dialog |

## Visual systems

- **Day / night cycle** — the sky lerps through nine phase stops (night → pre-dawn → sunrise → morning → midday → afternoon → sunset → dusk → night) every ~120 seconds. The sun and moon arc across the sky, casting real shadows; stars fade in at night and fireflies drift over forests.
- **Water** — animated shader plane with foam along every coast. Highlights pick up the current sky colour, so dawn and dusk paint the sea.
- **Terrain** — flat-shaded low-poly with hash-jittered vertices for organic peaks. Each biome scatters its own decorations: pine and broadleaf trees in forests, grass tufts and wildflowers on plains, boulders and rocks in mountains, ice spikes on snow, pebbles and driftwood on beaches, reeds along shorelines.
- **Creatures** — composite low-poly bodies with sclera + pupil eyes, per-individual colour jitter (no two sheep look quite alike), seven hair colours for humans (greying with elderhood), predator-amber eyes, walking sway and idle breathing. Newborns fade in; the dead leave fading "ghost" silhouettes instead of popping out.
- **Huts** — stone foundation, tribe-coloured pyramid roof, chimney that emits smoke matching the current sky tone.
- **Cinematic overlay** — Thronglet awareness moments display Netflix-style subtitles, a soft red vignette during Stage 4 stares, and an attribution badge so screenshots are self-explanatory.

## Tech stack

- Vanilla **HTML / CSS / ES modules** — no build step, no bundler, no package manager.
- **Three.js 0.170** loaded from a CDN via `<script type="importmap">`.
- WebGL shadows (PCF soft), ACES tone mapping, sRGB output.
- All persistent state is in `localStorage` under the `thronglets_*` namespace.
- Hosted on **GitHub Pages**.

The whole thing is small, vanilla JavaScript split across single-responsibility modules under `js/`.

## Running locally

Any static file server works. The simplest option:

```bash
git clone https://github.com/jmbt25/jmbt25.github.io.git
cd jmbt25.github.io
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

There is nothing to install — opening `index.html` directly will fail because ES modules need an HTTP origin, but any server (Python's `http.server`, `npx serve`, VS Code's Live Server, etc.) works out of the box.

## Browser support

Tested on recent Chromium and Firefox. Needs WebGL and ES module support — anything from 2020 onwards.

## License

MIT — feel free to fork, remix, and learn from it.
