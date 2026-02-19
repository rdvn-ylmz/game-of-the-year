# Balance Knobs - Pocket Planet Janitor (MVP)

## TASK META
- task_id: TASK-0037
- owner: game_design

## TUNABLES
| Knob | Default | Suggested Range | Gameplay Impact | Low-Spec Note |
|---|---:|---:|---|---|
| run_timer_seconds | 360 | 300-420 | Sets session length and pressure ramp. | Keep <=420 for short-run loop. |
| orbit_accel_deg_s2 | 300 | 220-360 | Controls turn-in response. | Too high feels twitchy on low FPS. |
| orbit_damping | 0.90 | 0.84-0.94 | Controls drift/slippery feel. | Lower values increase control difficulty. |
| max_orbit_speed_deg_s | 220 | 180-260 | Sets traversal ceiling around planet. | Cap for collision readability. |
| boost_speed_bonus_deg_s | 140 | 90-180 | Defines boost escape power. | High values can invalidate hazards. |
| boost_duration_s | 0.22 | 0.14-0.30 | Controls boost travel distance. | Keep short to avoid overshoot frustration. |
| boost_cooldown_s | 2.4 | 1.8-3.2 | Controls recovery frequency. | Longer cooldown lowers input burst load. |
| carry_soft_cap | 6 | 4-8 | Risk stack before heavy handling penalty. | Cap keeps HUD/state simple. |
| carry_accel_penalty_per_item | 0.06 | 0.03-0.10 | Adds tension while holding junk. | Clamp total penalty for fairness. |
| combo_step | 0.2 | 0.1-0.3 | Reward slope per chained deposit. | High step can snowball score. |
| combo_cap | 2.0 | 1.6-2.4 | Max multiplier ceiling. | Keep <=2.2 for pacing stability. |
| combo_timeout_s | 8 | 5-10 | Window to continue combo chain. | Longer timeout lowers decision pressure. |
| meteor_interval_s_phase1 | 5.0 | 4.2-6.0 | Early hazard density. | Keep sparse for onboarding fairness. |
| meteor_interval_s_phase3 | 2.8 | 2.2-3.4 | Late hazard density spike. | Avoid <=2.2 for low-spec readability. |
| solar_pulse_interval_s_phase3 | 7.0 | 5.5-9.0 | Late pulse cadence and route disruption. | Preserve telegraph visibility. |

## PHASE TARGETS
| Phase | Window | Target Difficulty |
|---|---|---|
| Phase 1 | 0-120s | Learn controls, low punishment, establish deposit rhythm. |
| Phase 2 | 121-240s | Route pressure rises, combo risk decisions become frequent. |
| Phase 3 | 241-360s | High hazard overlap, mastery-focused survival and banking. |

## ANTI-SNOWBALL RULES
- Combo hard cap at `2.0x`.
- Damage resets combo to `1.0x`.
- Combo also resets if no deposit within `combo_timeout_s`.
- Carry handling penalty capped at 35% total accel reduction.

## QUICK QA TARGETS
- New player 60s survival: >=75%
- Median run duration: 4.8-6.2 min
- 5-run extraction/deposit mastery uplift: score +60% to +130%
- Top 10% score not more than 3.0x median score
