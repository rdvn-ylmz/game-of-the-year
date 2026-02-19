# FTUE - Pocket Planet Janitor (MVP)

## TASK META
- task_id: TASK-0039
- owner: player_experience
- pipeline_id: PIPE-0004
- stage: 4/10

## ACCEPTANCE CRITERIA
- [x] FTUE onboarding steps are mapped to concrete triggers and success outcomes.
- [x] FTUE sequence supports low-spec runtime with minimal overlays and reusable HUD patterns.

## FTUE (Onboarding)
| Step | Trigger | Player sees | Player does | Success |
|---|---|---|---|---|
| 1. Shift kickoff | Run start (t=0) | Overlay `Orbit is dirty. Shift starts now.` + objective strip | Begins orbit movement | Input detected within 5s |
| 2. Orbit control hint | No left/right input for 3s | `Left/Right to orbit the planet` | Moves clockwise/counterclockwise | Hint dismisses for this run |
| 3. Boost hint | No boost used by 8s | `Space: short burst, then cooldown` | Uses boost once | Boost flag marked complete |
| 4. Carry awareness | First junk pickup | Carry UI pulse + hint `More junk carried means slower turning` | Picks up additional junk | Carry counter updates and remains visible |
| 5. Deposit tutorial | First recycler entry with carry > 0 | Prompt `Press E in recycler zone to bank points` | Deposits once | Score increases and carry resets |
| 6. Combo introduction | First successful chained deposit | Toast `Chain held. Combo now {combo}x.` | Attempts next deposit within timeout | Combo multiplier increases above 1.0x |
| 7. Combo timeout teaching | Active combo chain with <=2.0s remaining | Toast `Combo fading. Deposit now.` + timeout ring turns amber | Deposits or lets combo expire | Warning fires once per chain and state resolves cleanly |
| 8. Hazard escalation | Timer crosses 121s then 241s | One-shot phase warnings | Adjusts routing to safer lane timing | Each phase warning appears once only |
| 9. End-state coaching | Timer complete or integrity KO | End summary + single retry tip tied to fail cause | Selects `Restart Shift` or `Quit to Title` | Restart works in <=2 inputs and resets FTUE run flags |

## FTUE IMPLEMENTATION NOTES (for coder)
- Reuse a single lightweight prompt/toast component with event-keyed text.
- Apply queue rules from UX flow doc: one visible toast, 1.2s min gap, fixed priority.
- Format `{combo}`/`{combo_cap}` to one decimal; reserve value width in text container.
- Keep prompts non-blocking; gameplay should continue while FTUE messages appear.
- Gate intro hints by profile first-run flags; gate warning hints by per-run one-shot flags.

## FTUE VALIDATION NOTES (for QA)
- Run first-time profile and returning profile paths.
- Force rapid deposit sequences to validate combo gain debounce and timeout warning behavior.
- Force overlap scenarios (phase warning + combo warning + damage) and verify priority ordering.
- Validate placeholder text rendering at 1280x720 and reduced HUD width.
- Confirm no FTUE hint loops indefinitely when player intentionally ignores a prompt.

## RISKS
- Missing debounce/queue limits can flood toast lane during fast deposit chains.
- Placeholder width guards may fail on localized strings, causing clipped combo messages.
