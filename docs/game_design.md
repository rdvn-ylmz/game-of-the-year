# Game Design - Pocket Planet Janitor (MVP)

## TASK META
- task_id: TASK-0037
- owner: game_design
- pipeline_id: PIPE-0004
- stage: 2/10

## ACCEPTANCE CRITERIA
- [x] Core loop, systems, progression, and pacing are implementable for MVP.
- [x] Balance knobs include concrete defaults for movement, combo, and hazards.

## DESIGN OVERVIEW
- Game mode(s): Single-player timed score run.
- Session length target: 5-7 minutes (default 360s).
- Win/lose conditions:
  - Win state: survive until timer ends and submit score.
  - Early lose: integrity reaches 0.

## CORE LOOP (implementable)
1. Orbit the planet, vacuum junk pieces, and build carry stack.
2. Choose risk: keep carrying for combo growth or bank at recycler now.
3. Dodge meteor lanes and solar pulses, deposit junk for score, end run on timer/KO.

## SYSTEMS (MVP)
| System | Purpose | Inputs | Outputs | Notes |
|---|---|---|---|---|
| Orbit Movement | Core control feel | Left/right input, accel, damping, dt | Orbit angle, angular velocity | One-axis orbital model for low CPU cost. |
| Boost Burst | Recovery and skill ceiling | Boost input, cooldown, carry load | Temporary speed gain, cooldown state | Short burst; disabled during hit-stun. |
| Carry Stack | Risk/reward pressure | Junk pickup events | Carry count, move penalty | Higher carry reduces accel for tension. |
| Recycler Deposit | Banking objective | Enter recycler zone + deposit input | Banked score, carry reset | Single recycler gate keeps readability high. |
| Combo Chain | Score mastery | Deposit timing, damage events, timeout | Combo multiplier, combo chain | Hard cap prevents score snowball. |
| Junk Spawner | Resource flow | Spawn timer, seed, max active | Junk entities | Two junk types, shared pickup behavior. |
| Meteor Lanes | Primary hazard | Phase profile, lane seeds | Active danger lanes | Telegraph lane for fairness. |
| Solar Pulse Zones | Secondary hazard | Phase timer, pulse pattern | Active pulse rings | Brief warning flash before pulse. |
| Integrity + iFrames | Failure state control | Hazard hits | HP value, invuln timer, KO state | HP=3, iFrame keeps hits readable. |
| Run State + Persistence | Session lifecycle | Start/end events, score updates | Timer, end state, local PB | Local storage only. |

## PROGRESSION & ECONOMY (simple)
- Currency (if any): No persistent currency.
- Rewards:
  - Run score from deposit value multiplied by combo.
  - Local personal best and last-run stats.
- Unlocks:
  - No meta unlocks in MVP.
  - In-run only: combo tier escalation by successful chained deposits.

## CONTENT PLAN (MVP)
- Levels/missions count:
  - 1 single-screen planet arena.
  - 1 mission: maximize score before timer/KO.
- Enemies/obstacles list:
  - Meteor lanes.
  - Solar pulse zones.
- Items/abilities list:
  - Junk type A (small scrap).
  - Junk type B (dense core; same pickup rules, higher value).
  - Pilot boost ability.

## BALANCE KNOBS
1. run_timer_seconds = 360
2. orbit_accel_deg_s2 = 300
3. orbit_damping = 0.90
4. max_orbit_speed_deg_s = 220
5. boost_speed_bonus_deg_s = 140
6. boost_duration_s = 0.22
7. boost_cooldown_s = 2.4
8. carry_soft_cap = 6
9. combo_step = 0.2 (cap 2.0x)
10. combo_timeout_s = 8

## SCORING MODEL (MVP)
- Junk base values:
  - Small scrap: 60
  - Dense core: 100
- Deposit score formula:
  - `deposit_points = (sum(carried_values)) * combo_multiplier`
- Combo rules:
  - Starts at `1.0x`
  - `+0.2x` per successful deposit within timeout window
  - Hard cap: `2.0x`
  - Resets to `1.0x` on damage or timeout

## PHASE PACING (360s default)
- Phase 1 (0-120s): sparse meteor lanes, low solar pulse frequency.
- Phase 2 (121-240s): meteor interval shortens, pulse frequency increases.
- Phase 3 (241-360s): densest lane coverage and fastest pulse cadence.

## HANDOFF -> NARRATIVE & PLAYER_EXPERIENCE
- Narrative needs (characters, setting, mission beats):
  - Define pilot identity, planet status, and cleanup urgency tone.
  - Write short beats for phase transitions and end-state summaries.
  - Keep text playful but readable in 1-2 lines per beat.
- UX needs (FTUE, menus, feedback):
  - FTUE for orbit control, boost, carry, deposit, combo timeout.
  - Minimal flow: title -> play -> end -> restart.
  - Clear feedback for carry load, combo timer, hazard telegraph, and damage.
- Non-goals:
  - No online leaderboard.
  - No additional playable pilots.
  - No cosmetics or meta progression.
