/**
 * main.js — entry point.
 * Wires all subsystems together and starts the game loop.
 * ES module: loaded via <script type="module"> — deferred by default.
 */

import { World }                from './world/World.js';
import { WorldGen }             from './world/WorldGen.js';
import { EntityRegistry }       from './entities/EntityRegistry.js';
import { SimulationManager }    from './sim/SimulationManager.js';
import { CivilizationManager }  from './sim/CivilizationManager.js';
import { Renderer3D }           from './render/Renderer3D.js';
import { UIManager }            from './ui/UIManager.js';
import { ThrongletsManager }    from './sim/Thronglets.js';
import { SIM_TICK_MS, TYPE }    from './core/constants.js';

const canvas = document.getElementById('world-canvas');
resizeCanvas();

const world    = new World();
const registry = new EntityRegistry(world);

WorldGen.generate(world);

const renderer = new Renderer3D(canvas, world, registry);
const civ      = new CivilizationManager(registry, world);
renderer.civ   = civ;

const sim = new SimulationManager(world, registry, civ);

seedWorld(world, registry);

const ui = new UIManager({ canvas, world, registry, renderer, sim, civ });

// Thronglets — emergent awareness overlay. Self-contained; safe to remove
// this block + the two new files (Thronglets.js, ThrongletGlyphs.js) and
// the small _thronglet hooks in Human.js to disable the feature entirely.
// Runtime opt-out: ?normal=1 URL param, Ctrl+Shift+T, or window.__thronglets.disable().
const thronglets = new ThrongletsManager({
  registry, world, civ, sim, renderer, glyphs: renderer.thrGlyphs,
});
window.__thronglets = thronglets;

let simInterval = setInterval(() => sim.update(), SIM_TICK_MS);

function renderLoop() {
  renderer.render();
  ui.tickFrame();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

window.addEventListener('resize', () => {
  resizeCanvas();
  renderer.resize(canvas.width, canvas.height);
});

function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  canvas.width    = container.clientWidth;
  canvas.height   = container.clientHeight;
}

function seedWorld(world, registry) {
  const W = world.width;
  const H = world.height;

  const spawnRandom = (type, count) => {
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 20) {
      tries++;
      const x = Math.floor(Math.random() * W);
      const y = Math.floor(Math.random() * H);
      if (!world.isPassable(x, y)) continue;
      if (registry.spawn(type, x, y)) placed++;
    }
  };

  spawnRandom(TYPE.HERBIVORE, 55);
  spawnRandom(TYPE.PREDATOR,  12);
  spawnRandom(TYPE.HUMAN,     14);
}
