/**
 * NEURAL ARENA — Unified Player Profile
 * Tracks player behavior across all games, persists to localStorage.
 */
const PlayerProfile = (() => {
    const STORAGE_KEY = 'neural-arena-profile';

    const defaultProfile = () => ({
        version: 2,
        created: Date.now(),
        totalGamesPlayed: 0,
        adaptationScore: 0,
        games: {
            pong: { played: 0, wins: 0, losses: 0, patterns: {}, history: [] },
            connect4: { played: 0, wins: 0, losses: 0, patterns: {}, history: [] },
            patternDuel: { played: 0, wins: 0, losses: 0, patterns: {}, history: [] },
            dodgeArena: { played: 0, sessions: 0, patterns: {}, history: [] },
            memoryMatch: { played: 0, wins: 0, bestTime: null, patterns: {}, history: [] }
        },
        detectedPatterns: [],
        winRateHistory: [] // [{timestamp, game, aiWinRate}]
    });

    let profile = defaultProfile();

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                // Merge with defaults to handle new fields
                profile = { ...defaultProfile(), ...saved };
                for (const key of Object.keys(defaultProfile().games)) {
                    profile.games[key] = { ...defaultProfile().games[key], ...(saved.games?.[key] || {}) };
                }
            }
        } catch (e) {
            console.warn('Failed to load profile:', e);
            profile = defaultProfile();
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        } catch (e) {
            console.warn('Failed to save profile:', e);
        }
    }

    function getAdaptationLevel() {
        // Score based on total games played and AI learning progress
        const totalGames = Object.values(profile.games).reduce((s, g) => s + (g.played || 0), 0);
        const aiWins = Object.values(profile.games).reduce((s, g) => s + (g.losses || 0), 0);
        const patternsDetected = profile.detectedPatterns.length;
        return Math.min(99, Math.floor(totalGames * 0.5 + patternsDetected * 3 + aiWins * 0.3));
    }

    function recordGame(gameName, result, patterns = []) {
        const g = profile.games[gameName];
        if (!g) return;
        g.played++;
        profile.totalGamesPlayed++;
        if (result === 'win') g.wins++;
        else if (result === 'loss') g.losses++;

        // Record win rate history point
        const aiWinRate = g.played > 0 ? ((g.losses / g.played) * 100) : 0;
        profile.winRateHistory.push({
            timestamp: Date.now(),
            game: gameName,
            aiWinRate: Math.round(aiWinRate)
        });
        // Keep last 100
        if (profile.winRateHistory.length > 100) {
            profile.winRateHistory = profile.winRateHistory.slice(-100);
        }

        // Add detected patterns
        for (const p of patterns) {
            if (!profile.detectedPatterns.includes(p)) {
                profile.detectedPatterns.push(p);
            }
        }
        // Cap at 20 patterns
        if (profile.detectedPatterns.length > 20) {
            profile.detectedPatterns = profile.detectedPatterns.slice(-20);
        }

        profile.adaptationScore = getAdaptationLevel();
        save();
    }

    function updatePatterns(gameName, patternData) {
        const g = profile.games[gameName];
        if (!g) return;
        Object.assign(g.patterns, patternData);
        save();
    }

    function getGameStats(gameName) {
        return profile.games[gameName] || {};
    }

    function getOverview() {
        const stats = {};
        for (const [key, val] of Object.entries(profile.games)) {
            stats[key] = {
                played: val.played || 0,
                wins: val.wins || 0,
                losses: val.losses || 0,
                winRate: val.played > 0 ? Math.round((val.wins / val.played) * 100) : 0,
                aiWinRate: val.played > 0 ? Math.round((val.losses / val.played) * 100) : 0
            };
        }
        return {
            totalGamesPlayed: profile.totalGamesPlayed,
            adaptationLevel: getAdaptationLevel(),
            detectedPatterns: profile.detectedPatterns,
            winRateHistory: profile.winRateHistory,
            games: stats
        };
    }

    function reset() {
        profile = defaultProfile();
        save();
    }

    // Auto-load on init
    load();

    return {
        load, save, recordGame, updatePatterns, getGameStats, getOverview, getAdaptationLevel, reset,
        get data() { return profile; }
    };
})();
