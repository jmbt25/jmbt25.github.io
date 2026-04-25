import * as THREE from 'three';
import { TYPE, MAX_ENTITIES } from '../core/constants.js';

const PLANT_COLOR     = new THREE.Color('#50c040');
const HERBIVORE_COLOR = new THREE.Color('#f0d040');
const PREDATOR_COLOR  = new THREE.Color('#d04040');
const HUMAN_COLOR     = new THREE.Color('#e09050');
const HUNGRY_TINT     = new THREE.Color('#404040');
const GESTATING_TINT  = new THREE.Color('#ff80a0');

export class EntityRenderer3D {
  constructor() {
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();

    const plantGeom = new THREE.ConeGeometry(0.32, 0.7, 5);
    plantGeom.translate(0, 0.35, 0);
    const herbGeom = new THREE.SphereGeometry(0.32, 8, 6);
    herbGeom.translate(0, 0.32, 0);
    const predGeom = new THREE.BoxGeometry(0.6, 0.42, 0.6);
    predGeom.translate(0, 0.21, 0);
    const humanGeom = new THREE.CapsuleGeometry(0.18, 0.5, 3, 6);
    humanGeom.translate(0, 0.43, 0);

    const baseMat = () => new THREE.MeshStandardMaterial({
      vertexColors: false,
      roughness:    0.7,
      metalness:    0.0,
    });

    this.meshes = {
      [TYPE.PLANT]:     new THREE.InstancedMesh(plantGeom, baseMat(), MAX_ENTITIES),
      [TYPE.HERBIVORE]: new THREE.InstancedMesh(herbGeom,  baseMat(), MAX_ENTITIES),
      [TYPE.PREDATOR]:  new THREE.InstancedMesh(predGeom,  baseMat(), MAX_ENTITIES),
      [TYPE.HUMAN]:     new THREE.InstancedMesh(humanGeom, baseMat(), MAX_ENTITIES),
    };

    for (const m of Object.values(this.meshes)) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      // Allocate the per-instance color buffer
      m.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_ENTITIES * 3), 3,
      );
    }

    // Highlight ring shown around the inspected entity
    const ringGeom = new THREE.TorusGeometry(0.55, 0.06, 6, 16);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false,
    });
    this.highlight = new THREE.Mesh(ringGeom, ringMat);
    this.highlight.renderOrder = 999;
    this.highlight.visible = false;
  }

  /** Per-frame: sync instance matrices and colors from the entity registry. */
  update(registry, tileRenderer3d) {
    const counts = {
      [TYPE.PLANT]: 0, [TYPE.HERBIVORE]: 0, [TYPE.PREDATOR]: 0, [TYPE.HUMAN]: 0,
    };

    for (const ent of registry.getAll()) {
      if (!ent.alive) continue;
      const mesh = this.meshes[ent.type];
      if (!mesh) continue;
      const idx = counts[ent.type]++;
      if (idx >= MAX_ENTITIES) continue;

      const elev = tileRenderer3d.getElevationAt(ent.tileX, ent.tileY);
      const x = ent.tileX + 0.5;
      const z = ent.tileY + 0.5;
      const y = elev;

      this._dummy.position.set(x, y, z);
      this._dummy.rotation.set(0, 0, 0);
      let scale = 1;
      if (ent.type === TYPE.PLANT && ent.stage !== undefined) {
        scale = 0.45 + ent.stage * 0.35;
      }
      this._dummy.scale.set(scale, scale, scale);
      this._dummy.updateMatrix();
      mesh.setMatrixAt(idx, this._dummy.matrix);

      this._color.copy(_baseColor(ent.type));
      if (ent.gestating) {
        this._color.lerp(GESTATING_TINT, 0.45);
      } else if (ent.hunger !== undefined && ent.hunger > 0.7) {
        this._color.lerp(HUNGRY_TINT, 0.35);
      }
      mesh.setColorAt(idx, this._color);
    }

    for (const [type, mesh] of Object.entries(this.meshes)) {
      mesh.count = counts[type];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  setHighlighted(entity, tileRenderer3d) {
    if (!entity || !entity.alive) {
      this.highlight.visible = false;
      return;
    }
    const elev = tileRenderer3d.getElevationAt(entity.tileX, entity.tileY);
    this.highlight.position.set(entity.tileX + 0.5, elev + 0.08, entity.tileY + 0.5);
    this.highlight.visible = true;
  }
}

function _baseColor(type) {
  switch (type) {
    case TYPE.PLANT:     return PLANT_COLOR;
    case TYPE.HERBIVORE: return HERBIVORE_COLOR;
    case TYPE.PREDATOR:  return PREDATOR_COLOR;
    case TYPE.HUMAN:     return HUMAN_COLOR;
    default:             return HERBIVORE_COLOR;
  }
}
