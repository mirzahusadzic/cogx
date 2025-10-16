import { ofetch } from 'ofetch';
import FormData from 'form-data';
import type { StructuralData } from '../types/structural.js';

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
      // Temporarily allow empty key for local dev
      console.warn(
        'WORKBENCH_API_KEY not set. This is required for production.'
      );
    }
  }

  async health() {
    return await ofetch(`${this.baseUrl}/health`);
  }

  async summarize(request: SummarizeRequest) {
    const formData = new FormData();
    formData.append('file', Buffer.from(request.content), request.filename);

    const params = new URLSearchParams();
    params.set('persona', request.persona);
    if (request.goal) params.set('goal', request.goal);
    if (request.model_name) params.set('model_name', request.model_name);
    if (request.max_tokens)
      params.set('max_tokens', request.max_tokens.toString());
    if (request.temperature)
      params.set('temperature', request.temperature.toString());

    return await ofetch(`${this.baseUrl}/summarize?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });
  }

  async parseAST(request: ASTParseRequest): Promise<StructuralData> {
    const formData = new FormData();
    formData.append('file', Buffer.from(request.content), request.filename);

    const params = new URLSearchParams();
    params.set('language', request.language);

    return await ofetch<StructuralData>(`${this.baseUrl}/parse-ast?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });
  }
}
