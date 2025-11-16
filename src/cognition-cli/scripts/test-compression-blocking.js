/**
 * Test to debug compression blocking issue
 *
 * This test simulates the compression flow to identify where the UI blocking occurs.
 */

async function testCompressionBlocking() {
  console.log('=== COMPRESSION BLOCKING TEST ===\n');

  // Simulate setIsThinking(true)
  console.log('[T+0ms] Step 1: setIsThinking(true)');
  console.log(
    '[T+0ms] ⚠️  UI WOULD BE BLOCKED HERE - React hasnt rendered yet!\n'
  );

  // Simulate importing modules
  console.log('[T+0ms] Step 2: Importing modules...');
  const startImport = Date.now();
  const { compressContext } = await import('./dist/sigma/compressor.js');
  const { reconstructSessionContext } = await import(
    './dist/sigma/context-reconstructor.js'
  );
  const importTime = Date.now() - startImport;
  console.log(
    `[T+${importTime}ms] Step 3: Modules imported (${importTime}ms)\n`
  );

  // Create a minimal lattice for testing
  const testLattice = {
    nodes: [
      {
        id: 'test1',
        type: 'conversation_turn',
        turn_id: 'turn_1',
        role: 'user',
        content: 'Test message 1',
        timestamp: Date.now(),
        embedding: new Array(768).fill(0.1),
        novelty: 0.5,
        overlay_scores: {
          O1_structural: 3.0,
          O2_security: 2.0,
          O3_lineage: 1.0,
          O4_mission: 4.0,
          O5_operational: 2.0,
          O6_mathematical: 1.0,
          O7_strategic: 2.0,
        },
        importance_score: 5,
        is_paradigm_shift: false,
        semantic_tags: ['test'],
      },
      {
        id: 'test2',
        type: 'conversation_turn',
        turn_id: 'turn_2',
        role: 'assistant',
        content: 'Test response',
        timestamp: Date.now() + 1000,
        embedding: new Array(768).fill(0.1),
        novelty: 0.3,
        overlay_scores: {
          O1_structural: 2.0,
          O2_security: 1.0,
          O3_lineage: 1.0,
          O4_mission: 3.0,
          O5_operational: 5.0,
          O6_mathematical: 1.0,
          O7_strategic: 2.0,
        },
        importance_score: 4,
        is_paradigm_shift: false,
        semantic_tags: ['test'],
      },
    ],
    edges: [],
  };

  console.log('[T+Xms] Step 4: Starting reconstructSessionContext...');
  const startReconstruct = Date.now();

  // Call reconstructSessionContext WITHOUT conversation registry (fast path only)
  console.log('[T+Xms] Testing FAST PATH (no conversation registry)...\n');
  try {
    const result = await reconstructSessionContext(
      testLattice,
      process.cwd(),
      undefined // No conversation registry - should use fast path only
    );
    const reconstructTime = Date.now() - startReconstruct;
    console.log(
      `\n[T+${reconstructTime}ms] ✅ Fast path complete (${reconstructTime}ms)`
    );
    console.log(
      `[T+${reconstructTime}ms] Recap length: ${result.recap.length} chars`
    );
    console.log(`[T+${reconstructTime}ms] Mode: ${result.mode}\n`);
  } catch (err) {
    console.error('❌ Fast path failed:', err.message);
  }

  // Now test with conversation registry (slow path)
  console.log('\n[T+Xms] Testing SLOW PATH (with conversation registry)...');
  console.log('[T+Xms] Creating conversation registry...\n');

  const { ConversationOverlayRegistry } = await import(
    './dist/sigma/conversation-registry.js'
  );
  const registry = new ConversationOverlayRegistry('./.sigma');

  // Set current session to prevent reading all historical sessions
  const testSessionId = 'test-session-123';
  await registry.setCurrentSession(testSessionId);
  console.log(`[T+Xms] Set current session: ${testSessionId}\n`);

  const startSlowPath = Date.now();
  try {
    const result = await reconstructSessionContext(
      testLattice,
      process.cwd(),
      registry // With conversation registry - might hit slow path
    );
    const slowPathTime = Date.now() - startSlowPath;
    console.log(
      `\n[T+${slowPathTime}ms] ✅ Slow path complete (${slowPathTime}ms)`
    );
    console.log(
      `[T+${slowPathTime}ms] Recap length: ${result.recap.length} chars`
    );
    console.log(`[T+${slowPathTime}ms] Mode: ${result.mode}\n`);
  } catch (err) {
    console.error('❌ Slow path failed:', err.message);
  }

  console.log('\n=== KEY INSIGHT ===');
  console.log('The issue is NOT that reconstruction is slow.');
  console.log(
    'The issue is that ALL these async operations happen BEFORE React renders setIsThinking(true).'
  );
  console.log(
    'Solution: Yield to event loop after setIsThinking(true) to let React render.\n'
  );
  console.log(
    'Fix: Add `await new Promise(resolve => setTimeout(resolve, 0));` after setIsThinking(true)\n'
  );
}

testCompressionBlocking().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
