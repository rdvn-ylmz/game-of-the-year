# Game of the Year

This repository currently hosts a playable browser-game prototype called **Pocket Planet Janitor**.
It is a small JavaScript game workspace built around one-screen arcade gameplay, short score runs, and fast iteration on feel, tuning, and moment-to-moment clarity.

## What this project shows

- A playable browser prototype built with plain JavaScript modules
- Design-to-implementation workflow supported by concept, tuning, UX, and playtest docs
- Lightweight game-state, canvas, and UI structure without a heavy framework
- Iteration on gameplay systems such as movement, hazards, combo flow, and difficulty

## Prototype summary

In Pocket Planet Janitor, the player pilots a maintenance ship around a tiny planet, collects drifting debris, banks it at recycler zones, avoids hazards, and tries to survive a fast, score-driven run.

The project is desktop-first and designed for quick retries rather than long sessions.

## Run locally

Because the project is a static browser build, serving it with a small local HTTP server is the easiest way to run it:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

You can also open `index.html` directly, but a local server is the safer default when working with assets.

## Controls

- `A` / `Left Arrow`: rotate counter-clockwise
- `D` / `Right Arrow`: rotate clockwise
- `Space`: boost
- `E`: deposit carry in recycler zone
- `P`: pause or resume

## Repository structure

- `index.html`: main browser entry point
- `src/`: gameplay logic, state management, canvas systems, and tests
- `docs/`: concept notes, controls, tuning, UX flow, FTUE, and playtest material
- `assets/`: generated or supporting game assets

## Notes

- The repository name predates the current prototype direction.
- This is an iteration-heavy workspace, so the strongest value is in the playable loop plus the surrounding design and tuning process.
