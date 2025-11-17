/**
 * eGemma Workbench API Client
 *
 * HTTP client for communicating with the eGemma workbench API, which provides:
 * - Code summarization via LLM (semantic understanding)
 * - Text embedding generation (768-dimensional vectors)
 * - AST parsing for structural analysis
 *
 * DESIGN PRINCIPLES:
 * - Rate limiting: Prevents API quota exhaustion
 * - Request queueing: Serializes concurrent requests
 * - Exponential backoff: Handles transient failures gracefully
 * - Automatic retries: Resilient to 429 (rate limit) errors
 *
 * ARCHITECTURE:
 * - Two independent queues: summarize and embed (different rate limits)
 * - FIFO processing: Maintains request order within each queue
 * - Promise-based API: Callers await results transparently
 * - Lazy API key checking: Only validates when needed (read-only ops don't need it)
 *
 * RATE LIMITING STRATEGY:
 * - Client-side limiting: Prevents hitting server-side limits
 * - Token bucket algorithm: N calls per M seconds
 * - Separate limits for summarize vs embed (different resource costs)
 * - Server-side fallback: Respects 429 responses with retry-after
 *
 * PERFORMANCE CHARACTERISTICS:
 * - Summarize: ~2-5s per request (LLM inference)
 * - Embed: ~100-200ms per request (fast embedding model)
 * - AST Parse: ~50-100ms per request (tree-sitter parsing)
 * - Queue overhead: <1ms per enqueue/dequeue
 *
 * @example
 * // Initialize client
 * const client = new WorkbenchClient('http://localhost:8000', true);
 *
 * // Check API health
 * await client.health();
 *
 * // Summarize code
 * const summary = await client.summarize({
 *   filename: 'auth.ts',
 *   content: sourceCode,
 *   persona: 'security_analyst'
 * });
 *
 * // Generate embedding
 * const embedding = await client.embed({
 *   signature: 'class:AuthManager:login:logout',
 *   dimensions: 768
 * });
 *
 * // Parse AST
 * const ast = await client.parseAST({
 *   filename: 'user.py',
 *   content: pythonCode,
 *   language: 'python'
 * });
 */

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
  MAX_RETRIES,
  MAX_RETRY_DELAY_MS,
} from '../../config.js';

/**
 * Represents a queued summarization request.
 *
 * Encapsulates the request data and promise resolution callbacks
 * for async request processing.
 */
interface SummarizeQueueItem {
  /** The summarization request parameters */
  request: SummarizeRequest;

  /** Promise resolver for successful completion */
  resolve: (value: SummarizeResponse | PromiseLike<SummarizeResponse>) => void;

  /** Promise rejector for errors */
  reject: (reason?: unknown) => void;
}

/**
 * Represents a queued embedding request.
 *
 * Encapsulates the request data and promise resolution callbacks
 * for async request processing.
 */
interface EmbedQueueItem {
  /** The embedding request parameters */
  request: EmbedRequest;

  /** Promise resolver for successful completion */
  resolve: (value: EmbedResponse | PromiseLike<EmbedResponse>) => void;

  /** Promise rejector for errors */
  reject: (reason?: unknown) => void;
}

/**
 * HTTP client for communicating with the eGemma workbench API.
 *
 * Manages rate limiting, queueing, and retries for all API operations.
 *
 * CONCURRENCY MODEL:
 * - Each queue processes one request at a time (serialized)
 * - Multiple requests can be queued concurrently (promise-based)
 * - Rate limits enforced at queue processing time
 *
 * RATE LIMIT CONFIGURATION:
 * - Summarize: SUMMARIZE_RATE_LIMIT_CALLS per SUMMARIZE_RATE_LIMIT_SECONDS
 * - Embed: EMBED_RATE_LIMIT_CALLS per EMBED_RATE_LIMIT_SECONDS
 *
 * RETRY POLICY:
 * - Max retries: MAX_RETRIES (typically 3)
 * - Max retry delay: MAX_RETRY_DELAY_MS (typically 60s)
 * - Only retries on 429 (rate limit exceeded)
 * - Other errors fail immediately
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

  /**
   * Creates a new workbench API client.
   *
   * @param baseUrl - Base URL of the workbench API (e.g., 'http://localhost:8000')
   * @param debug - Enable debug logging for rate limits and retries
   *
   * @example
   * const client = new WorkbenchClient('http://localhost:8000', true);
   */
  constructor(
    private baseUrl: string,
    private debug: boolean = false
  ) {
    this.apiKey = process.env.WORKBENCH_API_KEY || '';
    // Note: API key warning is deferred until first actual API call
    // Read-only commands don't need workbench access
  }

  /**
   * Get the base URL of the workbench API.
   *
   * @returns The configured base URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Sanitize error messages to prevent API key/URL leakage in logs
   */
  private sanitizeError(error: string): string {
    // Remove API keys from Bearer tokens
    let sanitized = error.replace(/Bearer\s+\S+/g, 'Bearer [REDACTED]');
    // Remove API keys from query parameters
    sanitized = sanitized.replace(/api_key=\S+/g, 'api_key=[REDACTED]');
    // Remove API keys from headers
    sanitized = sanitized.replace(
      /x-api-key:\s*\S+/gi,
      'x-api-key: [REDACTED]'
    );
    return sanitized;
  }

  /**
   * Check workbench API health.
   *
   * Sends a health check request to verify the API is reachable.
   * Does not require authentication.
   *
   * @returns Health check response from the API
   * @throws Error if API is unreachable or returns non-200 status
   *
   * @example
   * const health = await client.health();
   * console.log('Workbench status:', health.status);
   */
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

  /**
   * Summarize code using LLM.
   *
   * Generates semantic summaries of code for storage in overlays.
   * The summary captures what the code does, why it exists, and its
   * architectural role.
   *
   * QUEUEING:
   * - Request is queued immediately
   * - Processing begins async (FIFO order)
   * - Promise resolves when summary is ready
   *
   * RATE LIMITING:
   * - Respects SUMMARIZE_RATE_LIMIT_CALLS per SUMMARIZE_RATE_LIMIT_SECONDS
   * - Automatically waits if limit exceeded
   * - Retries on 429 (server-side rate limit)
   *
   * @param request - Summarization request parameters
   * @returns Promise resolving to the generated summary
   * @throws Error if API key not set or request fails after retries
   *
   * @example
   * const summary = await client.summarize({
   *   filename: 'auth.ts',
   *   content: 'export class AuthManager { ... }',
   *   persona: 'security_analyst',
   *   goal: 'Identify security-critical operations'
   * });
   * console.log(summary.text);
   */
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

  /**
   * Generate embedding vector for text.
   *
   * Converts structural signatures or semantic text into 768-dimensional
   * vectors for similarity search in overlays.
   *
   * QUEUEING:
   * - Request is queued immediately
   * - Processing begins async (FIFO order)
   * - Promise resolves when embedding is ready
   *
   * RATE LIMITING:
   * - Respects EMBED_RATE_LIMIT_CALLS per EMBED_RATE_LIMIT_SECONDS
   * - Automatically waits if limit exceeded
   * - Retries on 429 (server-side rate limit)
   *
   * @param request - Embedding request parameters
   * @returns Promise resolving to the generated embedding
   * @throws Error if API key not set or request fails after retries
   *
   * @example
   * const embedding = await client.embed({
   *   signature: 'class:AuthManager:login:logout:validateToken',
   *   dimensions: 768,
   *   prompt_name: 'structural_pattern'
   * });
   * console.log(embedding.embedding.length); // 768
   */
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

  /**
   * Process the summarization request queue.
   *
   * ALGORITHM:
   * 1. Check if already processing (prevent concurrent processing)
   * 2. While queue has items:
   *    a. Wait for rate limit window
   *    b. Dequeue next request
   *    c. Send HTTP request with retry logic
   *    d. Resolve/reject promise
   * 3. Mark processing complete
   *
   * RETRY LOGIC:
   * - On 429: Extract retry-after header, wait, retry (up to MAX_RETRIES)
   * - On other errors: Reject immediately (no retry)
   * - Max retry delay: MAX_RETRY_DELAY_MS (cap exponential backoff)
   *
   * CONCURRENCY:
   * - Only one instance of this method runs at a time
   * - Prevents race conditions on rate limit state
   * - New requests trigger processing if not already running
   */
  private async processSummarizeQueue(): Promise<void> {
    if (this.isProcessingSummarizeQueue) {
      return;
    }
    this.isProcessingSummarizeQueue = true;

    while (this.summarizeQueue.length > 0) {
      await this.waitForSummarizeRateLimit();

      const { request, resolve, reject } = this.summarizeQueue.shift()!;
      const maxRetries = MAX_RETRIES;
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < maxRetries) {
        try {
          const formData = new FormData();
          const fileBuffer = Buffer.from(request.content);

          const blob = new Blob([fileBuffer], { type: 'text/plain' });
          formData.set('file', blob, request.filename);

          formData.set('persona', request.persona);
          if (request.goal) formData.set('goal', request.goal);
          if (request.model_name)
            formData.set('model_name', request.model_name);
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

          if (response.status === 429) {
            // Rate limit exceeded - extract retry time and wait
            const errorText = await response.text();
            const retryMatch = errorText.match(/Try again in (\d+) seconds/);
            const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 10;

            attempt++;
            if (attempt < maxRetries) {
              const waitTime = Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS);
              if (this.debug) {
                const msg = `[WorkbenchClient] Summarize rate limit hit (429), retrying in ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})`;
                console.log(chalk?.yellow ? chalk.yellow(msg) : msg);
              }
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              continue;
            } else {
              throw new Error(
                `HTTP 429: ${this.sanitizeError(errorText)} (max retries exceeded)`
              );
            }
          }

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `HTTP ${response.status}: ${this.sanitizeError(errorText)}`
            );
          }

          resolve((await response.json()) as SummarizeResponse);
          break; // Success - exit retry loop
        } catch (error) {
          lastError = error as Error;

          // Enhance error message with connection context for fetch failures
          if (
            lastError.message.includes('fetch failed') ||
            lastError.message.includes('ECONNREFUSED') ||
            lastError.message.includes('ETIMEDOUT') ||
            lastError.message.includes('ENOTFOUND') ||
            lastError.message.includes('EHOSTUNREACH')
          ) {
            const enhancedError = new Error(
              `Failed to connect to workbench at ${this.baseUrl}\n` +
                `Original error: ${lastError.message}\n` +
                `\n💡 Check your WORKBENCH_URL environment variable\n` +
                `   Current: ${this.baseUrl}\n` +
                `   Expected format: http://localhost:8000`
            );
            enhancedError.stack = lastError.stack;
            reject(enhancedError);
            break;
          }

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
    this.isProcessingSummarizeQueue = false;
  }

  /**
   * Process the embedding request queue.
   *
   * ALGORITHM:
   * 1. Check if already processing (prevent concurrent processing)
   * 2. While queue has items:
   *    a. Wait for rate limit window
   *    b. Dequeue next request
   *    c. Send HTTP request with retry logic
   *    d. Resolve/reject promise
   * 3. Mark processing complete
   *
   * RETRY LOGIC:
   * - On 429: Extract retry-after header, wait, retry (up to MAX_RETRIES)
   * - On other errors: Reject immediately (no retry)
   * - Max retry delay: MAX_RETRY_DELAY_MS (cap exponential backoff)
   *
   * CONCURRENCY:
   * - Only one instance of this method runs at a time
   * - Prevents race conditions on rate limit state
   * - New requests trigger processing if not already running
   *
   * LOGGING:
   * - Individual fetch logs disabled (too noisy)
   * - Progress tracked by EmbedLogger in calling code
   */
  private async processEmbedQueue(): Promise<void> {
    if (this.isProcessingEmbedQueue) {
      return;
    }
    this.isProcessingEmbedQueue = true;

    while (this.embedQueue.length > 0) {
      await this.waitForEmbedRateLimit();

      const { request, resolve, reject } = this.embedQueue.shift()!;
      const maxRetries = MAX_RETRIES;
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
              const waitTime = Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS);
              if (this.debug) {
                const msg = `[WorkbenchClient] Rate limit hit (429), retrying in ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})`;
                console.log(chalk?.yellow ? chalk.yellow(msg) : msg);
              }
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              continue;
            } else {
              throw new Error(
                `HTTP 429: ${this.sanitizeError(errorText)} (max retries exceeded)`
              );
            }
          }

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `HTTP ${response.status}: ${this.sanitizeError(errorText)}`
            );
          }

          resolve((await response.json()) as EmbedResponse);
          break; // Success - exit retry loop
        } catch (error) {
          lastError = error as Error;

          // Enhance error message with connection context for fetch failures
          if (
            lastError.message.includes('fetch failed') ||
            lastError.message.includes('ECONNREFUSED') ||
            lastError.message.includes('ETIMEDOUT') ||
            lastError.message.includes('ENOTFOUND') ||
            lastError.message.includes('EHOSTUNREACH')
          ) {
            const enhancedError = new Error(
              `Failed to connect to workbench at ${this.baseUrl}\n` +
                `Original error: ${lastError.message}\n` +
                `\n💡 Check your WORKBENCH_URL environment variable\n` +
                `   Current: ${this.baseUrl}\n` +
                `   Expected format: http://localhost:8000`
            );
            enhancedError.stack = lastError.stack;
            reject(enhancedError);
            break;
          }

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

  /**
   * Wait for summarization rate limit window to pass.
   *
   * ALGORITHM (Token Bucket):
   * 1. Calculate time since last call
   * 2. If within window AND bucket full (call count >= limit):
   *    - Calculate wait time (time remaining in window)
   *    - Sleep for that duration
   *    - Reset bucket (call count = 0)
   * 3. Otherwise: proceed immediately
   *
   * EXAMPLE:
   * - Limit: 5 calls per 10 seconds
   * - Call times: 0s, 1s, 2s, 3s, 4s (5 calls in 4 seconds)
   * - Next call at 5s: Must wait 5s (until 10s window expires)
   * - Call at 10s: Bucket resets, proceed immediately
   */
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

  /**
   * Wait for embedding rate limit window to pass.
   *
   * ALGORITHM (Token Bucket):
   * 1. Calculate time since last call
   * 2. If within window AND bucket full (call count >= limit):
   *    - Calculate wait time (time remaining in window)
   *    - Sleep for that duration
   *    - Reset bucket (call count = 0)
   * 3. Otherwise: proceed immediately
   *
   * PUBLIC ACCESS:
   * This method is public to allow external batch processing logic
   * to coordinate rate limiting across multiple clients.
   *
   * @example
   * // Manual rate limit coordination
   * await client.waitForEmbedRateLimit();
   * const embedding = await client.embed({ ... });
   */
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

  /**
   * Parse code AST (Abstract Syntax Tree).
   *
   * Uses tree-sitter to parse code and extract structural information:
   * - Classes, functions, interfaces
   * - Method signatures and parameters
   * - Import statements
   * - Inheritance relationships
   *
   * NOT QUEUED:
   * AST parsing is fast (<100ms) and doesn't have strict rate limits,
   * so requests are sent immediately without queueing.
   *
   * @param request - AST parse request parameters
   * @returns Parsed structural data
   * @throws Error if API key not set or parsing fails
   *
   * @example
   * const ast = await client.parseAST({
   *   filename: 'user.py',
   *   content: 'class User:\n    def __init__(self): pass',
   *   language: 'python'
   * });
   * console.log(ast.classes[0].name); // 'User'
   */
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

  /**
   * Gracefully shutdown the client.
   *
   * Waits for all queued requests to complete before returning.
   * Should be called before process exit to avoid losing in-flight requests.
   *
   * BEHAVIOR:
   * - Waits for both queues to finish processing
   * - Polls every 100ms until both queues are idle
   * - Does NOT cancel in-flight requests
   *
   * @example
   * // Graceful shutdown
   * await client.shutdown();
   * console.log('All requests completed');
   * process.exit(0);
   */
  public async shutdown(): Promise<void> {
    // Wait for any ongoing processing to finish
    while (this.isProcessingSummarizeQueue || this.isProcessingEmbedQueue) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
