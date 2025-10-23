import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbeddingService } from './embedding.js';

// Integration tests - require eGemma to be running
describe('EmbeddingService - Integration', () => {
  const EGGEMMA_URL = process.env.WORKBENCH_URL || 'http://localhost:8000';
  const isEGemmaAvailable = process.env.EGGEMMA_AVAILABLE === 'true';

  const skipIfNoEGemma = isEGemmaAvailable ? it : it.skip;

  skipIfNoEGemma(
    'should respect rate limits and queue requests',
    async () => {
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

// Unit tests - no external dependencies
describe('EmbeddingService - Unit', () => {
  let service: EmbeddingService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        embedding_768d: new Array(768).fill(0.1),
      }),
    }));

    global.fetch = mockFetch;
    service = new EmbeddingService('http://localhost:8000');
  });

  it('should queue requests and process sequentially', async () => {
    const promises = [
      service.getEmbedding('sig1', 768),
      service.getEmbedding('sig2', 768),
      service.getEmbedding('sig3', 768),
    ];

    expect(service.getQueueSize()).toBe(3);
    expect(service.isProcessing()).toBe(true);

    await Promise.all(promises);

    expect(service.getQueueSize()).toBe(0);
    expect(service.isProcessing()).toBe(false);
  });

  it('should not call fetch concurrently', async () => {
    let concurrentCalls = 0;
    let maxConcurrent = 0;

    mockFetch.mockImplementation(async () => {
      concurrentCalls++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);

      await new Promise((resolve) => setTimeout(resolve, 10));

      concurrentCalls--;

      return {
        ok: true,
        json: async () => ({ embedding_768d: new Array(768).fill(0.1) }),
      };
    });

    const promises = Array.from({ length: 5 }, (_, i) =>
      service.getEmbedding(`sig${i}`, 768)
    );

    await Promise.all(promises);

    // Should never have more than 1 concurrent call
    expect(maxConcurrent).toBe(1);
  });

  it('should handle embedding failures gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(service.getEmbedding('failing_sig', 768)).rejects.toThrow(
      'Network error'
    );

    // Queue should continue processing after error
    const result = await service.getEmbedding('successful_sig', 768);
    expect(result).toHaveProperty('embedding_768d');
  });

  it('should shutdown and reject pending requests', async () => {
    const promise1 = service.getEmbedding('sig1', 768).catch((e) => e);
    const promise2 = service.getEmbedding('sig2', 768).catch((e) => e);

    await service.shutdown();

    const result1 = await promise1;
    const result2 = await promise2;

    expect(result1).toBeInstanceOf(Error);
    expect(result1.message).toContain('shutdown');
    expect(result2).toBeInstanceOf(Error);
    expect(result2.message).toContain('shutdown');
  });

  it('should report queue size correctly', async () => {
    // Queue 3 requests
    service.getEmbedding('sig1', 768);
    service.getEmbedding('sig2', 768);
    service.getEmbedding('sig3', 768);

    // Should have queued items
    expect(service.getQueueSize()).toBeGreaterThan(0);
  });
});
