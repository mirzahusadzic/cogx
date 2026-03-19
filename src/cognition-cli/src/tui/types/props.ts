import type { SigmaStats } from '../../core/state/tui-sync/types.js';
import type { SessionTokenCount } from '../hooks/tokens/useSessionTokenCount.js';

/**
 * Base properties for all TUI components
 */
export interface IBaseComponentProps {
  /** Whether the component is currently focused */
  focused: boolean;

  /** Optional layout version to trigger re-renders on layout changes */
  layoutVersion?: string;
}

/**
 * Base properties for panel components
 */
export interface IBasePanelProps extends IBaseComponentProps {
  /** Global Sigma statistics */
  sigmaStats?: SigmaStats;

  /** Session-wide token usage tracking */
  sessionTokenCount?: SessionTokenCount;

  /** Preferred width of the panel */
  width?: number;
}

/**
 * Base properties for modal components
 * @template T The type of state managed by the modal
 */
export interface IBaseModalProps<T> extends IBaseComponentProps {
  /** Current state of the modal's data/flow */
  state: T;

  /** Callback to close the modal */
  onClose?: () => void;
}

/**
 * Common event handler for submission
 */
export type SubmitHandler<T = string> = (value: T) => void;

/**
 * Common event handler for selection
 */
export type SelectHandler<T> = (item: T) => void;

/**
 * Common event handler for generic actions
 */
export type ActionHandler<T = void> = (payload: T) => void;
