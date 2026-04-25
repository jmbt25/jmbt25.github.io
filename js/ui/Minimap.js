/**
 * Minimap — small overhead view of terrain + entity positions.
 * Drawn into a 2D canvas so it stays cheap regardless of world size.
 */
import { eventBus } from '../core/eventBus.js';
import { TERRAIN, TERRAIN_COLOR } from '../world/TerrainType.js';
import { TYPE } from '../core/constants.js';

export class Minimap {
  constructor({ canvasId = 'minimap-canvas', world, registry, civ }) {
    this.canvas   = document.getElementById(canvasId);
    this.ctx      = this.canvas?.getContext('2d');
    this.world    = world;
    this.registry = registry;
    this.civ      = civ;
    this._frame   = 0;
    this._terrainCanvas = null;
    this._terrainDirty = true;

    if (!this.ctx) return;

    this.canvas.addEventListener('click', e => this._onClick(e));
    this.canvas.style.cursor = 'crosshair';

    this._buildTerrainCache();
    this._draw();

    eventBus.on('sim:tick', () => {
      this._frame++;
      if (this._frame % 3 === 0) this._draw();
    });
  }

  /** Call when world terrain has been edited or regenerated. */
  invalidateTerrain() {
    this._terrainDirty = true;
  }

  /** Optional click-to-pan (set externally by UIManager). */
  set onPan(fn) { this._onPan = fn; }

  _onClick(e) {
    if (!this._onPan) return;
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const tx = (px / r.width) * this.world.width;
    const ty = (py / r.height) * this.world.height;
    this._onPan(tx, ty);
  }

  _buildTerrainCache() {
    const W = this.world.width;
    const H = this.world.height;
    if (!this._terrainCanvas) {
      this._terrainCanvas = document.createElement('canvas');
      this._terrainCanvas.width = W;
      this._terrainCanvas.height = H;
    }
    const tctx = this._terrainCanvas.getContext('2d');
    const img = tctx.createImageData(W, H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = this.world.getTerrain(x, y);
        const hex = TERRAIN_COLOR[t];
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const o = (y * W + x) * 4;
        img.data[o]   = r;
        img.data[o+1] = g;
        img.data[o+2] = b;
        img.data[o+3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
    this._terrainDirty = false;
  }

  _draw() {
    if (!this.ctx) return;
    if (this._terrainDirty) this._buildTerrainCache();

    const { canvas, ctx, world, registry, civ } = this;
    const W = canvas.width;
    const H = canvas.height;

    // Terrain — scaled blit
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._terrainCanvas, 0, 0, W, H);

    // Entities — colored dots
    const sx = W / world.width;
    const sy = H / world.height;

    const drawDot = (x, y, color, size = 1.6) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x * sx, y * sy, size, 0, Math.PI * 2);
      ctx.fill();
    };

    // Plants are dim noise — skip them to keep the map readable
    for (const e of registry.getAll()) {
      if (!e.alive) continue;
      switch (e.type) {
        case TYPE.HERBIVORE: drawDot(e.tileX, e.tileY, '#f5d550', 1.4); break;
        case TYPE.PREDATOR:  drawDot(e.tileX, e.tileY, '#e15252', 1.6); break;
        case TYPE.HUMAN: {
          let c = '#ec9b5a';
          if (civ && e.tribeId != null) {
            const t = civ.getTribe(e.tribeId);
            if (t) c = t.color;
          }
          drawDot(e.tileX, e.tileY, c, 1.6);
          break;
        }
        case TYPE.BUILDING: {
          let c = '#7a5a3a';
          if (civ && e.tribeId != null) {
            const t = civ.getTribe(e.tribeId);
            if (t) c = t.color;
          }
          ctx.fillStyle = c;
          ctx.fillRect(e.tileX * sx - 1, e.tileY * sy - 1, 3, 3);
          break;
        }
      }
    }

    // Border
    ctx.strokeStyle = 'rgba(120,150,200,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }
}
