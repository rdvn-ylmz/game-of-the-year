# Narrative - Pocket Planet Janitor (MVP)

## TASK META
- task_id: TASK-0038
- owner: narrative
- pipeline_id: PIPE-0004
- stage: 3/10

## ACCEPTANCE CRITERIA
- [x] Narrative frame, mission text, and UI copy are implementation-ready for the MVP loop.
- [x] Phase transitions, combo-state lines, and run-end summaries are defined with clear triggers.

## NARRATIVE FRAME (MVP)
- Setting (1-2 sentences): Pocket Planet C-7 is choking on orbital junk after a cargo chain failure. You are a contract cleanup pilot racing the clock to clear debris before meteor and solar activity lock the lane.
- Tone: Playful urgency with clear operational language.
- Main motivation: Carry scrap, bank it at the recycler, preserve combo chains, and finish the shift with the highest score possible.

## CHARACTERS (MVP)
| Name | Role | Personality | Sample line |
|---|---|---|---|
| Nox Vega | Player pilot | Efficient, dry humor, risk-aware | "Mess first, medals later." |
| ARC-12 | Recycler control AI | Precise, supportive, concise | "Recycler live. Bring me clean scrap." |
| Helios Net | Automated hazard system voice | Formal, indifferent | "Solar pulse pattern updated." |

## MISSION/LEVEL TEXT (MVP)
- Intro line: "Orbit is dirty. Shift starts now."
- Objective line: "Vacuum junk and deposit at recycler for score."
- Success line: "Shift complete. Score archived. Orbit stabilized."
- Failure line: "Integrity critical. Cleanup run terminated."

## PHASE + COMBO + RUN-END LINES (MVP)
- Run start: "Run live. Build a safe first route."
- Phase 2 warning (121s): "Meteor lanes tightening. Keep deposits steady."
- Phase 3 warning (241s): "Solar pulse cadence rising. Bank often."
- Combo gain: "Chain held. Combo now {combo}x."
- Combo near timeout: "Combo fading. Deposit now."
- Combo cap reached: "Combo capped at {combo_cap}x. Cash it in."
- Combo reset (damage/timeout): "Combo reset to 1.0x. Rebuild the chain."
- Damage taken: "Hull hit. Stability reduced."
- Timer complete (run end): "Timer complete. Final score locked."
- Integrity KO (run fail): "Hull breach. Recovery tug inbound."
- New personal best: "New personal best. Clean orbit, cleaner record."

## HANDOFF -> PLAYER_EXPERIENCE & CODER
- Text integration points (where these strings appear):
  - Start overlay: intro line + run start line.
  - HUD objective panel: objective line and recycler reminder.
  - HUD toast lane: phase warnings, damage, combo gain/reset/cap, timeout warning.
  - End screen: success/failure line, timer complete/KO line, PB summary line.
- Any conditional lines:
  - Phase 2 warning on first tick crossing 121s elapsed; phase 3 warning on first tick crossing 241s.
  - Combo gain on successful deposit inside combo timeout.
  - Combo near-timeout when remaining combo window <=2.0s and only once per active chain.
  - Combo cap line when multiplier first reaches `combo_cap`.
  - Timer complete line when `run_timer <= 0` and integrity > 0; KO line when integrity reaches 0.
  - PB line only if final score exceeds stored best score.
- Localization notes (if any):
  - Keep runtime HUD strings under 72 characters.
  - Use placeholders (`{combo}`, `{combo_cap}`) with numeric formatting to one decimal.
  - Avoid idioms that break direct translation.
