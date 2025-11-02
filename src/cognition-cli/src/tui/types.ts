/**
 * TUI Types
 */

export interface OverlayInfo {
  id: string;
  name: string;
  description: string;
  hasData: boolean;
  itemCount: number;
}

export type PanelFocus = 'overlays' | 'claude';

export interface TUIState {
  focusedPanel: PanelFocus;
  selectedOverlay: number;
  overlays: OverlayInfo[];
  claudeSessionId?: string;
}
