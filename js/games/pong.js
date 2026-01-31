/**
 * NEURAL ARENA — Pong with Q-Learning AI
 * 
 * AI APPROACH: Simplified Q-learning where the AI learns which paddle positions
 * work best against the player's tendencies. The Q-table maps discretized states
 * (ball position + velocity) to actions (move up, stay, move down).
 * As the player develops patterns, the AI adapts its positioning.
 */
const PongGame = (() => {
    let canvas, ctx, particles;
    let running = false;
    let animFrame;

    // Game state
    const W = 800, H = 500;
    let scale = 1;
    let ball, playerPaddle, aiPaddle;
    let playerScore, aiScore;
    let rallyCount;
    let gameOver;
    const WINNING_SCORE = 7;
    const PADDLE_H = 80, PADDLE_W = 12;
    const BALL_SIZE = 8;
    const PADDLE_SPEED = 5;
    const BALL_BASE_SPEED = 5;

    // Q-Learning AI
    const Q = {};
    const LEARNING_RATE = 0.3;
    const DISCOUNT = 0.9;
    const EPSILON_START = 0.3;
    let epsilon = EPSILON_START;
    let lastState = null;
    let lastAction = null;

    // Pattern tracking
    let playerAimHistory = []; // Where player aims (y-positions)
    let playerHitZones = [0, 0, 0, 0, 0]; // 5 zones top to bottom
    let aiConfidence = 0;

    function discretize(bx, by, bvx, bvy, ay) {
        // Discretize state into grid for Q-table
        const gbx = Math.floor(bx / (W / 8));
        const gby = Math.floor(by / (H / 6));
        const gvx = bvx > 0 ? 1 : 0;
        const gvy = bvy > 0 ? 1 : (bvy < 0 ? -1 : 0);
        const gay = Math.floor(ay / (H / 6));
        return `${gbx},${gby},${gvx},${gvy},${gay}`;
    }

    function getQ(state, action) {
        return (Q[state] && Q[state][action]) || 0;
    }

    function setQ(state, action, value) {
        if (!Q[state]) Q[state] = {};
        Q[state][action] = value;
    }

    function bestAction(state) {
        const actions = [-1, 0, 1]; // up, stay, down
        let best = actions[0];
        let bestVal = getQ(state, best);
        for (const a of actions) {
            const v = getQ(state, a);
            if (v > bestVal) { bestVal = v; best = a; }
        }
        return best;
    }

    function qLearnStep(reward) {
        if (lastState === null) return;
        const state = discretize(ball.x, ball.y, ball.vx, ball.vy, aiPaddle.y);
        const maxFutureQ = Math.max(getQ(state, -1), getQ(state, 0), getQ(state, 1));
        const oldQ = getQ(lastState, lastAction);
        const newQ = oldQ + LEARNING_RATE * (reward + DISCOUNT * maxFutureQ - oldQ);
        setQ(lastState, lastAction, newQ);
    }

    function aiDecide() {
        const state = discretize(ball.x, ball.y, ball.vx, ball.vy, aiPaddle.y);
        let action;

        // Baseline: track the ball (so AI always looks alive)
        const aiCenter = aiPaddle.y + PADDLE_H / 2;
        const ballTarget = ball.y + ball.vy * 3; // predict a few frames ahead
        let baselineAction = 0;
        if (ballTarget < aiCenter - 15) baselineAction = -1;
        else if (ballTarget > aiCenter + 15) baselineAction = 1;

        // Q-learning override: as AI learns, it uses Q-table more
        const qStates = Object.keys(Q).length;
        const useQLearning = qStates > 20 && Math.random() > epsilon;

        if (useQLearning) {
            action = bestAction(state);
        } else if (Math.random() < epsilon * 0.3) {
            // Small random exploration
            action = [-1, 0, 1][Math.floor(Math.random() * 3)];
        } else {
            // Default to ball tracking (keeps AI visually responsive)
            action = baselineAction;
        }

        lastState = state;
        lastAction = action;
        return action;
    }

    function resetBall(direction = 1) {
        ball = {
            x: W / 2, y: H / 2,
            vx: BALL_BASE_SPEED * direction * (0.8 + Math.random() * 0.4),
            vy: (Math.random() - 0.5) * BALL_BASE_SPEED * 0.8,
            trail: []
        };
        rallyCount = 0;
    }

    function init(c) {
        canvas = c;
        ctx = canvas.getContext('2d');
        particles = new ParticleSystem(ctx);
        playerPaddle = { x: 30, y: H / 2 - PADDLE_H / 2 };
        aiPaddle = { x: W - 30 - PADDLE_W, y: H / 2 - PADDLE_H / 2 };
        playerScore = 0;
        aiScore = 0;
        gameOver = false;
        playerAimHistory = [];
        playerHitZones = [0, 0, 0, 0, 0];
        aiConfidence = 0;
        epsilon = EPSILON_START;
        resetBall(1);
    }

    let mouseY = H / 2;
    let keys = {};

    function handleInput() {
        // Mouse / touch control
        const targetY = mouseY / scale - PADDLE_H / 2;
        playerPaddle.y += (targetY - playerPaddle.y) * 0.15;
        playerPaddle.y = Math.max(0, Math.min(H - PADDLE_H, playerPaddle.y));

        // Keyboard fallback
        if (keys['ArrowUp'] || keys['w']) playerPaddle.y -= PADDLE_SPEED;
        if (keys['ArrowDown'] || keys['s']) playerPaddle.y += PADDLE_SPEED;
        playerPaddle.y = Math.max(0, Math.min(H - PADDLE_H, playerPaddle.y));
    }

    function update() {
        if (gameOver) return;
        handleInput();

        // AI movement using Q-learning
        const action = aiDecide();
        aiPaddle.y += action * (PADDLE_SPEED + Math.min(rallyCount * 0.15, 2));
        aiPaddle.y = Math.max(0, Math.min(H - PADDLE_H, aiPaddle.y));

        // Ball trail
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 10) ball.trail.shift();

        // Ball movement
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Top/bottom bounce
        if (ball.y <= BALL_SIZE || ball.y >= H - BALL_SIZE) {
            ball.vy *= -1;
            ball.y = Math.max(BALL_SIZE, Math.min(H - BALL_SIZE, ball.y));
            AudioSystem.dodge();
        }

        // Paddle collisions
        // Player paddle
        if (ball.x - BALL_SIZE <= playerPaddle.x + PADDLE_W &&
            ball.x + BALL_SIZE >= playerPaddle.x &&
            ball.y >= playerPaddle.y && ball.y <= playerPaddle.y + PADDLE_H &&
            ball.vx < 0) {
            ball.vx = Math.abs(ball.vx) * 1.05;
            const hitPos = (ball.y - playerPaddle.y) / PADDLE_H;
            ball.vy = (hitPos - 0.5) * BALL_BASE_SPEED * 1.5;
            ball.x = playerPaddle.x + PADDLE_W + BALL_SIZE;
            rallyCount++;
            AudioSystem.hit();
            particles.emit(ball.x, ball.y, 8, '#00f0ff', { speed: 2, life: 20 });

            // Track player aim patterns
            const aimZone = Math.floor((ball.vy > 0 ? 1 : 0) * 2.5 + 1.25);
            playerHitZones[Math.min(4, Math.max(0, aimZone))]++;
            playerAimHistory.push(ball.y);

            qLearnStep(-1); // Player hit = negative reward for AI
        }

        // AI paddle
        if (ball.x + BALL_SIZE >= aiPaddle.x &&
            ball.x - BALL_SIZE <= aiPaddle.x + PADDLE_W &&
            ball.y >= aiPaddle.y && ball.y <= aiPaddle.y + PADDLE_H &&
            ball.vx > 0) {
            ball.vx = -Math.abs(ball.vx) * 1.05;
            const hitPos = (ball.y - aiPaddle.y) / PADDLE_H;
            ball.vy = (hitPos - 0.5) * BALL_BASE_SPEED * 1.5;
            ball.x = aiPaddle.x - BALL_SIZE;
            rallyCount++;
            AudioSystem.hit();
            particles.emit(ball.x, ball.y, 8, '#ff006e', { speed: 2, life: 20 });
            qLearnStep(1); // AI hit = positive reward
        }

        // Score
        if (ball.x < -20) {
            aiScore++;
            qLearnStep(10); // AI scored
            epsilon = Math.max(0.05, epsilon * 0.95); // Reduce exploration
            aiConfidence = Math.min(100, aiConfidence + 5);
            AudioSystem.score();
            particles.emit(W / 2, H / 2, 20, '#ff006e', { speed: 4, life: 30 });
            checkGameOver();
            if (!gameOver) resetBall(1);
        }
        if (ball.x > W + 20) {
            playerScore++;
            qLearnStep(-10); // AI conceded
            AudioSystem.score();
            particles.emit(W / 2, H / 2, 20, '#00f0ff', { speed: 4, life: 30 });
            checkGameOver();
            if (!gameOver) resetBall(-1);
        }

        particles.update();
    }

    function checkGameOver() {
        if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
            gameOver = true;
            const won = playerScore >= WINNING_SCORE;
            if (won) AudioSystem.win(); else AudioSystem.lose();

            // Determine detected patterns
            const patterns = [];
            const total = playerHitZones.reduce((a, b) => a + b, 0);
            if (total > 3) {
                const topPct = (playerHitZones[0] + playerHitZones[1]) / total;
                const botPct = (playerHitZones[3] + playerHitZones[4]) / total;
                if (topPct > 0.6) patterns.push('Aims high in Pong');
                else if (botPct > 0.6) patterns.push('Aims low in Pong');
                else patterns.push('Varied aim in Pong');
            }

            PlayerProfile.recordGame('pong', won ? 'win' : 'loss', patterns);
            PlayerProfile.updatePatterns('pong', { hitZones: [...playerHitZones], confidence: aiConfidence });

            // Show end screen after delay
            setTimeout(() => showEndScreen(won), 500);
        }
    }

    function showEndScreen(won) {
        const overlay = document.getElementById('game-ui-overlay');
        overlay.innerHTML = `
            <div class="game-start-overlay">
                <div class="game-overlay-msg" style="color: ${won ? '#00f0ff' : '#ff006e'}">
                    ${won ? '🏆 YOU WIN' : '🧠 AI WINS'}
                </div>
                <div style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem;">
                    ${playerScore} — ${aiScore}
                </div>
                <button class="start-btn" onclick="PongGame.restart()">PLAY AGAIN</button>
                <button class="back-btn" onclick="document.getElementById('back-btn').click()">BACK TO ARENA</button>
            </div>
        `;
    }

    function draw() {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, W, H);

        // Center line
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2, H);
        ctx.stroke();
        ctx.setLineDash([]);

        // Score (hide when game over to avoid overlap with end screen)
        if (!gameOver) {
            ctx.font = '48px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
            ctx.fillText(playerScore, W / 2 - 80, 60);
            ctx.fillStyle = 'rgba(255, 0, 110, 0.3)';
            ctx.fillText(aiScore, W / 2 + 80, 60);
        }

        // Ball trail
        for (let i = 0; i < ball.trail.length; i++) {
            const alpha = i / ball.trail.length * 0.3;
            ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(ball.trail[i].x, ball.trail[i].y, BALL_SIZE * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Ball
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_SIZE, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Paddles
        // Player (cyan)
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        roundRect(ctx, playerPaddle.x, playerPaddle.y, PADDLE_W, PADDLE_H, 4);
        ctx.fill();

        // AI (pink)
        ctx.fillStyle = '#ff006e';
        ctx.shadowColor = '#ff006e';
        roundRect(ctx, aiPaddle.x, aiPaddle.y, PADDLE_W, PADDLE_H, 4);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Rally counter
        if (rallyCount > 2 && !gameOver) {
            ctx.font = '14px Share Tech Mono';
            ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(255, 230, 0, ${Math.min(1, rallyCount / 10)})`;
            ctx.fillText(`RALLY ${rallyCount}`, W / 2, H - 20);
        }

        particles.draw();
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function gameLoop() {
        if (!running) return;
        update();
        draw();
        animFrame = requestAnimationFrame(gameLoop);
    }

    function getInsights() {
        const total = playerHitZones.reduce((a, b) => a + b, 0);
        const insights = [
            { label: 'AI Confidence', value: `${Math.round(aiConfidence)}%`, bar: aiConfidence / 100, color: '#ff006e' },
            { label: 'Rally Best', value: `${rallyCount}`, color: '#ffe600' },
            { label: 'Q-States Learned', value: `${Object.keys(Q).length}`, color: '#b829dd' },
        ];
        if (total > 2) {
            const topPct = Math.round(((playerHitZones[0] + playerHitZones[1]) / total) * 100);
            const botPct = Math.round(((playerHitZones[3] + playerHitZones[4]) / total) * 100);
            insights.push({ label: 'Aim Top', value: `${topPct}%`, bar: topPct / 100, color: '#00f0ff' });
            insights.push({ label: 'Aim Bottom', value: `${botPct}%`, bar: botPct / 100, color: '#39ff14' });
        }
        return insights;
    }

    return {
        name: 'pong',
        title: 'NEURAL PONG',
        init,
        start(c) {
            init(c);
            canvas.width = W;
            canvas.height = H;

            // Show start overlay
            const overlay = document.getElementById('game-ui-overlay');
            overlay.innerHTML = `
                <div class="game-start-overlay">
                    <div style="font-family: var(--font-display); font-size: 1.5rem; color: var(--neon-cyan);">NEURAL PONG</div>
                    <div class="start-instruction">Move your mouse or use ↑↓ / W/S keys to control your paddle.<br>The AI learns your patterns with Q-learning.</div>
                    <button class="start-btn" id="pong-start">START</button>
                </div>
            `;
            document.getElementById('pong-start').onclick = () => {
                overlay.innerHTML = '';
                running = true;
                AudioSystem.init();
                gameLoop();
            };

            // Input handlers
            canvas.onmousemove = (e) => {
                const rect = canvas.getBoundingClientRect();
                scale = rect.height / H;
                mouseY = e.clientY - rect.top;
            };
            canvas.ontouchmove = (e) => {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                scale = rect.height / H;
                mouseY = e.touches[0].clientY - rect.top;
            };
            document.onkeydown = (e) => { keys[e.key] = true; };
            document.onkeyup = (e) => { keys[e.key] = false; };
        },
        stop() {
            running = false;
            cancelAnimationFrame(animFrame);
            canvas.onmousemove = null;
            canvas.ontouchmove = null;
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
            return `<span><span class="stat-label">YOU</span> <span class="stat-value">${playerScore}</span></span>
                    <span><span class="stat-label">AI</span> <span class="stat-value">${aiScore}</span></span>
                    <span><span class="stat-label">Q-STATES</span> <span class="stat-value">${Object.keys(Q).length}</span></span>`;
        }
    };
})();
