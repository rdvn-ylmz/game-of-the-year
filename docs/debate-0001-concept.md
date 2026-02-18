# Debate DEBATE-0001 - Concept Position

## Position
Recommend **OOP-first architecture** for MVP, with explicit data-oriented boundaries and a planned migration trigger for hotspots.

## Why OOP for this MVP
1. **Scope fit:** MVP has limited entity variety (player, drones, hazards, pickups), so ECS setup cost is unlikely to pay back immediately.
2. **Team speed:** OOP is faster for small teams to implement, reason about, and debug under low-spec delivery pressure.
3. **Codebase alignment:** Existing runtime already uses class/state-driven patterns; OOP minimizes rewrite risk and preserves momentum.
4. **Operational simplicity:** Fewer abstractions mean lower integration and onboarding friction for downstream roles.

## Concrete Tradeoffs
| Topic | OOP-first gain | OOP-first cost | ECS alternative |
|---|---|---|---|
| Delivery speed | Faster MVP iteration | Potential future refactor | Slower initial setup |
| Performance | Adequate for low entity counts | Can degrade with many update loops | Better scaling at high entity volume |
| Maintainability | Clear for current scope | Inheritance/coupling can grow | Better composition at scale |
| Debugging | Direct call paths | Hidden side effects if state mutates broadly | System-level tracing but more indirection |

## Assumptions to Challenge
- Assumption: "ECS is always faster."  
  Reality: ECS benefits appear when entity/component counts and cache pressure are high; MVP may never hit that threshold.
- Assumption: "OOP cannot scale."  
  Reality: OOP can scale to medium complexity if strict boundaries are enforced (no deep inheritance, no god objects).
- Assumption: "Architecture choice is irreversible."  
  Reality: We can define migration triggers now and defer ECS until measured bottlenecks appear.

## Risks
- OOP object coupling may grow and slow feature additions after MVP.
- Per-entity update patterns may become CPU-heavy if content scales quickly.
- Late migration to ECS can be expensive if data contracts are not stabilized early.

## Actionable Recommendation for Moderator
1. Decide **OOP-first for MVP** as default architecture.
2. Add two guardrails now:
   - Favor composition over inheritance.
   - Keep game state in flat, serializable data structures at module boundaries.
3. Define hard migration triggers to revisit ECS:
   - Frame time >16.7ms for sustained gameplay on target low-spec devices.
   - Entity count growth beyond agreed threshold (e.g., >150 active entities).
   - Repeated feature friction from cross-object coupling in 2+ consecutive sprints.
4. Assign follow-up tasks:
   - `game_design`: provide expected peak entity counts by phase.
   - `coder`: instrument basic frame-time + entity-count telemetry.
   - `reviewer`: enforce architecture guardrails in PR reviews.

## Handoff Notes
- Decision output needed from moderator: "OOP-first accepted" or "ECS now," with measurable rationale.
- If OOP-first is accepted, next implementation should include telemetry and boundary rules in coding checklist.
