"use strict"

/*****
 * Version 1: 25ms at 1,000 boids, baseline 15ms up to 600 boids
 * Version 2: 60ms at 1,000 boids, baseline 17ms up to 350 boids (trail 25)
 * Version 3: 32ms at 1,000 boids, baseline 17ms up to 730 boids (quick trail draw)
 *
 * TODO:
 * (1) Optimize rules:
 *      - Combine loops?
 *      - Tiling algorithm
 *      - DBSCAN (https://adamprice.io/blog/boids.html)
 *
 * (2) Boids change color based on angle (fake sunlight reflection)
 * (3) Infection mode
 * (4) Zombie mode
 * (5) Sound when eating
 *
 *  BUGS:
 *  - Quick tail drawing leaves black pixels in the middle of the trail
 *  - Make sure all coordinates are ints when drawing (avoids anti-aliasing so not sure if looks good)
 */
const FLAG_LOG_TIMING = false;
const VELOCITY_RANGE = 1; // Max is 2, it means some are close to zero

// Algorithm configuration
const COLLISION_DISTANCE = 10;
const VIEW_DISTANCE_BOID = 200;
const VIEW_DISTANCE_PREDATOR = 400;
const PREDATOR_KILL_DISTANCE = 10;

const FACTOR_CENTERING = 0.005;
const FACTOR_PREDATOR_HUNT = 0.1;
const FACTOR_COLLISION = 0.1;
const FACTOR_BOUNDARY = 0.5;
const FACTOR_MATCHING = 0.05;
const FACTOR_PREDATOR_AVOIDANCE = 0.009;
const FACTOR_PREDATOR_MATCHING = 0.02;

// Visualization parameters
const SIZE_BOID = 1.5;
const SIZE_PREDATOR = 3.0;
const SPLASH_TIMER_START = 5;
const SPLASH_SIZE = 6;

// Drawing the tail properly takes a lot of cycles so they're disabled by default
// to use a cheaper method. Turn this flag on to switch to the expensive but pretties
// method.
const TAIL_TRACKING_ON = false;
const TAIL_LENGTH_BOID = 20;
const TAIL_LENGTH_PREDATOR = 30;

// GUI configurable parameters
let ANIMATION_ENABLED = true;
let NOF_BOIDS = 100;
let MAX_SPEED = 8;
let MAX_SPEED_PREDATOR = 9;

// Global variables
let canvasWidth;
let canvasHeight;
let fpsCounter;

let boids = [];
let splashes = [];

//---------------------------------------------------------------------------
// Splash
//---------------------------------------------------------------------------
class Splash {
    constructor(location) {
        this.location = location;
        this.timer = SPLASH_TIMER_START;
    }

    animate(ctx) {

        // Alpha goes down and size goes up over the lifetime of the splash
        let alpha = 1 - (SPLASH_TIMER_START - this.timer) / SPLASH_TIMER_START;
        let size = 5 + SPLASH_SIZE * ((SPLASH_TIMER_START - this.timer) / SPLASH_TIMER_START);

        ctx.beginPath();

        ctx.fillStyle = 'rgba(255,38,0,' + alpha + ')';
        ctx.arc(this.location.x,this.location.y, size, 0, 2 * Math.PI);
        ctx.fill();

        this.timer--;

        // Return true if the splash is done
        return this.timer === 0;
    }
}

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

         // Boids are created at the edes of the canvas, with a random vector pointing inwards
         let x=0,y=0,dx=0,dy=0;

         // Pick the edge
         switch(Math.floor(Math.random()*4) + 1) {

             // Left
             case 1:
                x = 0;
                y = Math.random() * canvasHeight;
                dx = Math.random() * 2;
                dy = Math.random() * 2 - 1;
                break;

             // Right
             case 2:
                 x = canvasWidth;
                 y = Math.random() * canvasHeight;
                 dx = Math.random() * -2;
                 dy = Math.random() * 2 - 1;
                 break;

             // Top
             case 3:
                 x = Math.random() * canvasWidth;
                 y = 0;
                 dx = Math.random() * 2 - 1;
                 dy = Math.random() * 2;
                 break;

             // Bottom
             case 4:
                 x = Math.random() * canvasWidth;
                 y = canvasHeight;
                 dx = Math.random() * 2 - 1;
                 dy = Math.random() * -2;
         }

         this.location = new Vector(x, y);
         this.velocity = new Vector(dx, dy);
         this.velocityMultiplier = (Math.random() * VELOCITY_RANGE) + (1 - VELOCITY_RANGE / 2);
         this.predator = false;
         this.history = [];
    }

    adjustVelocity(vector) {
         this.velocity.x += vector.x;
         this.velocity.y += vector.y;
    }

    updateLocation() {
        this.lastLocation = new Vector(this.location.x, this.location.y);
        this.location.x += this.velocity.x * this.velocityMultiplier;
        this.location.y += this.velocity.y * this.velocityMultiplier;

        // Add the new location to the end of the history list for tail drawing
        if (TAIL_TRACKING_ON) {
            this.history.push(new Vector(this.location.x, this.location.y));

            // If we're maxed out, drop first element
            if (this.predator) {
                if (this.history.length > TAIL_LENGTH_PREDATOR) this.history.shift();
            } else {
                if (this.history.length > TAIL_LENGTH_BOID) this.history.shift();
            }
        }
    }
}

//---------------------------------------------------------------------------
// Rules
//---------------------------------------------------------------------------
function rule1_predatorFindNearest(predatorBoid) {

    let nearestBoid;
    let nearestDirection;
    let shortestDistance = 999999;

    // Find the closest boid that we can see
    for(let otherBoid of boids) {
        if (otherBoid === predatorBoid) continue;

        let direction = Vector.subtract(predatorBoid.location, otherBoid.location);
        let distance = direction.length();

        if (distance < VIEW_DISTANCE_PREDATOR && distance < shortestDistance) {

            nearestBoid = otherBoid;
            nearestDirection = direction;
            shortestDistance = distance;
        }
    }
    // Did we see prey?
    if (typeof nearestDirection !== 'undefined') {

        // If we're super close, eat it!
        if (shortestDistance < PREDATOR_KILL_DISTANCE) {
            splashes.push(new Splash(nearestBoid.location));
            boids.splice(boids.indexOf(nearestBoid), 1);
            NOF_BOIDS--;
            updateCountSlider();

        } else {
            // Otherwise fly closer and match velocity
            let adjustVector = new Vector(nearestDirection.x, nearestDirection.y).multiply(-1 * FACTOR_PREDATOR_HUNT);
            let nearestVelocity = new Vector(nearestBoid.velocity.x, nearestBoid.velocity.y).multiply(-1 * FACTOR_PREDATOR_MATCHING);

            adjustVector.add(nearestVelocity);
            predatorBoid.adjustVelocity(adjustVector);
        }
    }
}

// RULE 1: Boids try to fly towards the center of mass of visible (nearest) boids
function rule1_centerOfLocalMass() {
    for(let currentBoid of boids) {

        if (currentBoid.predator) {
            rule1_predatorFindNearest(currentBoid);
            continue;
        }
        // Get center of mass
        let center = new Vector();
        let neighborCount = 0;

        for(let otherBoid of boids) {
            let direction = Vector.subtract(currentBoid.location, otherBoid.location);
            let viewDistance = currentBoid.predator ?  VIEW_DISTANCE_PREDATOR : VIEW_DISTANCE_BOID;

            if (direction.length() < viewDistance) {
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

// RULE 4: Avoid canvas edges
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

// RULE 5: Run away from the predator
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

// RULE X: Don't exceed max speed
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
        ctx.fillStyle = 'rgb(255,255,255)';
        size = SIZE_BOID;
    }

    // Draw the circle
    ctx.arc(boid.location.x,boid.location.y, size, 0, 2 * Math.PI);
    ctx.fill();
}

// Draw just one segment trail behind the boid and remove the boid from the last
// location. This method is used when the full trail drawing is not on.
//
// Used when TAIL_TRACKING_ON == false
function drawBoidTrailShort(ctx, boid) {

    if (boid.lastLocation === undefined) return;

    // Overwrite the previous boid location with a black circle
    ctx.beginPath();
    ctx.fillStyle = 'black';

    ctx.arc(boid.lastLocation.x,boid.lastLocation.y,
        boid.predator ? SIZE_PREDATOR : SIZE_BOID,
        0, 2 * Math.PI);
    ctx.fill();

    // Draw a line between current location and the previous location
    ctx.beginPath();

    if (boid.predator) {
        ctx.strokeStyle = 'rgb(255,38,0)';
        ctx.lineWidth = 3;
    } else {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
    }

    ctx.moveTo(boid.lastLocation.x, boid.lastLocation.y);
    ctx.lineTo(boid.location.x, boid.location.y);
    ctx.stroke();
}

// Complete trail drawing method. Trail is completely drawn every frame, with full
// narrowing and fading. Looks better is much more expensive.
//
// Run when TAIL_TRACKING_ON == true
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
    let pointList = boid.history.slice().reverse();
    let last_point = pointList[0];

    for (const point of pointList) {

        ctx.beginPath();

        if (boid.predator) {
            ctx.strokeStyle = 'rgba(255,38,0,' + alpha + ')';
            ctx.lineWidth = widthPredator;
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
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

    // Draw the boids
    for (let boid of boids) {
        drawBoidPoint(ctx, boid);

        // Draw the trails if they are on
        if (ANIMATION_ENABLED) {
            if (TAIL_TRACKING_ON) {
                drawBoidTrail(ctx, boid);
            } else {
                drawBoidTrailShort(ctx, boid);
            }
        }
    }
}

function drawSplashes() {
    const ctx = document.getElementById('boidCanvas').getContext('2d');

    for(let splash of splashes) {
        if (splash.animate(ctx) === true) {
            // Remove
            splashes.splice(splashes.indexOf(splash), 1);
        }
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

// Called when boid count is changed from the GUI
function updateNumberOfBoids(newCount) {
    if (newCount === NOF_BOIDS) return;

    if (newCount < NOF_BOIDS) {
        boids.splice(0, (NOF_BOIDS - newCount));
    } else {
        for(let i=NOF_BOIDS; i < newCount; i++) {
            boids.push(new Boid());
        }
    }
    NOF_BOIDS = newCount;
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

// Time stamp used for FPS calculation
let lastTime = Date.now();
let fpsArray = [];
const AVERAGES = 30;

function animationLoop() {

    // Update frame timing and save timestamp for the next frame
    fpsCounter = Date.now() - lastTime;
    lastTime = Date.now();

    // Update average array
    fpsArray.push(fpsCounter);
    if (fpsArray.length > AVERAGES) fpsArray.shift();

    drawUI();

    if (ANIMATION_ENABLED) {
        updateBoids();
    }

    drawBoids();
    drawSplashes();

    if (FLAG_LOG_TIMING) console.timeEnd("Frame");
    if (FLAG_LOG_TIMING) console.time("Frame");


    window.requestAnimationFrame(animationLoop);
}

// DEBUG
// createBoids();
// updateBoids();
// console.log("");
