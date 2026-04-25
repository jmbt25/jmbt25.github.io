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

// Per-vertex Y jitter range, by terrain. Bigger = more dramatic surface.
const ELEV_JITTER = new Float32Array(7);
ELEV_JITTER[TERRAIN.WATER]    = 0.0;
ELEV_JITTER[TERRAIN.SAND]     = 0.05;
ELEV_JITTER[TERRAIN.GRASS]    = 0.18;
ELEV_JITTER[TERRAIN.FOREST]   = 0.28;
ELEV_JITTER[TERRAIN.DIRT]     = 0.18;
ELEV_JITTER[TERRAIN.MOUNTAIN] = 1.40;
ELEV_JITTER[TERRAIN.SNOW]     = 1.10;

// Per-tile X/Z lateral jitter — breaks up the perfect grid look.
const LATERAL_JITTER = 0.18;

export function getTerrainElevation(t) {
  return TERRAIN_ELEVATION[t];
}

function tileVariant(x, y) {
  const h = Math.imul(x * 2246822519, y * 2654435761) >>> 0;
  return (h & 0xff) / 255;
}

// Deterministic per-vertex hash → 3 random floats in [-1, 1]
function vertHash(vx, vy) {
  let h = Math.imul(vx | 0, 374761393) ^ Math.imul(vy | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const a = (h >>> 0) / 0xffffffff;
  h = Math.imul(h ^ (h >>> 17), 2246822519);
  const b = (h >>> 0) / 0xffffffff;
  h = Math.imul(h ^ (h >>> 11), 3266489917);
  const c = (h >>> 0) / 0xffffffff;
  return [a * 2 - 1, b * 2 - 1, c * 2 - 1];
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
      roughness:    0.92,
      metalness:    0.0,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'terrain';
    this.mesh.castShadow    = true;
    this.mesh.receiveShadow = true;

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
    const VW = WORLD_WIDTH + 1;
    const positions = this._positions;
    const colors    = this._colors;

    for (let vy = 0; vy <= WORLD_HEIGHT; vy++) {
      for (let vx = 0; vx <= WORLD_WIDTH; vx++) {
        let sumH = 0, sumR = 0, sumG = 0, sumB = 0, count = 0;
        // Track terrain-weighted lateral + elevation jitter scale
        let jitterScale = 0;
        let isMountainous = false;
        let isWater = false;
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
            jitterScale += ELEV_JITTER[t];
            if (t === TERRAIN.MOUNTAIN || t === TERRAIN.SNOW) isMountainous = true;
            if (t === TERRAIN.WATER) isWater = true;
            count++;
          }
        }
        const idx = vy * VW + vx;
        const inv = count > 0 ? 1 / count : 0;
        const baseH = sumH * inv;
        const baseScale = jitterScale * inv;

        const [jx, jy, jz] = vertHash(vx, vy);

        // Lateral jitter — only on edges between non-water tiles. Don't jitter
        // border vertices (vx==0 / WORLD_WIDTH etc.) so the world stays a clean rect.
        const onBorder = vx === 0 || vy === 0 || vx === WORLD_WIDTH || vy === WORLD_HEIGHT;
        const latX = onBorder || isWater ? 0 : jx * LATERAL_JITTER;
        const latZ = onBorder || isWater ? 0 : jz * LATERAL_JITTER;

        // Elevation jitter — uniform, but mountains spike higher (jy^3 keeps small jitter
        // small but lets occasional vertices spike to make peaks).
        let elevJ = jy * baseScale;
        if (isMountainous) {
          const spike = Math.sign(jy) * Math.pow(Math.abs(jy), 0.7);
          elevJ = spike * baseScale;
        }

        positions[idx * 3 + 0] = vx + latX;
        positions[idx * 3 + 1] = baseH + elevJ;
        positions[idx * 3 + 2] = vy + latZ;
        colors[idx * 3 + 0] = sumR * inv;
        colors[idx * 3 + 1] = sumG * inv;
        colors[idx * 3 + 2] = sumB * inv;
      }
    }

    // Snow caps: a second pass that lifts the very highest mountain peaks toward
    // the snow palette. Cheap because most vertices are unaffected.
    for (let vy = 0; vy <= WORLD_HEIGHT; vy++) {
      for (let vx = 0; vx <= WORLD_WIDTH; vx++) {
        const idx = vy * VW + vx;
        const y = positions[idx * 3 + 1];
        if (y > 4.0) {
          // Blend toward white-ish
          const mix = THREE.MathUtils.clamp((y - 4.0) / 1.5, 0, 0.85);
          colors[idx * 3 + 0] = colors[idx * 3 + 0] * (1 - mix) + 0.92 * mix;
          colors[idx * 3 + 1] = colors[idx * 3 + 1] * (1 - mix) + 0.95 * mix;
          colors[idx * 3 + 2] = colors[idx * 3 + 2] * (1 - mix) + 1.00 * mix;
        }
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
