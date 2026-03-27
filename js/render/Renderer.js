import { TILE_SIZE } from '../core/constants.js';
import { TileRenderer }   from './TileRenderer.js';
import { EntityRenderer } from './EntityRenderer.js';

export class Renderer {
  constructor(canvas, world, registry, camera) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.world    = world;
    this.registry = registry;
    this.camera   = camera;

    this.tileRenderer   = new TileRenderer();
    this.entityRenderer = new EntityRenderer();

    // Optional: entity to highlight (set by inspect tool)
    this.highlighted = null;

    // Disable image smoothing for pixel art look
    this.ctx.imageSmoothingEnabled = false;
  }

  render() {
    const { ctx, canvas, world, registry, camera } = this;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // ── Apply camera transform ───────────────────────────────────────────────
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // ── Terrain layer ────────────────────────────────────────────────────────
    this.tileRenderer.render(ctx, world, camera, W, H);

    // ── Entity layer ─────────────────────────────────────────────────────────
    this.entityRenderer.render(ctx, registry, camera, W, H);

    // ── Highlight selected entity ────────────────────────────────────────────
    if (this.highlighted?.alive) {
      this.entityRenderer.drawHighlight(ctx, this.highlighted, '#ffffff');
    }

    ctx.restore();

    // ── Tool cursor overlay (screen-space) ────────────────────────────────────
    this._drawCursor(ctx);
  }

  _drawCursor(ctx) {
    if (!this._cursorTile) return;
    const { tx, ty } = this._cursorTile;
    const ts = TILE_SIZE * this.camera.zoom;
    const sx = tx * ts + this.camera.x;
    const sy = ty * ts + this.camera.y;

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
  }

  /** Called by ToolManager on mousemove. */
  setCursorTile(tx, ty) {
    this._cursorTile = { tx, ty };
  }

  clearCursor() {
    this._cursorTile = null;
  }
}
