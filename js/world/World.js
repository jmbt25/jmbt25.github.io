import { WORLD_WIDTH, WORLD_HEIGHT, HUT_FARM_RADIUS } from '../core/constants.js';
import { TERRAIN, isPassable, getFertility } from './TerrainType.js';

export class World {
  constructor() {
    this.width  = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;

    // Flat typed array of terrain IDs — very cache-friendly
    this.terrain = new Uint8Array(this.width * this.height);

    // Per-tile entity ID sets — used for spatial queries and hit-testing
    // Indexed by the same flat idx(x,y)
    this.tileEntities = Array.from(
      { length: this.width * this.height },
      () => new Set(),
    );

    // Per-tile count of nearby huts. addHutInfluence/removeHutInfluence keep
    // it in sync as buildings are born and die. Plants and humans read it
    // cheaply to apply farm bonuses.
    this.hutInfluence = new Uint16Array(this.width * this.height);
  }

  // ── Hut influence (farm radius) ─────────────────────────────────────────────
  addHutInfluence(cx, cy)    { this._stampHut(cx, cy, +1); }
  removeHutInfluence(cx, cy) { this._stampHut(cx, cy, -1); }

  isNearHut(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.hutInfluence[this.idx(x, y)] > 0;
  }

  _stampHut(cx, cy, delta) {
    const r = HUT_FARM_RADIUS;
    const r2 = r * r;
    const x0 = Math.max(0, cx - r);
    const y0 = Math.max(0, cy - r);
    const x1 = Math.min(this.width  - 1, cx + r);
    const y1 = Math.min(this.height - 1, cy + r);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          const i = this.idx(x, y);
          // Guard against underflow if an entity:died fires for a hut that
          // was already cleared by registry.clear() — the typed array would
          // wrap to 65535.
          if (delta < 0 && this.hutInfluence[i] === 0) continue;
          this.hutInfluence[i] += delta;
        }
      }
    }
  }

  /** Wipe all hut influence — used by the regen path. */
  clearHutInfluence() {
    this.hutInfluence.fill(0);
  }

  // ── Coordinate helpers ──────────────────────────────────────────────────────

  idx(x, y)       { return y * this.width + x; }
  inBounds(x, y)  { return x >= 0 && x < this.width && y >= 0 && y < this.height; }

  // ── Terrain ─────────────────────────────────────────────────────────────────

  getTerrain(x, y) {
    if (!this.inBounds(x, y)) return TERRAIN.MOUNTAIN;
    return this.terrain[this.idx(x, y)];
  }

  setTerrain(x, y, type) {
    if (!this.inBounds(x, y)) return;
    this.terrain[this.idx(x, y)] = type;
  }

  isPassable(x, y)   { return isPassable(this.getTerrain(x, y)); }
  getFertility(x, y) { return getFertility(this.getTerrain(x, y)); }

  // ── Entity spatial tracking ─────────────────────────────────────────────────
  // These are called by EntityRegistry whenever an entity is born, dies, or moves.

  registerEntity(entity) {
    if (this.inBounds(entity.tileX, entity.tileY))
      this.tileEntities[this.idx(entity.tileX, entity.tileY)].add(entity.id);
  }

  unregisterEntity(entity) {
    if (this.inBounds(entity.tileX, entity.tileY))
      this.tileEntities[this.idx(entity.tileX, entity.tileY)].delete(entity.id);
  }

  // Move an entity's tile-registration atomically.
  moveEntityRecord(entity, newX, newY) {
    this.unregisterEntity(entity);
    entity.tileX = newX;
    entity.tileY = newY;
    this.registerEntity(entity);
  }

  /** Returns the Set<id> for a tile (may be empty, never null). */
  getEntitiesAt(x, y) {
    if (!this.inBounds(x, y)) return _EMPTY_SET;
    return this.tileEntities[this.idx(x, y)];
  }
}

const _EMPTY_SET = new Set();
