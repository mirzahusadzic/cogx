/**
 * Fetch URL Tool for Gemini Agent Provider
 *
 * Simple HTTP fetch tool for retrieving web content.
 * Follows the same pattern as other ADK tools in gemini-adk-tools.ts
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';

/**
 * Fetch URL tool - retrieves content from a URL
 */
export const fetchUrlTool = new FunctionTool({
  name: 'fetch_url',
  description:
    'Fetch content from a URL to read documentation, APIs, or external resources. Returns text content with basic HTML stripping.',
  parameters: z.object({
    url: z.string().url().describe('The URL to fetch content from'),
  }),
  execute: async ({ url }) => {
    try {
      // Basic URL validation
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'Error: URL must start with http:// or https://';
      }

      // Use native fetch (Node 18+)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Cognition-CLI/1.0',
          Accept: 'text/html,application/json,text/plain,*/*',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }

      const contentType = response.headers.get('content-type') || '';
      let text = await response.text();

      // Handle JSON
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(text);
          text = JSON.stringify(json, null, 2);
        } catch {
          // Keep raw text if parse fails
        }
      }
      // Basic HTML stripping
      else if (contentType.includes('text/html')) {
        // Remove script/style tags
        text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, '');
        text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, '');
        // Remove HTML tags
        text = text.replace(/<[^>]+>/g, ' ');
        // Collapse whitespace
        text = text.replace(/\s+/g, ' ').trim();
      }

      // Truncate if too large (200K chars = ~50K tokens, 2.5% of Gemini's 2M token context)
      const MAX_LENGTH = 200000;
      if (text.length > MAX_LENGTH) {
        text =
          text.substring(0, MAX_LENGTH) +
          `\n\n[Truncated - total length: ${text.length} chars]`;
      }

      return text;
    } catch (error) {
      return `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});
