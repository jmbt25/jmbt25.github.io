import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../core/constants.js';
import { TERRAIN, TERRAIN_COLOR, TERRAIN_COLOR2 } from '../world/TerrainType.js';

const TERRAIN_ELEVATION = new Float32Array(7);
TERRAIN_ELEVATION[TERRAIN.WATER]    = -1.5;
TERRAIN_ELEVATION[TERRAIN.SAND]     =  0.0;
TERRAIN_ELEVATION[TERRAIN.GRASS]    =  0.5;
TERRAIN_ELEVATION[TERRAIN.FOREST]   =  1.0;
TERRAIN_ELEVATION[TERRAIN.DIRT]     =  0.3;
TERRAIN_ELEVATION[TERRAIN.MOUNTAIN] =  3.5;
TERRAIN_ELEVATION[TERRAIN.SNOW]     =  4.5;

export function getTerrainElevation(t) {
  return TERRAIN_ELEVATION[t];
}

function tileVariant(x, y) {
  const h = Math.imul(x * 2246822519, y * 2654435761) >>> 0;
  return (h & 0xff) / 255;
}

const _colorCache = new Map();
function hexToRGB(hex) {
  let v = _colorCache.get(hex);
  if (v) return v;
  const c = new THREE.Color(hex);
  v = { r: c.r, g: c.g, b: c.b };
  _colorCache.set(hex, v);
  return v;
}

export class TileRenderer3D {
  constructor() {
    const VW = WORLD_WIDTH + 1;
    const VH = WORLD_HEIGHT + 1;
    const numVertices = VW * VH;
    const numQuads    = WORLD_WIDTH * WORLD_HEIGHT;

    this._positions = new Float32Array(numVertices * 3);
    this._colors    = new Float32Array(numVertices * 3);
    const indices   = new Uint32Array(numQuads * 6);

    let i = 0;
    for (let vy = 0; vy < WORLD_HEIGHT; vy++) {
      for (let vx = 0; vx < WORLD_WIDTH; vx++) {
        const tl = vy * VW + vx;
        const tr = tl + 1;
        const bl = tl + VW;
        const br = bl + 1;
        indices[i++] = tl;
        indices[i++] = bl;
        indices[i++] = tr;
        indices[i++] = tr;
        indices[i++] = bl;
        indices[i++] = br;
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    this.geometry.setAttribute('color',    new THREE.BufferAttribute(this._colors,    3));

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading:  true,
      roughness:    0.95,
      metalness:    0.0,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'terrain';

    const cursorGeom = new THREE.PlaneGeometry(1, 1);
    cursorGeom.rotateX(-Math.PI / 2);
    cursorGeom.translate(0.5, 0, 0.5);
    const cursorMat = new THREE.MeshBasicMaterial({
      color:        0xffffff,
      transparent:  true,
      opacity:      0.35,
      depthWrite:   false,
    });
    this.cursor = new THREE.Mesh(cursorGeom, cursorMat);
    this.cursor.visible = false;
  }

  rebuild(world) {
    const VW = WORLD_WIDTH + 1;
    const positions = this._positions;
    const colors    = this._colors;

    for (let vy = 0; vy <= WORLD_HEIGHT; vy++) {
      for (let vx = 0; vx <= WORLD_WIDTH; vx++) {
        let sumH = 0, sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = -1; dy <= 0; dy++) {
          for (let dx = -1; dx <= 0; dx++) {
            const tx = vx + dx;
            const ty = vy + dy;
            if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) continue;
            const t = world.getTerrain(tx, ty);
            const v = tileVariant(tx, ty);
            const hex = v > 0.65 ? TERRAIN_COLOR2[t] : TERRAIN_COLOR[t];
            const rgb = hexToRGB(hex);
            sumH += TERRAIN_ELEVATION[t];
            sumR += rgb.r; sumG += rgb.g; sumB += rgb.b;
            count++;
          }
        }
        const idx = vy * VW + vx;
        const inv = count > 0 ? 1 / count : 0;
        positions[idx * 3 + 0] = vx;
        positions[idx * 3 + 1] = sumH * inv;
        positions[idx * 3 + 2] = vy;
        colors[idx * 3 + 0] = sumR * inv;
        colors[idx * 3 + 1] = sumG * inv;
        colors[idx * 3 + 2] = sumB * inv;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate    = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  /** Smooth surface elevation at the centre of tile (tx, ty). */
  getElevationAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return 0;
    const VW = WORLD_WIDTH + 1;
    const p  = this._positions;
    const tl = ty * VW + tx;
    const tr = tl + 1;
    const bl = tl + VW;
    const br = bl + 1;
    return 0.25 * (
      p[tl * 3 + 1] + p[tr * 3 + 1] + p[bl * 3 + 1] + p[br * 3 + 1]
    );
  }

  setCursorTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) {
      this.cursor.visible = false;
      return;
    }
    const elev = this.getElevationAt(tx, ty);
    this.cursor.position.set(tx, elev + 0.05, ty);
    this.cursor.visible = true;
  }

  clearCursor() {
    this.cursor.visible = false;
  }
}
