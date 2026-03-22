// ===============================
// Ambient Camera Synth + Wavy Rings UI
// - p5.js + p5.sound required
// - Click to start (Safari-safe)
// ===============================

let cam, prevFrame;
let started = false;

let smoothedMotion = 0;
let smoothedLum = 128;

// ---- timing ----
let bpm = 70;
let beatInterval, stepInterval;
let stepsPerBar = 16;
let lastStepTime = 0;
let currentStep = 0;
let currentBar = 0;

// ---- dark mode (brightness) ----
let darkMode = false;
let darkOnThresh = 55;
let darkOffThresh = 75;

// ---- FX ----
let reverb, gongDelay;

// ---- MET (G,B,E,A only) ----
let metVoices = [];
let metNotePool = [];
let metFilter;
let tremPhase = 0;
let metFilterPhase = 0;

// ---- Sea / Land ----
let seaNoise, seaFilter;
let landNoise, landFilter;

// ---- HiHat ----
let hhNoise, hhFilter, hhEnv;
let hhProbBase = 0.25, hhProbMax = 0.7;

// ---- TV Noise ----
let tvNoise, tvFilter, tvEnv;
let tvProbBase = 0.15, tvProbMax = 0.45;

// ---- Voice ----
let voiceOsc1, voiceOsc2;
let voiceFilter1, voiceFilter2;
let voiceEnv;
let voiceBaseFreq1 = 0, voiceBaseFreq2 = 0;
let voiceActive = false, voiceEndTime = 0;
let voiceVibPhase = 0;

// ---- Gong ----
let gongOsc, gongEnv;

// ---- Thunder ----
let thunderNoise, thunderFilter, thunderEnv;

// ---- Metal hit ----
let metalOsc, metalFilter, metalEnv;

// ---- Bass ----
let bassOsc1, bassOsc2;
let bassPhase = 0;
let bassRate = 10;
let bassHitEnv;
let nextBassHitTime = 0;
let darkBassInterval = 140;
let darkBassLevel = 0.22;

// ---- High beep ----
let beepOsc, beepPhase = 0;
let beepOn = true, nextBeepToggleTime = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  pixelDensity(1);

  cam = createCapture(VIDEO);
  cam.size(160, 120);
  cam.hide();

  prevFrame = createImage(160, 120);

  beatInterval = 60000 / bpm;
  stepInterval = beatInterval / 4;
  lastStepTime = millis();

  reverb = new p5.Reverb();
  gongDelay = new p5.Delay();

  let base = [55, 59, 64, 69];
  for (let o = -1; o <= 2; o++) {
    for (let n of base) {
      metNotePool.push(n + o * 12);
    }
  }

  metFilter = new p5.LowPass();
  metFilter.freq(2000);
  metFilter.res(1);

  for (let i = 0; i < 6; i++) {
    let osc = new p5.Oscillator(random(["sine", "triangle", "sawtooth"]));
    let freq = midiToFreq(random(metNotePool));
    osc.freq(freq);
    osc.amp(0);
    osc.start();
    osc.disconnect();
    osc.connect(metFilter);
    metVoices.push({ osc, baseAmp: 0.03 + random(0.02) });
  }
  reverb.process(metFilter, 5, 2);

  seaNoise = new p5.Noise("pink");
  seaFilter = new p5.LowPass();
  seaNoise.disconnect();
  seaNoise.connect(seaFilter);
  seaFilter.freq(800);
  seaFilter.res(1);
  seaNoise.amp(0);
  seaNoise.start();
  reverb.process(seaFilter, 5, 3);

  landNoise = new p5.Noise("brown");
  landFilter = new p5.BandPass();
  landNoise.disconnect();
  landNoise.connect(landFilter);
  landFilter.freq(1500);
  landFilter.res(4);
  landNoise.amp(0);
  landNoise.start();
  reverb.process(landFilter, 6, 4);

  hhNoise = new p5.Noise("white");
  hhFilter = new p5.HighPass();
  hhNoise.disconnect();
  hhNoise.connect(hhFilter);
  hhNoise.amp(0);
  hhNoise.start();
  hhEnv = new p5.Envelope();
  hhEnv.setADSR(0.001, 0.02, 0, 0.03);
  hhEnv.setRange(0.5, 0);
  reverb.process(hhFilter, 1.5, 0.3);

  tvNoise = new p5.Noise("white");
  tvFilter = new p5.BandPass();
  tvNoise.disconnect();
  tvNoise.connect(tvFilter);
  tvNoise.amp(0);
  tvNoise.start();
  tvEnv = new p5.Envelope();
  tvEnv.setADSR(0.005, 0.08, 0, 0.08);
  tvEnv.setRange(1.0, 0);
  reverb.process(tvFilter, 2.5, 0.5);

  voiceOsc1 = new p5.Oscillator("sine");
  voiceOsc2 = new p5.Oscillator("triangle");
  voiceOsc1.amp(0);
  voiceOsc2.amp(0);
  voiceOsc1.start();
  voiceOsc2.start();

  voiceFilter1 = new p5.BandPass();
  voiceFilter2 = new p5.BandPass();

  voiceOsc1.disconnect();
  voiceOsc2.disconnect();
  voiceOsc1.connect(voiceFilter1);
  voiceOsc2.connect(voiceFilter2);

  voiceFilter1.freq(900);
  voiceFilter1.res(7);
  voiceFilter2.freq(2200);
  voiceFilter2.res(8);

  voiceEnv = new p5.Envelope();
  voiceEnv.setADSR(0.2, 0.8, 0.3, 1.2);
  voiceEnv.setRange(0.5, 0);

  reverb.process(voiceFilter1, 8, 0.7);
  reverb.process(voiceFilter2, 8, 0.7);

  gongOsc = new p5.Oscillator("sine");
  gongOsc.amp(0);
  gongOsc.start();
  gongEnv = new p5.Envelope();
  gongEnv.setADSR(0.01, 1.5, 0, 4);
  gongEnv.setRange(0.35, 0);
  reverb.process(gongOsc, 5, 3);
  gongDelay.process(gongOsc, 0.45, 0.75, 4000);

  thunderNoise = new p5.Noise("brown");
  thunderFilter = new p5.LowPass();
  thunderNoise.disconnect();
  thunderNoise.connect(thunderFilter);
  thunderFilter.freq(250);
  thunderFilter.res(1);
  thunderNoise.amp(0);
  thunderNoise.start();
  thunderEnv = new p5.Envelope();
  thunderEnv.setADSR(0.2, 2.0, 0, 4.0);
  thunderEnv.setRange(0.4, 0);
  reverb.process(thunderFilter, 9, 0.8);

  metalOsc = new p5.Oscillator("square");
  metalOsc.amp(0);
  metalOsc.start();
  metalFilter = new p5.BandPass();
  metalOsc.disconnect();
  metalOsc.connect(metalFilter);
  metalFilter.freq(2500);
  metalFilter.res(10);
  metalEnv = new p5.Envelope();
  metalEnv.setADSR(0.002, 0.25, 0, 0.3);
  metalEnv.setRange(0.8, 0);
  reverb.process(metalFilter, 5, 0.6);

  bassOsc1 = new p5.Oscillator("square");
  bassOsc2 = new p5.Oscillator("square");
  bassOsc1.freq(41);
  bassOsc2.freq(49);
  bassOsc1.amp(0);
  bassOsc2.amp(0);
  bassOsc1.start();
  bassOsc2.start();
  reverb.process(bassOsc1, 3, 0.2);
  reverb.process(bassOsc2, 3, 0.2);

  bassHitEnv = new p5.Envelope();
  bassHitEnv.setADSR(0.001, 0.06, 0, 0.10);
  bassHitEnv.setRange(darkBassLevel, 0);

  beepOsc = new p5.Oscillator("sine");
  beepOsc.freq(3800);
  beepOsc.amp(0);
  beepOsc.start();
  reverb.process(beepOsc, 5, 0.6);
  nextBeepToggleTime = millis() + random(3000, 9000);
}

function draw() {
  background(180);

  if (!started) {
    fill(255);
    textSize(18);
    text("CLICK CANVAS TO START (Audio + Camera)", width / 2, height / 2);
    return;
  }

  // image(cam, 20, 20, 160, 120);

  detectCameraMotionAndBrightness();

  let now = millis();
  if (now - lastStepTime >= stepInterval) {
    while (now - lastStepTime >= stepInterval) {
      lastStepTime += stepInterval;
    }
    advanceStep();
  }

  updateSea();
  updateLand();
  updateMet();
  updateBass();
  updateVoice();
  updateBeep();

  drawUI();
}

function detectCameraMotionAndBrightness() {
  cam.loadPixels();
  if (!cam.pixels || cam.pixels.length === 0) return;

  prevFrame.loadPixels();
  if (!prevFrame.pixels || prevFrame.pixels.length !== cam.pixels.length) {
    prevFrame.copy(cam, 0, 0, cam.width, cam.height, 0, 0, prevFrame.width, prevFrame.height);
    return;
  }

  let diffSum = 0;
  let lumSum = 0;
  let count = 0;

  for (let i = 0; i < cam.pixels.length; i += 4) {
    const r = cam.pixels[i];
    const g = cam.pixels[i + 1];
    const b = cam.pixels[i + 2];

    const pr = prevFrame.pixels[i];
    const pg = prevFrame.pixels[i + 1];
    const pb = prevFrame.pixels[i + 2];

    diffSum += abs(r - pr) + abs(g - pg) + abs(b - pb);
    lumSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    count++;
  }

  const motionRaw = diffSum / count;
  const lumRaw = lumSum / count;

  smoothedMotion = lerp(smoothedMotion, motionRaw, 0.15);
  smoothedLum = lerp(smoothedLum, lumRaw, 0.12);

  if (!darkMode && smoothedLum < darkOnThresh) {
    darkMode = true;
    nextBassHitTime = millis();
  } else if (darkMode && smoothedLum > darkOffThresh) {
    darkMode = false;
  }

  prevFrame.copy(cam, 0, 0, cam.width, cam.height, 0, 0, prevFrame.width, prevFrame.height);
}

function advanceStep() {
  currentStep++;

  if (currentStep >= stepsPerBar) {
    currentStep = 0;
    currentBar++;

    let block = floor(currentBar / 2) % 2;
    if (block === 0) {
      seaNoise.amp(0.06, 1.0);
      landNoise.amp(0.0, 1.0);
    } else {
      seaNoise.amp(0.0, 1.0);
      landNoise.amp(0.05, 1.0);
    }

    if (random() < 0.18) triggerThunder();
    if (random() < 0.18) triggerGong();
    if (random() < 0.18) triggerMetal();
    if (random() < 0.12) triggerVoice();
  }

  stepHiHat();
  stepTV();
}

function updateMet() {
  let motionNorm = constrain(smoothedMotion / 50.0, 0, 1);
  let tremRate = lerp(0.15, 12.0, motionNorm);

  let dt = deltaTime / 1000.0;
  tremPhase += TWO_PI * tremRate * dt;
  if (tremPhase > TWO_PI) tremPhase -= TWO_PI;

  let trem = 0.5 + 0.5 * sin(tremPhase);
  let density = 0.6 + motionNorm * 1.0;

  for (let v of metVoices) {
    v.osc.amp(v.baseAmp * trem * density, 0.05);
  }

  let lfoRate = 0.03;
  metFilterPhase += TWO_PI * lfoRate * dt;
  if (metFilterPhase > TWO_PI) metFilterPhase -= TWO_PI;

  let lfo = (sin(metFilterPhase) + 1) / 2;
  metFilter.freq(lerp(400, 5000, lfo));
}

function updateSea() {
  let t = millis() * 0.0002;
  let lfo = (sin(TWO_PI * t) + 1) / 2;
  let amp = 0.03 + lfo * 0.04;
  seaNoise.amp(min(0.08, amp), 0.2);
}

function updateLand() {
  let t = millis() * 0.00015;
  let lfo = (sin(TWO_PI * t + PI / 3) + 1) / 2;
  landFilter.freq(900 + lfo * 900);
}

function updateBass() {
  if (darkMode) {
    updateDarkBassHits();
    bassOsc1.amp(0, 0.05);
    bassOsc2.amp(0, 0.05);
    return;
  }

  let motionNorm = constrain(smoothedMotion / 50.0, 0, 1);
  if (motionNorm < 0.05) {
    bassOsc1.amp(0, 0.1);
    bassOsc2.amp(0, 0.1);
    return;
  }

  let dt = deltaTime / 1000.0;
  bassPhase += TWO_PI * bassRate * dt;
  if (bassPhase > TWO_PI) bassPhase -= TWO_PI;

  let trem = (sin(bassPhase) + 1) / 2;
  let amp = (0.03 + 0.1 * motionNorm) * trem;

  bassOsc1.amp(amp, 0.05);
  bassOsc2.amp(amp, 0.05);
}

function updateDarkBassHits() {
  let now = millis();
  if (now >= nextBassHitTime) {
    let det = random(-1.5, 1.5);
    bassOsc1.freq(41 + det);
    bassOsc2.freq(49 + det);

    bassHitEnv.setRange(darkBassLevel, 0);
    bassHitEnv.play(bassOsc1);
    bassHitEnv.play(bassOsc2);

    nextBassHitTime = now + darkBassInterval;
  }
}

function stepHiHat() {
  let motionNorm = constrain(smoothedMotion / 50.0, 0, 1);
  let p = lerp(hhProbBase, hhProbMax, motionNorm);
  if (random() < p) {
    hhFilter.freq(random(5000, 9000));
    hhEnv.play(hhNoise);
  }
}

function stepTV() {
  let motionNorm = constrain(smoothedMotion / 50.0, 0, 1);
  let p = lerp(tvProbBase, tvProbMax, motionNorm);
  if (random() < p) {
    tvFilter.freq(random(1000, 4000));
    tvEnv.play(tvNoise);
  }
}

function triggerVoice() {
  let midi1 = random(metNotePool);
  let midi2 = midi1 + random([0, 2, 4]);
  voiceBaseFreq1 = midiToFreq(midi1);
  voiceBaseFreq2 = midiToFreq(midi2);

  voiceOsc1.freq(voiceBaseFreq1);
  voiceOsc2.freq(voiceBaseFreq2);

  voiceEnv.play(voiceOsc1);
  voiceEnv.play(voiceOsc2);

  voiceActive = true;
  voiceEndTime = millis() + beatInterval * 4;
  voiceVibPhase = 0;
}

function updateVoice() {
  let t = millis() * 0.00025;
  voiceFilter1.freq(700 + 300 * sin(TWO_PI * t));
  voiceFilter2.freq(1900 + 600 * sin(TWO_PI * t + PI / 2));

  if (!voiceActive) return;
  if (millis() > voiceEndTime) {
    voiceActive = false;
    return;
  }

  let dt = deltaTime / 1000.0;
  let vibRate = 5.0;
  voiceVibPhase += TWO_PI * vibRate * dt;

  let depth = 0.02;
  let mod1 = 1 + depth * sin(voiceVibPhase);
  let mod2 = 1 + depth * sin(voiceVibPhase + PI / 2);

  voiceOsc1.freq(voiceBaseFreq1 * mod1);
  voiceOsc2.freq(voiceBaseFreq2 * mod2);
}

function triggerThunder() {
  thunderFilter.freq(random(150, 280));
  thunderEnv.play(thunderNoise);
}

function triggerGong() {
  gongOsc.freq(random(280, 520));
  gongEnv.play(gongOsc);
}

function triggerMetal() {
  metalFilter.freq(random(1800, 3500));
  metalEnv.play(metalOsc);
}

function updateBeep() {
  let now = millis();
  if (now > nextBeepToggleTime) {
    beepOn = random() < 0.6;
    beepOsc.freq(random(3200, 4200));
    nextBeepToggleTime = now + random(3000, 9000);
  }

  let dt = deltaTime / 1000.0;
  let rate = 0.08;
  beepPhase += TWO_PI * rate * dt;
  if (beepPhase > TWO_PI) beepPhase -= TWO_PI;

  let lfo = (sin(beepPhase) + 1) / 2;
  let amp = beepOn ? (0.002 + 0.01 * lfo) : 0;
  beepOsc.amp(amp, 0.4);
}

function drawUI() {
  let motionNorm = constrain(smoothedMotion / 50.0, 0, 1);

  let baseRadius = min(width, height) * 0.12;
  let ringCount = 18;
  let ringGap = min(width, height) * 0.018;

  let t = millis() * 0.0015;

  noFill();
  stroke(255, 60, 60);
  strokeWeight(2.2);

  push();
  translate(width / 2, height / 2);

  for (let j = 0; j < ringCount; j++) {
    let rBase = baseRadius + j * ringGap;

    beginShape();
    for (let a = 0; a <= TWO_PI + 0.08; a += 0.08) {
      let n1 = noise(
        cos(a) * 1.2 + 10,
        sin(a) * 1.2 + 10,
        t + j * 0.08
      );

      let n2 = noise(
        cos(a * 2.0) * 0.8 + 40,
        sin(a * 2.0) * 0.8 + 40,
        t * 1.4 + j * 0.05
      );

      let wobble =
        map(n1, 0, 1, -1, 1) * (18 + j * 1.8) * (0.35 + motionNorm * 1.8) +
        map(n2, 0, 1, -1, 1) * 10 * (0.2 + motionNorm);

      if (darkMode) wobble *= 1.25;

      let pulse =
        sin(a * 3.0 + t * 2.0 + j * 0.35) *
        6 *
        (0.15 + motionNorm * 0.8);

      let r = rBase + wobble + pulse;

      let x = cos(a) * r;
      let y = sin(a) * r;

      curveVertex(x, y);
    }
    endShape(CLOSE);
  }

  pop();

  noStroke();
  fill(255);
  textSize(14);
  text(
    `bar:${currentBar} step:${currentStep}\n` +
    `motion:${smoothedMotion.toFixed(2)}  lum:${smoothedLum.toFixed(1)}\n` +
    `darkMode:${darkMode ? "ON" : "OFF"}`,
    width / 2,
    height - 55
  );
}

function mousePressed() {
  if (started) return;

  userStartAudio().then(() => {
    started = true;
    lastStepTime = millis();
    currentStep = 0;
    currentBar = 0;

    seaNoise.amp(0.06, 0.8);
    landNoise.amp(0.0, 0.8);

    for (let v of metVoices) {
      v.osc.amp(v.baseAmp, 1.5);
    }
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}