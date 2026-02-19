# Playtest Checklist - Gameplay Vertical Slice v1

## Quick Start
1. Open `index.html` in a browser
2. Click "Start Shift"
3. Use controls to play (see docs/controls.md)

## Core Gameplay Checks

### Movement & Physics
- [ ] Player rotates with A/D or Arrow keys
- [ ] Acceleration feels responsive (not instant, has momentum)
- [ ] Friction slows ship when no keys pressed
- [ ] Space triggers boost with visual effect
- [ ] Boost has cooldown (cannot spam)
- [ ] Ship stays within canvas bounds

### Carry Weight System
- [ ] Collecting debris adds to carry count
- [ ] More carry = slower rotation (noticeable at 5+ items)
- [ ] Carry orbits visually around ship

### Debris Collection
- [ ] Debris spawns automatically over time
- [ ] Flying near debris collects it
- [ ] Collection triggers particle effect
- [ ] Carry count increments in HUD

### Deposit System
- [ ] Recycler zone visible on canvas (green circle)
- [ ] Entering recycler zone shows "Press E" text
- [ ] Pressing E in zone deposits all carry
- [ ] Deposit triggers particle effect
- [ ] Score increases based on carry * combo
- [ ] Combo increases on deposit (up to 2.0x)

### Combo System
- [ ] Combo starts at 1.0x
- [ ] Each deposit increases combo by 0.2x
- [ ] Combo caps at 2.0x
- [ ] Combo timer counts down from 8 seconds
- [ ] Combo timer warning appears at 2 seconds
- [ ] Combo resets to 1.0x when timer expires
- [ ] Taking damage resets combo

### Hazards
- [ ] Hazards spawn from screen edges
- [ ] Hazards move across screen
- [ ] Hazards damage on contact
- [ ] Collision triggers screen shake
- [ ] Collision triggers hit flash
- [ ] Player becomes invulnerable briefly after hit
- [ ] HP decreases on damage
- [ ] Game ends at 0 HP

### Phase System
- [ ] Phase 2 starts at 121s (toast appears)
- [ ] Phase 3 starts at 241s (toast appears)
- [ ] Hazard spawn rate increases in later phases

### Pause System
- [ ] P key toggles pause
- [ ] Pause button toggles pause
- [ ] Game freezes when paused
- [ ] "PAUSED" overlay displays
- [ ] Resume works correctly

### Game Over & Restart
- [ ] Game ends when HP reaches 0
- [ ] Game ends when timer reaches 0
- [ ] End panel shows with correct outcome
- [ ] Final score displayed
- [ ] Personal best comparison shown
- [ ] Restart Shift button works
- [ ] Quit to Title button works

## VFX Checks
- [ ] Screen shake on damage
- [ ] Red hit flash on damage
- [ ] Particle burst on debris collect
- [ ] Particle burst on deposit
- [ ] Boost shows engine trail
- [ ] Recycler pulses/glows

## Debug Features (Testing Only)
- [ ] "Collect Scrap" button works
- [ ] "Deposit" button works (anywhere)
- [ ] "Take Damage" button works
- [ ] Debug buttons don't interfere with gameplay flow

## QA Smoke Scenarios

### Scenario 1: Normal Run
1. Start game
2. Collect 3-5 debris
3. Deposit at recycler
4. Repeat 2-3 times
5. Verify score increases correctly
6. Let timer run out
7. Verify end screen appears

### Scenario 2: Combo Chain
1. Collect debris
2. Deposit immediately
3. Repeat quickly 5+ times
4. Verify combo reaches 2.0x
5. Verify "Combo capped" message
6. Wait for timeout
7. Verify combo resets

### Scenario 3: Damage & Death
1. Start game
2. Collide with hazard (or press H)
3. Verify HP decreases
4. Verify screen shake and flash
5. Collide 2 more times
6. Verify game over at 0 HP
7. Verify end panel appears

### Scenario 4: Pause/Resume
1. Start game
2. Collect some debris
3. Press P to pause
4. Verify game freezes
5. Press P to resume
6. Verify game continues correctly

## Performance Checks
- [ ] Game runs at 60fps
- [ ] No memory leaks after 5 minute run
- [ ] Smooth rendering even with 10+ entities
- [ ] No console errors

## Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
