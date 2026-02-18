# Game Design - Implementation Sprint v1

## TASK META
- task_id: TASK-0013
- owner: game_design
- pipeline_id: PIPE-0002
- stage: 2/10

## ACCEPTANCE CRITERIA
- [x] Core loop, systems, progression/economy, and content pacing are implementable for MVP.
- [x] Balance knobs are documented with default values for coder tuning.

## DESIGN OVERVIEW
- Game mode(s): Solo score attack (single-player run).
- Session length target: 5-8 minutes (default run timer: 360s).
- Win/lose conditions:
  - Win: Collect required cells, unlock extraction, reach extraction before blackout.
  - Lose: Timer reaches 0 or player integrity reaches 0.

## CORE LOOP (implementable)
1. Spawn in one of three city layouts, read timer/cell target, select route.
2. Move and dash through hazards to collect cells, avoid damage to preserve multiplier.
3. Unlock extraction after target cells, extract for bonus score, store best score, restart instantly.

## SYSTEMS (MVP)
| System | Purpose | Inputs | Outputs | Notes |
|---|---|---|---|---|
| Movement + Dash | Skill expression and traversal | Direction input, dash input, dt | Position, velocity, dash state | Fixed timestep update and speed cap for low-spec stability. |
| Integrity (HP) | Failure pressure | Hazard collisions | HP value, fail state | Baseline HP=3; each hit deals 1 damage. |
| Run Timer | Session pressure | Start time, dt | Time remaining, blackout fail | 360s baseline with warning at 30s. |
| Cell Objective | Gate extraction | Pickup events | Cell count, unlock state | Extraction unlock at required cell count. |
| Hazard Director | Escalation pacing | Elapsed time, seed | Drone cap/speed, laser timing profile | Phase shifts at 120s and 240s. |
| Drone Patrol | Moving enemy pressure | Waypoints, speed, player proximity | Drone transforms, collision checks | Max active drone cap to protect performance. |
| Laser Grid | Area denial and timing challenge | Node pattern, cycle timer | Active/inactive hazard tiles | Deterministic cycle per seed for fairness. |
| Score + Multiplier | Replay motivation | Pickups, survival ticks, extraction, damage | Run score, multiplier | Damage resets multiplier to 1.0. |
| Local Persistence | Lightweight progression | Run end summary | Best score (overall + per layout) | Local storage only, no backend in MVP. |
| HUD + End Screen | Readability and restart speed | Game state values | Timer, score, cells, HP, multiplier, restart CTA | Minimal UI set only. |

## PROGRESSION & ECONOMY (simple)
- Currency (if any): None (score-only progression).
- Rewards:
  - Score from cell pickups, survival time, extraction completion.
  - Local personal best updates for replay motivation.
- Unlocks:
  - No meta-unlocks in MVP.
  - In-run unlock only: extraction opens after required cells collected.

## CONTENT PLAN (MVP)
- Levels/missions count:
  - 3 layouts: Small Blocks, Split Avenue, Ring Sector.
  - 1 mission type: collect cells then extract.
- Enemies/obstacles list:
  - Laser grid (timed on/off).
  - Patrol drones (waypoint-based, phase-scaled speed/count).
- Items/abilities list:
  - Energy cell collectible.
  - Player movement.
  - Dash ability with cooldown.

## BALANCE KNOBS
1. run_timer_seconds = 360
2. required_cells = 6
3. player_move_speed_px_s = 220
4. player_dash_duration_s = 0.18
5. player_dash_cooldown_s = 2.2
6. player_hp = 3
7. drone_base_speed_px_s = 120
8. max_active_drones = 3
9. laser_on_off_seconds = 2.0/1.4
10. multiplier_gain_interval_s = 10

## HANDOFF -> NARRATIVE & PLAYER_EXPERIENCE
- Narrative needs (characters, setting, mission beats):
  - Courier identity and city blackout premise.
  - Brief beat text for start, mid-pressure, final 30s warning, fail/win states.
  - Mission tone aligned with urgency and replay cadence.
- UX needs (FTUE, menus, feedback):
  - FTUE for move/dash/cell objective/extraction unlock.
  - Minimal menu flow: title -> run -> end -> restart.
  - Strong feedback for damage, multiplier reset/growth, extraction unlock, timer warning.
- Non-goals:
  - No online leaderboard.
  - No extra characters/abilities.
  - No cosmetics or meta-progression.
