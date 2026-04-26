let _nextId = 1;

export class Entity {
  constructor(type, tileX, tileY) {
    this.id    = _nextId++;
    this.type  = type;
    this.tileX = tileX;
    this.tileY = tileY;
    this.alive = true;
    this.age   = 0;
    // Wall-clock stamp of construction. Renderer reads this to grow the
    // entity's scale from 0 → 1 over a short window so spawns don't pop in.
    this.bornAt = (typeof performance !== 'undefined') ? performance.now() : 0;

    // ── Motion interpolation (read by renderer) ────────────────────────────
    // prevTileX/Y is where we were before the most recent move.
    // moveStartedAt is performance.now() at the moment of the move.
    // moveDurationMs is how long the slide should visually take.
    this.prevTileX     = tileX;
    this.prevTileY     = tileY;
    this.moveStartedAt = 0;
    this.moveDurationMs = 0;

    // Facing direction in radians around the Y axis (0 = +X). Renderer rotates
    // composite body parts by this. Updated whenever the entity moves.
    this.heading = 0;

    // Optional fields populated by traits / civ system. Listed here so renderer
    // and inspector can read them without `?? defaults` everywhere:
    this.scale     = 1;
    this.strength  = 1;
    this.trait     = null;     // {id, name, desc} or null
    this.tribeId   = null;     // humans only
  }
}
