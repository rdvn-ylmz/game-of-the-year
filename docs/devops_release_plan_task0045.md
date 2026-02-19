# TASK-0045 DevOps Release Plan (PIPE-0004 Creative Sprint v2)

## CI/CD review
- Decision: CHANGES_REQUESTED
- Rationale: required gate automation is not present in repository (`.github/workflows/*` and `scripts/*` from gate contract are missing), so merge/release checks cannot be enforced deterministically.

## Gate mapping
### Merge gate
- Required checks (contract): `lint`, `unit_tests`, `security_scan`, `architecture_check`, `review_approval`
- Run mode:
  - Local: quick syntax/unit smoke
  - CI: blocking checks for merge

### Release gate
- Required checks (contract + stage template): `e2e_tests` (integration), `smoke_tests`, `security_scan`, `performance_budget`, `reliability_slo`, `observability_baseline`, `rollback_plan`
- Run mode:
  - CI: `e2e_tests`, `security_scan`, `performance_budget`, `reliability_slo`, `observability_baseline`
  - Manual release steps: browser smoke, rollback drill

## Release blockers
- CI workflows absent: no `.github/workflows/*`.
- Gate scripts absent: no `scripts/lint.sh`, `scripts/test.sh`, `scripts/security_scan.sh`, `scripts/perf_budget.sh`.
- Production hardening checks not enforced in release gate:
  - debug controls/hotkeys off in production build
  - CSP presence check
  - storage schema validation monitoring

## Rollback plan
- Trigger conditions:
  - `toast_priority_inversion_total > 0`
  - `p95(end_panel_delay_ms) > 500`
  - `debug_action_total{env=prod} > 0`
  - Browser smoke failure on overlap ordering, timer/ko end transition, or restart focus behavior
- Steps:
  1. Halt promotion and restore last-known-good static artifact.
  2. Purge CDN/browser cache for `index.html` and active JS bundles.
  3. Re-run lightweight smoke flow before reopening traffic.
- Data migration considerations: none (client-side storage only).
- Feature flag strategy: release with debug disabled; gate debug controls behind explicit debug flag.

## Release checklist
- [ ] Version/tag and release notes completed
- [ ] CI gate workflows/scripts implemented and green
- [ ] Browser smoke passed on release artifact
- [ ] Alerts wired: toast inversion, end-panel delay, prod debug activity
- [ ] Rollback drill validated
