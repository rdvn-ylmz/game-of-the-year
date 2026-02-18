# TASK-0010 DevOps Release Plan

## CI/CD review
- Decision: CHANGES_REQUESTED
- Reason: release blockers from QA/Security/SRE are still open; repo has no CI workflow files and no gate scripts (`scripts/` missing).

## Gate mapping
### Merge gate
- Required checks:
  - lint (from `gates.yaml`)
  - unit_tests (from `gates.yaml`)
  - security_scan (from `gates.yaml`)
  - architecture_check (from `gates.yaml`)
  - review_approval (from `gates.yaml`)
- Run location:
  - CI: all required checks (local optional smoke only)

### Release gate
- Required checks:
  - e2e_tests (maps to integration coverage)
  - performance_budget
  - reliability_slo
  - observability_baseline
  - rollback_plan
  - manual smoke_tests (post-deploy)
  - security_scan re-validation (security sign-off)
- Run location:
  - CI jobs: e2e_tests, performance_budget, reliability_slo, observability_baseline
  - Manual release step: smoke_tests, rollback drill confirmation, final security sign-off

## Blocking conditions
- QA critical defect unresolved: extraction bonus missing on win path.
- QA high defect unresolved: `requiredCells` objective/HUD desync.
- Security hardening unresolved: debug controls active, storage validation gaps, missing CSP baseline.
- CI implementation gap: no `.github/workflows/*`, no gate scripts referenced by `gates.yaml`.

## Rollback plan
- Trigger conditions:
  - `game_score_mismatch_total > 0`
  - `game_required_cells_mismatch_total > 0`
  - `game_debug_action_total{env=prod} > 0`
  - smoke test fail for start/collect/extract/fail path
- Steps:
  1. Stop promotion and route traffic to last-known-good static artifact.
  2. Purge CDN/browser caches for `index.html` and JS bundles.
  3. Re-run smoke tests and check mismatch/debug metrics for 15 minutes before reopening traffic.
- Data migration: none (client-side storage only).
- Feature flag strategy: enforce `DEBUG_MODE=false` in release build and gate debug controls by flag.

## Release checklist
- [ ] CI workflows and gate scripts added and green
- [ ] QA re-pass confirms extraction bonus + requiredCells sync fixes
- [ ] Security re-pass confirms debug gating, storage validation, CSP
- [ ] Observability alerts wired (`score_mismatch`, `required_cells_mismatch`, `storage_validation_fail`, `debug_action`)
- [ ] Rollback drill executed with cache purge validation
