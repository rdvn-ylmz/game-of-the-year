# Balance Knobs - Implementation Sprint v1

## TASK META
- task_id: TASK-0013
- owner: game_design

## KNOBS TABLE
| Knob | Default | Range | Gameplay Effect | Low-Spec Guardrail |
|---|---:|---:|---|---|
| run_timer_seconds | 360 | 300-480 | Controls run length and urgency. | Keep <=480 to protect session pacing. |
| required_cells | 6 | 4-9 | Controls route commitment before extraction. | Lower if early fail rate is too high. |
| player_move_speed_px_s | 220 | 180-260 | Affects responsiveness and dodge windows. | Avoid >260 to reduce collision errors. |
| player_dash_duration_s | 0.18 | 0.12-0.24 | Sets dash travel window. | Keep short to avoid tunneling edge cases. |
| player_dash_cooldown_s | 2.2 | 1.6-3.0 | Sets recovery frequency. | Longer cooldown reduces event spikes. |
| player_hp | 3 | 2-4 | Controls run forgiveness. | Start at 3 for baseline fairness. |
| drone_base_speed_px_s | 120 | 90-150 | Controls chase pressure. | Cap near 150 for low FPS fairness. |
| max_active_drones | 3 | 2-4 | Controls threat density and CPU load. | Keep <=3 for low-end stability. |
| laser_on_seconds | 2.0 | 1.2-2.4 | Controls denial uptime. | Too high can feel static; retune with off window. |
| laser_off_seconds | 1.4 | 0.8-2.0 | Controls crossing opportunity. | Keep >=1.0 in early phase for fairness. |
| multiplier_step | 0.1 | 0.05-0.2 | Controls reward growth for clean play. | High values create runaway scores. |
| multiplier_interval_s | 10 | 6-14 | Controls pace of multiplier gain. | Keep >=8 for readable score growth. |
| multiplier_max | 2.0 | 1.5-3.0 | Controls top-end scoring ceiling. | Keep <=2.5 for scoreboard readability. |
| extraction_bonus_base | 500 | 300-800 | Rewards successful completion. | Too high devalues route risk decisions. |
| extraction_bonus_per_sec | 5 | 2-8 | Rewards faster extraction. | Pair with timer tuning to avoid rush-only meta. |

## DIFFICULTY PHASE TARGETS
| Phase | Time Window | Target State |
|---|---|---|
| Phase 1 | 0-120s | 1 drone, baseline laser cadence, onboarding pressure |
| Phase 2 | 121-240s | 2 drones max, +10% drone speed, tighter laser safe windows |
| Phase 3 | 241-360s | 3 drones max, +20% drone speed, highest pressure |

## QUICK QA TARGETS
- First-60s death rate (new players): <=25%
- Avg run length: 4.5-6.5 minutes
- Extraction success (after 5 runs): 35-55%
- Score delta (new vs practiced): 1.8x-2.5x
