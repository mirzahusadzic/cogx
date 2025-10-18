import { fetch, FormData } from 'undici';
import type { BodyInit } from 'undici';
import { Blob } from 'node:buffer';
import type { StructuralData, SummarizeResponse } from '../types/structural.js';
import type { SummarizeRequest, ASTParseRequest } from '../types/workbench.js';
import {
  SUMMARIZE_RATE_LIMIT_SECONDS,
  SUMMARIZE_RATE_LIMIT_CALLS,
} from '../config.js';

interface SummarizeQueueItem {
  request: SummarizeRequest;
  resolve: (value: SummarizeResponse | PromiseLike<SummarizeResponse>) => void;
  reject: (reason?: unknown) => void;
}

export class WorkbenchClient {
  private apiKey: string;
  private summarizeQueue: SummarizeQueueItem[] = [];
  private isProcessingSummarizeQueue: boolean = false;
  private lastSummarizeCallTime: number = 0;
  private summarizeCallCount: number = 0;
  private readonly SUMMARIZE_RATE_LIMIT_SECONDS_CONFIG: number =
    SUMMARIZE_RATE_LIMIT_SECONDS;
  private readonly SUMMARIZE_RATE_LIMIT_CALLS_CONFIG: number =
    SUMMARIZE_RATE_LIMIT_CALLS;

  constructor(private baseUrl: string) {
    this.apiKey = process.env.WORKBENCH_API_KEY || '';
    if (!this.apiKey) {
      console.warn(
        'WORKBENCH_API_KEY not set. This is required for production.'
      );
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  async health() {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  }

  async summarize(request: SummarizeRequest): Promise<SummarizeResponse> {
    return new Promise((resolve, reject) => {
      this.summarizeQueue.push({ request, resolve, reject });
      this.processSummarizeQueue();
    });
  }

  private async processSummarizeQueue(): Promise<void> {
    if (this.isProcessingSummarizeQueue) {
      return;
    }
    this.isProcessingSummarizeQueue = true;

    while (this.summarizeQueue.length > 0) {
      const now = Date.now();
      const timeElapsed = now - this.lastSummarizeCallTime;

      if (
        timeElapsed < this.SUMMARIZE_RATE_LIMIT_SECONDS_CONFIG * 1000 &&
        this.summarizeCallCount >= this.SUMMARIZE_RATE_LIMIT_CALLS_CONFIG
      ) {
        const timeToWait =
          this.SUMMARIZE_RATE_LIMIT_SECONDS_CONFIG * 1000 - timeElapsed;
        await new Promise((resolve) => setTimeout(resolve, timeToWait));
        this.summarizeCallCount = 0; // Reset count after waiting
        this.lastSummarizeCallTime = Date.now();
      }

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
          console.error('Summarize request failed:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        resolve((await response.json()) as SummarizeResponse);
      } catch (error) {
        reject(error);
      }
    }
    this.isProcessingSummarizeQueue = false;
  }

  async parseAST(request: ASTParseRequest): Promise<StructuralData> {
    const formData = new FormData();
    const fileBuffer = Buffer.from(request.content);

    // Create a Blob with filename metadata
    const blob = new Blob([fileBuffer], { type: 'text/x-python' });
    formData.set('file', blob, request.filename);

    // Append language field
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
      console.error('Parse AST request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return (await response.json()) as StructuralData;
  }
}
