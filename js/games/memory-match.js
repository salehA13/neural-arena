/**
 * NEURAL ARENA — Memory Match (Adaptive Difficulty)
 *
 * AI APPROACH: Tracks which cards the player remembers (found quickly)
 * vs forgets (many attempts). Uses this to adapt: if the player has great
 * memory, grid size increases. If struggling, it decreases. Also tracks
 * spatial memory patterns (does player scan left-to-right? Random?)
 */
const MemoryMatchGame = (() => {
    let canvas, ctx, particles;
    let running = false;
    let animFrame;

    const W = 700, H = 500;

    const SYMBOLS = ['🧠', '⚡', '🔥', '💎', '🌊', '🎯', '🚀', '🌙', '⭐', '🎮', '🔮', '💜', '🌈', '🎪', '🤖', '👾', '🎲', '🎵'];

    let grid; // {symbol, revealed, matched, flipAnim}
    let gridCols, gridRows;
    let cellSize;
    let selected; // Array of selected card indices
    let matchCount;
    let totalPairs;
    let attempts;
    let startTime;
    let gameOver;
    let flipping; // Lock during flip animation

    // Adaptive AI
    let memoryScore; // How good is the player's memory (0-100)
    let quickMatches; // Matches found in ≤2 attempts after seeing both
    let seenCards; // Track which cards have been revealed
    let revealOrder; // Order of card reveals for pattern analysis
    let adaptiveGridSize; // Current grid size level

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function buildGrid(cols, rows) {
        gridCols = cols;
        gridRows = rows;
        const totalCards = cols * rows;
        totalPairs = totalCards / 2;

        const symbols = shuffle([...SYMBOLS]).slice(0, totalPairs);
        const cards = shuffle([...symbols, ...symbols]);

        cellSize = Math.min((W - 40) / cols, (H - 80) / rows);
        const padX = (W - cols * cellSize) / 2;
        const padY = (H - rows * cellSize) / 2 + 20;

        grid = cards.map((symbol, i) => ({
            symbol,
            revealed: false,
            matched: false,
            flipAnim: 0,
            x: padX + (i % cols) * cellSize,
            y: padY + Math.floor(i / cols) * cellSize,
            idx: i
        }));
    }

    function init(c) {
        canvas = c;
        ctx = canvas.getContext('2d');
        particles = new ParticleSystem(ctx);

        const stats = PlayerProfile.getGameStats('memoryMatch');
        const prevGames = stats.played || 0;
        memoryScore = (stats.patterns?.memoryScore) || 50;

        // Adaptive grid size based on memory score
        if (memoryScore > 70 && prevGames > 2) {
            adaptiveGridSize = 3; // 6x4 = 24 cards
            buildGrid(6, 4);
        } else if (memoryScore < 30 && prevGames > 2) {
            adaptiveGridSize = 1; // 4x3 = 12 cards
            buildGrid(4, 3);
        } else {
            adaptiveGridSize = 2; // 4x4 = 16 cards (default)
            buildGrid(4, 4);
        }

        selected = [];
        matchCount = 0;
        attempts = 0;
        startTime = Date.now();
        gameOver = false;
        flipping = false;
        quickMatches = 0;
        seenCards = new Set();
        revealOrder = [];
    }

    function selectCard(idx) {
        if (flipping || gameOver) return;
        const card = grid[idx];
        if (card.revealed || card.matched) return;
        if (selected.length >= 2) return;

        AudioSystem.flip();
        card.revealed = true;
        card.flipAnim = 1;
        selected.push(idx);
        revealOrder.push(idx);
        seenCards.add(idx);

        if (selected.length === 2) {
            attempts++;
            flipping = true;

            const a = grid[selected[0]];
            const b = grid[selected[1]];

            if (a.symbol === b.symbol) {
                // Match!
                setTimeout(() => {
                    a.matched = true;
                    b.matched = true;
                    matchCount++;
                    AudioSystem.match();

                    const cx = (a.x + b.x) / 2 + cellSize / 2;
                    const cy = (a.y + b.y) / 2 + cellSize / 2;
                    particles.emit(cx, cy, 12, '#39ff14', { speed: 3, life: 25 });

                    selected = [];
                    flipping = false;

                    if (matchCount >= totalPairs) {
                        gameOver = true;
                        endGame();
                    }
                }, 400);
            } else {
                // No match — hide after delay
                setTimeout(() => {
                    a.revealed = false;
                    b.revealed = false;
                    a.flipAnim = 0;
                    b.flipAnim = 0;
                    selected = [];
                    flipping = false;
                    AudioSystem.wrong();
                }, 800);
            }
        }
    }

    function update() {
        // Animate flip
        for (const card of grid) {
            if (card.revealed && card.flipAnim < 1) {
                card.flipAnim = Math.min(1, card.flipAnim + 0.15);
            }
        }
        particles.update();
    }

    function draw() {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, W, H);

        // Header
        const elapsed = gameOver ? 0 : Math.floor((Date.now() - startTime) / 1000);
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${matchCount}/${totalPairs} Matched`, W / 2, 25);

        ctx.font = '12px Share Tech Mono';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'left';
        ctx.fillText(`ATTEMPTS: ${attempts}`, 15, 20);
        ctx.fillText(`TIME: ${elapsed}s`, 15, 36);
        ctx.textAlign = 'right';
        ctx.fillText(`GRID: ${gridCols}×${gridRows}`, W - 15, 20);
        ctx.fillText(`MEMORY: ${Math.round(memoryScore)}%`, W - 15, 36);

        // Memory score bar
        const barX = W / 2 - 80, barY = 35, barW = 160, barH = 10;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 3);
        ctx.fill();

        const mColor = memoryScore > 60 ? '#39ff14' : (memoryScore > 30 ? '#ffe600' : '#ff006e');
        ctx.fillStyle = mColor;
        ctx.beginPath();
        ctx.roundRect(barX, barY, (memoryScore / 100) * barW, barH, 3);
        ctx.fill();

        // Cards
        for (const card of grid) {
            const pad = 4;
            const cx = card.x + pad;
            const cy = card.y + pad;
            const cw = cellSize - pad * 2;
            const ch = cellSize - pad * 2;

            if (card.matched) {
                // Matched - show with glow
                ctx.fillStyle = 'rgba(57, 255, 20, 0.1)';
                ctx.strokeStyle = 'rgba(57, 255, 20, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(cx, cy, cw, ch, 8);
                ctx.fill();
                ctx.stroke();

                ctx.font = `${Math.floor(cw * 0.5)}px serif`;
                ctx.textAlign = 'center';
                ctx.globalAlpha = 0.5;
                ctx.fillText(card.symbol, cx + cw / 2, cy + ch / 2 + cw * 0.18);
                ctx.globalAlpha = 1;
            } else if (card.revealed) {
                // Revealed
                ctx.fillStyle = '#1a1a3a';
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.roundRect(cx, cy, cw, ch, 8);
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 0;

                ctx.font = `${Math.floor(cw * 0.5)}px serif`;
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.fillText(card.symbol, cx + cw / 2, cy + ch / 2 + cw * 0.18);
            } else {
                // Hidden
                ctx.fillStyle = '#1a1a2e';
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(cx, cy, cw, ch, 8);
                ctx.fill();
                ctx.stroke();

                // Neural pattern on back
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.font = `${Math.floor(cw * 0.35)}px serif`;
                ctx.textAlign = 'center';
                ctx.fillText('?', cx + cw / 2, cy + ch / 2 + cw * 0.12);
            }
        }

        particles.draw();
    }

    function endGame() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        AudioSystem.win();

        // Calculate memory score
        const efficiency = totalPairs / Math.max(1, attempts); // 1.0 = perfect
        const newMemoryScore = Math.min(100, Math.max(0, efficiency * 100));
        memoryScore = memoryScore * 0.6 + newMemoryScore * 0.4; // Smooth

        const patterns = [];
        if (efficiency > 0.7) patterns.push('Excellent memory');
        else if (efficiency < 0.3) patterns.push('Struggles with memory');

        // Check scanning pattern
        if (revealOrder.length > 6) {
            let leftToRight = 0;
            for (let i = 1; i < revealOrder.length; i++) {
                const prev = revealOrder[i - 1] % gridCols;
                const curr = revealOrder[i] % gridCols;
                if (curr > prev) leftToRight++;
            }
            if (leftToRight / revealOrder.length > 0.5) {
                patterns.push('Scans left-to-right');
            }
        }

        PlayerProfile.recordGame('memoryMatch', 'win', patterns);
        PlayerProfile.updatePatterns('memoryMatch', { memoryScore: Math.round(memoryScore), bestTime: elapsed });

        setTimeout(() => showEndScreen(elapsed), 500);
    }

    function showEndScreen(elapsed) {
        const overlay = document.getElementById('game-ui-overlay');
        const efficiency = Math.round((totalPairs / Math.max(1, attempts)) * 100);
        overlay.innerHTML = `
            <div class="game-start-overlay">
                <div class="game-overlay-msg" style="color: #39ff14">🏆 COMPLETE!</div>
                <div style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.9rem;">
                    Time: ${elapsed}s | Attempts: ${attempts}<br>
                    Efficiency: ${efficiency}% | Memory Score: ${Math.round(memoryScore)}%
                </div>
                <div style="color: var(--text-dim); font-family: var(--font-mono); font-size: 0.8rem;">
                    ${memoryScore > 65 ? '⬆️ Grid may increase next game' : (memoryScore < 35 ? '⬇️ Grid may decrease next game' : 'Grid stays the same')}
                </div>
                <button class="start-btn" onclick="MemoryMatchGame.restart()">PLAY AGAIN</button>
                <button class="back-btn" onclick="document.getElementById('back-btn').click()">BACK TO ARENA</button>
            </div>
        `;
    }

    function gameLoop() {
        if (!running) return;
        update();
        draw();
        animFrame = requestAnimationFrame(gameLoop);
    }

    function getInsights() {
        return [
            { label: 'Memory Score', value: `${Math.round(memoryScore)}%`, bar: memoryScore / 100, color: '#39ff14' },
            { label: 'Grid Size', value: `${gridCols}×${gridRows}`, color: '#b829dd' },
            { label: 'Attempts', value: `${attempts}`, color: '#ffe600' },
            { label: 'Matched', value: `${matchCount}/${totalPairs}`, color: '#00f0ff' }
        ];
    }

    return {
        name: 'memoryMatch',
        title: 'MEMORY MATCH',
        init,
        start(c) {
            init(c);
            canvas.width = W;
            canvas.height = H;

            const overlay = document.getElementById('game-ui-overlay');
            overlay.innerHTML = `
                <div class="game-start-overlay">
                    <div style="font-family: var(--font-display); font-size: 1.5rem; color: var(--neon-purple);">MEMORY MATCH</div>
                    <div class="start-instruction">
                        Click cards to reveal them. Match pairs.<br>
                        AI tracks your memory patterns and adjusts difficulty.<br>
                        Good memory → bigger grid. Bad memory → smaller grid.
                    </div>
                    <button class="start-btn" id="mm-start">START</button>
                </div>
            `;
            document.getElementById('mm-start').onclick = () => {
                overlay.innerHTML = '';
                running = true;
                AudioSystem.init();
                startTime = Date.now();
                gameLoop();
            };

            canvas.onclick = (e) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = W / rect.width;
                const scaleY = H / rect.height;
                const mx = (e.clientX - rect.left) * scaleX;
                const my = (e.clientY - rect.top) * scaleY;

                for (const card of grid) {
                    if (mx >= card.x && mx <= card.x + cellSize &&
                        my >= card.y && my <= card.y + cellSize) {
                        selectCard(card.idx);
                        return;
                    }
                }
            };
        },
        stop() {
            running = false;
            cancelAnimationFrame(animFrame);
            canvas.onclick = null;
        },
        restart() {
            running = false;
            cancelAnimationFrame(animFrame);
            document.getElementById('game-ui-overlay').innerHTML = '';
            init(canvas);
            canvas.width = W;
            canvas.height = H;
            running = true;
            startTime = Date.now();
            canvas.onclick = (e) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = W / rect.width;
                const scaleY = H / rect.height;
                const mx = (e.clientX - rect.left) * scaleX;
                const my = (e.clientY - rect.top) * scaleY;
                for (const card of grid) {
                    if (mx >= card.x && mx <= card.x + cellSize &&
                        my >= card.y && my <= card.y + cellSize) {
                        selectCard(card.idx);
                        return;
                    }
                }
            };
            gameLoop();
        },
        getInsights,
        getStatsBar() {
            return `<span><span class="stat-label">MATCHED</span> <span class="stat-value">${matchCount}/${totalPairs}</span></span>
                    <span><span class="stat-label">ATTEMPTS</span> <span class="stat-value">${attempts}</span></span>`;
        }
    };
})();
