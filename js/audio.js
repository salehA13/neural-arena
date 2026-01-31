// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
        const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
        return this;
    };
}

/**
 * NEURAL ARENA — Web Audio API Synth Sound System
 * Zero external files. All sounds generated procedurally.
 */
const AudioSystem = (() => {
    let ctx = null;
    let masterGain = null;
    let enabled = true;

    function init() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(ctx.destination);
    }

    function ensureCtx() {
        if (!ctx) init();
        if (ctx.state === 'suspended') ctx.resume();
    }

    // Core synth: play a tone with ADSR envelope
    function playTone(freq, duration, type = 'sine', volume = 0.5, detune = 0) {
        if (!enabled) return;
        ensureCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    }

    // Noise burst for impacts
    function noise(duration = 0.1, volume = 0.3) {
        if (!enabled) return;
        ensureCtx();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        src.buffer = buffer;
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        src.start();
    }

    return {
        init,
        toggle() { enabled = !enabled; return enabled; },

        // UI sounds
        click() { playTone(800, 0.08, 'sine', 0.2); },
        hover() { playTone(600, 0.04, 'sine', 0.1); },

        // Game sounds
        hit() {
            playTone(300, 0.15, 'square', 0.3);
            noise(0.05, 0.15);
        },
        score() {
            playTone(523, 0.1, 'square', 0.25);
            setTimeout(() => playTone(659, 0.1, 'square', 0.25), 80);
            setTimeout(() => playTone(784, 0.15, 'square', 0.3), 160);
        },
        lose() {
            playTone(300, 0.2, 'sawtooth', 0.25);
            setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.2), 150);
        },
        win() {
            [523, 659, 784, 1047].forEach((f, i) => {
                setTimeout(() => playTone(f, 0.15, 'square', 0.25), i * 100);
            });
        },
        select() {
            playTone(440, 0.08, 'triangle', 0.2);
            playTone(660, 0.1, 'triangle', 0.15);
        },
        predict() {
            playTone(880, 0.06, 'sine', 0.2);
        },
        wrong() {
            playTone(200, 0.15, 'sawtooth', 0.2, 30);
        },
        dodge() {
            noise(0.03, 0.1);
        },
        explosion() {
            noise(0.3, 0.4);
            playTone(80, 0.3, 'sawtooth', 0.3);
        },
        place() {
            playTone(500, 0.06, 'triangle', 0.2);
        },
        match() {
            playTone(700, 0.1, 'sine', 0.3);
            setTimeout(() => playTone(900, 0.15, 'sine', 0.3), 100);
        },
        flip() {
            playTone(1200, 0.04, 'sine', 0.15);
        }
    };
})();
