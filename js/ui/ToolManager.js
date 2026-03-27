import { TYPE }    from '../core/constants.js';
import { TERRAIN } from '../world/TerrainType.js';

export const TOOL = Object.freeze({
  INSPECT:          'inspect',
  ERASE:            'erase',
  SPAWN_PLANT:      'spawn_plant',
  SPAWN_HERBIVORE:  'spawn_herbivore',
  SPAWN_PREDATOR:   'spawn_predator',
  SPAWN_HUMAN:      'spawn_human',
  TERRAIN_WATER:    'terrain_water',
  TERRAIN_GRASS:    'terrain_grass',
  TERRAIN_FOREST:   'terrain_forest',
  TERRAIN_DIRT:     'terrain_dirt',
  TERRAIN_MOUNTAIN: 'terrain_mountain',
  TERRAIN_SAND:     'terrain_sand',
});

// Map tool id → terrain type constant
const TOOL_TO_TERRAIN = {
  [TOOL.TERRAIN_WATER]:    TERRAIN.WATER,
  [TOOL.TERRAIN_GRASS]:    TERRAIN.GRASS,
  [TOOL.TERRAIN_FOREST]:   TERRAIN.FOREST,
  [TOOL.TERRAIN_DIRT]:     TERRAIN.DIRT,
  [TOOL.TERRAIN_MOUNTAIN]: TERRAIN.MOUNTAIN,
  [TOOL.TERRAIN_SAND]:     TERRAIN.SAND,
};

// Map tool id → entity type string
const TOOL_TO_ENTITY = {
  [TOOL.SPAWN_PLANT]:     TYPE.PLANT,
  [TOOL.SPAWN_HERBIVORE]: TYPE.HERBIVORE,
  [TOOL.SPAWN_PREDATOR]:  TYPE.PREDATOR,
  [TOOL.SPAWN_HUMAN]:     TYPE.HUMAN,
};

export class ToolManager {
  constructor(canvas, world, registry, camera, renderer, onInspect) {
    this.canvas    = canvas;
    this.world     = world;
    this.registry  = registry;
    this.camera    = camera;
    this.renderer  = renderer;
    this.onInspect = onInspect;   // callback(entity | null)

    this.activeTool = TOOL.SPAWN_HERBIVORE;
    this._pressing  = false;
    this._panning   = false;
    this._lastPos   = { x: 0, y: 0 };
    this._pinchDist = null;

    this._bind();
  }

  setTool(tool) {
    this.activeTool = tool;
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  _bind() {
    const el = this.canvas;
    el.addEventListener('pointerdown',  e => this._onDown(e));
    el.addEventListener('pointermove',  e => this._onMove(e));
    el.addEventListener('pointerup',    e => this._onUp(e));
    el.addEventListener('pointerleave', e => this._onUp(e));
    el.addEventListener('wheel',        e => this._onWheel(e), { passive: false });
    el.addEventListener('contextmenu',  e => e.preventDefault());

    // Touch pinch-to-zoom
    el.addEventListener('touchstart',  e => this._onTouchStart(e),  { passive: false });
    el.addEventListener('touchmove',   e => this._onTouchMove(e),   { passive: false });
    el.addEventListener('touchend',    e => this._onTouchEnd(e));
  }

  _getCanvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── Mouse ──────────────────────────────────────────────────────────────────

  _onDown(e) {
    const pos = this._getCanvasPos(e);

    if (e.button === 1 || e.button === 2) {
      this._panning = true;
      this._lastPos = pos;
      return;
    }

    this._pressing = true;
    this._lastPos  = pos;
    this._applyTool(pos.x, pos.y);
  }

  _onMove(e) {
    const pos = this._getCanvasPos(e);
    const tile = this.camera.screenToTile(pos.x, pos.y);
    this.renderer.setCursorTile(tile.x, tile.y);

    if (this._panning) {
      this.camera.pan(pos.x - this._lastPos.x, pos.y - this._lastPos.y);
    } else if (this._pressing) {
      this._applyTool(pos.x, pos.y);
    }

    this._lastPos = pos;
  }

  _onUp(e) {
    this._pressing = false;
    this._panning  = false;
  }

  _onWheel(e) {
    e.preventDefault();
    const pos    = this._getCanvasPos(e);
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    this.camera.zoomAt(factor, pos.x, pos.y);
  }

  // ── Touch pinch ───────────────────────────────────────────────────────────

  _onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      this._pinchDist = this._touchDist(e.touches);
    } else if (e.touches.length === 1) {
      const t   = e.touches[0];
      const r   = this.canvas.getBoundingClientRect();
      const pos = { x: t.clientX - r.left, y: t.clientY - r.top };
      this._pressing = true;
      this._lastPos  = pos;
      this._applyTool(pos.x, pos.y);
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2 && this._pinchDist !== null) {
      const newDist = this._touchDist(e.touches);
      const cx      = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy      = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const r       = this.canvas.getBoundingClientRect();
      this.camera.zoomAt(newDist / this._pinchDist, cx - r.left, cy - r.top);
      this._pinchDist = newDist;
    } else if (e.touches.length === 1 && this._pressing) {
      const t   = e.touches[0];
      const r   = this.canvas.getBoundingClientRect();
      const pos = { x: t.clientX - r.left, y: t.clientY - r.top };
      this._applyTool(pos.x, pos.y);
      this._lastPos = pos;
    }
  }

  _onTouchEnd(e) {
    this._pressing  = false;
    this._pinchDist = null;
  }

  _touchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Tool application ───────────────────────────────────────────────────────

  _applyTool(screenX, screenY) {
    const { x, y } = this.camera.screenToTile(screenX, screenY);
    if (!this.world.inBounds(x, y)) return;

    const tool = this.activeTool;

    // Terrain paint
    if (TOOL_TO_TERRAIN[tool] !== undefined) {
      this.world.setTerrain(x, y, TOOL_TO_TERRAIN[tool]);
      this.renderer.tileRenderer.invalidate();
      return;
    }

    // Entity spawn
    if (TOOL_TO_ENTITY[tool]) {
      const type = TOOL_TO_ENTITY[tool];
      if (type === TYPE.PLANT) {
        if (this.world.getFertility(x, y) > 0) this.registry.spawn(type, x, y);
      } else {
        if (this.world.isPassable(x, y)) this.registry.spawn(type, x, y);
      }
      return;
    }

    // Erase
    if (tool === TOOL.ERASE) {
      for (const id of [...this.world.getEntitiesAt(x, y)]) {
        this.registry.killById(id);
      }
      return;
    }

    // Inspect
    if (tool === TOOL.INSPECT) {
      const ids  = [...this.world.getEntitiesAt(x, y)];
      const ent  = ids.length ? this.registry.get(ids[0]) : null;
      this.renderer.highlighted = ent || null;
      this.onInspect(ent || null, x, y);
    }
  }
}
