#!/usr/bin/env node

import { OpenAIAgentProvider } from '../dist/llm/providers/openai-agent-provider.js';

const provider = new OpenAIAgentProvider({
  baseUrl: 'http://localhost:8000/v1',  // Must include /v1 for proper routing
  apiKey: 'dummy-key',
});

console.log('🔍 Testing tool calling...\n');

const responses = [];
for await (const response of provider.executeAgent({
  prompt: 'Use the bash tool to echo hello',
  model: 'gpt-oss-20b',
  cwd: process.cwd(),
})) {
  responses.push(response);
  console.log('📦 Response received:');
  console.log(JSON.stringify(response, null, 2));
  console.log('\n---\n');
}

console.log(`\n✅ Total responses: ${responses.length}`);

const toolUse = responses.some(r => r.messages.some(m => m.type === 'tool_use'));
console.log(`🔧 Tool use called: ${toolUse}`);
