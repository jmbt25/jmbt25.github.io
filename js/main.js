/**
 * main.js — entry point.
 * Wires all subsystems together and starts the game loop.
 * ES module: loaded via <script type="module"> — deferred by default.
 */

import { World }               from './world/World.js';
import { WorldGen }            from './world/WorldGen.js';
import { EntityRegistry }      from './entities/EntityRegistry.js';
import { SimulationManager }   from './sim/SimulationManager.js';
import { Camera }              from './render/Camera.js';
import { Renderer }            from './render/Renderer.js';
import { UIManager }           from './ui/UIManager.js';
import { SIM_TICK_MS, TYPE }   from './core/constants.js';

// ── Initialise ────────────────────────────────────────────────────────────────

const canvas    = document.getElementById('world-canvas');
resizeCanvas();

const world     = new World();
const registry  = new EntityRegistry(world);
const camera    = new Camera(canvas.width, canvas.height);
const renderer  = new Renderer(canvas, world, registry, camera);

// Generate terrain first
WorldGen.generate(world);

const sim = new SimulationManager(world, registry);

// Seed initial population
seedWorld(world, registry);

// Wire UI (toolbar, stats, graph, controls)
const ui = new UIManager({ canvas, world, registry, camera, renderer, sim });

// ── Game loop ────────────────────────────────────────────────────────────────

// Simulation runs on a fixed interval (independent of render fps)
let simInterval = setInterval(() => sim.update(), SIM_TICK_MS);

// Render loop at ~60 fps
function renderLoop() {
  renderer.render();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// ── Resize handling ───────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  resizeCanvas();
  camera.canvasW = canvas.width;
  camera.canvasH = canvas.height;
});

function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  canvas.width    = container.clientWidth;
  canvas.height   = container.clientHeight;
}

// ── Initial world seed ────────────────────────────────────────────────────────

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
  spawnRandom(TYPE.HUMAN,     10);
}
