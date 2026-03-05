/**
 * Tool Execution Configuration
 *
 * Centralized constants for tool executors to ensure consistency
 * across different providers and tools.
 */

export const TOOL_CONFIG = {
  READ_FILE: {
    /** Safety cap for reading whole files without limit/offset (500KB) */
    SAFETY_CAP_SIZE: 500 * 1024,
    /** Absolute maximum file size supported (10MB) to prevent OOM */
    ABSOLUTE_MAX_SIZE: 10 * 1024 * 1024,
    /** Maximum line length for TUI display safety */
    MAX_LINE_LENGTH: 2000,
    /** Output size threshold for smart compression (500KB) */
    COMPRESS_THRESHOLD: 500 * 1024,
    /** Absolute hard cap for read_file output characters (500k) */
    HARD_CAP_CHARS: 500000,
  },
  GLOB: {
    /** Maximum number of files to return in a single glob operation */
    MAX_FILES: 100,
  },
  GREP: {
    /** Timeout for ripgrep process in milliseconds (30s) */
    TIMEOUT_MS: 30000,
    /** Maximum raw output size before killing the process (500KB) */
    MAX_OUTPUT_SIZE: 500 * 1024,
    /** Maximum line length for TUI display safety */
    MAX_LINE_LENGTH: 2000,
    /** Output size threshold for smart compression (50KB) */
    COMPRESS_THRESHOLD: 50 * 1024,
  },
  BASH: {
    /** Default timeout for bash commands in milliseconds (120s) */
    DEFAULT_TIMEOUT_MS: 120000,
    /** Maximum buffer size for stdout/stderr (500KB) */
    MAX_BUFFER_SIZE: 500 * 1024,
    /** Maximum characters to preserve for git diff output (100KB) */
    GIT_DIFF_MAX_CHARS: 100000,
    /** Maximum characters to preserve for standard command output */
    STANDARD_MAX_CHARS: 30000,
  },
  FETCH_URL: {
    /** Timeout for fetch requests in milliseconds (10s) */
    TIMEOUT_MS: 10000,
    /** Maximum content length for fetched text (100k chars) */
    MAX_CONTENT_LENGTH: 100000,
  },
  WEB_SEARCH: {
    /** Timeout for web search requests in milliseconds (15s) */
    TIMEOUT_MS: 15000,
    /** Default maximum number of results to return */
    DEFAULT_MAX_RESULTS: 10,
  },
  SIGMA_TASK_UPDATE: {
    /** Minimum length for result_summary when completing a task */
    MIN_RESULT_SUMMARY_LENGTH: 15,
  },
  GLOBAL: {
    /** Default maximum characters for any tool output before truncation */
    MAX_TOOL_OUTPUT_CHARS: 50000,
    /** Maximum characters for read_file tool output (~5k tokens) */
    MAX_READ_FILE_CHARS: 20000,
    /** Maximum characters for bash tool output (~7.5k tokens) */
    MAX_BASH_CHARS: 30000,
    /** Threshold for eGemma summarization in characters */
    EGEMMA_SUMMARIZE_THRESHOLD: 50000,
    /** Absolute maximum size before truncation without summarization */
    PRE_TRUNCATE_THRESHOLD: 100000,
  },
} as const;
