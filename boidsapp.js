"use strict"

/*********************************************************************************************************
 * TODO:
 * - Display framerate
 * - Wrap each control + label in a div. Right now it does not align.
 *    - Hover highlight for the whole group, not just the control? *
 *
 * TODO CONTROLS:
 * - Trail length -- zero is off (boid / predator)
 * - Max Speed (boid / predator)
 * - View distance (boid / predator) -- possible to visualize as a circle while adjusting?
 * - Possibly other parameters
 *
 */

// DOM elements
let addPredator = document.querySelector("#addPredator");
let removePredator = document.querySelector("#removePredator");
let nofPredators = document.querySelector("#nofPredators");

let pausePlay = document.querySelector("#pausePlay");
let nofBoids = document.querySelector("#nofBoids");
let counterNofBoids = document.querySelector("#counterNofBoids");
let sliderSpeedBoids = document.querySelector("#speedBoid");
let sliderSpeedPredator = document.querySelector("#speedPredator");
let divFps = document.querySelector("#fps");

// Update GUI elements only once per second
let lastGUIElementUpdate = Date.now();

function drawUI() {
    const ctx = document.getElementById('boidCanvas').getContext('2d');

    // If we're using the cheap tail drawing, all we need to do is to erase last frame
    // only partially. This way the rail remains and gets dimmer over time due to
    // multiple partial erasures.
    let alpha;

    if (TAIL_TRACKING_ON) {
        alpha = 1.0;
    } else {
        alpha = 0.05;
    }

    // Clear the canvas
    ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Update FPS counter every second
    if ( (Date.now() - lastGUIElementUpdate) > 1000) {
        // Calculate average
        divFps.innerHTML = Math.floor(fpsArray.reduce((a,b) => a+b) / fpsArray.length) + "ms";
        lastGUIElementUpdate = Date.now();
    }
}

// App init
window.onload = () => {

    const canvas = document.getElementById('boidCanvas');
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    createBoids();
    updateCountSlider();

    // Start animation
    window.requestAnimationFrame(animationLoop);
}

addPredator.addEventListener('click', event => {

    let predator = new Boid();

    predator.predator = true;

    predators.push(predator);

    nofPredators.innerHTML = predators.length;
});

removePredator.addEventListener('click', event => {

    // togglePredator.classList.replace('off', 'on');

    // Remove predator from the end of the predators list
    predators.pop();

    nofPredators.innerHTML = predators.length;
});

// Click pause/play button
pausePlay.addEventListener('click', event => {

    if (pausePlay.classList.contains('on')) {
        // Pause
        ANIMATION_ENABLED = false;
        pausePlay.classList.replace('on', 'off');
        pausePlay.innerHTML = 'Play';

    } else if (pausePlay.classList.contains('off')) {
        ANIMATION_ENABLED = true;
        pausePlay.classList.replace("off", "on");
        pausePlay.innerHTML = 'Pause';
    }
});

// Boid count slider
nofBoids.oninput = function() {
    counterNofBoids.innerHTML = this.value;
    updateNumberOfBoids(parseInt(this.value));
}

function updateCountSlider() {
    nofBoids.value = NOF_BOIDS;
    counterNofBoids.innerHTML = NOF_BOIDS;
}

// Boid speed slider
sliderSpeedBoids.oninput = function() {
    MAX_SPEED = this.value;
}

// Predator speed slider
sliderSpeedPredator.oninput = function() {
    MAX_SPEED_PREDATOR = this.value;
}
