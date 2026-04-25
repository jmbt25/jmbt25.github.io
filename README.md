# Mini World

A WorldBox-inspired 3D life simulation that runs entirely in your browser. Plants spread, herbivores graze, predators hunt, and humans form tribes that build huts and wage war — all while the sun rises, the moon arcs overhead, and fireflies drift through the night.

**Live at [jmbt25.github.io](https://jmbt25.github.io)**

No installer, no account, no backend — just open the page and the world starts breathing.

## What you can do

- **Watch a world unfold.** A procedurally-generated map of forests, mountains, lakes and beaches seeds itself with creatures and runs continuously.
- **Shape the terrain.** Paint water, grass, forest, dirt, sand, or mountains with an adjustable brush.
- **Spawn life.** Drop plants, herbivores, predators, or humans anywhere and watch them interact.
- **Inspect anyone.** Click any creature, plant, or hut to see its name, tribe, hunger, energy, traits, skills, and current state of mind.
- **Control time.** Pause, slow, or fast-forward up to 5×; reset the world for a new seed.

## Living systems

| System | Behaviour |
|---|---|
| **Plants** | Grow through three stages, spread seeds onto fertile tiles, age slower in forests, spread faster on grass. |
| **Herbivores** | Graze plants, flee predators (panic-sprint), seek mates, give birth. Herd Instinct lets a flock take a second flee step when together. |
| **Predators** | Hunt herbivores and humans. Successful kills trigger a Blood Frenzy — a temporary speed buff with a red coat tint. |
| **Humans** | Form tribes, build huts, declare war on neighbours, return to their tribe's centroid when wandering. Some are named **Joshua** and inherit unique skills (Pathfinder, Architect, Ascendant, Patriarch, Champion). |
| **Tribes** | Periodically roll for war or peace based on proximity and size. Hut roofs and human tunics share the tribe colour. |

Some creatures are **special** — a 5% chance at birth gives them a trait (Swift, Hardy, Giant, Sage, Warrior, etc.) marked by a glowing gold octahedron above their head. Skills (Joshua-only) are marked by a cyan ring at their feet.

Above every creature, a small glyph telegraphs what they're feeling: **!** for fear, **♥** for courtship, **⚔** for combat, **⚒** for building, **+** for gestation, **z** for resting, **…** for hunger.

Particle bursts punctuate every event: green sparkles for birth, grey puffs for death, leaves when a plant is eaten, red splatter when prey is taken, yellow sparks for combat hits, brown footstep dust under a sprinting predator.

## Controls

### Mouse

| Action | What it does |
|---|---|
| Right-drag | Orbit the camera |
| Middle-drag | Pan |
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
| `Esc` | Close any open dialog |

## Visual systems

- **Day / night cycle** — the sky lerps through nine phase stops (night → pre-dawn → sunrise → morning → midday → afternoon → sunset → dusk → night) every ~120 seconds. The sun and moon arc across the sky, casting real shadows; stars fade in at night and fireflies drift over forests.
- **Water** — animated shader plane with foam along every coast. Highlights pick up the current sky colour, so dawn and dusk paint the sea.
- **Terrain** — flat-shaded low-poly with hash-jittered vertices for organic peaks. Each biome scatters its own decorations: pine and broadleaf trees in forests, grass tufts and wildflowers on plains, boulders and rocks in mountains, ice spikes on snow, pebbles and driftwood on beaches, reeds along shorelines.
- **Creatures** — composite low-poly bodies with sclera + pupil eyes, per-individual colour jitter (no two sheep look quite alike), seven hair colours for humans, predator-amber eyes, walking sway and idle breathing.
- **Huts** — stone foundation, tribe-coloured pyramid roof, chimney that emits smoke matching the current sky tone.

## Tech stack

- Vanilla **HTML / CSS / ES modules** — no build step, no bundler, no package manager.
- **Three.js 0.170** loaded from a CDN via `<script type="importmap">`.
- WebGL shadows (PCF soft), ACES tone mapping, sRGB output.
- Hosted on **GitHub Pages**.

The whole thing is ~3 600 lines of JavaScript split across small, single-responsibility modules under `js/`.

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
