import { TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';

export class Camera {
  constructor(canvasW, canvasH) {
    this.zoom   = 1.0;
    this.minZoom = 0.35;
    this.maxZoom = 5.0;

    const worldPxW = WORLD_WIDTH  * TILE_SIZE;
    const worldPxH = WORLD_HEIGHT * TILE_SIZE;

    // Start centred on the world
    this.x = (canvasW - worldPxW) / 2;
    this.y = (canvasH - worldPxH) / 2;
  }

  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /** Zoom around a canvas-space pivot point. */
  zoomAt(factor, pivotX, pivotY) {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const scale   = newZoom / this.zoom;
    this.x        = pivotX - scale * (pivotX - this.x);
    this.y        = pivotY - scale * (pivotY - this.y);
    this.zoom     = newZoom;
  }

  /** Convert a canvas-space point to world tile coords. */
  screenToTile(sx, sy) {
    return {
      x: Math.floor((sx - this.x) / (TILE_SIZE * this.zoom)),
      y: Math.floor((sy - this.y) / (TILE_SIZE * this.zoom)),
    };
  }

  /** Returns the range of tiles visible in the viewport. */
  visibleTileRange(canvasW, canvasH) {
    const ts = TILE_SIZE * this.zoom;
    return {
      x0: Math.max(0, Math.floor(-this.x / ts)),
      y0: Math.max(0, Math.floor(-this.y / ts)),
      x1: Math.min(WORLD_WIDTH,  Math.ceil((-this.x + canvasW) / ts) + 1),
      y1: Math.min(WORLD_HEIGHT, Math.ceil((-this.y + canvasH) / ts) + 1),
    };
  }
}
