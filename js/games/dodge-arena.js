/**
 * NEURAL ARENA — Dodge Arena
 *
 * AI APPROACH: The AI builds a heatmap of the player's movement positions
 * and learns dodge direction preferences. Projectiles are increasingly
 * aimed at where the player tends to move, not where they currently are.
 * A simple prediction model anticipates dodge direction based on recent velocity.
 */
const DodgeArenaGame = (() => {
    let canvas, ctx, particles;
    let running = false;
    let animFrame;

    const W = 700, H = 500;
    const PLAYER_SIZE = 14;
    const PROJECTILE_SIZE = 6;

    // Player state
    let player;
    let keys = {};
    let score, highScore, wave, hp, maxHp;
    let gameOver;
    let invincible, invTimer;
    let gameTime; // frames

    // Projectiles
    let projectiles;
    let spawnTimer, spawnRate;

    // AI Learning — Movement heatmap
    const GRID = 20; // heatmap grid resolution
    let heatmap; // GRID x GRID array of visit counts
    let totalSamples;

    // Dodge direction tracking
    let dodgeHistory; // last N dodge vectors
    let playerVelHistory;
    let aiAccuracy; // How many projectiles "nearly" hit

    // Wave system
    let waveTimer;
    const WAVE_DURATION = 600; // frames per wave

    function initHeatmap() {
        heatmap = [];
        for (let i = 0; i < GRID; i++) {
            heatmap[i] = [];
            for (let j = 0; j < GRID; j++) {
                heatmap[i][j] = 0;
            }
        }
        totalSamples = 0;
    }

    function updateHeatmap(x, y) {
        const gx = Math.floor((x / W) * GRID);
        const gy = Math.floor((y / H) * GRID);
        if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
            heatmap[gx][gy]++;
            totalSamples++;
        }
    }

    function getHeatmapHotspot() {
        // Find the cell the player visits most
        let maxVal = 0, maxGx = GRID / 2, maxGy = GRID / 2;
        for (let i = 0; i < GRID; i++) {
            for (let j = 0; j < GRID; j++) {
                if (heatmap[i][j] > maxVal) {
                    maxVal = heatmap[i][j];
                    maxGx = i;
                    maxGy = j;
                }
            }
        }
        return {
            x: (maxGx + 0.5) * (W / GRID),
            y: (maxGy + 0.5) * (H / GRID),
            confidence: totalSamples > 50 ? maxVal / totalSamples : 0
        };
    }

    function predictPlayerPos() {
        // Predict where player will be based on recent velocity
        if (playerVelHistory.length < 5) return { x: player.x, y: player.y };
        const recent = playerVelHistory.slice(-5);
        const avgVx = recent.reduce((a, v) => a + v.vx, 0) / recent.length;
        const avgVy = recent.reduce((a, v) => a + v.vy, 0) / recent.length;
        // Predict 20 frames ahead
        return {
            x: Math.max(PLAYER_SIZE, Math.min(W - PLAYER_SIZE, player.x + avgVx * 20)),
            y: Math.max(PLAYER_SIZE, Math.min(H - PLAYER_SIZE, player.y + avgVy * 20))
        };
    }

    function init(c) {
        canvas = c;
        ctx = canvas.getContext('2d');
        particles = new ParticleSystem(ctx);

        player = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
        score = 0;
        wave = 1;
        hp = 3;
        maxHp = 3;
        gameOver = false;
        invincible = false;
        invTimer = 0;
        gameTime = 0;
        projectiles = [];
        spawnTimer = 0;
        spawnRate = 40; // frames between spawns
        waveTimer = WAVE_DURATION;
        dodgeHistory = [];
        playerVelHistory = [];
        aiAccuracy = 0;
        initHeatmap();
    }

    function spawnProjectile() {
        const hotspot = getHeatmapHotspot();
        const predicted = predictPlayerPos();
        const adaptLevel = Math.min(1, totalSamples / 300); // 0-1 adaptation scale

        // Mix targeting: random → player → predicted → hotspot
        let targetX, targetY;
        const r = Math.random();
        if (r < 0.3 * (1 - adaptLevel)) {
            // Random target
            targetX = Math.random() * W;
            targetY = Math.random() * H;
        } else if (r < 0.5) {
            // Aim at current position
            targetX = player.x;
            targetY = player.y;
        } else if (r < 0.75) {
            // Aim at predicted position
            targetX = predicted.x + (Math.random() - 0.5) * 40;
            targetY = predicted.y + (Math.random() - 0.5) * 40;
        } else {
            // Aim at hotspot
            targetX = hotspot.x + (Math.random() - 0.5) * 60;
            targetY = hotspot.y + (Math.random() - 0.5) * 60;
        }

        // Spawn from edges
        let sx, sy;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { sx = -10; sy = Math.random() * H; }
        else if (side === 1) { sx = W + 10; sy = Math.random() * H; }
        else if (side === 2) { sx = Math.random() * W; sy = -10; }
        else { sx = Math.random() * W; sy = H + 10; }

        const dx = targetX - sx;
        const dy = targetY - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 2.5 + wave * 0.3 + adaptLevel;

        projectiles.push({
            x: sx, y: sy,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed,
            size: PROJECTILE_SIZE,
            color: adaptLevel > 0.5 ? '#ff006e' : '#ff6b35',
            predicted: r >= 0.5 // Was this an "adapted" shot?
        });
    }

    function handleInput() {
        const SPEED = 4;
        let vx = 0, vy = 0;
        if (keys['ArrowLeft'] || keys['a']) vx -= SPEED;
        if (keys['ArrowRight'] || keys['d']) vx += SPEED;
        if (keys['ArrowUp'] || keys['w']) vy -= SPEED;
        if (keys['ArrowDown'] || keys['s']) vy += SPEED;

        // Normalize diagonal
        if (vx !== 0 && vy !== 0) {
            vx *= 0.707;
            vy *= 0.707;
        }

        player.vx = vx;
        player.vy = vy;
        player.x += vx;
        player.y += vy;
        player.x = Math.max(PLAYER_SIZE, Math.min(W - PLAYER_SIZE, player.x));
        player.y = Math.max(PLAYER_SIZE, Math.min(H - PLAYER_SIZE, player.y));
    }

    function update() {
        if (gameOver) return;
        gameTime++;

        handleInput();

        // Track movement
        updateHeatmap(player.x, player.y);
        playerVelHistory.push({ vx: player.vx, vy: player.vy });
        if (playerVelHistory.length > 30) playerVelHistory.shift();

        // Spawn projectiles
        spawnTimer--;
        if (spawnTimer <= 0) {
            spawnProjectile();
            spawnTimer = Math.max(8, spawnRate - wave * 2);
            // Occasional burst
            if (wave > 2 && Math.random() < 0.15) {
                for (let i = 0; i < 3; i++) setTimeout(() => { if (running) spawnProjectile(); }, i * 100);
            }
        }

        // Update projectiles
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.x += p.vx;
            p.y += p.vy;

            // Remove if off screen
            if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) {
                projectiles.splice(i, 1);
                continue;
            }

            // Collision with player
            const dx = p.x - player.x;
            const dy = p.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < PLAYER_SIZE + p.size) {
                if (!invincible) {
                    hp--;
                    AudioSystem.explosion();
                    particles.emit(player.x, player.y, 25, '#ff006e', { speed: 4, life: 30 });
                    invincible = true;
                    invTimer = 60;

                    if (p.predicted) aiAccuracy++;

                    if (hp <= 0) {
                        gameOver = true;
                        AudioSystem.lose();
                        endGame();
                        return;
                    }
                }
                projectiles.splice(i, 1);
                continue;
            }

            // Near miss tracking (within 3x radius)
            if (dist < PLAYER_SIZE * 3 && dist > PLAYER_SIZE + p.size) {
                // Record dodge direction
                dodgeHistory.push({ dx: -dx / dist, dy: -dy / dist });
                if (dodgeHistory.length > 50) dodgeHistory.shift();
            }
        }

        // Invincibility timer
        if (invincible) {
            invTimer--;
            if (invTimer <= 0) invincible = false;
        }

        // Wave progression
        waveTimer--;
        score++;
        if (waveTimer <= 0) {
            wave++;
            waveTimer = WAVE_DURATION;
            spawnRate = Math.max(12, spawnRate - 3);
            AudioSystem.predict();
        }

        particles.update();
    }

    function endGame() {
        const patterns = [];
        const hotspot = getHeatmapHotspot();
        if (hotspot.confidence > 0.1) {
            const zoneX = hotspot.x < W / 3 ? 'left' : (hotspot.x > W * 2 / 3 ? 'right' : 'center');
            const zoneY = hotspot.y < H / 3 ? 'top' : (hotspot.y > H * 2 / 3 ? 'bottom' : 'middle');
            patterns.push(`Hides ${zoneY}-${zoneX} in Dodge`);
        }

        if (dodgeHistory.length > 10) {
            const avgDx = dodgeHistory.reduce((a, d) => a + d.dx, 0) / dodgeHistory.length;
            if (Math.abs(avgDx) > 0.3) {
                patterns.push(`Dodges ${avgDx > 0 ? 'right' : 'left'} in Dodge`);
            }
        }

        PlayerProfile.recordGame('dodgeArena', 'loss', patterns); // Survival game, always "loss"
        PlayerProfile.updatePatterns('dodgeArena', {
            bestWave: wave,
            bestScore: score,
            heatmapSamples: totalSamples
        });

        const stats = PlayerProfile.getGameStats('dodgeArena');
        if (!stats.bestScore || score > stats.bestScore) {
            PlayerProfile.updatePatterns('dodgeArena', { bestScore: score });
        }

        setTimeout(() => showEndScreen(), 500);
    }

    function showEndScreen() {
        const overlay = document.getElementById('game-ui-overlay');
        overlay.innerHTML = `
            <div class="game-start-overlay">
                <div class="game-overlay-msg" style="color: #ff006e">💥 ELIMINATED</div>
                <div style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.85rem;">
                    Wave ${wave} | Score: ${score}<br>
                    AI tracked ${totalSamples} position samples
                </div>
                <button class="start-btn" onclick="DodgeArenaGame.restart()">TRY AGAIN</button>
                <button class="back-btn" onclick="document.getElementById('back-btn').click()">BACK TO ARENA</button>
            </div>
        `;
    }

    function drawHeatmapOverlay() {
        // Subtle heatmap visualization
        if (totalSamples < 30) return;
        const cellW = W / GRID;
        const cellH = H / GRID;
        let maxVal = 1;
        for (let i = 0; i < GRID; i++)
            for (let j = 0; j < GRID; j++)
                maxVal = Math.max(maxVal, heatmap[i][j]);

        for (let i = 0; i < GRID; i++) {
            for (let j = 0; j < GRID; j++) {
                const val = heatmap[i][j] / maxVal;
                if (val > 0.1) {
                    ctx.fillStyle = `rgba(255, 0, 110, ${val * 0.08})`;
                    ctx.fillRect(i * cellW, j * cellH, cellW, cellH);
                }
            }
        }
    }

    function draw() {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 50) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += 50) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        drawHeatmapOverlay();

        // Projectiles
        for (const p of projectiles) {
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Player
        if (!invincible || Math.floor(invTimer / 4) % 2 === 0) {
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
            ctx.fill();

            // Inner glow
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(player.x, player.y, PLAYER_SIZE * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // HUD
        // HP
        for (let i = 0; i < maxHp; i++) {
            ctx.fillStyle = i < hp ? '#ff006e' : 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.arc(25 + i * 28, 25, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Score + Wave
        ctx.font = '14px Share Tech Mono';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffe600';
        ctx.fillText(`WAVE ${wave}`, W - 15, 22);
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(`SCORE ${score}`, W - 15, 40);

        // Projectile count
        ctx.font = '11px Share Tech Mono';
        ctx.fillStyle = '#555570';
        ctx.fillText(`THREATS: ${projectiles.length}`, W - 15, 56);

        // Wave progress bar
        const wpct = waveTimer / WAVE_DURATION;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, H - 3, W, 3);
        ctx.fillStyle = '#b829dd';
        ctx.fillRect(0, H - 3, W * (1 - wpct), 3);

        particles.draw();
    }

    function gameLoop() {
        if (!running) return;
        update();
        draw();
        animFrame = requestAnimationFrame(gameLoop);
    }

    function getInsights() {
        const hotspot = getHeatmapHotspot();
        const insights = [
            { label: 'Wave', value: `${wave}`, color: '#b829dd' },
            { label: 'Heatmap Samples', value: `${totalSamples}`, color: '#ff006e' },
            { label: 'Active Threats', value: `${projectiles.length}`, color: '#ff6b35' },
        ];

        if (hotspot.confidence > 0.05) {
            const zoneX = hotspot.x < W / 3 ? 'Left' : (hotspot.x > W * 2 / 3 ? 'Right' : 'Center');
            const zoneY = hotspot.y < H / 3 ? 'Top' : (hotspot.y > H * 2 / 3 ? 'Bottom' : 'Mid');
            insights.push({ label: 'Your Comfort Zone', value: `${zoneY}-${zoneX}`, color: '#ffe600' });
        }

        if (dodgeHistory.length > 5) {
            const avgDx = dodgeHistory.slice(-10).reduce((a, d) => a + d.dx, 0) / Math.min(10, dodgeHistory.length);
            insights.push({
                label: 'Dodge Tendency',
                value: Math.abs(avgDx) < 0.2 ? 'Balanced' : (avgDx > 0 ? 'Rightward' : 'Leftward'),
                color: '#39ff14'
            });
        }

        return insights;
    }

    return {
        name: 'dodgeArena',
        title: 'DODGE ARENA',
        init,
        start(c) {
            init(c);
            canvas.width = W;
            canvas.height = H;

            const overlay = document.getElementById('game-ui-overlay');
            overlay.innerHTML = `
                <div class="game-start-overlay">
                    <div style="font-family: var(--font-display); font-size: 1.5rem; color: var(--neon-orange);">DODGE ARENA</div>
                    <div class="start-instruction">
                        Use WASD or Arrow Keys to dodge projectiles.<br>
                        The AI builds a heatmap of your movement and aims where you tend to hide.<br>
                        Survive as long as you can!
                    </div>
                    <button class="start-btn" id="da-start">START</button>
                </div>
            `;
            document.getElementById('da-start').onclick = () => {
                overlay.innerHTML = '';
                running = true;
                AudioSystem.init();
                gameLoop();
            };

            document.onkeydown = (e) => { keys[e.key] = true; };
            document.onkeyup = (e) => { keys[e.key] = false; };
        },
        stop() {
            running = false;
            cancelAnimationFrame(animFrame);
        },
        restart() {
            running = false;
            cancelAnimationFrame(animFrame);
            document.getElementById('game-ui-overlay').innerHTML = '';
            init(canvas);
            canvas.width = W;
            canvas.height = H;
            running = true;
            gameLoop();
        },
        getInsights,
        getStatsBar() {
            return `<span><span class="stat-label">WAVE</span> <span class="stat-value">${wave}</span></span>
                    <span><span class="stat-label">SCORE</span> <span class="stat-value">${score}</span></span>
                    <span><span class="stat-label">HP</span> <span class="stat-value">${hp}/${maxHp}</span></span>`;
        }
    };
})();
