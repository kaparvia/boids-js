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
let togglePredator = document.querySelector("#togglePredator");
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

    // Clear the canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Update FPS counter every second
    if ( (Date.now() - lastGUIElementUpdate) > 1000) {
        divFps.innerHTML = Math.floor(fpsCounter) + "ms";
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

// Click on Predator button
togglePredator.addEventListener('click', event => {

    // If predator is off, create it
    if (togglePredator.classList.contains('off')) {
        let predator = new Boid();

        // Predator starts from the top left corner heading down at speed
        predator.location.x = 1;
        predator.location.y = 1;
        predator.velocity.x = 5;
        predator.velocity.y = 5;
        predator.predator = true;

        // Add predator to the end of the boid list
        boids.push(predator);
        togglePredator.classList.replace('off', 'on');

    } else if (togglePredator.classList.contains('on')) {

        // Remove predator from the end of the boid list
        boids.pop();
        togglePredator.classList.replace("on", "off");
    }
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
