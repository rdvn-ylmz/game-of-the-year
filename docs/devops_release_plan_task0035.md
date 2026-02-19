# TASK-0035 DevOps Release Plan (PIPE-0003 Recovery Sprint v1)

## Decision
- CI/CD review result: CHANGES_REQUESTED
- Reason: release gating artifacts are not implemented in-repo (`.github/workflows/*` and `scripts/*` from gate contract are missing), and release hardening checks from SRE/security are not yet enforced.

## Gate mapping
### Merge gate (contract from `team/config/gates.yaml`)
- Required checks: `lint`, `unit_tests`, `security_scan`, `architecture_check`, `review_approval`
- Run mode:
  - Local: quick syntax/unit smoke only
  - CI: required merge checks

### Release gate (contract from `team/config/gates.yaml` + stage requirements)
- Required checks: `e2e_tests` (integration coverage), `smoke_tests`, `security_scan`, `performance_budget`, `reliability_slo`, `observability_baseline`, `rollback_plan`
- Run mode:
  - CI jobs: `e2e_tests`, `security_scan`, `performance_budget`, `reliability_slo`, `observability_baseline`
  - Manual release: browser `smoke_tests`, rollback drill validation

## Release blockers
- No CI workflow files present (`.github/workflows/*` absent).
- No gate scripts present (`scripts/lint.sh`, `scripts/test.sh`, `scripts/security_scan.sh`, `scripts/perf_budget.sh` absent).
- Debug controls/hotkeys are active in runtime (`index.html:265`, `src/main.mjs:272`).
- CSP baseline not present in document head (`index.html`).
- Storage trust boundary hardening is incomplete (`src/main.mjs:86` raw JSON parse used without strict schema validation).

## Rollback plan
- Trigger conditions:
  - `toast_priority_inversion_total > 0`
  - `p95(end_panel_render_delay_ms) > 500ms`
  - `debug_action_total{env=prod} > 0`
  - Browser smoke fails warning-order or end-panel CTA/focus checks
- Steps:
  1. Stop promotion and restore last-known-good static artifact.
  2. Purge CDN/browser cache for `index.html` and active JS bundles.
  3. Re-run smoke flow (start -> warning collision -> end panel -> restart) before reopening traffic.
- Data migration considerations: none (client-side storage only).
- Feature flag strategy: enforce debug-off release profile and gate debug controls behind flag.

## Release checklist
- [ ] Version/tag created and release notes updated
- [ ] CI merge/release workflows and gate scripts added and green
- [ ] Browser smoke test passed on release artifact
- [ ] Observability and alerts wired (`toast inversion`, `end-panel delay`, `debug activity`)
- [ ] Rollback drill validated
