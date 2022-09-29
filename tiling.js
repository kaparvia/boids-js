//---------------------------------------------------------------------------
// Vector
//---------------------------------------------------------------------------
class Vector {
    constructor(x = 0, y= 0) {
        this.x = x;
        this.y = y;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    add(vector) {
        this.x += vector.x;
        this.y += vector.y;

        return this;
    }

    subtract(vector) {
        this.x -= vector.x;
        this.y -= vector.y;

        return this;
    }

    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;

        return this;
    }

    static subtract(vector1, vector2) {
        return new Vector(vector1.x - vector2.x, vector1.y - vector2.y);
    }
}

//---------------------------------------------------------------------------
// Boid
//---------------------------------------------------------------------------
class Boid  {
    constructor() {
        this.location = new Vector(Math.random() * canvasWidth, Math.random() * canvasHeight);
        this.velocity = new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1);
    }

    adjustVelocity(vector) {
        this.velocity.x += vector.x;
        this.velocity.y += vector.y;
    }

    updateLocation() {
        this.location.x += this.velocity.x * this.velocityMultiplier;
        this.location.y += this.velocity.y * this.velocityMultiplier;
    }
}

/******************
 * TILING:
 *   - 200x200 tiles
 *   - Collection of tiles
 *      - Get tile by coordinates
 *      - Returns surrounding 8 tiles
 *
 */
class Tile {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
    }
}

class TileCollection {
    tiles = [];

    constructor(width, height, tileSize) {
        this.width = width;
        this.height = height;
        this.tileSize = tileSize;

        let y = 0;
        for (let i = 0; i < height; i++) {
            let x = 0;
            for (let j = 0; j < width; j++) {
                this.tiles.push(new Tile(x, y, tileSize));
                x += tileSize;
            }
            y += tileSize;
        }
    }

    getTileByCoordinates(x, y) {
        if (x < 0 || y < 0 || x > (this.width * this.tileSize) || y > (this.height * this.tileSize)) return;

        let index = Math.floor(x / this.tileSize) + (Math.floor(y / this.tileSize) * this.width);
        return this.tiles[index];
    }
}


let collection = new TileCollection(6, 4, 200);
console.log(collection.getTileByCoordinates(311,201).x);
console.log("");
