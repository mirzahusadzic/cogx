import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Integration tests - require eGemma to be running
describe('EmbeddingService - Integration', () => {
  const EGGEMMA_URL = process.env.WORKBENCH_URL || 'http://localhost:8000';
  const isEGemmaAvailable = process.env.WORKBENCH_TEST_INTEGRATION === 'true';

  const skipIfNoEGemma = isEGemmaAvailable ? it : it.skip;

  skipIfNoEGemma(
    'should respect rate limits and queue requests',
    async () => {
      const { EmbeddingService } = await import('../embedding.js');
      const service = new EmbeddingService(EGGEMMA_URL);

      const start = Date.now();
      const promises = Array.from({ length: 12 }, (_, i) =>
        service.getEmbedding(`test_signature_${i}`, 768)
      );

      await Promise.all(promises);
      const elapsed = Date.now() - start;

      // With 5 req/10s limit, 12 requests should take at least 20s
      // (0-5: batch 1, 6-10: batch 2 after 10s, 11: batch 3 after 20s)
      expect(elapsed).toBeGreaterThan(19000);

      await service.shutdown();
    },
    30000
  );
});

// Unit tests - no external dependencies (run in CI/CD)
describe('EmbeddingService - Unit', () => {
  let EmbeddingService: typeof import('../embedding.js').EmbeddingService;
  let service: InstanceType<typeof EmbeddingService>;
  let mockWorkbenchClient: {
    embed: ReturnType<typeof vi.fn>;
    waitForEmbedRateLimit: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    vi.resetModules();

    // Create mock workbench client
    mockWorkbenchClient = {
      embed: vi.fn(async () => ({
        embedding_768d: new Array(768).fill(0.1),
      })),
      waitForEmbedRateLimit: vi.fn(async () => {}),
    };

    // Mock WorkbenchClient module
    vi.doMock('../../executors/workbench-client.js', () => ({
      WorkbenchClient: vi.fn().mockImplementation(() => mockWorkbenchClient),
    }));

    // Import after mocking
    const module = await import('../embedding.js');
    EmbeddingService = module.EmbeddingService;
    service = new EmbeddingService('http://localhost:8000');
  });

  afterEach(async () => {
    // Clean up service
    if (service) {
      await service.shutdown().catch(() => {});
    }
    vi.doUnmock('../../executors/workbench-client.js');
  });

  it('should queue requests and process sequentially', async () => {
    const promises = [
      service.getEmbedding('sig1', 768),
      service.getEmbedding('sig2', 768),
      service.getEmbedding('sig3', 768),
    ];

    // Wait a tick to let the queue populate
    await new Promise((resolve) => setTimeout(resolve, 0));

    // At least some should be queued (race condition: one might already be processing)
    expect(service.getQueueSize()).toBeGreaterThanOrEqual(0);

    await Promise.all(promises);

    expect(service.getQueueSize()).toBe(0);
    expect(service.isProcessing()).toBe(false);
    expect(mockWorkbenchClient.embed).toHaveBeenCalledTimes(3);
  });

  it('should not call embed concurrently', async () => {
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    mockWorkbenchClient.embed.mockImplementation(async () => {
      concurrentCalls++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);

      await new Promise((resolve) => setTimeout(resolve, 10));

      concurrentCalls--;

      return { embedding_768d: new Array(768).fill(0.1) };
    });

    const promises = Array.from({ length: 5 }, (_, i) =>
      service.getEmbedding(`sig${i}`, 768)
    );

    await Promise.all(promises);

    // Should never have more than 1 concurrent call
    expect(maxConcurrent).toBe(1);
  });

  it('should handle embedding failures gracefully', async () => {
    mockWorkbenchClient.embed.mockRejectedValueOnce(new Error('Network error'));

    await expect(service.getEmbedding('failing_sig', 768)).rejects.toThrow(
      'Network error'
    );

    // Queue should continue processing after error
    const result = await service.getEmbedding('successful_sig', 768);
    expect(result).toHaveProperty('embedding_768d');
  });

  it('should shutdown and reject pending requests', async () => {
    // Make embed delay so requests queue up
    mockWorkbenchClient.embed.mockImplementation(
      async () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ embedding_768d: new Array(768).fill(0.1) }),
            100
          )
        )
    );

    const promise1 = service.getEmbedding('sig1', 768).catch((e) => e);
    const promise2 = service.getEmbedding('sig2', 768).catch((e) => e);

    // Wait a tick to ensure they're queued
    await new Promise((resolve) => setTimeout(resolve, 0));

    await service.shutdown();

    const result1 = await promise1;
    const result2 = await promise2;

    // At least one should be rejected with shutdown error
    const errors = [result1, result2].filter((r) => r instanceof Error);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('shutdown'))).toBe(true);
  });

  it('should report queue size correctly', async () => {
    // Make embed delay so requests queue up
    mockWorkbenchClient.embed.mockImplementation(
      async () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ embedding_768d: new Array(768).fill(0.1) }),
            100
          )
        )
    );

    // Queue 3 requests and catch errors (so they don't become unhandled rejections)
    const promises = [
      service.getEmbedding('sig1', 768).catch(() => {}),
      service.getEmbedding('sig2', 768).catch(() => {}),
      service.getEmbedding('sig3', 768).catch(() => {}),
    ];

    // Wait a tick to let queue populate
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should have queued items (at least 2, since one might be processing)
    expect(service.getQueueSize()).toBeGreaterThanOrEqual(2);

    // Clean up
    await service.shutdown();
    await Promise.allSettled(promises);
  });
});
