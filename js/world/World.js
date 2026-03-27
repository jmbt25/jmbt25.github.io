import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';
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
