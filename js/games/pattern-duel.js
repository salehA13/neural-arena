/**
 * NEURAL ARENA — Pattern Duel (Markov Chain Prediction)
 *
 * AI APPROACH: N-gram Markov chain that tracks sequences of player choices.
 * The AI builds a transition matrix from 1-gram through 4-gram patterns,
 * weighting longer matches higher. Over time it predicts the player's next
 * move with increasing accuracy. Like advanced RPS with 5 symbols.
 */
const PatternDuelGame = (() => {
    let canvas, ctx, particles;
    let running = false;
    let animFrame;

    const W = 700, H = 500;

    // Symbols: each beats the two after it (circular)
    const SYMBOLS = [
        { id: 0, icon: '🔥', name: 'FIRE',    color: '#ff6b35', beats: [2, 3] },
        { id: 1, icon: '💧', name: 'WATER',   color: '#00b4d8', beats: [0, 4] },
        { id: 2, icon: '🌿', name: 'NATURE',  color: '#39ff14', beats: [1, 3] },
        { id: 3, icon: '⚡', name: 'THUNDER', color: '#ffe600', beats: [1, 4] },
        { id: 4, icon: '🪨', name: 'STONE',   color: '#b829dd', beats: [0, 2] }
    ];

    let playerScore, aiScore, draws, round, maxRounds;
    let gameOver;
    let playerHistory, aiHistory, resultHistory;
    let lastPlayerChoice, lastAIChoice, lastResult;
    let showResult, resultTimer;
    let aiPrediction; // what AI predicted player would choose
    let predictionAccuracy; // rolling accuracy

    // Markov chain: maps n-gram keys to frequency of next choice
    // e.g. markov["0,1"] = {0: 3, 1: 1, 2: 5, 3: 0, 4: 2}
    const markov = {};
    const MAX_ORDER = 4; // up to 4-gram

    // Pattern detection
    let detectedPatterns = [];
    let streaks = { player: 0, ai: 0 };

    function init(c) {
        canvas = c;
        ctx = canvas.getContext('2d');
        particles = new ParticleSystem(ctx);
        playerScore = 0;
        aiScore = 0;
        draws = 0;
        round = 0;
        maxRounds = 25;
        gameOver = false;
        playerHistory = [];
        aiHistory = [];
        resultHistory = [];
        lastPlayerChoice = -1;
        lastAIChoice = -1;
        lastResult = '';
        showResult = false;
        resultTimer = 0;
        aiPrediction = -1;
        predictionAccuracy = 0;
        detectedPatterns = [];
        streaks = { player: 0, ai: 0 };
    }

    function updateMarkov(choice) {
        // Update all n-gram orders
        for (let order = 1; order <= MAX_ORDER; order++) {
            if (playerHistory.length >= order) {
                const key = playerHistory.slice(-order).join(',');
                if (!markov[key]) markov[key] = {};
                markov[key][choice] = (markov[key][choice] || 0) + 1;
            }
        }
    }

    function predictPlayer() {
        // Weighted prediction from highest order to lowest
        let prediction = -1;
        let bestConfidence = 0;

        for (let order = MAX_ORDER; order >= 1; order--) {
            if (playerHistory.length < order) continue;
            const key = playerHistory.slice(-order).join(',');
            const transitions = markov[key];
            if (!transitions) continue;

            const total = Object.values(transitions).reduce((a, b) => a + b, 0);
            if (total < 2) continue; // Need enough data

            let bestChoice = -1, bestCount = 0;
            for (const [choice, count] of Object.entries(transitions)) {
                if (count > bestCount) {
                    bestCount = count;
                    bestChoice = parseInt(choice);
                }
            }

            const confidence = (bestCount / total) * (1 + order * 0.3); // Higher order = more weight
            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                prediction = bestChoice;
            }
        }

        return prediction;
    }

    function chooseCounter(predictedPlayer) {
        if (predictedPlayer === -1) {
            // Random if no prediction
            return Math.floor(Math.random() * 5);
        }
        // Find a symbol that beats the predicted choice
        for (let i = 0; i < 5; i++) {
            if (SYMBOLS[i].beats.includes(predictedPlayer)) return i;
        }
        return Math.floor(Math.random() * 5);
    }

    function getResult(player, ai) {
        if (player === ai) return 'draw';
        if (SYMBOLS[player].beats.includes(ai)) return 'win';
        return 'loss';
    }

    function playerChoose(choice) {
        if (gameOver || showResult) return;
        round++;
        AudioSystem.select();

        // AI makes prediction and chooses counter
        aiPrediction = predictPlayer();
        const aiChoice = chooseCounter(aiPrediction);

        // Update markov BEFORE adding to history
        updateMarkov(choice);
        playerHistory.push(choice);
        aiHistory.push(aiChoice);

        const result = getResult(choice, aiChoice);
        resultHistory.push(result);

        if (result === 'win') {
            playerScore++;
            streaks.player++;
            streaks.ai = 0;
            AudioSystem.score();
        } else if (result === 'loss') {
            aiScore++;
            streaks.ai++;
            streaks.player = 0;
            AudioSystem.wrong();
        } else {
            draws++;
            streaks.player = 0;
            streaks.ai = 0;
            AudioSystem.hit();
        }

        // Track prediction accuracy
        if (aiPrediction === choice && aiPrediction !== -1) {
            predictionAccuracy++;
        }

        lastPlayerChoice = choice;
        lastAIChoice = aiChoice;
        lastResult = result;
        showResult = true;
        resultTimer = 90; // frames to show result

        // Detect patterns
        detectPatterns();

        // Emit particles
        const cx = W / 2, cy = H / 2 - 30;
        const color = result === 'win' ? '#00f0ff' : (result === 'loss' ? '#ff006e' : '#ffe600');
        particles.emit(cx, cy, 15, color, { speed: 3, life: 25 });

        if (round >= maxRounds) {
            gameOver = true;
            setTimeout(() => endGame(), 1500);
        }
    }

    function detectPatterns() {
        detectedPatterns = [];
        if (playerHistory.length < 5) return;

        // Check for repetition
        const last5 = playerHistory.slice(-5);
        const unique = new Set(last5);
        if (unique.size === 1) detectedPatterns.push(`Repeats ${SYMBOLS[last5[0]].name}`);

        // Check for cycling
        if (playerHistory.length >= 6) {
            const last6 = playerHistory.slice(-6);
            if (last6[0] === last6[2] && last6[2] === last6[4] &&
                last6[1] === last6[3] && last6[3] === last6[5]) {
                detectedPatterns.push('Alternating pattern');
            }
            if (last6[0] === last6[3] && last6[1] === last6[4] && last6[2] === last6[5]) {
                detectedPatterns.push('3-cycle pattern');
            }
        }

        // Check for favorite symbol
        const counts = [0, 0, 0, 0, 0];
        playerHistory.forEach(c => counts[c]++);
        const total = playerHistory.length;
        for (let i = 0; i < 5; i++) {
            if (counts[i] / total > 0.4) {
                detectedPatterns.push(`Favors ${SYMBOLS[i].name}`);
            }
        }

        // Win-stay, lose-shift detection
        let wslsCount = 0;
        for (let i = 1; i < resultHistory.length; i++) {
            if (resultHistory[i - 1] === 'win' && playerHistory[i] === playerHistory[i - 1]) wslsCount++;
            if (resultHistory[i - 1] === 'loss' && playerHistory[i] !== playerHistory[i - 1]) wslsCount++;
        }
        if (resultHistory.length > 5 && wslsCount / (resultHistory.length - 1) > 0.65) {
            detectedPatterns.push('Win-stay / Lose-shift');
        }
    }

    function endGame() {
        const won = playerScore > aiScore;
        const draw = playerScore === aiScore;
        if (won) AudioSystem.win(); else if (!draw) AudioSystem.lose();

        PlayerProfile.recordGame('patternDuel', won ? 'win' : (draw ? 'draw' : 'loss'), detectedPatterns);
        PlayerProfile.updatePatterns('patternDuel', {
            predictionAccuracy: round > 0 ? Math.round((predictionAccuracy / round) * 100) : 0,
            markovStates: Object.keys(markov).length
        });

        showEndScreen(won, draw);
    }

    function showEndScreen(won, draw) {
        const overlay = document.getElementById('game-ui-overlay');
        const msg = draw ? '🤝 DRAW' : (won ? '🏆 YOU WIN' : '🧠 AI WINS');
        const color = draw ? '#ffe600' : (won ? '#00f0ff' : '#ff006e');
        const acc = round > 0 ? Math.round((predictionAccuracy / round) * 100) : 0;
        overlay.innerHTML = `
            <div class="game-start-overlay">
                <div class="game-overlay-msg" style="color: ${color}">${msg}</div>
                <div style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.85rem;">
                    ${playerScore} — ${aiScore} (${draws} draws)<br>
                    AI predicted ${acc}% of your moves
                </div>
                <button class="start-btn" onclick="PatternDuelGame.restart()">PLAY AGAIN</button>
                <button class="back-btn" onclick="document.getElementById('back-btn').click()">BACK TO ARENA</button>
            </div>
        `;
    }

    function draw() {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, W, H);

        // Title + round
        ctx.font = '14px Share Tech Mono';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#555570';
        ctx.fillText(`ROUND ${round}/${maxRounds}`, W / 2, 25);

        // Scores
        ctx.font = '32px Orbitron';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.textAlign = 'right';
        ctx.fillText(playerScore, W / 2 - 40, 75);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.textAlign = 'center';
        ctx.fillText('—', W / 2, 75);
        ctx.fillStyle = 'rgba(255, 0, 110, 0.4)';
        ctx.textAlign = 'left';
        ctx.fillText(aiScore, W / 2 + 40, 75);

        // Labels
        ctx.font = '12px Share Tech Mono';
        ctx.fillStyle = '#555570';
        ctx.textAlign = 'right';
        ctx.fillText('YOU', W / 2 - 40, 92);
        ctx.textAlign = 'left';
        ctx.fillText('AI', W / 2 + 40, 92);

        // Result display
        if (showResult && lastPlayerChoice >= 0) {
            resultTimer--;
            if (resultTimer <= 0) showResult = false;

            const alpha = Math.min(1, resultTimer / 30);

            // Player choice
            ctx.font = '60px serif';
            ctx.textAlign = 'center';
            ctx.globalAlpha = alpha;
            ctx.fillText(SYMBOLS[lastPlayerChoice].icon, W / 2 - 100, 200);

            // VS
            ctx.font = '20px Orbitron';
            ctx.fillStyle = '#555570';
            ctx.fillText('VS', W / 2, 195);

            // AI choice
            ctx.font = '60px serif';
            ctx.fillText(SYMBOLS[lastAIChoice].icon, W / 2 + 100, 200);

            // Result text
            const resultText = lastResult === 'win' ? 'YOU WIN!' : (lastResult === 'loss' ? 'AI WINS!' : 'DRAW!');
            const resultColor = lastResult === 'win' ? '#00f0ff' : (lastResult === 'loss' ? '#ff006e' : '#ffe600');
            ctx.font = '24px Orbitron';
            ctx.fillStyle = resultColor;
            ctx.shadowColor = resultColor;
            ctx.shadowBlur = 15;
            ctx.fillText(resultText, W / 2, 260);
            ctx.shadowBlur = 0;

            // AI prediction indicator
            if (aiPrediction >= 0) {
                ctx.font = '12px Share Tech Mono';
                ctx.fillStyle = aiPrediction === lastPlayerChoice ? '#39ff14' : '#555570';
                ctx.fillText(
                    aiPrediction === lastPlayerChoice ? '✓ AI predicted correctly' : '✗ AI predicted wrong',
                    W / 2, 290
                );
            }

            ctx.globalAlpha = 1;
        } else if (!gameOver) {
            // Prompt
            ctx.font = '18px Rajdhani';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#8888aa';
            ctx.fillText('Choose your element', W / 2, 200);
        }

        // Choice history (last 10)
        const histStart = Math.max(0, playerHistory.length - 10);
        ctx.font = '10px Share Tech Mono';
        ctx.fillStyle = '#555570';
        ctx.textAlign = 'center';
        ctx.fillText('HISTORY', W / 2, 330);
        for (let i = histStart; i < playerHistory.length; i++) {
            const idx = i - histStart;
            const x = W / 2 - (Math.min(playerHistory.length, 10) - 1) * 18 + idx * 36;
            const r = resultHistory[i];
            ctx.font = '18px serif';
            ctx.globalAlpha = 0.3 + (idx / 10) * 0.7;
            ctx.fillText(SYMBOLS[playerHistory[i]].icon, x - 8, 358);
            ctx.fillText(SYMBOLS[aiHistory[i]].icon, x + 8, 375);
            // Result dot
            ctx.fillStyle = r === 'win' ? '#00f0ff' : (r === 'loss' ? '#ff006e' : '#ffe600');
            ctx.beginPath();
            ctx.arc(x, 385, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Streak indicator
        if (streaks.player >= 3) {
            ctx.font = '12px Share Tech Mono';
            ctx.fillStyle = '#00f0ff';
            ctx.textAlign = 'center';
            ctx.fillText(`🔥 ${streaks.player} win streak!`, W / 2, H - 20);
        } else if (streaks.ai >= 3) {
            ctx.font = '12px Share Tech Mono';
            ctx.fillStyle = '#ff006e';
            ctx.textAlign = 'center';
            ctx.fillText(`🧠 AI on ${streaks.ai} win streak`, W / 2, H - 20);
        }

        particles.update();
        particles.draw();
    }

    function gameLoop() {
        if (!running) return;
        draw();
        animFrame = requestAnimationFrame(gameLoop);
    }

    function createChoiceButtons() {
        const overlay = document.getElementById('game-ui-overlay');
        let html = '<div class="pd-choices">';
        for (const sym of SYMBOLS) {
            html += `<button class="pd-choice-btn" data-choice="${sym.id}" 
                       style="--card-color: ${sym.color}" 
                       title="${sym.name}">${sym.icon}</button>`;
        }
        html += '</div>';

        // Append without replacing
        const div = document.createElement('div');
        div.innerHTML = html;
        overlay.appendChild(div.firstElementChild);

        overlay.querySelectorAll('.pd-choice-btn').forEach(btn => {
            btn.onclick = () => playerChoose(parseInt(btn.dataset.choice));
        });
    }

    function getInsights() {
        const acc = round > 0 ? Math.round((predictionAccuracy / round) * 100) : 0;
        const insights = [
            { label: 'AI Prediction Accuracy', value: `${acc}%`, bar: acc / 100, color: '#ff006e' },
            { label: 'Markov States', value: `${Object.keys(markov).length}`, color: '#b829dd' },
            { label: 'Rounds Played', value: `${round}/${maxRounds}`, color: '#00f0ff' },
        ];

        if (detectedPatterns.length > 0) {
            insights.push({ label: 'Detected Pattern', value: detectedPatterns[0], color: '#ffe600' });
        }

        // Show frequency distribution
        if (playerHistory.length > 3) {
            const counts = [0, 0, 0, 0, 0];
            playerHistory.forEach(c => counts[c]++);
            const fav = counts.indexOf(Math.max(...counts));
            insights.push({
                label: 'Your Favorite',
                value: `${SYMBOLS[fav].icon} ${SYMBOLS[fav].name} (${Math.round(counts[fav] / playerHistory.length * 100)}%)`,
                color: SYMBOLS[fav].color
            });
        }

        return insights;
    }

    return {
        name: 'patternDuel',
        title: 'PATTERN DUEL',
        init,
        start(c) {
            init(c);
            canvas.width = W;
            canvas.height = H;

            const overlay = document.getElementById('game-ui-overlay');
            overlay.innerHTML = `
                <div class="game-start-overlay">
                    <div style="font-family: var(--font-display); font-size: 1.5rem; color: var(--neon-yellow);">PATTERN DUEL</div>
                    <div class="start-instruction">
                        Pick an element each round. Each beats 2 others.<br>
                        🔥→🌿🪨  💧→🔥⚡  🌿→💧⚡  ⚡→💧🪨  🪨→🔥🌿<br>
                        The AI builds a Markov chain of your choices and tries to predict your next move.
                    </div>
                    <button class="start-btn" id="pd-start">START</button>
                </div>
            `;
            document.getElementById('pd-start').onclick = () => {
                overlay.innerHTML = '';
                createChoiceButtons();
                running = true;
                AudioSystem.init();
                gameLoop();
            };
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
            createChoiceButtons();
            running = true;
            gameLoop();
        },
        getInsights,
        getStatsBar() {
            const acc = round > 0 ? Math.round((predictionAccuracy / round) * 100) : 0;
            return `<span><span class="stat-label">YOU</span> <span class="stat-value">${playerScore}</span></span>
                    <span><span class="stat-label">AI</span> <span class="stat-value">${aiScore}</span></span>
                    <span><span class="stat-label">AI READS</span> <span class="stat-value">${acc}%</span></span>`;
        }
    };
})();
