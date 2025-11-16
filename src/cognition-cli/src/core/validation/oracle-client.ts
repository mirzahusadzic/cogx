/**
 * Oracle Client - External validation via eGemma
 *
 * HTTP client for communicating with eGemma Oracle for transform validation.
 * The Oracle evaluates transforms using the AAA framework:
 * - Accuracy: Did we achieve the intent?
 * - Efficiency: Was it done optimally?
 * - Adaptability: Can it handle change?
 *
 * REFERENCE: docs/manual/part-5-cpow-loop/20-cpow-reference.md (Phase 2: Oracle Validation)
 */

import type {
  OracleRequest,
  OracleResponse,
  EvaluateTransformOptions,
  StateSnapshot,
  TransformSummary,
} from '../types/oracle.js';
import {
  OracleError,
  OracleTimeoutError,
  OracleInvalidResponseError,
  createStateSnapshot,
  createTransformSummary,
} from '../types/oracle.js';

/**
 * Evaluate transform with Oracle
 *
 * Sends transform to eGemma Oracle for quality evaluation.
 * Returns Oracle response with accuracy, efficiency, and adaptability scores.
 *
 * @param options - Transform evaluation options
 * @returns Oracle response with quality assessment
 *
 * @example
 * const oracleResponse = await evaluateTransform({
 *   quest: quest,
 *   beforeState: beforeState,
 *   afterState: afterState,
 *   transform: transform,
 *   oracleEndpoint: 'http://localhost:8000/validate',
 *   timeout: 30000,
 *   acceptanceThreshold: 0.6
 * });
 *
 * console.log(`Oracle score: ${oracleResponse.score.toFixed(3)}`);
 * console.log(`Accepted: ${oracleResponse.accepted}`);
 *
 * if (!oracleResponse.accepted) {
 *   console.log('Suggestions:');
 *   oracleResponse.feedback.suggestions.forEach(s => console.log(`  - ${s}`));
 * }
 */
export async function evaluateTransform(
  options: EvaluateTransformOptions
): Promise<OracleResponse> {
  const {
    quest,
    beforeState,
    afterState,
    transform,
    oracleEndpoint,
    timeout = 30000,
    acceptanceThreshold = 0.6,
    weights,
  } = options;

  // Get Oracle endpoint URL
  const endpoint =
    oracleEndpoint ||
    process.env.WORKBENCH_URL ||
    'http://localhost:8000';
  const url = `${endpoint}/validate`;

  // Create Oracle request
  const request: OracleRequest = {
    quest_id: quest.quest_id,
    quest_intent: quest.intent,
    transform_id: transform.transform_id || `transform-${Date.now()}`,
    before_state: createStateSnapshot(beforeState),
    after_state: createStateSnapshot(afterState),
    transform: createTransformSummary(transform),
    security_level: quest.security_level,
  };

  // Send request with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new OracleError(
        `Oracle returned status ${response.status}: ${response.statusText}`,
        'ORACLE_HTTP_ERROR',
        { status: response.status, statusText: response.statusText }
      );
    }

    const data = await response.json();

    // Validate response structure
    const oracleResponse = validateOracleResponse(data);

    // Determine acceptance
    oracleResponse.accepted = oracleResponse.score >= acceptanceThreshold;

    return oracleResponse;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new OracleTimeoutError(timeout);
    }

    if (err instanceof OracleError) {
      throw err;
    }

    throw new OracleError(
      `Oracle request failed: ${err.message}`,
      'ORACLE_REQUEST_FAILED',
      { originalError: err }
    );
  }
}

/**
 * Validate Oracle response structure
 *
 * Ensures response has all required fields and valid values.
 *
 * @param data - Response data from Oracle
 * @returns Validated Oracle response
 * @throws OracleInvalidResponseError if response is invalid
 */
function validateOracleResponse(data: any): OracleResponse {
  // Check required fields
  if (typeof data.score !== 'number') {
    throw new OracleInvalidResponseError(
      'Missing or invalid "score" field',
      data
    );
  }

  if (!data.feedback) {
    throw new OracleInvalidResponseError(
      'Missing "feedback" field',
      data
    );
  }

  if (
    typeof data.feedback.accuracy !== 'number' ||
    typeof data.feedback.efficiency !== 'number' ||
    typeof data.feedback.adaptability !== 'number'
  ) {
    throw new OracleInvalidResponseError(
      'Invalid feedback structure (missing AAA scores)',
      data
    );
  }

  if (!Array.isArray(data.feedback.suggestions)) {
    throw new OracleInvalidResponseError(
      'Invalid feedback.suggestions (must be array)',
      data
    );
  }

  if (!data.session_id || typeof data.session_id !== 'string') {
    throw new OracleInvalidResponseError(
      'Missing or invalid "session_id"',
      data
    );
  }

  if (!data.timestamp || typeof data.timestamp !== 'string') {
    throw new OracleInvalidResponseError(
      'Missing or invalid "timestamp"',
      data
    );
  }

  // Validate score ranges (0.0 - 1.0)
  if (data.score < 0 || data.score > 1) {
    throw new OracleInvalidResponseError(
      `Invalid score: ${data.score} (must be 0.0-1.0)`,
      data
    );
  }

  const { accuracy, efficiency, adaptability } = data.feedback;
  if (
    accuracy < 0 ||
    accuracy > 1 ||
    efficiency < 0 ||
    efficiency > 1 ||
    adaptability < 0 ||
    adaptability > 1
  ) {
    throw new OracleInvalidResponseError(
      'Invalid AAA scores (must be 0.0-1.0)',
      data
    );
  }

  return {
    score: data.score,
    feedback: {
      accuracy: data.feedback.accuracy,
      efficiency: data.feedback.efficiency,
      adaptability: data.feedback.adaptability,
      suggestions: data.feedback.suggestions,
    },
    session_id: data.session_id,
    timestamp: data.timestamp,
    signature: data.signature,
  };
}

/**
 * Mock Oracle for testing
 *
 * Returns a simulated Oracle response without making HTTP request.
 * Useful for development and testing when Oracle is unavailable.
 *
 * @param options - Transform evaluation options
 * @returns Mock Oracle response
 *
 * @example
 * const mockResponse = await mockEvaluateTransform({
 *   quest: quest,
 *   beforeState: beforeState,
 *   afterState: afterState,
 *   transform: transform
 * });
 *
 * console.log('Mock Oracle score:', mockResponse.score);
 */
export async function mockEvaluateTransform(
  options: EvaluateTransformOptions
): Promise<OracleResponse> {
  const { beforeState, afterState, acceptanceThreshold = 0.6 } = options;

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Simple heuristic: check if coherence improved
  const coherenceDelta = afterState.coherence - beforeState.coherence;

  // Base scores
  let accuracy = 0.75;
  let efficiency = 0.7;
  let adaptability = 0.75;

  // Bonus for coherence improvement
  if (coherenceDelta > 0) {
    accuracy += 0.1;
    adaptability += 0.05;
  }

  // Cap at 1.0
  accuracy = Math.min(accuracy, 1.0);
  efficiency = Math.min(efficiency, 1.0);
  adaptability = Math.min(adaptability, 1.0);

  // Weighted average (0.5 * accuracy + 0.3 * efficiency + 0.2 * adaptability)
  const score = 0.5 * accuracy + 0.3 * efficiency + 0.2 * adaptability;

  const response: OracleResponse = {
    score,
    feedback: {
      accuracy,
      efficiency,
      adaptability,
      suggestions: [
        'This is a mock Oracle response for testing',
        coherenceDelta > 0
          ? 'Good coherence improvement'
          : 'Consider improving mission alignment',
      ],
    },
    session_id: `mock-session-${Date.now()}`,
    timestamp: new Date().toISOString(),
    accepted: score >= acceptanceThreshold,
  };

  return response;
}

/**
 * Check Oracle health
 *
 * Pings Oracle endpoint to verify it's reachable.
 *
 * @param oracleEndpoint - Oracle endpoint URL
 * @param timeout - Request timeout in milliseconds (default: 5000ms)
 * @returns true if Oracle is healthy
 *
 * @example
 * const healthy = await checkOracleHealth('http://localhost:8000');
 * if (!healthy) {
 *   console.warn('Oracle is unavailable - falling back to mock');
 * }
 */
export async function checkOracleHealth(
  oracleEndpoint?: string,
  timeout: number = 5000
): Promise<boolean> {
  const endpoint =
    oracleEndpoint ||
    process.env.WORKBENCH_URL ||
    'http://localhost:8000';
  const url = `${endpoint}/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch (err) {
    return false;
  }
}
