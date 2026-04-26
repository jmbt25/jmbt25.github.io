import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';
import { TERRAIN, TERRAIN_COLOR, TERRAIN_COLOR2 } from '../world/TerrainType.js';

/**
 * Voxel terrain — one stretched cube per tile via a single InstancedMesh.
 *
 * Each tile is a 1×H×1 cube whose TOP face sits at TERRAIN_ELEVATION[t]
 * (matching the values the rest of the renderer expects). Bottom of every
 * cube is anchored at y = WORLD_FLOOR_Y so all sides are visible from low
 * camera angles.  Per-instance colour gives terrain identity; a small
 * deterministic per-tile y-jitter breaks up the perfect grid.
 *
 * External interface preserved:
 *   .mesh                 — the THREE.Object3D added to the scene
 *   .rebuild(world)       — re-write all instance matrices + colours
 *   .getElevationAt(x, y) — surface Y at the centre of (x, y)
 *   .setCursorTile / .clearCursor — hover indicator
 */

const WORLD_FLOOR_Y = -2.4;     // bottom of every cube — keeps water sides visible

const TERRAIN_ELEVATION = new Float32Array(7);
TERRAIN_ELEVATION[TERRAIN.WATER]    = -1.5;
TERRAIN_ELEVATION[TERRAIN.SAND]     =  0.0;
TERRAIN_ELEVATION[TERRAIN.GRASS]    =  0.5;
TERRAIN_ELEVATION[TERRAIN.FOREST]   =  1.0;
TERRAIN_ELEVATION[TERRAIN.DIRT]     =  0.3;
TERRAIN_ELEVATION[TERRAIN.MOUNTAIN] =  3.5;
TERRAIN_ELEVATION[TERRAIN.SNOW]     =  4.5;

// Per-tile vertical jitter range — kept tiny so cubes still align to a clean grid.
const Y_JITTER = new Float32Array(7);
Y_JITTER[TERRAIN.WATER]    = 0.0;
Y_JITTER[TERRAIN.SAND]     = 0.04;
Y_JITTER[TERRAIN.GRASS]    = 0.06;
Y_JITTER[TERRAIN.FOREST]   = 0.10;
Y_JITTER[TERRAIN.DIRT]     = 0.06;
Y_JITTER[TERRAIN.MOUNTAIN] = 0.45;     // peaks vary noticeably
Y_JITTER[TERRAIN.SNOW]     = 0.55;

export function getTerrainElevation(t) {
  return TERRAIN_ELEVATION[t];
}

function tileVariant(x, y) {
  const h = Math.imul(x * 2246822519, y * 2654435761) >>> 0;
  return (h & 0xff) / 255;
}

function tileJitter(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h >>> 0) / 0xffffffff) * 2 - 1;   // [-1, 1]
}

const _colorCache = new Map();
function hexToColor(hex) {
  let v = _colorCache.get(hex);
  if (v) return v;
  v = new THREE.Color(hex);
  _colorCache.set(hex, v);
  return v;
}

export class TileRenderer3D {
  constructor() {
    const total = WORLD_WIDTH * WORLD_HEIGHT;

    // BoxGeometry centred at origin so position+scale anchor the cube nicely.
    const boxGeom = new THREE.BoxGeometry(1, 1, 1);
    // Slight bevel: shave the side walls in by 1% so cube edges cast a thin
    // shadow line — gives the voxel look from a screenshot at any angle.
    boxGeom.translate(0, 0, 0);

    const material = new THREE.MeshStandardMaterial({
      vertexColors: false,
      flatShading:  true,
      roughness:    0.92,
      metalness:    0.02,
    });

    this.mesh = new THREE.InstancedMesh(boxGeom, material, total);
    this.mesh.name = 'terrain';
    this.mesh.castShadow    = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this._dummy  = new THREE.Object3D();
    this._tmpCol = new THREE.Color();

    // Cache per-tile surface Y so getElevationAt is O(1).
    this._surfaceY = new Float32Array(total);

    // Cursor — flat plane that conforms to terrain at the hovered tile.
    const cursorGeom = new THREE.PlaneGeometry(1, 1);
    cursorGeom.rotateX(-Math.PI / 2);
    const cursorMat = new THREE.MeshBasicMaterial({
      color:        0xffffff,
      transparent:  true,
      opacity:      0.16,
      depthWrite:   false,
    });
    this.cursor = new THREE.Mesh(cursorGeom, cursorMat);
    this.cursor.visible = false;

    const outlineGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.02, 1));
    const outlineMat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false,
    });
    this.cursorOutline = new THREE.LineSegments(outlineGeom, outlineMat);
    this.cursorOutline.renderOrder = 999;
    this.cursorOutline.visible = false;
    this.cursor.add(this.cursorOutline);
  }

  rebuild(world) {
    const dummy = this._dummy;
    const col   = this._tmpCol;

    let i = 0;
    for (let ty = 0; ty < WORLD_HEIGHT; ty++) {
      for (let tx = 0; tx < WORLD_WIDTH; tx++) {
        const t = world.getTerrain(tx, ty);

        const baseTop  = TERRAIN_ELEVATION[t];
        const jitter   = tileJitter(tx, ty) * Y_JITTER[t];
        const top      = baseTop + jitter;
        const height   = Math.max(0.05, top - WORLD_FLOOR_Y);
        const centerY  = WORLD_FLOOR_Y + height * 0.5;

        dummy.position.set(tx + 0.5, centerY, ty + 0.5);
        dummy.scale.set(1, height, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);

        // Colour: alternate primary/secondary palette by per-tile hash, then
        // gently tint snow tiles brighter the higher they spike.
        const v   = tileVariant(tx, ty);
        const hex = v > 0.55 ? TERRAIN_COLOR2[t] : TERRAIN_COLOR[t];
        col.copy(hexToColor(hex));

        if (t === TERRAIN.MOUNTAIN || t === TERRAIN.SNOW) {
          // Snowier near the top — peaks read as white-capped without a
          // separate mesh.
          const snowMix = Math.max(0, Math.min(0.85, (top - 3.6) / 1.4));
          col.lerp(_SNOW_TINT, snowMix);
        }

        // Per-tile micro brightness jitter for individuality.
        const lj = (tileVariant(tx + 19, ty + 7) - 0.5) * 0.06;
        col.r = Math.max(0, Math.min(1, col.r + lj));
        col.g = Math.max(0, Math.min(1, col.g + lj));
        col.b = Math.max(0, Math.min(1, col.b + lj));

        this.mesh.setColorAt(i, col);

        this._surfaceY[i] = top;
        i++;
      }
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.mesh.computeBoundingBox();
  }

  /** Surface Y at the centre of tile (tx, ty). */
  getElevationAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return 0;
    return this._surfaceY[ty * WORLD_WIDTH + tx];
  }

  setCursorTile(tx, ty, brushSize = 1) {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) {
      this.cursor.visible = false;
      this.cursorOutline.visible = false;
      return;
    }
    const elev = this.getElevationAt(tx, ty);
    this.cursor.position.set(tx + 0.5, elev + 0.05, ty + 0.5);
    this.cursor.scale.set(brushSize, 1, brushSize);
    this.cursor.visible = true;
    this.cursorOutline.visible = true;
  }

  clearCursor() {
    this.cursor.visible = false;
    this.cursorOutline.visible = false;
  }
}

const _SNOW_TINT = new THREE.Color('#f1f8ff');
