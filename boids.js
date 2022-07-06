"use strict"

/*****
 * Version 1: 25ms at 1,000 boids, 15ms at 600 boids
 *
 * TODO:
 * (1) Predator can eat boids
 * (2) Optimize rules: Combine loops?
 * (3) Boids change color based on angle (fake sunlight reflection)
 * (4) Infection mode
 * (5) Zombie mode
 *
 */
const NOF_BOIDS = 1000;
const FLAG_LOG_TIMING = false;

// Algorithm configuration
const COLLISION_DISTANCE = 10;
const VIEW_DISTANCE_BOID = 200;
const VIEW_DISTANCE_PREDATOR = 400;
const MAX_SPEED = 8;
const MAX_SPEED_PREDATOR = 7;

const FACTOR_CENTERING = 0.005;
const FACTOR_COLLISION = 0.1;
const FACTOR_BOUNDARY = 0.5;
const FACTOR_MATCHING = 0.05;
const FACTOR_PREDATOR_AVOIDANCE = 0.009;

// Visualization parameters
const SIZE_BOID = 1.5;
const SIZE_PREDATOR = 3.0;
const HISTORY_LENGTH_BOID = 5;
const HISTORY_LENGTH_PREDATOR = 50;


// Global variables
let canvasWidth = 100;
let canvasHeight = 100;
let isPredator = false;

let boids = new Array();

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
// Boid
//---------------------------------------------------------------------------
class Boid  {
     constructor() {
         this.location = new Vector(Math.random() * canvasWidth, Math.random() * canvasHeight);
         this.velocity = new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1);
         this.predator = false;
         this.history = new Array();
    }

    adjustVelocity(vector) {
         this.velocity.x += vector.x;
         this.velocity.y += vector.y;
    }

    updateLocation() {
        this.location.x += this.velocity.x;
        this.location.y += this.velocity.y;

        // Add the new location to the end of the history list and drop the first element in the list
        this.history.push(new Vector(this.location.x, this.location.y));
        this.history = this.history.slice(-1 * (this.predator ? HISTORY_LENGTH_PREDATOR : HISTORY_LENGTH_BOID));
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
            let viewDistance = currentBoid.predator ?  VIEW_DISTANCE_PREDATOR : VIEW_DISTANCE_BOID;

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

        if (currentBoid.predator) continue;

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

        if (currentBoid.predator) continue;

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

function rule5_Predator() {
    for(let currentBoid of boids) {

        if (currentBoid.predator) continue;

        let adjust_vector = new Vector();

        for(let otherBoid of boids) {
            if (otherBoid.predator) {
                let distance = Vector.subtract(currentBoid.location, otherBoid.location);
                if (distance.length() < VIEW_DISTANCE_BOID) {
                    adjust_vector.subtract(distance);
                }
            }
        }
        adjust_vector.multiply(-1 * FACTOR_PREDATOR_AVOIDANCE);
        currentBoid.adjustVelocity(adjust_vector);
    }

}

function rule_LimitSpeed() {
    for(let boid of boids) {

        let speed = boid.velocity.length();
        let maxSpeed = boid.predator ? MAX_SPEED_PREDATOR : MAX_SPEED;

        if (speed > maxSpeed) {
            boid.velocity.multiply(maxSpeed / speed);
        }
    }
}

//---------------------------------------------------------------------------
// Graphics
//---------------------------------------------------------------------------
function drawBoidPoint(ctx, boid) {
    let size;

    ctx.beginPath();

    // Set the color and size based on the boid type
    if (boid.predator) {
        ctx.fillStyle = 'rgba(255,38,0,1)';
        size = SIZE_PREDATOR;
    } else {
        ctx.fillStyle = 'rgba(0,65,255,1)';
        size = SIZE_BOID;
    }

    // Draw the circle
    ctx.arc(boid.location.x,boid.location.y, size, 0, 2 * Math.PI);
    ctx.fill();

    // Draw the trails if they are on
    if ( (!boid.predator && HISTORY_LENGTH_BOID > 0) || (boid.predator && HISTORY_LENGTH_PREDATOR > 0)) {
        drawBoidTrail(ctx, boid);
    }
}

function drawBoidTrail(ctx, boid) {
    // Parameters for the trail color and width
    const ALPHA_START = 0.6;
    const ALPHA_END = 0.05;
    const ALPHA_STEP = (ALPHA_START - ALPHA_END) / boid.history.length;

    const WIDTH_PREDATOR_START = 4;
    const WIDTH_PREDATOR_END = 0;
    const WIDTH_PREDATOR_STEP = (WIDTH_PREDATOR_START - WIDTH_PREDATOR_END) / boid.history.length;

    const WIDTH_BOID_START = 1.5;
    const WIDTH_BOID_END = 0;
    const WIDTH_BOID_STEP = (WIDTH_BOID_START - WIDTH_BOID_END) / boid.history.length;

    let alpha =  ALPHA_START;
    let widthPredator = WIDTH_PREDATOR_START;
    let widthBoid = WIDTH_BOID_START;

    // Reverse the history to draw from the head to tail
    var pointList = boid.history.slice().reverse();
    var last_point = pointList[0];

    for (const point of pointList) {

        ctx.beginPath();

        if (boid.predator) {
            ctx.strokeStyle = 'rgba(255,38,0,' + alpha + ')';
            ctx.lineWidth = widthPredator;
        } else {
            ctx.strokeStyle = 'rgba(0,65,255,' + alpha + ')';
            ctx.lineWidth = widthBoid;
        }

        alpha -= ALPHA_STEP;
        widthPredator -= WIDTH_PREDATOR_STEP;
        widthBoid -= WIDTH_BOID_STEP;

        ctx.moveTo(last_point.x, last_point.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();

        last_point = point;
    }
}

function drawBoids() {
    const ctx = document.getElementById('boidCanvas').getContext('2d');

    // Clear the screen and redraw the bounding box
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

    // Draw the boids
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
    // Run the rules to update velocity vetor for all the boids. This is where the magic happens!
    rule1_centerOfLocalMass();
    rule2_CollisionAvoidance();
    rule3_MatchVelocity();
    rule4_StayWithinBounds();
    rule5_Predator();
    rule_LimitSpeed();

    // Apply velocity vector to all boids to get new location
    for(let boid of boids) {
        boid.updateLocation();
    }
}

function animationLoop() {
    updateBoids();
    drawBoids();

    if (FLAG_LOG_TIMING) console.timeEnd("Frame");
    if (FLAG_LOG_TIMING) console.time("Frame");

    window.requestAnimationFrame(animationLoop);
}

window.onload = () => {

    const canvas = document.getElementById('boidCanvas');
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    createBoids();

    // Start animation
    window.requestAnimationFrame(animationLoop);
}

window.onclick = () => {

    if (!isPredator) {
        let predator = new Boid();

        // Predator starts from the top left corner heading down at speed
        predator.location.x = 1;
        predator.location.y = 1;
        predator.velocity.x = 5;
        predator.velocity.y = 5;
        predator.predator = true;

        // Add predator to the end of the boid list
        boids.push(predator);
        isPredator = true;
    } else {

        // Remove predator from the end of the boid list
        boids.pop();
        isPredator = false;
    }
}
// DEBUG
// createBoids();
// updateBoids();
// console.log("");

