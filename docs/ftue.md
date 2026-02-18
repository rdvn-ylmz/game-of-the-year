# FTUE - Last Light Courier (MVP)

## TASK META
- task_id: TASK-0015
- owner: player_experience
- pipeline_id: PIPE-0002
- stage: 4/10

## ACCEPTANCE CRITERIA
- [x] FTUE onboarding steps are mapped to concrete triggers and success outcomes.
- [x] FTUE sequence supports low-spec runtime with minimal overlays and reusable HUD patterns.

## FTUE (Onboarding)
| Step | Trigger | Player sees | Player does | Success |
|---|---|---|---|---|
| 1. Mission framing | Run start (t=0) | Overlay: `Blackout wave inbound. Stay mobile.` + objective strip `Collect 6 energy cells to unlock extraction.` | Begins navigating toward cells | Player movement input within 5s |
| 2. Movement prompt | No movement for 3s | Hint: `Move: WASD / Arrow Keys` | Moves in any direction | Hint dismisses and stays hidden for current run |
| 3. Dash prompt | No dash used by 8s | Hint: `Space - Short burst, then cooldown` | Uses dash once | Dash hint completion flag set |
| 4. Run cadence intro | After first movement OR 2s timeout | Toast: `Run live. Build a clean route.` | Continues route planning | Player collects first cell within 20s target |
| 5. Damage learning | First integrity loss in run | Flash + toast `Integrity hit. Multiplier reset.` | Avoids immediate repeat damage | No second hit during next 5s window |
| 6. Mid-phase pressure | Timer crosses 121s | One-shot warning: `Grid surge. Patrol traffic increasing.` | Adjusts route to avoid higher pressure | Warning flag set and no repeat |
| 7. Extraction unlock | Cell count reaches 6 | Toast + marker pulse: `Quota met. Extraction is now active.` | Heads for extraction | Player heading trends toward extraction zone |
| 8. Final urgency | Timer crosses below 30s | One-shot warning: `Thirty seconds. Commit to extraction now.` | Prioritizes extraction over cell detours | Pathing heads to extraction within 3s target |
| 9. End coaching | Run ends (win/fail) | Win title/body OR fail title/body + one retry tip on fail | Chooses restart/quit | Restart works in <=2 inputs and resets FTUE run flags |

## FTUE IMPLEMENTATION NOTES (for coder)
- Reuse one lightweight prompt/toast component with event-keyed text values.
- Enforce toast queue rules from UX doc: minimum 1.2s gap and fixed priority order.
- Keep FTUE strings <=72 chars to reduce clipping risk at low resolution.
- Do not hard-pause gameplay for FTUE; only use non-blocking overlays.

## FTUE VALIDATION NOTES (for QA)
- Run first-time profile and returning-profile paths to verify FTUE gating.
- Force event overlap (damage near 121s and <30s) and confirm warning order/spacing.
- Validate no more than one warning toast is visible at a time.
- Validate all one-shot warnings stay one-shot across restart loops.

## RISKS
- If queue throttling is not applied, warning overlap can hide critical messages.
- If HUD containers do not wrap/truncate predictably, final-warning text may clip on 720p.
