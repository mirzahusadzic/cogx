import { fetch, FormData } from 'undici';
import type { BodyInit } from 'undici';
import { Blob } from 'node:buffer';
import chalk from 'chalk';
import type { StructuralData, SummarizeResponse } from '../types/structural.js';
import type {
  SummarizeRequest,
  ASTParseRequest,
  EmbedRequest,
  EmbedResponse,
} from '../types/workbench.js';
import {
  SUMMARIZE_RATE_LIMIT_SECONDS,
  SUMMARIZE_RATE_LIMIT_CALLS,
  EMBED_RATE_LIMIT_SECONDS,
  EMBED_RATE_LIMIT_CALLS,
  EMBED_PROMPT_NAME,
} from '../../config.js';

/**
 * Represents a queued summarization request.
 */
interface SummarizeQueueItem {
  request: SummarizeRequest;
  resolve: (value: SummarizeResponse | PromiseLike<SummarizeResponse>) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Represents a queued embedding request.
 */
interface EmbedQueueItem {
  request: EmbedRequest;
  resolve: (value: EmbedResponse | PromiseLike<EmbedResponse>) => void;
  reject: (reason?: unknown) => void;
}

/**
 * HTTP client for communicating with the eGemma workbench API with rate limiting and queueing.
 */
export class WorkbenchClient {
  private apiKey: string;
  private summarizeQueue: SummarizeQueueItem[] = [];
  private embedQueue: EmbedQueueItem[] = [];
  private isProcessingSummarizeQueue: boolean = false;
  private isProcessingEmbedQueue: boolean = false;

  // Rate limiting state for summarize
  private lastSummarizeCallTime: number = 0;
  private summarizeCallCount: number = 0;

  // Rate limiting state for embed
  private lastEmbedCallTime: number = 0;
  private embedCallCount: number = 0;

  constructor(
    private baseUrl: string,
    private debug: boolean = false
  ) {
    this.apiKey = process.env.WORKBENCH_API_KEY || '';
    // Note: API key warning is deferred until first actual API call
    // Read-only commands don't need workbench access
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  async health() {
    if (!this.apiKey) {
      console.warn(
        'WORKBENCH_API_KEY not set. This is required for workbench API calls.'
      );
    }
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  }

  async summarize(request: SummarizeRequest): Promise<SummarizeResponse> {
    if (!this.apiKey) {
      throw new Error(
        'WORKBENCH_API_KEY not set. This is required for summarization.'
      );
    }
    return new Promise((resolve, reject) => {
      this.summarizeQueue.push({ request, resolve, reject });
      this.processSummarizeQueue();
    });
  }

  async embed(request: EmbedRequest): Promise<EmbedResponse> {
    if (!this.apiKey) {
      throw new Error(
        'WORKBENCH_API_KEY not set. This is required for embedding.'
      );
    }
    return new Promise((resolve, reject) => {
      this.embedQueue.push({ request, resolve, reject });
      this.processEmbedQueue();
    });
  }

  private async processSummarizeQueue(): Promise<void> {
    if (this.isProcessingSummarizeQueue) {
      return;
    }
    this.isProcessingSummarizeQueue = true;

    while (this.summarizeQueue.length > 0) {
      await this.waitForSummarizeRateLimit();

      const { request, resolve, reject } = this.summarizeQueue.shift()!;
      try {
        const formData = new FormData();
        const fileBuffer = Buffer.from(request.content);

        const blob = new Blob([fileBuffer], { type: 'text/plain' });
        formData.set('file', blob, request.filename);

        formData.set('persona', request.persona);
        if (request.goal) formData.set('goal', request.goal);
        if (request.model_name) formData.set('model_name', request.model_name);
        if (request.max_tokens)
          formData.set('max_tokens', request.max_tokens.toString());
        if (request.temperature)
          formData.set('temperature', request.temperature.toString());
        if (request.enable_safety !== undefined)
          formData.set('enable_safety', request.enable_safety.toString());

        const response = await fetch(`${this.baseUrl}/summarize`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: formData as unknown as BodyInit,
        });

        this.summarizeCallCount++;
        this.lastSummarizeCallTime = Date.now();

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        resolve((await response.json()) as SummarizeResponse);
      } catch (error) {
        reject(error);
      }
    }
    this.isProcessingSummarizeQueue = false;
  }

  private async processEmbedQueue(): Promise<void> {
    if (this.isProcessingEmbedQueue) {
      return;
    }
    this.isProcessingEmbedQueue = true;

    while (this.embedQueue.length > 0) {
      await this.waitForEmbedRateLimit();

      const { request, resolve, reject } = this.embedQueue.shift()!;
      const maxRetries = 5;
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < maxRetries) {
        try {
          // FIX: Send as FormData, not JSON
          const formData = new FormData();
          const signatureBuffer = Buffer.from(request.signature);
          const blob = new Blob([signatureBuffer], { type: 'text/plain' });
          // The server expects a 'file' field
          formData.set('file', blob, 'signature.txt');
          const promptName = request.prompt_name || EMBED_PROMPT_NAME;

          // Logging disabled - EmbedLogger handles progress tracking
          // Individual fetch logs create too much noise during batch operations

          const response = await fetch(
            `${this.baseUrl}/embed?dimensions=${request.dimensions}&prompt_name=${promptName}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${this.apiKey}`,
              },
              body: formData as unknown as BodyInit,
            }
          );

          this.embedCallCount++;
          this.lastEmbedCallTime = Date.now();

          if (response.status === 429) {
            // Rate limit exceeded - extract retry time and wait
            const errorText = await response.text();
            const retryMatch = errorText.match(/Try again in (\d+) seconds/);
            const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 10;

            attempt++;
            if (attempt < maxRetries) {
              const waitTime = retryAfter * 1000 + attempt * 1000; // Add exponential backoff
              if (this.debug) {
                const msg = `[WorkbenchClient] Rate limit hit (429), retrying in ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})`;
                console.log(chalk?.yellow ? chalk.yellow(msg) : msg);
              }
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              continue;
            } else {
              throw new Error(`HTTP 429: ${errorText} (max retries exceeded)`);
            }
          }

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          resolve((await response.json()) as EmbedResponse);
          break; // Success - exit retry loop
        } catch (error) {
          lastError = error as Error;
          // If it's not a rate limit error, don't retry
          if (!lastError.message.includes('HTTP 429')) {
            reject(error);
            break;
          }
        }
      }

      // If we exhausted retries, reject with the last error
      if (attempt >= maxRetries && lastError) {
        reject(lastError);
      }
    }
    this.isProcessingEmbedQueue = false;
  }

  private async waitForSummarizeRateLimit(): Promise<void> {
    const now = Date.now();
    const timeElapsed = now - this.lastSummarizeCallTime;

    if (
      timeElapsed < SUMMARIZE_RATE_LIMIT_SECONDS * 1000 &&
      this.summarizeCallCount >= SUMMARIZE_RATE_LIMIT_CALLS
    ) {
      const timeToWait = SUMMARIZE_RATE_LIMIT_SECONDS * 1000 - timeElapsed;
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
      this.summarizeCallCount = 0;
      this.lastSummarizeCallTime = Date.now();
    }
  }

  public async waitForEmbedRateLimit(): Promise<void> {
    const now = Date.now();
    const timeElapsed = now - this.lastEmbedCallTime;

    if (
      timeElapsed < EMBED_RATE_LIMIT_SECONDS * 1000 &&
      this.embedCallCount >= EMBED_RATE_LIMIT_CALLS
    ) {
      const timeToWait = EMBED_RATE_LIMIT_SECONDS * 1000 - timeElapsed;
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
      this.embedCallCount = 0;
      this.lastEmbedCallTime = Date.now();
    }
  }

  async parseAST(request: ASTParseRequest): Promise<StructuralData> {
    if (!this.apiKey) {
      throw new Error(
        'WORKBENCH_API_KEY not set. This is required for AST parsing.'
      );
    }
    const formData = new FormData();
    const fileBuffer = Buffer.from(request.content);

    const blob = new Blob([fileBuffer], { type: 'text/x-python' });
    formData.set('file', blob, request.filename);

    formData.set('language', request.language);

    const response = await fetch(`${this.baseUrl}/parse-ast`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData as unknown as BodyInit,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return (await response.json()) as StructuralData;
  }

  public async shutdown(): Promise<void> {
    // Wait for any ongoing processing to finish
    while (this.isProcessingSummarizeQueue || this.isProcessingEmbedQueue) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
