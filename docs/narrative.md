# Narrative - Last Light Courier (MVP)

## TASK META
- task_id: TASK-0014
- owner: narrative
- pipeline_id: PIPE-0002
- stage: 3/10

## ACCEPTANCE CRITERIA
- [x] Narrative frame, mission text, and UI copy hooks are implementation-ready for the MVP loop.
- [x] Start, warning, fail, and win lines are defined and mapped to clear trigger points.

## NARRATIVE FRAME (MVP)
- Setting (1-2 sentences): Neon Sector Nine is entering rolling blackout. You are the last active courier, collecting unstable cells to reopen one extraction lane before the grid locks down.
- Tone: Urgent, clean, and tactical.
- Main motivation: Hit cell quota fast, unlock extraction, and escape before blackout or integrity collapse.

## CHARACTERS (MVP)
| Name | Role | Personality | Sample line |
|---|---|---|---|
| Kade Rook | Player courier | Focused, disciplined, dry humor | "Route first. Risks second." |
| Dispatch Iona | Support voice in comms | Direct, calm under pressure | "Clock is running. Collect cells and move." |
| Sentinel Grid | Automated defense network | Clinical, threatening | "Unauthorized transfer in progress." |

## MISSION/LEVEL TEXT (MVP)
- Intro line: "Blackout wave inbound. Stay mobile."
- Objective line: "Collect 6 energy cells to unlock extraction."
- Success line: "Extraction secured. Sector pulse restored."
- Failure line: "Courier signal lost. Sector offline."

## PHASE + EVENT LINES (MVP)
- Run start: "Run live. Build a clean route."
- Mid pressure warning (121s): "Grid surge. Patrol traffic increasing."
- Final warning (<30s): "Thirty seconds. Commit to extraction now."
- Damage taken: "Integrity hit. Multiplier reset."
- Extraction unlocked: "Quota met. Extraction is now active."
- Run fail: "Mission failed. Re-run and reroute."
- Run win: "Delivery complete. Last light preserved."

## HANDOFF -> PLAYER_EXPERIENCE & CODER
- Text integration points (where these strings appear):
  - Start overlay: intro + run start line.
  - HUD objective card: objective line and extraction unlocked line.
  - HUD toast/warning channel: damage line, 121s warning, <30s final warning.
  - End screen: success/failure mission line plus run win/fail line.
- Any conditional lines:
  - Damage line only on integrity loss events.
  - Extraction line only when `collected_cells >= required_cells` changes false -> true.
  - 121s warning fires once on entering phase 2; <30s warning fires once when timer drops below 30.
- Localization notes (if any):
  - Keep HUD strings under 72 characters.
  - Keep phrasing literal; avoid slang and idioms for easier translation.
