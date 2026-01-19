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
  private isAlternateScreenEnabled: boolean = false;

  private constructor() {}

  public static getInstance(): TerminalService {
    if (!TerminalService.instance) {
      TerminalService.instance = new TerminalService();
    }
    return TerminalService.instance;
  }

  /**
   * Enter alternate screen buffer
   */
  public enterAlternateScreen(): void {
    if (
      this.isAlternateScreenEnabled ||
      !process.stdout.isTTY ||
      process.env.NODE_ENV === 'test'
    )
      return;
    try {
      process.stdout.write('\x1b[?1049h');
      this.isAlternateScreenEnabled = true;
    } catch (e) {
      systemLog('tui', `Failed to enter alternate screen: ${e}`);
    }
  }

  /**
   * Exit alternate screen buffer
   */
  public exitAlternateScreen(): void {
    if (
      !this.isAlternateScreenEnabled ||
      !process.stdout.isTTY ||
      process.env.NODE_ENV === 'test'
    )
      return;
    try {
      process.stdout.write('\x1b[?1049l');
      this.isAlternateScreenEnabled = false;
    } catch (e) {
      systemLog('tui', `Failed to exit alternate screen: ${e}`);
    }
  }

  /**
   * Set terminal background color using OSC 11
   * This affects the entire terminal window including margins in some terminals.
   */
  public setTerminalBackgroundColor(hexColor: string): void {
    if (!process.stdout.isTTY || process.env.NODE_ENV === 'test') return;
    try {
      // OSC 11 sets the default background color
      // Format: \x1b]11;#RRGGBB\x07
      process.stdout.write(`\x1b]11;${hexColor}\x07`);
    } catch (e) {
      systemLog('tui', `Failed to set terminal background color: ${e}`);
    }
  }

  /**
   * Reset terminal background color to default
   */
  public resetTerminalBackgroundColor(): void {
    if (!process.stdout.isTTY || process.env.NODE_ENV === 'test') return;
    try {
      // OSC 111 resets the default background color
      process.stdout.write('\x1b]111\x07');
    } catch (e) {
      systemLog('tui', `Failed to reset terminal background color: ${e}`);
    }
  }

  /**
   * Reset terminal colors and attributes
   */
  public resetColors(): void {
    try {
      process.stdout.write('\x1b[0m');
      this.resetTerminalBackgroundColor();
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
    this.exitAlternateScreen();
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
