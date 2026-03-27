import { TILE_SIZE } from '../core/constants.js';
import { TERRAIN, TERRAIN_COLOR, TERRAIN_COLOR2 } from '../world/TerrainType.js';

// Deterministic "random" variation per tile (no runtime RNG needed)
function tileVariant(x, y) {
  const h = Math.imul(x * 2246822519, y * 2654435761) >>> 0;
  return (h & 0xff) / 255;
}

export class TileRenderer {
  constructor() {
    this._lastCamKey = '';
    // Pre-built offscreen canvas for the static terrain layer
    this._terrainCanvas  = null;
    this._terrainCtx     = null;
    this._terrainDirty   = true;
  }

  /**
   * Draw the terrain for the visible tile range.
   * ctx already has the camera transform applied.
   */
  render(ctx, world, camera, canvasW, canvasH) {
    const ts  = TILE_SIZE;
    const { x0, y0, x1, y1 } = camera.visibleTileRange(canvasW, canvasH);

    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        const terrain = world.getTerrain(tx, ty);
        const px      = tx * ts;
        const py      = ty * ts;
        const v       = tileVariant(tx, ty);

        // Base tile colour
        ctx.fillStyle = v > 0.65 ? TERRAIN_COLOR2[terrain] : TERRAIN_COLOR[terrain];
        ctx.fillRect(px, py, ts, ts);

        // Per-terrain detail marks
        this._drawDetail(ctx, terrain, px, py, ts, v);
      }
    }
  }

  _drawDetail(ctx, terrain, px, py, ts, v) {
    switch (terrain) {
      case TERRAIN.WATER:
        if (v > 0.55) {
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(px + 2, py + ts * 0.5 | 0, ts - 4, 2);
        }
        break;

      case TERRAIN.GRASS:
        if (v > 0.80) {
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(px + (v * ts | 0) % (ts - 2), py + (v * 7 | 0) % (ts - 2), 2, 2);
        }
        break;

      case TERRAIN.FOREST:
        // Subtle dark blotch
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);
        break;

      case TERRAIN.MOUNTAIN:
        // Peak highlight
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(px + (ts / 3 | 0), py, ts / 3 | 0, ts / 3 | 0);
        break;

      case TERRAIN.SNOW:
        if (v > 0.5) {
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
        }
        break;

      case TERRAIN.SAND:
        if (v > 0.7) {
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fillRect(px + (v * 11 | 0) % ts, py + (v * 13 | 0) % ts, 2, 1);
        }
        break;
    }
  }

  /** Mark terrain as needing redraw (call when terrain is painted). */
  invalidate() {
    this._terrainDirty = true;
  }
}
