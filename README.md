# 🧠 Neural Arena

**[▶ Play Now](https://saleha13.github.io/neural-arena/)**

An AI game arena where the opponent learns your play style in real-time and adapts its strategy. 5 mini-games, one adaptive AI that builds a behavioral profile of you as you play.

## Games

| Game | AI Technique | What It Learns |
|------|-------------|----------------|
| **Pong** | Q-learning | Your paddle positioning, aim patterns, reaction speed |
| **Connect 4** | Minimax + adaptive heuristics | Your opening preferences, column tendencies |
| **Pattern Duel** | Markov chain prediction | Your choice sequences, predicts your next move |
| **Dodge Arena** | Movement pattern tracking | Your dodge direction bias, reaction patterns |
| **Memory Match** | Recall pattern analysis | What you remember, adapts card placement |

## How It Works

Each game tracks your behavior and feeds it into a unified Player Profile. The AI starts average and gets harder as it learns your patterns. You can see what the AI has detected about you in the insights panel during gameplay and in the Player Profile dashboard.

**AI techniques used:**
- Q-learning with state-action value tables (Pong)
- Minimax with alpha-beta pruning and learned position weights (Connect 4)
- Markov chain sequence prediction (Pattern Duel)
- Movement heatmap tracking with predictive targeting (Dodge Arena)
- Recall probability modeling (Memory Match)

## Tech

Pure HTML/CSS/JavaScript. No frameworks, no build tools, no server. Everything runs client-side. Player profile persists in localStorage.

Built with Web Audio API for synth sound effects and Canvas for rendering.
