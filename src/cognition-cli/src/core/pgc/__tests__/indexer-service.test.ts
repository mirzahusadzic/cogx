import { describe, it, expect, vi } from 'vitest';
import { PGCIndexerService } from '../indexer-service.js';
import { PGCStoreContext } from '../store-context.js';
import { IndexData } from '../../types/index.js';

describe('PGCIndexerService', () => {
  const mockContext = {
    index: {
      set: vi.fn(),
    },
    transformLog: {
      record: vi.fn(),
    },
  } as unknown as PGCStoreContext;

  const indexerService = new PGCIndexerService(mockContext);

  it('index() delegates to index.set()', async () => {
    const mockData: IndexData = { structural_hash: 'hash1', symbol: 'MyClass' };
    await indexerService.index('key1', mockData);
    expect(mockContext.index.set).toHaveBeenCalledWith('key1', mockData);
  });

  it('recordTransform() delegates to transformLog.record()', async () => {
    const mockTransformData = { inputs: [], outputs: [] };
    vi.mocked(mockContext.transformLog.record).mockResolvedValue('tid1');
    const result = await indexerService.recordTransform(mockTransformData);
    expect(mockContext.transformLog.record).toHaveBeenCalledWith(
      mockTransformData
    );
    expect(result).toBe('tid1');
  });

  it('canRequestEmbeddings() returns false initially', () => {
    expect(indexerService.canRequestEmbeddings()).toBe(false);
  });

  it('requestEmbedding() throws if handler not set', async () => {
    await expect(
      indexerService.requestEmbedding({ signature: 's', dimensions: 768 })
    ).rejects.toThrow('Embedding request handler not set');
  });

  it('setEmbeddingRequestHandler() enables embedding requests', async () => {
    const mockHandler = vi
      .fn()
      .mockResolvedValue({ embedding_768d: [0.1, 0.2] });
    indexerService.setEmbeddingRequestHandler(mockHandler);

    expect(indexerService.canRequestEmbeddings()).toBe(true);
    const result = await indexerService.requestEmbedding({
      signature: 's',
      dimensions: 768,
    });
    expect(mockHandler).toHaveBeenCalledWith({
      signature: 's',
      dimensions: 768,
    });
    expect(result.embedding_768d).toEqual([0.1, 0.2]);
  });
});
