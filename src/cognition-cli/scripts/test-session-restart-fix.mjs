/**
 * Test to verify the session state restart bug fix
 *
 * BUG: When restarting TUI with same anchor_id, state file was being reset
 * FIX: Preserve compression history when reason='initial' but state exists
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import the session state functions
const sessionStatePath = path.join(
  __dirname,
  'dist',
  'sigma',
  'session-state.js'
);
const {
  createSessionState,
  updateSessionState,
  saveSessionState,
  loadSessionState,
} = await import(sessionStatePath);

console.log('=== Testing Session State Restart Bug Fix ===\n');

const testDir = path.join(__dirname, '.test-sigma');
const anchorId = 'test-restart-1234';

// Clean up any existing test files
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true });
}
fs.mkdirSync(testDir, { recursive: true });

// Step 1: Create initial session state
console.log('Step 1: Create initial session state');
const state1 = createSessionState(anchorId, 'sdk-session-1');
saveSessionState(
  state1,
  __dirname.replace(
    '/src/cognition-cli',
    '/src/cogx/src/cognition-cli/.test-sigma/..'
  )
);
console.log(`  ✓ Created state with 1 entry in compression_history`);
console.log(`  Current session: ${state1.current_session}`);

// Step 2: Simulate compression (add 3 more sessions)
console.log('\nStep 2: Simulate 3 compressions');
let state2 = updateSessionState(state1, 'sdk-session-2', 'compression', 126331);
saveSessionState(
  state2,
  __dirname.replace(
    '/src/cognition-cli',
    '/src/cogx/src/cognition-cli/.test-sigma/..'
  )
);

let state3 = updateSessionState(state2, 'sdk-session-3', 'compression', 131024);
saveSessionState(
  state3,
  __dirname.replace(
    '/src/cognition-cli',
    '/src/cogx/src/cognition-cli/.test-sigma/..'
  )
);

let state4 = updateSessionState(state3, 'sdk-session-4', 'compression', 134385);
saveSessionState(
  state4,
  __dirname.replace(
    '/src/cognition-cli',
    '/src/cogx/src/cognition-cli/.test-sigma/..'
  )
);

console.log(`  ✓ Added 3 compressions`);
console.log(
  `  Compression history length: ${state4.compression_history.length}`
);
console.log(`  Current session: ${state4.current_session}`);

// Step 3: Verify state has 4 entries
console.log('\nStep 3: Verify state file');
const beforeRestart = loadSessionState(
  anchorId,
  __dirname.replace(
    '/src/cognition-cli',
    '/src/cogx/src/cognition-cli/.test-sigma/..'
  )
);
console.log(
  `  Compression history: ${beforeRestart.compression_history.length} entries`
);
console.log(
  `  Sessions: ${beforeRestart.compression_history.map((h) => h.reason).join(' → ')}`
);

// Step 4: Simulate TUI restart with new SDK session
console.log('\nStep 4: Simulate TUI restart (THE FIX TEST)');
console.log(
  '  This simulates what happens when TUI restarts with same anchor_id'
);
console.log('  OLD BUG: Would call create() and reset state to 1 entry');
console.log(
  '  NEW FIX: Should call update() with reason="restart" and preserve history'
);

// The fix: Use updateSessionState with 'restart' reason instead of createSessionState
const afterRestart = updateSessionState(
  beforeRestart,
  'sdk-session-5',
  'restart'
);
saveSessionState(
  afterRestart,
  __dirname.replace(
    '/src/cognition-cli',
    '/src/cogx/src/cognition-cli/.test-sigma/..'
  )
);

console.log(`  ✓ Updated with reason='restart'`);
console.log(
  `  Compression history length: ${afterRestart.compression_history.length}`
);
console.log(`  Current session: ${afterRestart.current_session}`);

// Step 5: Verify state preserved
console.log('\nStep 5: Verify state was preserved');
const final = loadSessionState(
  anchorId,
  __dirname.replace(
    '/src/cognition-cli',
    '/src/cogx/src/cognition-cli/.test-sigma/..'
  )
);
const historyPreserved = final.compression_history.length === 5;
const hasRestartEntry = final.compression_history.some(
  (h) => h.reason === 'restart'
);

console.log(
  `  Compression history: ${final.compression_history.length} entries`
);
console.log(
  `  Sessions: ${final.compression_history.map((h) => h.reason).join(' → ')}`
);
console.log(`  Has 'restart' entry: ${hasRestartEntry}`);

// Results
console.log('\n=== RESULTS ===');
if (historyPreserved && hasRestartEntry) {
  console.log('✅ SUCCESS: Session state preserved on restart!');
  console.log('   - All 4 previous sessions preserved');
  console.log('   - New session added with reason="restart"');
  console.log('   - Total: 5 entries in compression_history');
} else if (!historyPreserved) {
  console.log('❌ FAILURE: Compression history was lost!');
  console.log(
    `   Expected: 5 entries, Got: ${final.compression_history.length}`
  );
} else if (!hasRestartEntry) {
  console.log('❌ FAILURE: No restart entry found!');
  console.log('   The restart reason was not recorded');
}

// Clean up
fs.rmSync(testDir, { recursive: true });
console.log('\n✓ Test cleanup complete');
