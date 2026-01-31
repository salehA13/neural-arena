/**
 * NEURAL ARENA — Main App Controller
 * Handles screen switching, game cards, game lifecycle, and background animation.
 */
const App = (() => {
    const GAMES = [
        {
            id: 'pong',
            instance: PongGame,
            icon: '🏓',
            title: 'NEURAL PONG',
            aiType: 'Q-Learning',
            desc: 'Classic pong — but the AI learns your paddle patterns with reinforcement learning.',
            color: '#00f0ff'
        },
        {
            id: 'connect4',
            instance: Connect4Game,
            icon: '🔴',
            title: 'CONNECT 4',
            aiType: 'Minimax + Adaptive',
            desc: 'Strategic Connect 4 with minimax AI that adapts its heuristics to your openings.',
            color: '#ff006e'
        },
        {
            id: 'patternDuel',
            instance: PatternDuelGame,
            icon: '🔮',
            title: 'PATTERN DUEL',
            aiType: 'Markov Chain',
            desc: 'Pick elements in a prediction duel. The AI builds a Markov chain of your choices.',
            color: '#ffe600'
        },
        {
            id: 'dodgeArena',
            instance: DodgeArenaGame,
            icon: '💥',
            title: 'DODGE ARENA',
            aiType: 'Heatmap Tracking',
            desc: 'Dodge projectiles as the AI learns your movement patterns and aims where you hide.',
            color: '#ff6b35'
        },
        {
            id: 'memoryMatch',
            instance: MemoryMatchGame,
            icon: '🧠',
            title: 'MEMORY MATCH',
            aiType: 'Recall Modeling',
            desc: 'Match card pairs while the AI adapts difficulty based on your recall patterns.',
            color: '#39ff14'
        }
    ];

    let currentGame = null;
    let bgAnimation = null;
    let insightInterval = null;

    // DOM refs
    const screens = {
        menu: document.getElementById('main-menu'),
        game: document.getElementById('game-screen'),
        profile: document.getElementById('profile-screen')
    };

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[name].classList.add('active');

        if (name === 'menu') {
            startBgAnimation();
            updateMenuBadge();
        } else {
            stopBgAnimation();
        }
    }

    // --- Menu ---

    function buildGameCards() {
        const container = document.getElementById('game-cards');
        const overview = PlayerProfile.getOverview();

        container.innerHTML = GAMES.map(game => {
            const stats = overview.games[game.id] || {};
            const played = stats.played || 0;
            const winRate = stats.winRate || 0;

            return `
                <div class="game-card fade-in" data-game="${game.id}" style="--card-color: ${game.color}">
                    <span class="card-icon">${game.icon}</span>
                    <div class="card-title">${game.title}</div>
                    <div class="card-ai-type" style="color: ${game.color}">${game.aiType}</div>
                    <div class="card-desc">${game.desc}</div>
                    <div class="card-stats">
                        <span>Played: ${played}</span>
                        <span class="win-rate">${played > 0 ? `${winRate}% WR` : 'NEW'}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click handlers
        container.querySelectorAll('.game-card').forEach(card => {
            card.onclick = () => {
                AudioSystem.click();
                launchGame(card.dataset.game);
            };
        });
    }

    function updateMenuBadge() {
        const badge = document.getElementById('menu-adaptation');
        const level = PlayerProfile.getAdaptationLevel();
        badge.textContent = `LV ${level}`;
    }

    // --- Background Animation ---

    let neuralBg = null;

    function startBgAnimation() {
        const canvas = document.getElementById('bg-canvas');
        if (!neuralBg) {
            neuralBg = new NeuralBackground(canvas);
        }
        function animate(t) {
            if (!screens.menu.classList.contains('active')) return;
            neuralBg.update(t);
            bgAnimation = requestAnimationFrame(animate);
        }
        bgAnimation = requestAnimationFrame(animate);
    }

    function stopBgAnimation() {
        if (bgAnimation) {
            cancelAnimationFrame(bgAnimation);
            bgAnimation = null;
        }
    }

    // --- Game Lifecycle ---

    function launchGame(gameId) {
        const gameDef = GAMES.find(g => g.id === gameId);
        if (!gameDef) return;

        currentGame = gameDef;
        const instance = gameDef.instance;

        // Set up game screen
        document.getElementById('game-title').textContent = gameDef.title;
        document.getElementById('game-ui-overlay').innerHTML = '';

        showScreen('game');

        // Initialize game on canvas
        const canvas = document.getElementById('game-canvas');
        instance.start(canvas);

        // Start insight updates
        updateInsights();
        insightInterval = setInterval(updateInsights, 1000);
        updateStatsBar();
    }

    function stopCurrentGame() {
        if (currentGame) {
            currentGame.instance.stop();
            clearInterval(insightInterval);
            insightInterval = null;
            currentGame = null;
        }
        document.getElementById('game-ui-overlay').innerHTML = '';
    }

    function updateInsights() {
        if (!currentGame) return;
        const insights = currentGame.instance.getInsights();
        const container = document.getElementById('ai-insights-content');

        container.innerHTML = insights.map(insight => {
            let barHtml = '';
            if (insight.bar !== undefined) {
                barHtml = `
                    <div class="insight-bar">
                        <div class="insight-bar-fill" style="width: ${Math.round(insight.bar * 100)}%; background: ${insight.color}"></div>
                    </div>
                `;
            }
            return `
                <div class="insight-item" style="border-left-color: ${insight.color}">
                    <div class="insight-label">${insight.label}</div>
                    <div class="insight-value">${insight.value}</div>
                    ${barHtml}
                </div>
            `;
        }).join('');

        updateStatsBar();
    }

    function updateStatsBar() {
        if (!currentGame) return;
        const bar = document.getElementById('game-stats-bar');
        bar.innerHTML = currentGame.instance.getStatsBar();
    }

    // --- Profile Screen ---

    function showProfile() {
        showScreen('profile');
        renderProfile();
    }

    function renderProfile() {
        const overview = PlayerProfile.getOverview();
        const container = document.getElementById('profile-content');

        // Adaptation Level Card
        let html = `
            <div class="profile-card">
                <div class="adaptation-level">
                    <div class="adaptation-number">${overview.adaptationLevel}</div>
                    <div class="adaptation-label">AI Adaptation Level</div>
                </div>
                <div class="profile-stat-row">
                    <span class="profile-stat-label">Total Games</span>
                    <span class="profile-stat-value">${overview.totalGamesPlayed}</span>
                </div>
            </div>
        `;

        // Per-game stats
        for (const gameDef of GAMES) {
            const stats = overview.games[gameDef.id];
            if (!stats) continue;
            html += `
                <div class="profile-card">
                    <h3>${gameDef.icon} ${gameDef.title}</h3>
                    <div class="profile-stat-row">
                        <span class="profile-stat-label">Played</span>
                        <span class="profile-stat-value">${stats.played}</span>
                    </div>
                    <div class="profile-stat-row">
                        <span class="profile-stat-label">Win Rate</span>
                        <span class="profile-stat-value" style="color: ${stats.winRate >= 50 ? '#39ff14' : '#ff006e'}">${stats.winRate}%</span>
                    </div>
                    <div class="profile-stat-row">
                        <span class="profile-stat-label">AI Win Rate</span>
                        <span class="profile-stat-value" style="color: ${stats.aiWinRate >= 50 ? '#ff006e' : '#39ff14'}">${stats.aiWinRate}%</span>
                    </div>
                </div>
            `;
        }

        // Detected Patterns
        if (overview.detectedPatterns.length > 0) {
            html += `
                <div class="profile-card">
                    <h3>🔍 DETECTED PATTERNS</h3>
                    <div>${overview.detectedPatterns.map(p => `<span class="pattern-tag">${p}</span>`).join('')}</div>
                </div>
            `;
        }

        // AI Win Rate Over Time (text-based since we don't have a chart lib)
        if (overview.winRateHistory.length > 5) {
            const recent = overview.winRateHistory.slice(-10);
            const avg = Math.round(recent.reduce((a, r) => a + r.aiWinRate, 0) / recent.length);
            html += `
                <div class="profile-card">
                    <h3>📈 AI PERFORMANCE TREND</h3>
                    <div class="profile-stat-row">
                        <span class="profile-stat-label">Recent AI Win Rate</span>
                        <span class="profile-stat-value">${avg}%</span>
                    </div>
                    <div style="display: flex; align-items: flex-end; gap: 3px; height: 60px; margin-top: 12px;">
                        ${recent.map(r => {
                            const h = Math.max(4, r.aiWinRate * 0.6);
                            return `<div style="flex:1; height:${h}px; background: linear-gradient(to top, #ff006e, #b829dd); border-radius: 2px;" title="${r.aiWinRate}%"></div>`;
                        }).join('')}
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">
                        <span>Older</span><span>Recent</span>
                    </div>
                </div>
            `;
        }

        // Reset button
        html += `
            <div class="profile-card" style="text-align: center;">
                <button class="back-btn" onclick="if(confirm('Reset all data?')){PlayerProfile.reset();App.showProfile();}" style="color: #ff006e; border-color: #ff006e;">
                    🗑️ RESET ALL DATA
                </button>
            </div>
        `;

        container.innerHTML = html;
    }

    // --- Init ---

    function init() {
        buildGameCards();
        updateMenuBadge();
        startBgAnimation();

        // Navigation
        document.getElementById('back-btn').onclick = () => {
            AudioSystem.click();
            stopCurrentGame();
            buildGameCards(); // Refresh stats
            showScreen('menu');
        };

        document.getElementById('profile-btn').onclick = () => {
            AudioSystem.click();
            showProfile();
        };

        document.getElementById('profile-back-btn').onclick = () => {
            AudioSystem.click();
            showScreen('menu');
        };

        // Init audio on first interaction
        document.addEventListener('click', () => AudioSystem.init(), { once: true });
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { showProfile, launchGame };
})();
