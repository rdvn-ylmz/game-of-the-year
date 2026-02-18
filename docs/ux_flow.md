# UX Flow - Last Light Courier (MVP)

## TASK META
- task_id: TASK-0015
- owner: player_experience
- pipeline_id: PIPE-0002
- stage: 4/10

## ACCEPTANCE CRITERIA
- [x] UX flows (start, menu, gameplay, end) are defined with implementation-ready steps.
- [x] FTUE dependencies, minimal feedback, friction checks, and QA scenarios are defined for coder and QA.

## UX FLOWS (MVP)
1. Start game
- Title screen shows one primary CTA: `Start Run`.
- Above CTA, show mission objective line: `Collect 6 energy cells to unlock extraction.`
- First-ever launch only, show compact control hint strip (`Move`, `Dash`) and auto-hide on first input.
- Press `Start Run` to enter gameplay immediately (no intermediate setup screen).

2. Main menu (minimal)
- Title options: `Start Run`, `How to Play` (single overlay card).
- Pause options only: `Resume`, `Restart`, `Quit to Title`.
- Keep personal best and last-run summary in a small read-only panel.
- Use one panel component for title/pause/end to reduce UI complexity on low-spec.

3. Gameplay loop
- Persistent HUD: timer, integrity (HP), cells (`x/6`), multiplier, score.
- Start messaging sequence:
  - Overlay line: `Blackout wave inbound. Stay mobile.`
  - Toast line: `Run live. Build a clean route.`
- Damage event: brief red flash + toast `Integrity hit. Multiplier reset.`
- Warning cadence rules (to avoid overlap):
  - Mid warning at 121s, one-shot: `Grid surge. Patrol traffic increasing.`
  - Final warning at `<30s`, one-shot: `Thirty seconds. Commit to extraction now.`
  - Minimum 1.2s gap between queued warning toasts.
  - Priority order if collisions occur: fail/win > extraction unlock > final warning > damage > mid warning.
- Extraction unlock event (`cells == 6`): marker pulse + toast `Quota met. Extraction is now active.`

4. End of run
- End panel appears after brief 250-300ms transition and freezes hazard simulation.
- Win hierarchy:
  - Title: `Delivery complete. Last light preserved.`
  - Body/support line: `Extraction secured. Sector pulse restored.`
- Fail hierarchy:
  - Title: `Mission failed. Re-run and reroute.`
  - Body/support line: `Courier signal lost. Sector offline.`
- Stats row: final score, PB delta, cells collected, survival time.
- Actions: primary `Restart`, secondary `Quit to Title`.

## FEEDBACK & JUICE (minimal)
- Visual feedback:
  - Damage flash (120ms), extraction marker pulse, timer pulse in final 30s.
  - One warning toast visible at a time; queue extra warnings by priority.
- Audio feedback:
  - Short SFX: pickup, damage, unlock, fail/win stinger.
  - Final-30s metronome tick, single source only (no stacked loops).
- Haptics (if mobile):
  - Short vibration on damage.
  - Medium vibration on extraction unlock.
  - Disable gracefully when vibration API is unavailable.

## FRICTION CHECKLIST
- [x] Clear goal in first 10 seconds.
- [x] Failure teaches player (fail panel includes one retry tip).
- [x] Menus are minimal.

## QA TEST NOTES (MVP)
1. First launch shows controls hint once; later launches do not repeat unless profile reset.
2. Start flow reaches live gameplay in one input.
3. HUD text remains readable at 1280x720 with no clipping in objective/warning regions.
4. Mid warning fires exactly once at 121s and never repeats on subsequent seconds.
5. Final warning fires exactly once when timer crosses below 30s.
6. If damage happens near warning thresholds, toast queue enforces a minimum 1.2s gap and stable priority ordering.
7. Extraction unlock fires once at `cells == 6` and does not retrigger on additional cell pickups.
8. End panel shows correct title/body hierarchy for win and fail outcomes.
9. Restart resets timer, HP, cells, multiplier, warnings-fired flags, and toast queue state.
10. Pause menu blocks movement/dash input while active.

## HANDOFF -> CODER & QA
- Implementation order:
  1) HUD layout and toast queue with priority + minimum gap.
  2) End screen hierarchy and restart path.
  3) FTUE prompts integrated into start, damage, unlock, and final-warning events.
  4) Readability pass for low-resolution HUD containers.
- Risky UX areas:
  - Warning collisions under high event density on low-end hardware.
  - HUD copy clipping when localized text expands.
  - Overly repetitive fail messaging if retry tip rotation is not implemented.
- What "done" looks like:
  - Player understands objective and controls in first 10 seconds without external help.
  - Warning cadence is readable and non-overlapping in edge-timing scenarios.
  - QA scenarios pass across win/fail paths and restart loops.
