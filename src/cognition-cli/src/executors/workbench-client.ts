import { fetch, FormData } from 'undici';
import type { BodyInit } from 'undici';
import { Blob } from 'node:buffer';
import type { StructuralData, SummarizeResponse } from '../types/structural.js';

interface SummarizeRequest {
  content: string;
  filename: string;
  persona: string;
  goal?: string;
  model_name?: string;
  max_tokens?: number;
  temperature?: number;
}

interface ASTParseRequest {
  content: string;
  language: string;
  filename: string;
}

export class WorkbenchClient {
  private apiKey: string;

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
    const formData = new FormData();
    const fileBuffer = Buffer.from(request.content);

    // Create a Blob with filename metadata
    const blob = new Blob([fileBuffer], { type: 'text/plain' });
    formData.set('file', blob, request.filename);

    // Append other fields
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Summarize request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return (await response.json()) as SummarizeResponse;
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
