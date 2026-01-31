/**
 * NEURAL ARENA — Main Application Controller
 */
(() => {
    const GAMES = [
        {
            id: 'pong',
            module: PongGame,
            icon: '🏓',
            title: 'Neural Pong',
            aiType: 'Q-Learning',
            desc: 'AI learns your paddle patterns with reinforcement learning. Adapts its positioning in real-time.',
            color: '#00f0ff'
        },
        {
            id: 'connect4',
            module: Connect4Game,
            icon: '🔴',
            title: 'Connect 4',
            aiType: 'Minimax + Adaptive',
            desc: 'AI uses minimax with alpha-beta pruning. Learns your opening patterns over multiple games.',
            color: '#ff006e'
        },
        {
            id: 'patternDuel',
            module: PatternDuelGame,
            icon: '⚔️',
            title: 'Pattern Duel',
            aiType: 'Markov Chains',
            desc: 'AI builds a probability model of your choices and predicts your next move. Stay unpredictable.',
            color: '#ffe600'
        },
        {
            id: 'dodgeArena',
            module: DodgeArenaGame,
            icon: '💥',
            title: 'Dodge Arena',
            aiType: 'Heatmap RL',
            desc: 'AI tracks your movement in a heatmap and learns to aim where you\'re going to dodge.',
            color: '#39ff14'
        },
        {
            id: 'memoryMatch',
            module: MemoryMatchGame,
            icon: '🧠',
            title: 'Memory Match',
            aiType: 'Adaptive Difficulty',
            desc: 'AI tracks your memory accuracy and adjusts grid size. Great memory? Bigger challenge.',
            color: '#b829dd'
        }
    ];

    let currentGame = null;
    let bgAnimation = null;
    let insightInterval = null;

    // ---- Screen Management ----
    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    // ---- Build Game Cards ----
    function buildGameCards() {
        const container = document.getElementById('game-cards');
        container.innerHTML = GAMES.map(g => {
            const stats = PlayerProfile.getGameStats(g.id);
            const played = stats.played || 0;
            const aiWinRate = played > 0 ? Math.round(((stats.losses || 0) / played) * 100) : 0;
            return `
                <div class="game-card" data-game="${g.id}" style="--card-color: ${g.color}">
                    <span class="card-icon">${g.icon}</span>
                    <div class="card-title">${g.title}</div>
                    <div class="card-ai-type" style="color: ${g.color}">${g.aiType}</div>
                    <div class="card-desc">${g.desc}</div>
                    <div class="card-stats">
                        <span>Played: ${played}</span>
                        <span class="win-rate">AI: ${aiWinRate}%</span>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                AudioSystem.click();
                launchGame(card.dataset.game);
            });
            card.addEventListener('mouseenter', () => AudioSystem.hover());
        });
    }

    // ---- Launch Game ----
    function launchGame(gameId) {
        const game = GAMES.find(g => g.id === gameId);
        if (!game) return;

        currentGame = game;
        showScreen('game-screen');
        document.getElementById('game-title').textContent = game.title;
        document.getElementById('game-ui-overlay').innerHTML = '';

        const canvas = document.getElementById('game-canvas');
        game.module.start(canvas);

        // Start insight updates
        updateInsights();
        insightInterval = setInterval(updateInsights, 500);
    }

    function updateInsights() {
        if (!currentGame) return;
        const insights = currentGame.module.getInsights();
        const container = document.getElementById('ai-insights-content');
        container.innerHTML = insights.map(i => `
            <div class="insight-item" style="border-left-color: ${i.color}">
                <div class="insight-label">${i.label}</div>
                <div class="insight-value">${i.value}</div>
                ${i.bar !== undefined ? `
                    <div class="insight-bar">
                        <div class="insight-bar-fill" style="width: ${Math.round(i.bar * 100)}%; background: ${i.color}"></div>
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Update stats bar
        const statsBar = document.getElementById('game-stats-bar');
        if (currentGame.module.getStatsBar) {
            statsBar.innerHTML = currentGame.module.getStatsBar();
        }
    }

    function exitGame() {
        if (currentGame) {
            currentGame.module.stop();
            currentGame = null;
        }
        clearInterval(insightInterval);
        showScreen('main-menu');
        buildGameCards(); // Refresh stats
        updateAdaptationBadge();
    }

    // ---- Player Profile ----
    function showProfile() {
        AudioSystem.click();
        showScreen('profile-screen');
        buildProfileContent();
    }

    function buildProfileContent() {
        const overview = PlayerProfile.getOverview();
        const container = document.getElementById('profile-content');

        // Adaptation level card
        let html = `
            <div class="profile-card" style="grid-column: 1 / -1;">
                <div class="adaptation-level">
                    <div class="adaptation-number">${overview.adaptationLevel}</div>
                    <div class="adaptation-label">AI Adaptation Level</div>
                </div>
            </div>
        `;

        // Game stats
        html += `<div class="profile-card">
            <h3>📊 GAME STATISTICS</h3>
            <div class="profile-stat-row">
                <span class="profile-stat-label">Total Games</span>
                <span class="profile-stat-value">${overview.totalGamesPlayed}</span>
            </div>`;

        for (const [key, stats] of Object.entries(overview.games)) {
            const game = GAMES.find(g => g.id === key);
            if (!game) continue;
            html += `
                <div class="profile-stat-row">
                    <span class="profile-stat-label">${game.icon} ${game.title}</span>
                    <span class="profile-stat-value">${stats.played} (W:${stats.wins} L:${stats.losses})</span>
                </div>`;
        }
        html += '</div>';

        // Detected patterns
        html += `<div class="profile-card">
            <h3>🔍 DETECTED PATTERNS</h3>`;
        if (overview.detectedPatterns.length === 0) {
            html += '<div style="color: var(--text-dim); font-size: 0.9rem;">Play more games for the AI to detect your patterns.</div>';
        } else {
            html += overview.detectedPatterns.map(p => `<span class="pattern-tag">${p}</span>`).join('');
        }
        html += '</div>';

        // AI Win Rate Trend
        html += `<div class="profile-card">
            <h3>📈 AI WIN RATE TREND</h3>
            <div class="win-chart-container"><canvas id="win-chart"></canvas></div>
        </div>`;

        // Reset button
        html += `<div class="profile-card" style="text-align: center;">
            <button class="back-btn" style="color: #ff006e; border-color: #ff006e44;" onclick="if(confirm('Reset all player data?')){PlayerProfile.reset();location.reload();}">
                Reset All Data
            </button>
        </div>`;

        container.innerHTML = html;

        // Draw mini chart
        setTimeout(() => drawWinChart(overview.winRateHistory), 50);
    }

    function drawWinChart(history) {
        const canvas = document.getElementById('win-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;

        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, 0, w, h);

        if (history.length < 2) {
            ctx.font = '12px Share Tech Mono';
            ctx.fillStyle = '#555';
            ctx.textAlign = 'center';
            ctx.fillText('Play more games to see trends', w / 2, h / 2);
            return;
        }

        // Draw line chart
        ctx.strokeStyle = '#ff006e';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff006e';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        const last20 = history.slice(-20);
        for (let i = 0; i < last20.length; i++) {
            const x = (i / (last20.length - 1)) * (w - 20) + 10;
            const y = h - (last20[i].aiWinRate / 100) * (h - 20) - 10;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Dots
        for (let i = 0; i < last20.length; i++) {
            const x = (i / (last20.length - 1)) * (w - 20) + 10;
            const y = h - (last20[i].aiWinRate / 100) * (h - 20) - 10;
            ctx.fillStyle = '#ff006e';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Labels
        ctx.font = '10px Share Tech Mono';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'left';
        ctx.fillText('0%', 2, h - 2);
        ctx.fillText('100%', 2, 12);
    }

    function updateAdaptationBadge() {
        const level = PlayerProfile.getAdaptationLevel();
        document.getElementById('menu-adaptation').textContent = `LV ${level}`;
    }

    // ---- Background Animation ----
    function startBgAnimation() {
        const bgCanvas = document.getElementById('bg-canvas');
        bgAnimation = new NeuralBackground(bgCanvas);
        function animate() {
            bgAnimation.update(performance.now());
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ---- Init ----
    function init() {
        buildGameCards();
        updateAdaptationBadge();
        startBgAnimation();

        // Navigation
        document.getElementById('back-btn').onclick = () => { AudioSystem.click(); exitGame(); };
        document.getElementById('profile-btn').onclick = showProfile;
        document.getElementById('profile-back-btn').onclick = () => { AudioSystem.click(); showScreen('main-menu'); };
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
