/**
 * Terminal Service
 *
 * Manages low-level terminal interactions, including ANSI escape sequences,
 * mouse tracking, and clean process exit handling.
 */

import { systemLog } from '../../utils/debug-logger.js';

export class TerminalService {
  private static instance: TerminalService;
  private isMouseTrackingEnabled: boolean = false;
  private isBracketedPasteEnabled: boolean = false;
  private isCursorHidden: boolean = false;

  private constructor() {}

  public static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService();
    }
    return TerminalService.instance;
  }

  /**
   * Reset terminal colors and attributes
   */
  public resetColors(): void {
    try {
      process.stdout.write('\x1b[0m');
    } catch {
      // Ignore errors during cleanup
    }
  }

  /**
   * Enable/disable bracketed paste mode
   * 2004 = Bracketed paste mode (pastes wrapped with \x1b[200~ and \x1b[201~)
   */
  public setBracketedPaste(enabled: boolean): void {
    if (this.isBracketedPasteEnabled === enabled) return;

    try {
      if (enabled) {
        process.stdout.write('\x1b[?2004h');
      } else {
        process.stdout.write('\x1b[?2004l');
      }
      this.isBracketedPasteEnabled = enabled;
    } catch (e) {
      systemLog('tui', `Failed to set bracketed paste: ${e}`);
    }
  }

  /**
   * Enable/disable mouse tracking
   * 1000 = Basic mouse tracking (clicks + scroll)
   * 1006 = SGR encoding (position-aware)
   */
  public setMouseTracking(enabled: boolean): void {
    if (this.isMouseTrackingEnabled === enabled) return;

    try {
      if (enabled) {
        process.stdout.write('\x1b[?1000h');
        process.stdout.write('\x1b[?1006h');
      } else {
        process.stdout.write('\x1b[?1000l');
        process.stdout.write('\x1b[?1006l');
      }
      this.isMouseTrackingEnabled = enabled;
    } catch (e) {
      systemLog('tui', `Failed to set mouse tracking: ${e}`);
    }
  }

  /**
   * Show/hide the terminal cursor
   */
  public setCursorVisibility(visible: boolean): void {
    const hidden = !visible;
    if (this.isCursorHidden === hidden) return;

    try {
      if (hidden) {
        process.stdout.write('\x1b[?25l');
      } else {
        process.stdout.write('\x1b[?25h');
      }
      this.isCursorHidden = hidden;
    } catch (e) {
      systemLog('tui', `Failed to set cursor visibility: ${e}`);
    }
  }

  /**
   * Perform full terminal cleanup
   */
  public cleanup(): void {
    this.resetColors();
    this.setBracketedPaste(false);
    this.setMouseTracking(false);
    this.setCursorVisibility(true);
  }

  /**
   * Exit the process immediately and forcefully
   */
  public forceKill(): void {
    this.cleanup();
    try {
      // Kill the entire process group to ensure workers die too
      process.kill(-process.pid, 'SIGKILL');
    } catch {
      process.abort(); // Fallback
    }
  }
}

export const terminal = TerminalService.getInstance();
