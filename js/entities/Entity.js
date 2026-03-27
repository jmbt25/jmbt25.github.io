let _nextId = 1;

export class Entity {
  constructor(type, tileX, tileY) {
    this.id    = _nextId++;
    this.type  = type;
    this.tileX = tileX;
    this.tileY = tileY;
    this.alive = true;
    this.age   = 0;
  }
}
