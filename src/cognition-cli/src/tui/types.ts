/**
 * TUI (Text User Interface) Type Definitions
 *
 * Defines the state and data structures for the interactive terminal UI.
 * The TUI provides a split-pane interface for browsing overlays and
 * querying them via Claude conversation.
 *
 * DESIGN:
 * - Left pane: Overlay browser (list of O1-O7 with metadata)
 * - Right pane: Claude conversation interface (natural language queries)
 * - Keyboard navigation: Tab to switch panes, arrow keys to select
 *
 * STATE MANAGEMENT:
 * - Immutable state updates (functional style)
 * - Focus tracking: Which pane is active
 * - Selection tracking: Which overlay is highlighted
 * - Session persistence: Claude conversation context
 *
 * @example
 * // Initial TUI state
 * const state: TUIState = {
 *   focusedPanel: 'overlays',
 *   selectedOverlay: 0,
 *   overlays: [
 *     { id: 'O1', name: 'Structural', hasData: true, itemCount: 142 },
 *     { id: 'O2', name: 'Security', hasData: true, itemCount: 37 }
 *   ],
 *   claudeSessionId: undefined
 * };
 */

/**
 * Metadata about an overlay for display in the TUI.
 *
 * Summarizes overlay state without loading full contents.
 *
 * @example
 * const overlay: OverlayInfo = {
 *   id: 'O2',
 *   name: 'Security',
 *   description: 'Threat models, vulnerabilities, mitigations',
 *   hasData: true,
 *   itemCount: 37
 * };
 */
export interface OverlayInfo {
  /** Overlay identifier (O1, O2, ..., O7) */
  id: string;

  /** Human-readable name */
  name: string;

  /** Brief description of overlay purpose */
  description: string;

  /** Whether overlay has been populated */
  hasData: boolean;

  /** Number of items in overlay */
  itemCount: number;
}

/**
 * Which panel currently has keyboard focus.
 *
 * - 'overlays': Left pane (overlay browser)
 * - 'claude': Right pane (conversation interface)
 */
export type PanelFocus = 'overlays' | 'claude';

/**
 * Complete TUI state.
 *
 * Captures all information needed to render the interface:
 * - Which panel has focus
 * - Which overlay is selected
 * - Available overlays and their metadata
 * - Active Claude conversation session
 *
 * @example
 * const state: TUIState = {
 *   focusedPanel: 'claude',
 *   selectedOverlay: 1, // Security overlay (O2)
 *   overlays: [...],
 *   claudeSessionId: 'session-abc123'
 * };
 */
export interface TUIState {
  /** Which panel currently has keyboard focus */
  focusedPanel: PanelFocus;

  /** Index of currently selected overlay (0-based) */
  selectedOverlay: number;

  /** Metadata for all available overlays */
  overlays: OverlayInfo[];

  /** Optional: Active Claude conversation session ID */
  claudeSessionId?: string;
}
