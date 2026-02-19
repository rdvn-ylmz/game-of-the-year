# UX Flow - Pocket Planet Janitor (MVP)

## TASK META
- task_id: TASK-0039
- owner: player_experience
- pipeline_id: PIPE-0004
- stage: 4/10

## ACCEPTANCE CRITERIA
- [x] UX flows (start, menu, gameplay, end) are defined with implementation-ready steps.
- [x] FTUE dependencies, minimal feedback, friction checks, and QA scenarios are defined for coder and QA.

## UX FLOWS (MVP)
1. Start game
- Title screen shows one primary CTA: `Start Shift`.
- Objective line appears above CTA: `Vacuum junk and deposit at recycler for score.`
- First launch only: compact hint strip for orbit and boost controls.
- One input enters gameplay; no intermediate setup/config screen.

2. Main menu (minimal)
- Title options: `Start Shift`, `How to Play` (single overlay card).
- Pause options: `Resume`, `Restart Shift`, `Quit to Title`.
- Keep PB + last run score in one small read-only panel.
- Reuse one panel template for title, pause, and end screen to limit UI complexity.

3. Gameplay loop
- Persistent HUD: timer, integrity hearts, carry count, combo multiplier, combo timeout ring, score.
- Run start messaging:
  - Overlay: `Orbit is dirty. Shift starts now.`
  - Toast: `Run live. Build a safe first route.`
- Core action rhythm:
  - Collect scrap -> carry stack grows -> movement feels heavier.
  - Enter recycler zone + press `Deposit` to bank score and progress combo.
  - Decide to bank now or keep carrying for higher risk/reward.
- Hazard + combo alert cadence:
  - Phase 2 warning at 121s (one-shot): `Meteor lanes tightening. Keep deposits steady.`
  - Phase 3 warning at 241s (one-shot): `Solar pulse cadence rising. Bank often.`
  - Combo near-timeout warning when remaining combo window <= 2.0s (one-shot per active chain): `Combo fading. Deposit now.`
  - Combo cap alert when cap first reached: `Combo capped at {combo_cap}x. Cash it in.`
- Toast queue rules (low-spec readability):
  - Max 1 toast visible at once.
  - Minimum 1.2s between toast start times.
  - Priority order: run-end critical > KO/damage > phase warning > combo timeout > combo cap > combo gain.
  - Debounce repeated combo gain lines to avoid spam during rapid deposits.
- Placeholder safety:
  - Format `{combo}` and `{combo_cap}` with one decimal (e.g., `1.4`).
  - Reserve fixed width for placeholder values and truncate trailing text if needed on 720p.

4. End of run
- Freeze simulation and open end panel within 300ms.
- Timer-complete path:
  - Title: `Shift Complete`
  - Body: `Final score locked. Recycler cycle closed.`
- KO path:
  - Title: `Hull Failure`
  - Body: `Recovery tug inbound. Run terminated.`
- Optional PB badge if score beats local best:
  - Badge: `New Personal Best`
  - Body: `Clean orbit, cleaner record.`
- Actions: primary `Restart Shift`, secondary `Quit to Title`.

## FEEDBACK & JUICE (minimal)
- Visual feedback:
  - Recycler pulse on valid deposit window.
  - Combo timeout ring shifts from cyan to amber in final 2s.
  - Damage flash + brief knockback tint.
  - Meteor lane and solar pulse telegraphs stay high contrast and non-animated beyond simple alpha pulse.
- Audio feedback:
  - Short pickup tick, deposit confirm, combo up cue, combo break cue, damage hit cue.
  - Distinct phase warning ping and end-state stinger.
  - Keep one warning channel active at a time to avoid clutter.
- Haptics (if mobile):
  - Short vibration on damage.
  - Medium vibration on successful deposit at combo >= 1.6x.
  - Disable gracefully when vibration API unavailable.

## FRICTION CHECKLIST
- [x] Clear goal in first 10 seconds.
- [x] Failure teaches player (show cause + one retry tip on end panel).
- [x] Menus are minimal.

## QA TEST NOTES (MVP)
1. First-run controls hint appears once; does not reappear on normal restarts.
2. Start screen enters gameplay in one input.
3. Combo timeout warning fires once per chain when remaining window <= 2.0s.
4. Phase warnings fire exactly once at 121s and 241s.
5. Toast queue never shows more than one toast at a time under rapid deposit spam.
6. Combo gain messages are debounced and do not flood the HUD.
7. Placeholder lines (`{combo}`, `{combo_cap}`) remain readable at 1280x720 and small-width HUD containers.
8. KO path and timer-complete path show correct end title/body and actions.
9. New PB badge appears only when final score exceeds stored best.
10. Restart Shift resets timer, integrity, carry stack, combo state, and one-shot warning flags.

## HANDOFF -> CODER & QA
- Implementation order:
  1) HUD frame with carry/combo/timer + timeout ring.
  2) Toast queue service (priority, min-gap, debounce, one-shot gates).
  3) End screen hierarchy for timer-complete/KO/PB states.
  4) FTUE prompt triggers and first-run gating.
- Risky UX areas:
  - Toast overlap during combo-heavy play plus phase warnings.
  - Placeholder width overflow for `{combo}` and `{combo_cap}` on small HUD widths.
  - Combo timeout feedback may be missed if telegraph contrast is too subtle.
- What "done" looks like:
  - New player can orbit, collect, deposit, and understand combo risk in first minute.
  - Warnings are readable and non-overlapping during high event density.
  - QA scenarios pass across timer-complete, KO, and PB branches.
