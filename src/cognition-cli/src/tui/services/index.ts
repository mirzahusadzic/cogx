/**
 * TUI Services
 *
 * Background services for the TUI that manage long-running operations,
 * file watching, and other non-UI concerns.
 */

export {
  BackgroundTaskManager,
  getBackgroundTaskManager,
  resetBackgroundTaskManager,
  type BackgroundTask,
  type TaskUpdateCallback,
  type TaskCompleteCallback,
} from './BackgroundTaskManager.js';

export { terminal, TerminalService } from './TerminalService.js';
