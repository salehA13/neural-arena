# 🧠 Neural Arena

**The AI that learns *you*.**

A collection of 5 browser-based mini-games where every AI opponent genuinely adapts to your play style in real-time. No pre-programmed difficulty levels — the AI studies your patterns and evolves its strategy.

### [▶️ Play Now](https://saleha13.github.io/neural-arena)

---

## 🎮 Games

| Game | AI Technique | What It Learns |
|------|-------------|----------------|
| 🏓 **Neural Pong** | Q-Learning | Your paddle positioning and aim tendencies |
| 🔴 **Connect 4** | Minimax + Adaptive Heuristics | Your opening moves and column preferences |
| 🔮 **Pattern Duel** | Markov Chain Prediction | Sequences in your element choices |
| 💥 **Dodge Arena** | Movement Heatmap Tracking | Where you hide and how you dodge |
| 🧠 **Memory Match** | Recall Modeling | Which symbols/positions you struggle with |

## 🤖 How the AI Adapts

Each game uses a different machine learning technique:

- **Q-Learning (Pong):** The AI builds a Q-table mapping game states to optimal actions, updating rewards when it scores or gets scored on.
- **Minimax + Adaptation (Connect 4):** Classic minimax with alpha-beta pruning, but the evaluation heuristic shifts based on your opening patterns across games.
- **Markov Chains (Pattern Duel):** Builds 1-gram through 4-gram transition matrices from your choice history, predicting your next move with increasing accuracy.
- **Heatmap Tracking (Dodge Arena):** Records your position every frame into a spatial grid. Projectiles increasingly target your comfort zones and predicted dodge direction.
- **Recall Modeling (Memory Match):** Tracks your success rate per card position and symbol, then places harder symbols where you have poor recall.

## 📊 Player Profile

Your cross-game profile tracks:
- Total games played and win rates
- AI adaptation level (how much data the AI has on you)
- Detected behavioral patterns
- AI win rate trends over time

All data stored locally in `localStorage` — nothing leaves your browser.

## 🛠️ Tech Stack

- **Pure vanilla JS** — zero dependencies, zero build step
- **Canvas API** — all rendering
- **Web Audio API** — procedurally generated sound effects
- **localStorage** — persistent player profiles

Just open `index.html` and play.

## 📁 Project Structure

```
neural-arena/
├── index.html
├── css/style.css
├── js/
│   ├── app.js          # Main controller, screen management
│   ├── audio.js         # Procedural sound synthesis
│   ├── particles.js     # Particle effects + background animation
│   ├── profile.js       # Player profile & localStorage persistence
│   └── games/
│       ├── pong.js          # Q-learning pong
│       ├── connect4.js      # Adaptive minimax Connect 4
│       ├── pattern-duel.js  # Markov chain prediction game
│       ├── dodge-arena.js   # Heatmap-tracking dodge game
│       └── memory-match.js  # Adaptive memory card game
```

## License

MIT
