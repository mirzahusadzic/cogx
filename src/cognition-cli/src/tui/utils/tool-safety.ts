/**
 * Tool Safety Checker
 *
 * Classifies tool operations by risk level and detects dangerous patterns.
 * Used for implementing guardrails to prevent accidental destructive operations
 * and to slow down tool execution for rate-limit protection.
 */

export enum ToolRiskLevel {
  SAFE = 'safe', // Read-only operations
  MODERATE = 'moderate', // File writes, edits
  DANGEROUS = 'dangerous', // Git operations, file deletion
  CRITICAL = 'critical', // Destructive operations
}

export interface ToolSafetyCheck {
  riskLevel: ToolRiskLevel;
  reason: string;
  requiresConfirmation: boolean;
}

/**
 * Dangerous patterns for bash commands
 */
const BASH_PATTERNS = {
  critical: [
    /rm\s+-rf/i, // Force recursive delete
    /dd\s+if=/i, // Disk operations
    /mkfs/i, // Format filesystem
    /:\(\)\{.*\};\s*:/i, // Fork bomb
    />\s*\/dev\/sd/i, // Write to disk device
  ],
  dangerous: [
    /git\s+push\s+--force/i, // Force push
    /git\s+push\s+-f/i, // Force push (short form)
    /npm\s+publish/i, // Publish to npm
    /docker\s+rm/i, // Remove container
    /docker\s+rmi/i, // Remove image
    /kubectl\s+delete/i, // Delete k8s resources
    /curl.*-X\s+(DELETE|POST|PUT)/i, // HTTP mutations
    /DROP\s+(TABLE|DATABASE)/i, // SQL drops
    /DELETE\s+FROM/i, // SQL deletes
    /TRUNCATE/i, // SQL truncate
  ],
  moderate: [
    /git\s+commit/i, // Git commit
    /git\s+push/i, // Git push (non-force)
    /rm\s+/i, // File deletion
    /mv\s+.*\s+\/dev\/null/i, // Move to /dev/null
    />\s*[^&]/i, // Output redirection (file writes)
  ],
};

/**
 * Sensitive file patterns
 */
const SENSITIVE_FILES = [
  /\.env$/i,
  /credentials/i,
  /secrets/i,
  /\.key$/i,
  /\.pem$/i,
  /password/i,
  /config\.(json|yaml|yml)$/i,
  /package\.json$/i,
  /package-lock\.json$/i,
];

/**
 * Check if a bash command is dangerous
 */
function checkBashCommand(command: string): ToolSafetyCheck {
  // Check critical patterns
  for (const pattern of BASH_PATTERNS.critical) {
    if (pattern.test(command)) {
      return {
        riskLevel: ToolRiskLevel.CRITICAL,
        reason: `Contains critical operation: ${pattern.source}`,
        requiresConfirmation: true,
      };
    }
  }

  // Check dangerous patterns
  for (const pattern of BASH_PATTERNS.dangerous) {
    if (pattern.test(command)) {
      return {
        riskLevel: ToolRiskLevel.DANGEROUS,
        reason: `Contains dangerous operation: ${pattern.source}`,
        requiresConfirmation: true,
      };
    }
  }

  // Check moderate patterns
  for (const pattern of BASH_PATTERNS.moderate) {
    if (pattern.test(command)) {
      return {
        riskLevel: ToolRiskLevel.MODERATE,
        reason: `Contains potentially destructive operation: ${pattern.source}`,
        requiresConfirmation: true,
      };
    }
  }

  return {
    riskLevel: ToolRiskLevel.SAFE,
    reason: 'No dangerous patterns detected',
    requiresConfirmation: false,
  };
}

/**
 * Check if a file path is sensitive
 */
function checkFilePath(path: string): ToolSafetyCheck {
  for (const pattern of SENSITIVE_FILES) {
    if (pattern.test(path)) {
      return {
        riskLevel: ToolRiskLevel.DANGEROUS,
        reason: `Sensitive file: ${path}`,
        requiresConfirmation: true,
      };
    }
  }

  return {
    riskLevel: ToolRiskLevel.SAFE,
    reason: 'File path is safe',
    requiresConfirmation: false,
  };
}

/**
 * Main tool safety checker
 *
 * @param toolName - Name of the tool being called
 * @param input - Tool input (command, file path, etc.)
 * @returns Safety check result
 */
export function checkToolSafety(
  toolName: string,
  input: unknown
): ToolSafetyCheck {
  // Bash/shell commands
  if (toolName === 'bash' || toolName === 'shell') {
    const command =
      typeof input === 'object' && input !== null && 'command' in input
        ? (input as { command: string }).command
        : String(input);
    return checkBashCommand(command);
  }

  // File operations
  if (toolName === 'write_file' || toolName === 'edit_file') {
    const filePath =
      typeof input === 'object' && input !== null && 'file_path' in input
        ? (input as { file_path: string }).file_path
        : String(input);
    return checkFilePath(filePath);
  }

  // Read-only operations are always safe
  if (
    toolName === 'read_file' ||
    toolName === 'grep' ||
    toolName === 'glob' ||
    toolName === 'recall_past_conversation'
  ) {
    return {
      riskLevel: ToolRiskLevel.SAFE,
      reason: 'Read-only operation',
      requiresConfirmation: false,
    };
  }

  // Unknown tools are moderate risk by default
  return {
    riskLevel: ToolRiskLevel.MODERATE,
    reason: 'Unknown tool type',
    requiresConfirmation: true, // Require confirmation for unknown tools
  };
}

/**
 * Format tool input for display
 */
export function formatToolInput(toolName: string, input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }

  if (typeof input === 'object' && input !== null) {
    // Bash command
    if ('command' in input) {
      const cmd = (input as { command: string }).command;
      // Ensure command is a string and not corrupted
      return typeof cmd === 'string' ? cmd : JSON.stringify(input, null, 2);
    }

    // File path
    if ('file_path' in input) {
      const filePath = (input as { file_path: string }).file_path;
      return typeof filePath === 'string'
        ? filePath
        : JSON.stringify(input, null, 2);
    }

    // Generic object - format nicely
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      // Fallback if JSON.stringify fails (e.g., circular references)
      return String(input);
    }
  }

  return String(input);
}
