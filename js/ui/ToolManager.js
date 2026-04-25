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

const TOOL_TO_TERRAIN = {
  [TOOL.TERRAIN_WATER]:    TERRAIN.WATER,
  [TOOL.TERRAIN_GRASS]:    TERRAIN.GRASS,
  [TOOL.TERRAIN_FOREST]:   TERRAIN.FOREST,
  [TOOL.TERRAIN_DIRT]:     TERRAIN.DIRT,
  [TOOL.TERRAIN_MOUNTAIN]: TERRAIN.MOUNTAIN,
  [TOOL.TERRAIN_SAND]:     TERRAIN.SAND,
};

const TOOL_TO_ENTITY = {
  [TOOL.SPAWN_PLANT]:     TYPE.PLANT,
  [TOOL.SPAWN_HERBIVORE]: TYPE.HERBIVORE,
  [TOOL.SPAWN_PREDATOR]:  TYPE.PREDATOR,
  [TOOL.SPAWN_HUMAN]:     TYPE.HUMAN,
};

const TERRAIN_TOOL_SET = new Set(Object.keys(TOOL_TO_TERRAIN));

export class ToolManager {
  constructor(canvas, world, registry, renderer, onInspect, getBrushSize = () => 1) {
    this.canvas    = canvas;
    this.world     = world;
    this.registry  = registry;
    this.renderer  = renderer;
    this.onInspect = onInspect;
    this.getBrushSize = getBrushSize;

    this.activeTool = TOOL.SPAWN_HERBIVORE;
    this._pressing  = false;

    this._bind();
  }

  setTool(tool) {
    this.activeTool = tool;
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    // Cursor hint: erase-mode swaps to "no" cursor, inspect to pointer.
    if (this.canvas) {
      if (tool === TOOL.INSPECT)        this.canvas.style.cursor = 'pointer';
      else if (tool === TOOL.ERASE)     this.canvas.style.cursor = 'cell';
      else                              this.canvas.style.cursor = 'crosshair';
    }
  }

  _bind() {
    const el = this.canvas;
    el.addEventListener('pointerdown',  e => this._onDown(e));
    el.addEventListener('pointermove',  e => this._onMove(e));
    el.addEventListener('pointerup',    e => this._onUp(e));
    el.addEventListener('pointerleave', e => this._onUp(e));
    el.addEventListener('contextmenu',  e => e.preventDefault());
  }

  _getCanvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _isTerrainTool() { return TERRAIN_TOOL_SET.has(this.activeTool); }
  _effectiveBrush() {
    return this._isTerrainTool() ? Math.max(1, this.getBrushSize() | 0) : 1;
  }

  _onDown(e) {
    if (e.button !== 0) return;
    const pos = this._getCanvasPos(e);
    this._pressing = true;
    this._applyTool(pos.x, pos.y);
  }

  _onMove(e) {
    const pos = this._getCanvasPos(e);
    const tile = this.renderer.raycastTile(pos.x, pos.y);
    if (tile) {
      this.renderer.setCursorTile(tile.x, tile.y, this._effectiveBrush());
    } else {
      this.renderer.clearCursor();
    }
    if (this._pressing) this._applyTool(pos.x, pos.y);
  }

  _onUp() { this._pressing = false; }

  _applyTool(screenX, screenY) {
    const tile = this.renderer.raycastTile(screenX, screenY);
    if (!tile) return;
    const { x: cx, y: cy } = tile;
    if (!this.world.inBounds(cx, cy)) return;

    const tool = this.activeTool;
    const brush = this._effectiveBrush();
    const half  = (brush - 1) >> 1;     // 1→0, 2→0, 3→1, 5→2

    if (TOOL_TO_TERRAIN[tool] !== undefined) {
      for (let dy = -half; dy < brush - half; dy++) {
        for (let dx = -half; dx < brush - half; dx++) {
          const x = cx + dx, y = cy + dy;
          if (this.world.inBounds(x, y)) {
            this.world.setTerrain(x, y, TOOL_TO_TERRAIN[tool]);
          }
        }
      }
      this.renderer.rebuildTerrain();
      return;
    }

    if (TOOL_TO_ENTITY[tool]) {
      const type = TOOL_TO_ENTITY[tool];
      if (type === TYPE.PLANT) {
        if (this.world.getFertility(cx, cy) > 0) this.registry.spawn(type, cx, cy);
      } else {
        if (this.world.isPassable(cx, cy)) this.registry.spawn(type, cx, cy);
      }
      return;
    }

    if (tool === TOOL.ERASE) {
      for (const id of [...this.world.getEntitiesAt(cx, cy)]) {
        this.registry.killById(id);
      }
      return;
    }

    if (tool === TOOL.INSPECT) {
      const pick = this._pickInspectTarget(cx, cy);
      this.renderer.highlighted = pick || null;
      this.onInspect(pick || null);
    }
  }

  /**
   * Pick a creature to inspect. Sim ticks move entities discretely from tile
   * to tile while the renderer interpolates between them, so the user often
   * clicks on a tile that's "between" the creature's old and new tile. We
   * forgive that by searching outward up to 2 tiles, preferring creatures
   * over plants and the closest one to the click.
   */
  _pickInspectTarget(cx, cy) {
    const RADIUS = 2;
    let best = null, bestRank = Infinity;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!this.world.inBounds(x, y)) continue;
        const ids = this.world.getEntitiesAt(x, y);
        if (!ids || !ids.size) continue;
        for (const id of ids) {
          const e = this.registry.get(id);
          if (!e?.alive) continue;
          // Distance + creature-preference bias. Plants are weighted higher
          // (worse) so they're only picked when nothing else is around.
          const dist = Math.abs(dx) + Math.abs(dy);
          const isPlant = e.type === TYPE.PLANT;
          const rank = dist + (isPlant ? 5 : 0);
          if (rank < bestRank) {
            bestRank = rank;
            best = e;
          }
        }
      }
    }
    return best;
  }
}
