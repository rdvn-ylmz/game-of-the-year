# TASK-0056 DevOps Release Plan (PIPE-0005 Gameplay Vertical Slice v1)

## CI/CD review
- Decision: CHANGES_REQUESTED
- Reason: release-blocking defects from QA/Security/SRE are unresolved (pause integrity and runtime-boundary leakage), and required CI gate automation from contract (`.github/workflows/*`, `scripts/*`) is missing.

## Gate mapping
### Merge gate (from `team/config/gates.yaml`)
- Required checks: `lint`, `unit_tests`, `security_scan`, `architecture_check`, `review_approval`
- Execution model:
  - Local: quick syntax/unit smoke only
  - CI: merge-blocking checks

### Release gate (from `team/config/gates.yaml` + stage requirements)
- Required checks: `e2e_tests` (integration), `smoke_tests`, `security_scan`, `performance_budget`, `reliability_slo`, `observability_baseline`, `rollback_plan`
- Execution model:
  - CI jobs: `e2e_tests`, `security_scan`, `performance_budget`, `reliability_slo`, `observability_baseline`
  - Manual release: low-spec browser smoke and rollback drill

## Release blockers
- Critical: pause integrity failure (`runtime.tick` executes while paused), `src/main.mjs:369`.
- Critical: paused gameplay/debug actions still execute, `src/main.mjs:344`, `src/main.mjs:408`, `src/main.mjs:424`.
- High: runtime boundary leakage via direct state mutation and private method call, `src/main.mjs:382`, `src/main.mjs:389`.
- CI enforcement gap: no `.github/workflows/*` and no `scripts/lint.sh`, `scripts/test.sh`, `scripts/security_scan.sh`, `scripts/perf_budget.sh`.

## Rollback plan
- Trigger conditions:
  - `pause_tick_violation_total > 0`
  - `paused_action_executed_total > 0`
  - `runtime_boundary_violation_total > 0`
  - smoke failure on pause/resume integrity or timer_complete/ko end-state transitions
- Steps:
  1. Stop promotion and restore last-known-good static artifact.
  2. Purge CDN/browser cache for `index.html` and active JS bundles.
  3. Re-run low-spec smoke (`start -> pause -> action spam -> resume -> timer/ko -> restart`) before reopening traffic.
- Data migration considerations: none (client-side storage only).
- Feature flag strategy: ship with gameplay debug controls disabled in production profile.

## Release checklist
- [ ] Version/tag and release notes completed
- [ ] Coder fixes merged for pause gating and runtime boundary API usage
- [ ] QA + Security re-pass completed after fixes
- [ ] CI workflows/scripts implemented and green
- [ ] Low-spec smoke passed on release artifact
- [ ] Alerts wired (`pause_tick_violation_total`, `paused_action_executed_total`, `runtime_boundary_violation_total`)
- [ ] Rollback drill validated
