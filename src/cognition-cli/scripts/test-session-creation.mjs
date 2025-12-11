/**
 * Test whether SDK 0.1.42 creates new sessions with different approaches
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

console.log('=== Testing SDK 0.1.42 Session Creation ===\n');

// Helper to get session ID from query
async function getSessionId(queryObj) {
  for await (const msg of queryObj) {
    if ('session_id' in msg && msg.session_id) {
      return msg.session_id;
    }
    // Stop after first message with session_id
    if (msg.type === 'assistant' || msg.type === 'result') {
      break;
    }
  }
  return null;
}

// Test 1: resume: undefined (current approach)
console.log('Test 1: Passing resume: undefined');
const query1 = query({
  prompt: 'Say "test1" and nothing else',
  options: {
    cwd: process.cwd(),
    resume: undefined, // Explicitly pass undefined
    includePartialMessages: false,
  },
});

const sessionId1 = await getSessionId(query1);
console.log(`  Session ID 1: ${sessionId1}\n`);

// Small delay
await new Promise((resolve) => setTimeout(resolve, 1000));

// Test 2: resume: undefined again (should this create new session?)
console.log('Test 2: Passing resume: undefined again');
const query2 = query({
  prompt: 'Say "test2" and nothing else',
  options: {
    cwd: process.cwd(),
    resume: undefined, // Explicitly pass undefined again
    includePartialMessages: false,
  },
});

const sessionId2 = await getSessionId(query2);
console.log(`  Session ID 2: ${sessionId2}\n`);

// Test 3: Omit resume key entirely
console.log('Test 3: Omitting resume key entirely');
const options3 = {
  cwd: process.cwd(),
  includePartialMessages: false,
};
// Don't include resume at all
const query3 = query({
  prompt: 'Say "test3" and nothing else',
  options: options3,
});

const sessionId3 = await getSessionId(query3);
console.log(`  Session ID 3: ${sessionId3}\n`);

// Test 4: Omit resume key again
console.log('Test 4: Omitting resume key again');
const query4 = query({
  prompt: 'Say "test4" and nothing else',
  options: {
    cwd: process.cwd(),
    includePartialMessages: false,
    // No resume key
  },
});

const sessionId4 = await getSessionId(query4);
console.log(`  Session ID 4: ${sessionId4}\n`);

// Results
console.log('=== RESULTS ===');
console.log(`Session 1 (resume: undefined):  ${sessionId1}`);
console.log(`Session 2 (resume: undefined):  ${sessionId2}`);
console.log(`Session 3 (no resume key):      ${sessionId3}`);
console.log(`Session 4 (no resume key):      ${sessionId4}`);
console.log('');
console.log('Analysis:');
console.log(
  `  1 === 2? ${sessionId1 === sessionId2} ${sessionId1 === sessionId2 ? '❌ SAME (resume: undefined keeps session!)' : '✅ DIFFERENT (creates new)'}`
);
console.log(
  `  3 === 4? ${sessionId3 === sessionId4} ${sessionId3 === sessionId4 ? '❌ SAME (omitted key keeps session!)' : '✅ DIFFERENT (creates new)'}`
);
console.log(
  `  1 === 3? ${sessionId1 === sessionId3} ${sessionId1 === sessionId3 ? '⚠️  SAME approach' : '✓ Different approach'}`
);

console.log('\nConclusion:');
if (sessionId1 !== sessionId2) {
  console.log('✅ resume: undefined DOES create new sessions');
} else if (sessionId3 !== sessionId4) {
  console.log('✅ Omitting resume key DOES create new sessions');
  console.log(
    '💡 FIX: Change code to omit resume key instead of passing undefined'
  );
} else {
  console.log('❌ Neither approach creates new sessions!');
  console.log(
    '🔍 SDK 0.1.42 may have changed session management fundamentally'
  );
}
