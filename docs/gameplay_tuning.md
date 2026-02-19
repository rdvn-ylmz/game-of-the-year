# Gameplay Tuning Documentation

## Hotfix Changes (PIPE-0006)

### Pause System Fixes

**Issue**: Pause did not fully freeze the runtime, allowing gameplay actions to continue.

**Fix**: 
- Pause toggle now uses runtime as the source of truth and syncs canvas via `canvasGame.setPaused(paused)`
- Runtime tick and gameplay mutations are blocked while paused at the runtime layer
- All gameplay actions (collect, deposit, damage) are blocked when paused
- Main loop/input/debug handlers now share `isGameplayPaused()` guard (`runtime.isPaused()` OR `canvasGame.paused`)

**Files Modified**:
- `src/main.mjs` - Added unified pause guard and runtime-authoritative pause toggling
- `src/game_canvas.mjs` - Pause state respected in update loop

### Deposit Zone Contextual Prompt

**Issue**: "Press E" prompt was always visible in the recycler zone, regardless of player position.

**Fix**:
- `DepositZone.draw()` now accepts optional `playerPosition` parameter
- "Press E" prompt only renders when player is inside the deposit zone radius
- When outside, only "RECYCLER" label is shown

**Files Modified**:
- `src/entities.mjs` - Updated `DepositZone.draw()` signature and logic
- `src/game_canvas.mjs` - Passes player position to `depositZone.draw()`

### Runtime API Usage

**Issue**: Direct state writes to `runtime.state` and calls to private `runtime._finishRun()`.

**Fix**:
- Using public `runtime.syncPlayerState({ hp, carryCount, carryValue })` API for state synchronization
- Using public `runtime.endRunFromGameOver()` API for game over transitions
- Using public `runtime.setPaused(paused)` API to enforce pause semantics from UI integration
- No direct state mutations - all changes go through public methods
- Added regression test that scans `src/main.mjs` for forbidden `runtime.state` and `runtime._finishRun()` usage

**Files Modified**:
- `src/main.mjs` - Updated to use public APIs only
- `src/gameplay_hotfix.test.mjs` - Added public API boundary regression checks

### Test Coverage

**New Tests Added** in `src/gameplay_hotfix.test.mjs`:

1. **Pause Freeze Test** - Verifies runtime tick and gameplay mutations are blocked while paused
2. **Runtime Action Blocking** - Confirms actions are blocked when game is not running
3. **Deposit Zone Detection** - Tests player containment logic at various positions
4. **Game Over Transitions** - Verifies HP depletion and timer expiry trigger correct end states
5. **Post-Game Action Blocking** - Ensures actions are blocked after game over
6. **syncPlayerState API** - Tests the public state synchronization API
7. **endRunFromGameOver API** - Tests the public game over API
8. **Contextual Prompt** - Verifies "Press E" only shows when player is in zone
9. **Pause + EndRun State Reset** - Verifies end-run clears pause and blocks post-end mutations
10. **Main Integration API Guard** - Verifies `src/main.mjs` uses public runtime APIs only and keeps keyboard/debug paths

### Debug Controls Behavior

**Behavior**:
- Debug buttons (Collect Scrap, Deposit, Take Damage) only work when:
  - `runtime.isRunning()` returns true
  - Game is not paused (for gameplay consistency)
- Pause button (P key and UI button) toggles pause state
- When paused:
  - Runtime tick is skipped
  - Canvas game update is skipped
  - Gameplay keyboard inputs are blocked
  - Debug buttons are blocked (to maintain pause semantics)

## QA Evidence (2026-02-19)

- Command: `node --check src/main.mjs && node --check src/game_state.mjs && node --check src/game_canvas.mjs && node --check src/entities.mjs && node --check src/systems.mjs`
- Result: PASS (all checked files parse successfully)
- Command: `node --test src/*.test.mjs`
- Result: PASS (`18` tests, `0` failures)

## QA Verification Checklist

- [ ] Press P to pause - game freezes completely
- [ ] While paused, try debug buttons - should not work
- [ ] While paused, try keyboard controls - should not work
- [ ] Resume game - should continue from where paused
- [ ] Enter recycler zone - "Press E" prompt appears
- [ ] Exit recycler zone - "Press E" prompt disappears
- [ ] Stand at edge of recycler - prompt shows correctly
- [ ] Take damage until 0 HP - game over triggers correctly
- [ ] Let timer run out - game over triggers correctly
- [ ] After game over, try actions - should not work
- [ ] Restart game - new run starts correctly
