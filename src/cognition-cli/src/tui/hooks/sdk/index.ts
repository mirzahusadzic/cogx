/**
 * SDK Layer - Main exports
 *
 * Provides clean interface for SDK query management and message processing.
 *
 * Extracted from useClaudeAgent.ts as part of Week 2 Day 6-8 refactor.
 * Updated to include AgentProviderAdapter for multi-provider support.
 */

export * from './types.js';
export * from './SDKQueryManager.js';
export * from './SDKMessageProcessor.js';
export * from './AgentProviderAdapter.js';
