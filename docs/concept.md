# Creative Sprint v2 - Concept

## Task Meta
- task_id: TASK-0036
- owner: concept
- pipeline_id: PIPE-0004
- stage: 1/10

## Concept Summary
*Pocket Planet Janitor* is a whimsical browser arcade game for players who like short, high-focus score runs: you orbit a tiny cluttered planet as the last maintenance pilot, vacuuming drifting space junk and dumping it into a recycler before meteor weather overwhelms the orbit lanes; it is fun because movement is simple but expressive, carrying junk creates constant risk/reward tension, and each run feels like a fast escalating cleanup puzzle.

## Pillars
1. One-screen orbital mastery (clean controls, immediate readability).
2. Risky carrying decisions (hold more junk for combo vs bank now for safety).
3. Escalating sky events (meteor swarms and solar bursts change route safety).
4. Instant retry loop (short runs, fast restart, high-score chase).

## Core Loop
1. Orbit the planet, capture drifting junk clusters, and build carry stack.
2. Dodge hazards while deciding when to cash in at recycler gates for combo points.
3. Survive escalating weather phases, maximize score, and restart instantly.

## Scope
### MVP (must ship)
- Browser game, desktop-first, single-screen arena.
- One playable pilot with orbit movement + short boost.
- Two junk types with shared pickup behavior.
- Two hazards: meteor shower lanes and timed solar pulse zones.
- One recycler objective with combo scoring on deposit.
- One session mode: timed score run (5-7 minutes).
- Minimal UI: title, HUD (time/score/carry/combo), end screen, restart.
- Local personal-best storage.

### Later (nice to have)
- Additional planet variants with unique hazard patterns.
- Pilot abilities (magnet pulse, emergency shield).
- Daily seeded runs and lightweight leaderboard.
- Cosmetic trail effects and accessibility presets.

## Risks / Open Questions
### Risks
- Orbital movement can feel slippery if acceleration is not tuned tightly.
- Hazard readability may drop on small screens if effects overlap.
- Combo economy may snowball too hard without early cap controls.

### Open Questions
- MVP should ship keyboard-only, or include basic touch controls immediately?
- Should recycler have one universal drop zone in MVP, or multiple lanes for depth?

## Handoff -> Game Design
- Design focus: define orbit/boost movement parameters, carry/combo scoring model, and phase-based hazard pacing.
- Assumptions: low-spec browser target, one-screen gameplay, local-only persistence, no backend dependency in MVP.
- MVP boundaries: single mode, single character kit, minimal UI flow, no live events or meta progression required.
