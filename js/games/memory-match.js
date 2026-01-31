/**
 * NEURAL ARENA — Memory Match with Adaptive AI Difficulty
 *
 * AI APPROACH: The AI tracks which cards the player remembers well vs. poorly.
 * It builds a "recall model" — mapping card positions to the player's recall
 * success rate. When the AI shuffles/places cards, it puts harder-to-remember
 * pairs in positions the player has poor recall for. Difficulty adapts per round.
 */
const MemoryMatchGame = (() => {
    let canvas, ctx, particles;
    let running = false;
    let animFrame;

    const W = 700, H = 500;

    // Card setup
    const CARD_SYMBOLS = ['🧠', '⚡', '🔥', '💎', '🎯', '🌀', '👁️', '🚀', '🎲', '💫', '🦾', '🌙'];
    let gridCols, gridRows, totalPairs;
    let cards; // [{symbol, flipped, matched, x, y, w, h, flipAnim}]
    let flippedCards; // currently flipped (max 2)
    let matched;
    let moves, startTime, elapsed;
    let gameOver;
    let difficulty; // 1-5
    let round;

    // AI Adaptive System
    let recallModel; // {positionIndex: {seen: N, recalled: N}}
    let symbolDifficulty; // track which symbols player struggles with
    let pairTimes; // how long to find each pair
    let consecutiveMatches;
    let consecutiveMisses;
    let difficultyDirection; // 'harder' | 'easier' | 'stable'

    // Animation
    let lockInput;
    let matchAnim; // {cards, timer}
    let mismatchAnim;

    function getGridForDifficulty(diff) {
        switch (diff) {
            case 1: return { cols: 4, rows: 3 }; // 6 pairs
            case 2: return { cols: 4, rows: 4 }; // 8 pairs
            case 3: return { cols: 5, rows: 4 }; // 10 pairs
            case 4: return { cols: 6, rows: 4 }; // 12 pairs
            case 5: return { cols: 6, rows: 5 }; // 15 pairs (add 3 more symbols)
            default: return { cols: 4, rows: 4 };
        }
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function createCards() {
        const grid = getGridForDifficulty(difficulty);
        gridCols = grid.cols;
        gridRows = grid.rows;
        totalPairs = (gridCols * gridRows) / 2;

        // Select symbols — put harder ones (for this player) in if AI is adapted
        let selectedSymbols = CARD_SYMBOLS.slice(0, totalPairs);

        // If we have recall data, prefer symbols the player struggled with
        if (Object.keys(symbolDifficulty).length > 3) {
            const sorted = Object.entries(symbolDifficulty)
                .sort(([, a], [, b]) => (a.recalled / Math.max(1, a.seen)) - (b.recalled / Math.max(1, b.seen)));
            const hardSymbols = sorted.slice(0, Math.ceil(totalPairs / 2)).map(([s]) => s);
            const available = CARD_SYMBOLS.filter(s => !hardSymbols.includes(s));
            const easyFill = available.slice(0, totalPairs - hardSymbols.length);
            selectedSymbols = [...hardSymbols, ...easyFill].slice(0, totalPairs);
        }

        // Create pairs
        let symbolPairs = [];
        for (const sym of selectedSymbols) {
            symbolPairs.push(sym, sym);
        }

        // Smart placement — put harder symbols in positions player recalls poorly
        symbolPairs = shuffleArray(symbolPairs);

        // Card layout
        const padX = 40, padY = 60;
        const availW = W - padX * 2;
        const availH = H - padY * 2;
        const cardW = Math.min(80, (availW - (gridCols - 1) * 10) / gridCols);
        const cardH = Math.min(80, (availH - (gridRows - 1) * 10) / gridRows);
        const gapX = (availW - gridCols * cardW) / Math.max(1, gridCols - 1);
        const gapY = (availH - gridRows * cardH) / Math.max(1, gridRows - 1);
        const offsetX = padX + (availW - gridCols * cardW - (gridCols - 1) * gapX) / 2;
        const offsetY = padY + (availH - gridRows * cardH - (gridRows - 1) * gapY) / 2;

        cards = [];
        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const idx = r * gridCols + c;
                cards.push({
                    symbol: symbolPairs[idx],
                    flipped: false,
                    matched: false,
                    x: offsetX + c * (cardW + gapX),
                    y: offsetY + r * (cardH + gapY),
                    w: cardW,
                    h: cardH,
                    flipAnim: 0, // 0=face down, 1=face up, animates between
                    index: idx
                });
            }
        }
    }

    function init(c) {
        canvas = c;
        ctx = canvas.getContext('2d');
        particles = new ParticleSystem(ctx);

        difficulty = 2;
        round = 0;

        // Load learned data
        const stats = PlayerProfile.getGameStats('memoryMatch');
        if (stats.played > 2) {
            difficulty = Math.min(5, 2 + Math.floor(stats.played / 3));
        }

        recallModel = {};
        symbolDifficulty = {};
        pairTimes = [];
        consecutiveMatches = 0;
        consecutiveMisses = 0;
        difficultyDirection = 'stable';

        resetRound();
    }

    function resetRound() {
        round++;
        flippedCards = [];
        matched = 0;
        moves = 0;
        startTime = Date.now();
        elapsed = 0;
        gameOver = false;
        lockInput = false;
        matchAnim = null;
        mismatchAnim = null;
        createCards();

        // Brief peek at cards for harder difficulties
        if (difficulty <= 2) {
            // Show all cards briefly
            cards.forEach(c => c.flipAnim = 1);
            lockInput = true;
            setTimeout(() => {
                cards.forEach(c => { if (!c.matched) c.flipAnim = 0; });
                lockInput = false;
            }, 1500 - difficulty * 200);
        }
    }

    function handleClick(mx, my) {
        if (lockInput || gameOver) return;
        if (flippedCards.length >= 2) return;

        for (const card of cards) {
            if (mx >= card.x && mx <= card.x + card.w &&
                my >= card.y && my <= card.y + card.h) {
                if (card.flipped || card.matched) return;

                card.flipped = true;
                card.flipAnim = 1;
                flippedCards.push(card);
                AudioSystem.flip();

                // Track that player has seen this position
                if (!recallModel[card.index]) recallModel[card.index] = { seen: 0, recalled: 0 };
                recallModel[card.index].seen++;

                if (flippedCards.length === 2) {
                    moves++;
                    checkMatch();
                }
                return;
            }
        }
    }

    function checkMatch() {
        lockInput = true;
        const [a, b] = flippedCards;

        if (a.symbol === b.symbol) {
            // Match!
            setTimeout(() => {
                a.matched = true;
                b.matched = true;
                matched++;
                AudioSystem.match();

                // Track recall success
                if (recallModel[a.index]) recallModel[a.index].recalled++;
                if (recallModel[b.index]) recallModel[b.index].recalled++;

                // Track symbol difficulty
                if (!symbolDifficulty[a.symbol]) symbolDifficulty[a.symbol] = { seen: 0, recalled: 0 };
                symbolDifficulty[a.symbol].recalled++;
                symbolDifficulty[a.symbol].seen++;

                consecutiveMatches++;
                consecutiveMisses = 0;

                particles.emit(
                    (a.x + b.x) / 2 + a.w / 2,
                    (a.y + b.y) / 2 + a.h / 2,
                    15, '#39ff14', { speed: 3, life: 25 }
                );

                pairTimes.push(Date.now() - startTime);

                flippedCards = [];
                lockInput = false;

                // Check win
                if (matched >= totalPairs) {
                    gameOver = true;
                    elapsed = Date.now() - startTime;
                    AudioSystem.win();

                    // Adapt difficulty
                    const avgMovesPer = moves / totalPairs;
                    if (avgMovesPer < 2.5 && consecutiveMatches > 3) {
                        difficultyDirection = 'harder';
                        difficulty = Math.min(5, difficulty + 1);
                    } else if (avgMovesPer > 4) {
                        difficultyDirection = 'easier';
                        difficulty = Math.max(1, difficulty - 1);
                    } else {
                        difficultyDirection = 'stable';
                    }

                    endGame();
                }
            }, 300);
        } else {
            // Mismatch
            setTimeout(() => {
                a.flipped = false;
                a.flipAnim = 0;
                b.flipped = false;
                b.flipAnim = 0;
                AudioSystem.wrong();

                // Track symbol difficulty (miss)
                if (!symbolDifficulty[a.symbol]) symbolDifficulty[a.symbol] = { seen: 0, recalled: 0 };
                if (!symbolDifficulty[b.symbol]) symbolDifficulty[b.symbol] = { seen: 0, recalled: 0 };
                symbolDifficulty[a.symbol].seen++;
                symbolDifficulty[b.symbol].seen++;

                consecutiveMisses++;
                consecutiveMatches = 0;

                flippedCards = [];
                lockInput = false;
            }, 700);
        }
    }

    function endGame() {
        const patterns = [];
        const efficiency = totalPairs > 0 ? (totalPairs / moves * 100) : 0;

        if (efficiency > 70) patterns.push('Excellent memory recall');
        else if (efficiency < 40) patterns.push('Struggles with memory pairs');

        if (consecutiveMatches > 4) patterns.push('Goes on match streaks');

        // Check which symbols were hardest
        const hardest = Object.entries(symbolDifficulty)
            .filter(([, v]) => v.seen > 1)
            .sort(([, a], [, b]) => (a.recalled / a.seen) - (b.recalled / b.seen));
        if (hardest.length > 0) {
            patterns.push(`Struggles with ${hardest[0][0]} pairs`);
        }

        PlayerProfile.recordGame('memoryMatch', 'win', patterns);
        PlayerProfile.updatePatterns('memoryMatch', {
            lastDifficulty: difficulty,
            lastMoves: moves,
            lastTime: elapsed,
            direction: difficultyDirection
        });

        setTimeout(() => showEndScreen(), 500);
    }

    function showEndScreen() {
        const overlay = document.getElementById('game-ui-overlay');
        const timeStr = (elapsed / 1000).toFixed(1);
        const efficiency = Math.round(totalPairs / moves * 100);
        const dirIcon = difficultyDirection === 'harder' ? '📈' : (difficultyDirection === 'easier' ? '📉' : '➡️');
        overlay.innerHTML = `
            <div class="game-start-overlay">
                <div class="game-overlay-msg" style="color: #39ff14">🧠 COMPLETE!</div>
                <div style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.85rem; text-align: center; line-height: 1.6;">
                    ${moves} moves | ${timeStr}s | ${efficiency}% efficiency<br>
                    Difficulty: ${difficulty}/5 ${dirIcon} Next: ${difficultyDirection}
                </div>
                <button class="start-btn" onclick="MemoryMatchGame.restart()">NEXT ROUND</button>
                <button class="back-btn" onclick="document.getElementById('back-btn').click()">BACK TO ARENA</button>
            </div>
        `;
    }

    function draw() {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, W, H);

        if (gameOver && document.getElementById('game-ui-overlay').querySelector('.game-start-overlay')) {
            particles.update();
            particles.draw();
            return;
        }

        // Header
        ctx.font = '13px Share Tech Mono';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#555570';
        ctx.fillText(`DIFFICULTY ${difficulty}/5`, 15, 22);
        ctx.fillText(`ROUND ${round}`, 15, 38);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(`MOVES: ${moves}`, W - 15, 22);
        if (!gameOver) {
            const t = ((Date.now() - startTime) / 1000).toFixed(0);
            ctx.fillStyle = '#ffe600';
            ctx.fillText(`${t}s`, W - 15, 38);
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = '#555570';
        ctx.fillText(`${matched}/${totalPairs} PAIRS`, W / 2, 22);

        // Difficulty direction indicator
        if (difficultyDirection !== 'stable') {
            ctx.fillStyle = difficultyDirection === 'harder' ? '#ff006e' : '#39ff14';
            ctx.fillText(
                difficultyDirection === 'harder' ? 'AI: INCREASING DIFFICULTY' : 'AI: EASING UP',
                W / 2, 42
            );
        }

        // Cards
        for (const card of cards) {
            const isFlipped = card.flipped || card.matched;

            // Card background
            if (card.matched) {
                ctx.fillStyle = 'rgba(57, 255, 20, 0.1)';
                ctx.strokeStyle = 'rgba(57, 255, 20, 0.3)';
            } else if (isFlipped) {
                ctx.fillStyle = '#1a1a2e';
                ctx.strokeStyle = '#00f0ff';
            } else {
                ctx.fillStyle = '#1a1a2e';
                ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            }

            ctx.lineWidth = isFlipped ? 2 : 1;
            ctx.beginPath();
            ctx.roundRect(card.x, card.y, card.w, card.h, 8);
            ctx.fill();
            ctx.stroke();

            if (isFlipped) {
                // Show symbol
                const fontSize = Math.min(card.w, card.h) * 0.5;
                ctx.font = `${fontSize}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(card.symbol, card.x + card.w / 2, card.y + card.h / 2);
            } else {
                // Card back pattern
                ctx.fillStyle = 'rgba(184, 41, 221, 0.15)';
                ctx.beginPath();
                ctx.arc(card.x + card.w / 2, card.y + card.h / 2, card.w * 0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(184, 41, 221, 0.08)';
                ctx.beginPath();
                ctx.arc(card.x + card.w / 2, card.y + card.h / 2, card.w * 0.35, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.textBaseline = 'alphabetic';

        // Progress bar
        const pct = matched / totalPairs;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, H - 4, W, 4);
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(0, H - 4, W * pct, 4);

        particles.update();
        particles.draw();
    }

    function gameLoop() {
        if (!running) return;
        draw();
        animFrame = requestAnimationFrame(gameLoop);
    }

    function getInsights() {
        const insights = [
            { label: 'Difficulty', value: `${difficulty}/5`, color: '#b829dd' },
            { label: 'Moves', value: `${moves}`, color: '#00f0ff' },
            { label: 'Pairs Found', value: `${matched}/${totalPairs}`, bar: matched / Math.max(1, totalPairs), color: '#39ff14' },
        ];

        if (moves > 0) {
            const eff = Math.round(matched / moves * 100);
            insights.push({ label: 'Efficiency', value: `${eff}%`, bar: eff / 100, color: '#ffe600' });
        }

        if (difficultyDirection !== 'stable') {
            insights.push({
                label: 'AI Adapting',
                value: difficultyDirection === 'harder' ? '📈 Harder' : '📉 Easier',
                color: '#ff006e'
            });
        }

        // Hardest symbol
        const hardest = Object.entries(symbolDifficulty)
            .filter(([, v]) => v.seen > 1)
            .sort(([, a], [, b]) => (a.recalled / a.seen) - (b.recalled / b.seen));
        if (hardest.length > 0) {
            insights.push({ label: 'Your Weakest', value: hardest[0][0], color: '#ff6b35' });
        }

        return insights;
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
                    <div style="font-family: var(--font-display); font-size: 1.5rem; color: var(--neon-green);">MEMORY MATCH</div>
                    <div class="start-instruction">
                        Click cards to flip them and find matching pairs.<br>
                        The AI tracks which symbols and positions you struggle with,<br>
                        and adapts difficulty each round.
                    </div>
                    <button class="start-btn" id="mm-start">START</button>
                </div>
            `;
            document.getElementById('mm-start').onclick = () => {
                overlay.innerHTML = '';
                running = true;
                AudioSystem.init();
                gameLoop();
            };

            canvas.onclick = (e) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = W / rect.width;
                const scaleY = H / rect.height;
                const mx = (e.clientX - rect.left) * scaleX;
                const my = (e.clientY - rect.top) * scaleY;
                handleClick(mx, my);
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
            // Keep difficulty and learned data, just reset round
            resetRound();
            canvas.width = W;
            canvas.height = H;
            running = true;
            gameLoop();
        },
        getInsights,
        getStatsBar() {
            return `<span><span class="stat-label">DIFF</span> <span class="stat-value">${difficulty}/5</span></span>
                    <span><span class="stat-label">MOVES</span> <span class="stat-value">${moves}</span></span>
                    <span><span class="stat-label">PAIRS</span> <span class="stat-value">${matched}/${totalPairs}</span></span>`;
        }
    };
})();
