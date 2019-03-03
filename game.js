'use strict';

class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  plus(otherVector) {
    if (!(otherVector instanceof Vector)) {
      throw new Error("Можно прибавлять к вектору только вектор типа Vector");
    }
    return new Vector(this.x + otherVector.x, this.y + otherVector.y);
  }

  times(multiplier) {
    return new Vector(this.x * multiplier, this.y * multiplier);
  }
}

class Actor {
  constructor(pos = new Vector(0, 0), size = new Vector(1, 1), speed = new Vector(0, 0)) {
    if (!(pos instanceof Vector)) {
      throw new Error("Позиция объекта должна быть типа Vector");
    }
    if (!(size instanceof Vector)) {
      throw new Error("Размер объекта должен быть типа Vector");
    }
    if (!(speed instanceof Vector)) {
      throw new Error("Скорость объекта должна быть типа Vector");
    }
    this.pos = pos;
    this.size = size;
    this.speed = speed;
  }

  act() { }

  get left() {
    return this.pos.x;
  }

  get top() {
    return this.pos.y;
  }

  get right() {
    return this.pos.x + this.size.x;
  }

  get bottom() {
    return this.pos.y + this.size.y;
  }

  get type() {
    return 'actor';
  }

  isIntersect(otherActor) {
    if (!(otherActor instanceof Actor)) {
      throw new Error("Аргумент должен быть типа Actor");
    }

    if (this === otherActor) {
      return false;
    }

    if (this.top >= otherActor.bottom) {
      return false;
    }

    if (this.bottom <= otherActor.top) {
      return false;
    }

    if (this.right <= otherActor.left) {
      return false;
    }

    if (this.left >= otherActor.right) {
      return false;
    }

    return true;
  }
}

class Level {
  constructor(grid = [], actors = []) {
    this.grid = grid;
    this.actors = actors;
    this.player = actors.find(actor => actor.type === 'player');
    this.height = grid.length;
    this.width = this.grid.reduce((result, gridRow) => {
      return result < gridRow.length ? gridRow.length : result;
    }, 0);
    this.status = null;
    this.finishDelay = 1;
  }

  isFinished() {
    return this.status !== null && this.finishDelay < 0;
  }

  actorAt(otherActor) {
    if (!(otherActor instanceof Actor)) {
      throw new Error("Аргумент должен быть типа Actor");
    }

   return this.actors.find(actor => otherActor.isIntersect(actor));
  }

  obstacleAt(pos, size) {
    if (!(pos instanceof Vector)) {
      throw new Error("Первый аргумент должен быть типа Vector");
    }

    if (!(size instanceof Vector)) {
      throw new Error("Второй аргумент должен быть типа Vector");
    }

    const left = Math.floor(pos.x);
    const right = Math.ceil(pos.x + size.x);
    const top = Math.floor(pos.y);
    const bottom = Math.ceil(pos.y + size.y);

    if (left < 0 || top < 0 || right > this.width) {
      return 'wall';
    }

    if (bottom > this.height) {
      return 'lava';
    }

    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const obstacle = this.grid[y][x];
        if (obstacle) {
          return obstacle;
        }
      }
    }
  }

  removeActor(actorToRemove) {
    this.actors = this.actors.filter(actor => actorToRemove !== actor);
  }

  noMoreActors(actorType) {
    return !this.actors.some(actor => actor.type === actorType);
  }

  playerTouched(obstacleType, movedActor) {
    if (this.status !== null) {
      return;
    }

    if (obstacleType === 'lava' || obstacleType === 'fireball') {
      this.status = 'lost';
      return;
    }

    if (obstacleType === 'coin' && movedActor.type === 'coin') {
      this.removeActor(movedActor);
      if (this.noMoreActors('coin')) {
        this.status = 'won';
      }
    }
  }
}

class LevelParser {
  constructor(dict = {}) {
    this.dict = dict;
  }

  actorFromSymbol(sym) {
    return this.dict[sym];
  }

  obstacleFromSymbol(sym) {
    switch (sym) {
      case 'x': return 'wall';
      case '!': return 'lava';
    }
  }

  createGrid(rows = []) {
    return rows.map(row => row.split('').map(sym => this.obstacleFromSymbol(sym)));
  }

  createActors(rows = []) {
    const actors = [];
    rows.forEach((row, y) => row.split('').forEach((sym, x) => {
      if (typeof this.actorFromSymbol(sym) !== 'function') {
        return;
      }
      const actor = new this.dict[sym](new Vector(x, y));
      if (actor instanceof Actor) {
        actors.push(actor);
      }
    }));
    return actors;
  }

  parse(rows) {
    return new Level(this.createGrid(rows), this.createActors(rows));
  }
}

class Fireball extends Actor {
  constructor(pos = new Vector(0, 0), speed = new Vector(0, 0)) {
    super(pos, new Vector(1, 1), speed);
  }

  get type() {
    return 'fireball';
  }

  getNextPosition(time = 1) {
    return this.pos.plus(this.speed.times(time));
  }

  handleObstacle() {
    this.speed = this.speed.times(-1);
  }

  act(time, level) {
    const newPosition = this.getNextPosition(time);
    if (level.obstacleAt(newPosition, this.size)) {
      this.handleObstacle();
    } else {
      this.pos = newPosition;
    }
  }
}

class HorizontalFireball extends Fireball {
  constructor(pos) {
    super(pos, new Vector(2, 0));
  }
}

class VerticalFireball extends Fireball {
  constructor(pos) {
    super(pos, new Vector(0, 2));
  }
}

class FireRain extends Fireball {
  constructor(pos) {
    super(pos, new Vector(0, 3));
    this.startPos = pos;
  }

  handleObstacle() {
    this.pos = this.startPos;
  }
}

class Coin extends Actor {
  constructor(pos = new Vector(0, 0)) {
    super(pos.plus(new Vector(0.2, 0.1)), new Vector(0.6, 0.6));
    this.absPos = pos.plus(new Vector(0.2, 0.1));
    this.springSpeed = 8;
    this.springDist = 0.07;
    this.spring = Math.PI * 2 * Math.random();
  }

  get type() {
    return 'coin';
  }

  updateSpring(time = 1) {
    this.spring += this.springSpeed * time;
  }

  getSpringVector() {
    return new Vector(0, Math.sin(this.spring) * this.springDist);
  }

  getNextPosition(time = 1) {
    this.updateSpring(time);
    return this.absPos.plus(this.getSpringVector());
  }

  act(time) {
    this.pos = this.getNextPosition(time);
  }
}

class Player extends Actor {
  constructor(pos = new Vector(0, 0)) {
    super(pos.plus(new Vector(0, -0.5)), new Vector(0.8, 1.5));
  }

  get type() {
    return 'player';
  }
}

const actorDict = {
  '@': Player,
  'o': Coin,
  'v': FireRain,
  '|': VerticalFireball,
  '=': HorizontalFireball
};

const parser = new LevelParser(actorDict);

loadLevels().then(levels => {
  return runGame(JSON.parse(levels), parser, DOMDisplay)
}).then(result => alert("Вы выиграли!"));










