# Implementation Sprint v1 - Concept

## Task Meta
- task_id: TASK-0012
- owner: concept
- pipeline_id: PIPE-0002
- stage: 1/10

## Concept Summary
*Last Light Courier* is a playable, low-spec browser arcade game for players who want short mastery loops: each 5-8 minute run asks the player to route through a collapsing city, collect energy cells, and extract before blackout while avoiding drones and laser hazards; the fun comes from quick movement decisions, escalating pressure, and immediate replay after each run.

## Pillars
1. Readable, skill-based movement (move + dash, tight control feel).
2. Constant risk/reward routing (safe path vs score-efficient path).
3. Predictable escalation (pressure rises in clear phases).
4. Fast replay loop (instant reset, score chase, low friction UI).

## Core Loop
1. Start run, read objective and timer, pick route.
2. Collect required cells while avoiding hazards and protecting multiplier.
3. Reach extraction before blackout, score run, restart immediately.

## Scope
### MVP (must ship)
- Browser desktop-first playable build.
- One mode: solo score attack.
- One player kit: movement + dash.
- Core threats: laser grid + patrol drones.
- Objective: collect cells to unlock extraction.
- HUD + title + end screen + restart flow.
- Local best-score persistence.

### Later (nice to have)
- Additional layouts, hazards, and ability variants.
- Daily seed / online leaderboard.
- Cosmetic rewards and meta-progression.
- Touch controls and extended accessibility options.

## Risks / Open Questions
### Risks
- Low-end performance regressions can reduce input precision.
- Overtuned early hazard pacing can feel unfair.
- Content variety may feel thin if layout differences are weak.

### Open Questions
- MVP input target: keyboard only, or keyboard + touch fallback?
- Keep score/local progression fully offline in MVP, or add backend leaderboard now?

## Handoff -> Game Design
- Design focus: convert pillars into concrete systems, numeric balance knobs, and phase pacing.
- Assumptions: desktop browser first, low-spec profile, OOP-first implementation constraints, 5-8 minute sessions.
- MVP boundaries: single mode, minimal UI, no cosmetics, no live-service requirements.
