import { TILE_SIZE, TYPE } from '../core/constants.js';
import { SPECIES } from '../core/constants.js';

const TS  = TILE_SIZE;
const HS  = TS / 2;
const QS  = TS / 4;

export class EntityRenderer {
  /**
   * Draw all living entities. ctx already has camera transform applied.
   */
  render(ctx, registry, camera, canvasW, canvasH) {
    const { x0, y0, x1, y1 } = camera.visibleTileRange(canvasW, canvasH);

    for (const entity of registry.getAll()) {
      if (!entity.alive) continue;

      const { tileX: tx, tileY: ty } = entity;
      // Cull to visible range (with a 1-tile margin)
      if (tx < x0 - 1 || tx > x1 || ty < y0 - 1 || ty > y1) continue;

      const px = tx * TS;
      const py = ty * TS;

      switch (entity.type) {
        case TYPE.PLANT:     this._drawPlant(ctx, px, py, entity);     break;
        case TYPE.HERBIVORE: this._drawHerbivore(ctx, px, py, entity); break;
        case TYPE.PREDATOR:  this._drawPredator(ctx, px, py, entity);  break;
        case TYPE.HUMAN:     this._drawHuman(ctx, px, py, entity);     break;
      }
    }
  }

  // ── Plant ───────────────────────────────────────────────────────────────────

  _drawPlant(ctx, px, py, p) {
    const stage = p.stage ?? 0;

    if (stage === 0) {
      // Seedling: tiny green dot
      ctx.fillStyle = '#5a9a3a';
      ctx.fillRect(px + HS - 1, py + HS, 2, HS - 1);

    } else if (stage === 1) {
      // Young: stem + small leaves
      ctx.fillStyle = '#4a9a28';
      ctx.fillRect(px + HS - 1, py + QS + 2, 2, HS + 2); // stem
      ctx.fillRect(px + QS,     py + HS - 1, QS, 2);     // left leaf
      ctx.fillRect(px + HS,     py + HS - 1, QS, 2);     // right leaf

    } else {
      // Mature: fuller bush
      ctx.fillStyle = '#38881a';
      // Trunk
      ctx.fillRect(px + HS - 1, py + HS, 2, QS + 1);
      // Foliage circle
      ctx.beginPath();
      ctx.arc(px + HS, py + QS + 3, QS + 1, 0, Math.PI * 2);
      ctx.fillStyle = '#4aaa28';
      ctx.fill();
      ctx.fillStyle = '#5ac030';
      ctx.beginPath();
      ctx.arc(px + HS - 1, py + QS + 1, QS - 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Herbivore (sheep-like) ───────────────────────────────────────────────────

  _drawHerbivore(ctx, px, py, e) {
    const hungry = e.hunger > 0.65;
    const body   = hungry ? '#c8b840' : '#f0e070';
    const head   = hungry ? '#b0a030' : '#d8c858';

    // Body (fluffy oval)
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(px + HS, py + HS + 1, QS + 2, QS, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(px + HS, py + QS + 1, QS - 1, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(px + HS - 2, py + QS, 1, 1);
    ctx.fillRect(px + HS + 1, py + QS, 1, 1);

    // State indicator dot (gestating = pink)
    if (e.gestating) {
      ctx.fillStyle = '#ff80c0';
      ctx.fillRect(px + TS - 3, py + 1, 3, 3);
    }
  }

  // ── Predator (wolf-like) ─────────────────────────────────────────────────────

  _drawPredator(ctx, px, py, e) {
    const hungry = e.hunger > 0.65;
    const body   = hungry ? '#8a1a1a' : '#c03030';
    const head   = hungry ? '#701010' : '#a02020';

    // Body
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(px + HS, py + HS + 2, QS + 3, QS, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head (angular)
    ctx.fillStyle = head;
    ctx.fillRect(px + QS, py + QS, QS + 2, QS + 1);

    // Ears
    ctx.fillStyle = '#601010';
    ctx.fillRect(px + QS,         py + QS - 2, 2, 3);
    ctx.fillRect(px + QS + 4, py + QS - 2, 2, 3);

    // Eyes (red glow)
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(px + QS + 1, py + QS + 1, 2, 2);
    ctx.fillRect(px + QS + 5, py + QS + 1, 2, 2);

    if (e.gestating) {
      ctx.fillStyle = '#ff80c0';
      ctx.fillRect(px + TS - 3, py + 1, 3, 3);
    }
  }

  // ── Human ────────────────────────────────────────────────────────────────────

  _drawHuman(ctx, px, py, e) {
    const hungry = e.hunger > 0.65;
    const skin   = hungry ? '#a07040' : '#d49060';
    const shirt  = hungry ? '#5060a0' : '#6070c0';

    // Legs
    ctx.fillStyle = '#404870';
    ctx.fillRect(px + HS - 3, py + HS + 3, 2, QS);
    ctx.fillRect(px + HS + 1, py + HS + 3, 2, QS);

    // Body
    ctx.fillStyle = shirt;
    ctx.fillRect(px + HS - 3, py + QS + 3, 6, QS + 2);

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(px + HS, py + QS + 1, QS - 1, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(px + HS - 2, py + QS,     1, 1);
    ctx.fillRect(px + HS + 1, py + QS,     1, 1);

    // Sex indicator (small hat for female)
    if (e.sex === 'F') {
      ctx.fillStyle = '#d06080';
      ctx.fillRect(px + HS - 3, py + QS - 2, 6, 2);
    }

    if (e.gestating) {
      ctx.fillStyle = '#ff80c0';
      ctx.fillRect(px + TS - 3, py + 1, 3, 3);
    }
  }

  // ── Selection highlight ──────────────────────────────────────────────────────

  drawHighlight(ctx, entity, color = '#ffffff') {
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(entity.tileX * TS + 0.5, entity.tileY * TS + 0.5, TS - 1, TS - 1);
  }
}
