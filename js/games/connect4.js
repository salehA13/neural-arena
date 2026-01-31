/**
 * NEURAL ARENA — Connect 4 with Minimax + Adaptive Heuristics
 *
 * AI APPROACH: Minimax with alpha-beta pruning. The twist: the evaluation
 * heuristic adapts based on the player's opening patterns. If the player
 * always opens center, the AI starts counter-strategizing center play.
 * Shows move evaluation scores in real-time.
 */
const Connect4Game = (() => {
    let canvas, ctx, particles;
    let running = false;
    let animFrame;

    const COLS = 7, ROWS = 6;
    const CELL = 64;
    const W = COLS * CELL + 40;
    const H = ROWS * CELL + 100;
    const PAD_X = 20, PAD_Y = 60;

    let board; // 0=empty, 1=player, 2=AI
    let currentPlayer; // 1 or 2
    let gameOver;
    let winner;
    let winCells;
    let hoverCol;
    let moveEvals; // Evaluation scores for each column
    let thinkingText;
    let moveHistory;
    let dropping; // Animation state

    // Adaptive AI
    let playerOpenings = {}; // Track first 3 moves
    let openingWeight = {}; // Learned weights for columns
    let aiDepth = 5; // Search depth (increases over games)
    let gamesPlayed = 0;

    function newBoard() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    function init(c) {
        canvas = c;
        ctx = canvas.getContext('2d');
        particles = new ParticleSystem(ctx);
        board = newBoard();
        currentPlayer = 1;
        gameOver = false;
        winner = 0;
        winCells = [];
        hoverCol = -1;
        moveEvals = [];
        thinkingText = '';
        moveHistory = [];
        dropping = null;

        const stats = PlayerProfile.getGameStats('connect4');
        gamesPlayed = stats.played || 0;
        aiDepth = Math.min(7, 5 + Math.floor(gamesPlayed / 3));
    }

    function getValidCols(b) {
        const valid = [];
        for (let c = 0; c < COLS; c++) {
            if (b[0][c] === 0) valid.push(c);
        }
        return valid;
    }

    function dropPiece(b, col, player) {
        for (let r = ROWS - 1; r >= 0; r--) {
            if (b[r][col] === 0) {
                b[r][col] = player;
                return r;
            }
        }
        return -1;
    }

    function undoPiece(b, col) {
        for (let r = 0; r < ROWS; r++) {
            if (b[r][col] !== 0) {
                b[r][col] = 0;
                return;
            }
        }
    }

    function checkWin(b, player) {
        // Horizontal, vertical, diagonal checks
        const cells = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
                for (const [dr, dc] of dirs) {
                    const line = [];
                    let ok = true;
                    for (let i = 0; i < 4; i++) {
                        const nr = r + dr * i, nc = c + dc * i;
                        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== player) {
                            ok = false;
                            break;
                        }
                        line.push([nr, nc]);
                    }
                    if (ok) return line;
                }
            }
        }
        return null;
    }

    function evaluate(b) {
        // Score the board from AI's perspective
        let score = 0;

        // Center control bonus (adaptive)
        for (let r = 0; r < ROWS; r++) {
            if (b[r][3] === 2) score += 3;
            if (b[r][3] === 1) score -= 3;
        }

        // Evaluate all windows of 4
        function evalWindow(cells) {
            let ai = 0, pl = 0, empty = 0;
            for (const [r, c] of cells) {
                if (b[r][c] === 2) ai++;
                else if (b[r][c] === 1) pl++;
                else empty++;
            }
            if (ai === 4) return 10000;
            if (pl === 4) return -10000;
            if (ai === 3 && empty === 1) return 50;
            if (pl === 3 && empty === 1) return -80; // Slightly overweight blocking
            if (ai === 2 && empty === 2) return 10;
            if (pl === 2 && empty === 2) return -10;
            return 0;
        }

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
                for (const [dr, dc] of dirs) {
                    const cells = [];
                    let valid = true;
                    for (let i = 0; i < 4; i++) {
                        const nr = r + dr * i, nc = c + dc * i;
                        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) { valid = false; break; }
                        cells.push([nr, nc]);
                    }
                    if (valid) score += evalWindow(cells);
                }
            }
        }

        // Apply learned opening weights
        for (let c = 0; c < COLS; c++) {
            if (openingWeight[c]) {
                for (let r = 0; r < ROWS; r++) {
                    if (b[r][c] === 2) score += openingWeight[c] * 2;
                }
            }
        }

        return score;
    }

    function minimax(b, depth, alpha, beta, maximizing) {
        const aiWin = checkWin(b, 2);
        const plWin = checkWin(b, 1);
        if (aiWin) return 100000 + depth;
        if (plWin) return -100000 - depth;
        const valid = getValidCols(b);
        if (valid.length === 0 || depth === 0) return evaluate(b);

        if (maximizing) {
            let maxEval = -Infinity;
            for (const col of valid) {
                dropPiece(b, col, 2);
                const ev = minimax(b, depth - 1, alpha, beta, false);
                undoPiece(b, col);
                maxEval = Math.max(maxEval, ev);
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const col of valid) {
                dropPiece(b, col, 1);
                const ev = minimax(b, depth - 1, alpha, beta, true);
                undoPiece(b, col);
                minEval = Math.min(minEval, ev);
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    function aiMove() {
        thinkingText = 'AI thinking...';
        const valid = getValidCols(board);
        moveEvals = Array(COLS).fill(null);

        // Use requestAnimationFrame to keep UI responsive
        setTimeout(() => {
            let bestCol = valid[0];
            let bestScore = -Infinity;

            for (const col of valid) {
                dropPiece(board, col, 2);
                const score = minimax(board, aiDepth - 1, -Infinity, Infinity, false);
                undoPiece(board, col);
                moveEvals[col] = score;
                if (score > bestScore) {
                    bestScore = score;
                    bestCol = col;
                }
            }

            // Format thinking text
            const evalStrs = valid.map(c => `C${c + 1}:${moveEvals[c] > 0 ? '+' : ''}${Math.round(moveEvals[c])}`);
            thinkingText = `Eval: ${evalStrs.join(' | ')}`;

            // Drop with animation
            animateDrop(bestCol, 2, () => {
                moveHistory.push(bestCol);
                const win = checkWin(board, 2);
                if (win) {
                    gameOver = true;
                    winner = 2;
                    winCells = win;
                    AudioSystem.lose();
                    endGame();
                } else if (getValidCols(board).length === 0) {
                    gameOver = true;
                    endGame();
                } else {
                    currentPlayer = 1;
                }
            });
        }, 300);
    }

    function animateDrop(col, player, callback) {
        let targetRow = -1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][col] === 0) { targetRow = r; break; }
        }
        if (targetRow === -1) { callback(); return; }

        dropping = { col, player, y: PAD_Y, targetY: PAD_Y + targetRow * CELL + CELL / 2, row: targetRow, speed: 0 };
        const dropAnim = () => {
            if (!dropping) return;
            dropping.speed += 1.2;
            dropping.y += dropping.speed;
            if (dropping.y >= dropping.targetY) {
                dropping.y = dropping.targetY;
                board[targetRow][col] = player;
                AudioSystem.place();
                const cx = PAD_X + col * CELL + CELL / 2;
                const cy = PAD_Y + targetRow * CELL + CELL / 2;
                particles.emit(cx, cy, 10, player === 1 ? '#00f0ff' : '#ff006e', { speed: 2, life: 15 });
                dropping = null;
                callback();
                return;
            }
            requestAnimationFrame(dropAnim);
        };
        requestAnimationFrame(dropAnim);
    }

    function playerMove(col) {
        if (gameOver || currentPlayer !== 1 || dropping) return;
        if (board[0][col] !== 0) return;

        AudioSystem.select();
        currentPlayer = 0; // Lock input

        animateDrop(col, 1, () => {
            moveHistory.push(col);
            // Track opening patterns
            if (moveHistory.length <= 6) {
                const key = moveHistory.filter((_, i) => i % 2 === 0).join(',');
                playerOpenings[key] = (playerOpenings[key] || 0) + 1;
            }

            const win = checkWin(board, 1);
            if (win) {
                gameOver = true;
                winner = 1;
                winCells = win;
                AudioSystem.win();
                endGame();
            } else if (getValidCols(board).length === 0) {
                gameOver = true;
                endGame();
            } else {
                currentPlayer = 2;
                aiMove();
            }
        });
    }

    function endGame() {
        const patterns = [];
        // Analyze player's column preferences
        const colCounts = Array(COLS).fill(0);
        moveHistory.forEach((c, i) => { if (i % 2 === 0) colCounts[c]++; });
        const total = colCounts.reduce((a, b) => a + b, 0);
        if (total > 0) {
            const centerPct = Math.round((colCounts[3] / total) * 100);
            if (centerPct > 40) patterns.push('Opens center in Connect 4');
            const leftPct = Math.round(((colCounts[0] + colCounts[1] + colCounts[2]) / total) * 100);
            if (leftPct > 60) patterns.push('Favors left side in Connect 4');
            const rightPct = Math.round(((colCounts[4] + colCounts[5] + colCounts[6]) / total) * 100);
            if (rightPct > 60) patterns.push('Favors right side in Connect 4');

            // Update adaptive weights
            for (let c = 0; c < COLS; c++) {
                openingWeight[c] = (openingWeight[c] || 0) + colCounts[c] * 0.5;
            }
        }

        const result = winner === 1 ? 'win' : (winner === 2 ? 'loss' : 'draw');
        PlayerProfile.recordGame('connect4', result, patterns);

        setTimeout(() => showEndScreen(), 800);
    }

    function showEndScreen() {
        const overlay = document.getElementById('game-ui-overlay');
        const msg = winner === 1 ? '🏆 YOU WIN' : (winner === 2 ? '🧠 AI WINS' : '🤝 DRAW');
        const color = winner === 1 ? '#00f0ff' : (winner === 2 ? '#ff006e' : '#ffe600');
        overlay.innerHTML = `
            <div class="game-start-overlay">
                <div class="game-overlay-msg" style="color: ${color}">${msg}</div>
                <div style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.85rem;">
                    AI Search Depth: ${aiDepth} | States Evaluated: ~${Math.pow(7, aiDepth).toLocaleString()}
                </div>
                <button class="start-btn" onclick="Connect4Game.restart()">PLAY AGAIN</button>
                <button class="back-btn" onclick="document.getElementById('back-btn').click()">BACK TO ARENA</button>
            </div>
        `;
    }

    function draw() {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, W, H);

        // Board background
        ctx.fillStyle = '#111128';
        ctx.beginPath();
        ctx.roundRect(PAD_X - 5, PAD_Y - 5, COLS * CELL + 10, ROWS * CELL + 10, 12);
        ctx.fill();

        // Hover indicator
        if (hoverCol >= 0 && currentPlayer === 1 && !gameOver && !dropping) {
            ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
            ctx.fillRect(PAD_X + hoverCol * CELL, PAD_Y, CELL, ROWS * CELL);

            // Ghost piece
            ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(PAD_X + hoverCol * CELL + CELL / 2, PAD_Y / 2, CELL / 2 - 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Grid cells
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cx = PAD_X + c * CELL + CELL / 2;
                const cy = PAD_Y + r * CELL + CELL / 2;
                const radius = CELL / 2 - 6;

                // Empty hole
                ctx.fillStyle = '#0a0a12';
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();

                // Piece
                if (board[r][c] !== 0) {
                    const isWin = winCells.some(([wr, wc]) => wr === r && wc === c);
                    const color = board[r][c] === 1 ? '#00f0ff' : '#ff006e';
                    ctx.fillStyle = color;
                    if (isWin) {
                        ctx.shadowColor = color;
                        ctx.shadowBlur = 15;
                    }
                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        }

        // Dropping animation
        if (dropping) {
            const cx = PAD_X + dropping.col * CELL + CELL / 2;
            const color = dropping.player === 1 ? '#00f0ff' : '#ff006e';
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(cx, dropping.y, CELL / 2 - 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Move evaluation display
        if (moveEvals.length > 0 && !gameOver) {
            ctx.font = '11px Share Tech Mono';
            ctx.textAlign = 'center';
            for (let c = 0; c < COLS; c++) {
                if (moveEvals[c] !== null) {
                    const cx = PAD_X + c * CELL + CELL / 2;
                    const val = Math.round(moveEvals[c]);
                    ctx.fillStyle = val > 0 ? '#39ff14' : (val < 0 ? '#ff006e' : '#555');
                    ctx.fillText(val > 0 ? `+${val}` : `${val}`, cx, H - 8);
                }
            }
        }

        // Thinking text
        if (thinkingText && !gameOver) {
            ctx.font = '12px Share Tech Mono';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffe600';
            ctx.fillText(thinkingText, W / 2, H - 25);
        }

        particles.update();
        particles.draw();
    }

    function gameLoop() {
        if (!running) return;
        draw();
        animFrame = requestAnimationFrame(gameLoop);
    }

    function getInsights() {
        const stats = PlayerProfile.getGameStats('connect4');
        return [
            { label: 'AI Depth', value: `${aiDepth} ply`, color: '#ff006e' },
            { label: 'Games Learned', value: `${stats.played || 0}`, color: '#b829dd' },
            { label: 'Move History', value: `${moveHistory.length}`, color: '#00f0ff' },
            { label: 'Openings Tracked', value: `${Object.keys(playerOpenings).length}`, color: '#39ff14' }
        ];
    }

    return {
        name: 'connect4',
        title: 'CONNECT 4',
        init,
        start(c) {
            init(c);
            canvas.width = W;
            canvas.height = H;

            const overlay = document.getElementById('game-ui-overlay');
            overlay.innerHTML = `
                <div class="game-start-overlay">
                    <div style="font-family: var(--font-display); font-size: 1.5rem; color: var(--neon-pink);">CONNECT 4</div>
                    <div class="start-instruction">Click a column to drop your piece.<br>AI uses Minimax with adaptive heuristics.<br>It learns your opening patterns over time.</div>
                    <button class="start-btn" id="c4-start">START</button>
                </div>
            `;
            document.getElementById('c4-start').onclick = () => {
                overlay.innerHTML = '';
                running = true;
                AudioSystem.init();
                gameLoop();
            };

            canvas.onmousemove = (e) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = W / rect.width;
                const mx = (e.clientX - rect.left) * scaleX;
                hoverCol = Math.floor((mx - PAD_X) / CELL);
                if (hoverCol < 0 || hoverCol >= COLS) hoverCol = -1;
            };
            canvas.onclick = (e) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = W / rect.width;
                const mx = (e.clientX - rect.left) * scaleX;
                const col = Math.floor((mx - PAD_X) / CELL);
                if (col >= 0 && col < COLS) playerMove(col);
            };
        },
        stop() {
            running = false;
            cancelAnimationFrame(animFrame);
            canvas.onmousemove = null;
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
            gameLoop();
        },
        getInsights,
        getStatsBar() {
            return `<span><span class="stat-label">DEPTH</span> <span class="stat-value">${aiDepth}</span></span>
                    <span><span class="stat-label">MOVES</span> <span class="stat-value">${moveHistory.length}</span></span>`;
        }
    };
})();
