"use strict"

const NOF_BOIDS = 500;

const HISTORY_LENGTH = 30;

// Algorithm configuration
const COLLISION_DISTANCE = 10;
const VIEW_DISTANCE = 300;
const MAX_SPEED = 8;

const FACTOR_CENTERING = 0.005;
const FACTOR_COLLISION = 0.1;
const FACTOR_BOUNDARY = 0.5;
const FACTOR_MATCHING = 0.05;
const FACTOR_INFECTION = 0.01;

// Global variables
let canvasWidth = 100;
let canvasHeight = 100;
let frameCounter = 1;

let boids = new Array();


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
    }

    subtract(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
    }

    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
    }

    static subtract(vector1, vector2) {
        return new Vector(vector1.x - vector2.x, vector1.y - vector2.y);
    }
}

//---------------------------------------------------------------------------
// Boids
//---------------------------------------------------------------------------
class Boid  {
     constructor() {
         this.location = new Vector(Math.random() * canvasWidth, Math.random() * canvasHeight);
         this.velocity = new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1);
         this.infection = false;
         this.history = new Array();
    }

    adjustVelocity(vector) {
         this.velocity.x += vector.x;
         this.velocity.y += vector.y;
    }

    updateLocation() {
        this.location.x += this.velocity.x;
        this.location.y += this.velocity.y;

        this.history.push(new Vector(this.location.x, this.location.y));
        this.history = this.history.slice(-1 * HISTORY_LENGTH);
    }
}

//---------------------------------------------------------------------------
// Rules
//---------------------------------------------------------------------------

// RULE 1: Boids try to fly towards the center of mass of all boids
function rule1_centerOfLocalMass() {
    for(let currentBoid of boids) {

        // Get center of mass
        let center = new Vector();
        let neighborCount = 0;

        for(let otherBoid of boids) {
            let distance = Vector.subtract(currentBoid.location, otherBoid.location);

            let viewDistance = currentBoid.infection ? VIEW_DISTANCE * 1.1 : VIEW_DISTANCE;

            if (distance.length() < viewDistance) {
                center.add(otherBoid.location);
                neighborCount++;
            }
        }

        center.multiply(1/neighborCount);

        let adjust_vector = Vector.subtract(currentBoid.location, center);
        adjust_vector.multiply(-1 * FACTOR_CENTERING);
        currentBoid.adjustVelocity(adjust_vector);
    }
}

// RULE 2: Boids try to keep a small distance away from other boids
function rule2_CollisionAvoidance() {

    for(let currentBoid of boids) {
        let adjust_vector = new Vector();

        for(let otherBoid of boids) {
            if (otherBoid !== currentBoid) {
                let distance = Vector.subtract(currentBoid.location, otherBoid.location);
                if (distance.length() < COLLISION_DISTANCE) {
                    adjust_vector.subtract(distance);
                }
            }
        }
        adjust_vector.multiply(-1 * FACTOR_COLLISION);
        currentBoid.adjustVelocity(adjust_vector);
    }
}

// RULE 3: Boids try to match velocity with near boids
function rule3_MatchVelocity() {

    for(let currentBoid of boids) {

        let adjust_vector = new Vector();

        for (let otherBoid of boids) {
            if (otherBoid !== currentBoid) {
                adjust_vector.add(otherBoid.velocity);
            }
        }

        adjust_vector.multiply(1 / boids.length);
        adjust_vector.multiply(FACTOR_MATCHING);
        currentBoid.adjustVelocity(adjust_vector);
    }
}

function rule4_StayWithinBounds() {

    for(let boid of boids) {
        let adjust_vector = new Vector();

        if (boid.location.x < COLLISION_DISTANCE) {
            adjust_vector.x += Math.abs(boid.location.x);
        }

        if (boid.location.y < COLLISION_DISTANCE) {
            adjust_vector.y += Math.abs(boid.location.y);
        }

        if (boid.location.x > (canvasWidth - COLLISION_DISTANCE)) {
            adjust_vector.x -= Math.abs(canvasWidth - COLLISION_DISTANCE);
        }

        if (boid.location.y > (canvasHeight - COLLISION_DISTANCE)) {
            adjust_vector.y -= Math.abs(canvasHeight - COLLISION_DISTANCE);
        }

        adjust_vector.multiply(FACTOR_BOUNDARY);
        boid.adjustVelocity(adjust_vector);

    }
}

function rule5_Infection() {
    for(let currentBoid of boids) {

        if (currentBoid.infection) {
            // currentBoid.velocity.multiply(1.1);
            continue;
        }

        let adjust_vector = new Vector();

        for(let otherBoid of boids) {
            if (otherBoid.infection) {
                let distance = Vector.subtract(currentBoid.location, otherBoid.location);
                if (distance.length() < VIEW_DISTANCE) {
                    adjust_vector.subtract(distance);
                }
            }
        }
        adjust_vector.multiply(-1 * FACTOR_INFECTION);
        currentBoid.adjustVelocity(adjust_vector);
    }

}

function rule_LimitSpeed() {

    for(let boid of boids) {

        let speed = boid.velocity.length();
        let maxSpeed = boid.infection ? MAX_SPEED * 1.25 : MAX_SPEED;

        if (speed > maxSpeed) {
            let factor = maxSpeed / speed;
            boid.velocity.multiply(factor);
            let new_speed = boid.velocity.length();
        }
    }
}

//---------------------------------------------------------------------------
// Graphics
//---------------------------------------------------------------------------
function drawBoidTriangle(ctx, boid) {
    const angle = Math.atan2(boid.velocity.y, boid.velocity.x);

    ctx.save();

    // Move origin to the boid location and rotate canvas according to the boid direction
    ctx.translate(boid.location.x, boid.location.y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.lineTo(-15, -5)
    ctx.lineTo(-15, +5)
    ctx.lineTo(0, 0)
    ctx.fill();

    // Restore canvas translation for the next boid
    ctx.restore();
}

function drawBoidPoint(ctx, boid) {

    ctx.strokeStyle = 'rgba(255, 255, 255, 0)';

    if (boid.infection) {
        ctx.fillStyle = 'rgba(255,38,0,1)';
        ctx.fillRect(boid.location.x-3, boid.location.y-3, 6, 6);
    } else {
        ctx.fillStyle = 'rgba(0,65,255,1)';
        ctx.fillRect(boid.location.x-1, boid.location.y-1, 2, 2);
    }

    if (HISTORY_LENGTH > 0) {

        ctx.beginPath();

        ctx.fillStyle = 'rgba(255,255,255, 0)';

        if (boid.infection) {
            ctx.strokeStyle = 'rgba(255,38,0,0.15)';
        } else {
            ctx.strokeStyle = 'rgba(0,65,255,0.08)';
        }


        ctx.moveTo(boid.history[0].x, boid.history[0].y);
        for (const point of boid.history) {
            ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
    }
}

function drawBoids() {

    const ctx = document.getElementById('boidCanvas').getContext('2d');
    ctx.clearRect(1, 1, canvasWidth-2, canvasHeight-2);

    for (let boid of boids) {
        drawBoidPoint(ctx, boid);
    }
}

//---------------------------------------------------------------------------
// Main
//---------------------------------------------------------------------------
function createBoids() {
    for (let i = 0; i < NOF_BOIDS; i++) {
        boids.push(new Boid());
    }
}

function updateBoids() {

    // rule1_centerOfMass();
    rule1_centerOfLocalMass();
    rule2_CollisionAvoidance();
    rule3_MatchVelocity();
    rule4_StayWithinBounds();
    rule5_Infection();
    rule_LimitSpeed();

    for(let boid of boids) {
        boid.updateLocation();
    }
}

function animationLoop() {

    //console.log("Frame #" + frameCounter++);

    updateBoids();
    drawBoids();

    window.requestAnimationFrame(animationLoop);
}

window.onload = () => {

    const canvas = document.getElementById('boidCanvas');
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    const ctx = canvas.getContext('2d');
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    createBoids();

    window.requestAnimationFrame(animationLoop);
}


let isPredator = false;

window.onclick = () => {

    if (!isPredator) {
        let predator = new Boid();
        predator.location.x = 1;
        predator.location.y = 1;
        predator.velocity.x = 5;
        predator.velocity.y = 5;
        predator.infection = true;
        boids.push(predator);
        isPredator = true;
    } else {
        boids.pop();
        isPredator = false;
    }

//     // if (index > 0) {
//     //     boids[index].infection = false;
//     //     index = -1;
//     // } else {
//     //     index = Math.floor(Math.random() * boids.length);
//     //     boids[index].infection = true;
//     // }
}
//
// createBoids();
// updateBoids();
// console.log("");

