# Come By

A top-down pixel-art herding game. You are a blue heeler cattle dog bringing
ducks, sheep, goats, cattle and wild ponies home to a ranch that grows into a
thriving valley. Calm, skilful herding always pays better than barking
everything home.

Vite + TypeScript + Canvas 2D. No engine, no art or audio files: every
sprite is a pixel grid in code and every sound is synthesised.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static build in dist/, deployable to GitHub Pages
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
(enable Pages with "GitHub Actions" as the source).

## Controls

| Action         | Keyboard               | Touch                       |
|----------------|------------------------|-----------------------------|
| Move           | WASD / arrows          | left thumb stick            |
| Sprint         | Shift                  | push the stick to the rim   |
| Bark           | Space                  | BARK                        |
| Nip            | E                      | NIP                         |
| Lie down       | hold Q                 | hold DOWN                   |
| Build          | B (on the ranch)       | BUILD                       |
| Ranch Ledger   | Tab                    | tap your goal (top left)    |
| Helper dogs    | H                      | HELP                        |
| Pause / sound  | Esc / M                | pause button                |

See `CLAUDE.md` for the design laws, palette and code map, and `TASKS.md`
for milestones and design decisions.
