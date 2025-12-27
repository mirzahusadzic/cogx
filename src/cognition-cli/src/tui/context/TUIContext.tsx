import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from 'react';

export interface TUIState {
  focused: boolean;
  renderError: Error | null;
  showInfoPanel: boolean;
  saveMessage: string | null;
  isDropdownVisible: boolean;
  streamingPaste: string;
  inputLineCount: number;
}

type TUIAction =
  | { type: 'SET_FOCUS'; payload: boolean }
  | { type: 'TOGGLE_FOCUS' }
  | { type: 'SET_RENDER_ERROR'; payload: Error | null }
  | { type: 'SET_SHOW_INFO_PANEL'; payload: boolean }
  | { type: 'TOGGLE_INFO_PANEL' }
  | { type: 'SET_SAVE_MESSAGE'; payload: string | null }
  | { type: 'SET_DROPDOWN_VISIBLE'; payload: boolean }
  | { type: 'SET_STREAMING_PASTE'; payload: string }
  | { type: 'SET_INPUT_LINE_COUNT'; payload: number };

const initialState: TUIState = {
  focused: true,
  renderError: null,
  showInfoPanel: false,
  saveMessage: null,
  isDropdownVisible: false,
  streamingPaste: '',
  inputLineCount: 1,
};

function tuiReducer(state: TUIState, action: TUIAction): TUIState {
  switch (action.type) {
    case 'SET_FOCUS':
      return { ...state, focused: action.payload };
    case 'TOGGLE_FOCUS':
      return { ...state, focused: !state.focused };
    case 'SET_RENDER_ERROR':
      return { ...state, renderError: action.payload };
    case 'SET_SHOW_INFO_PANEL':
      return { ...state, showInfoPanel: action.payload };
    case 'TOGGLE_INFO_PANEL':
      return { ...state, showInfoPanel: !state.showInfoPanel };
    case 'SET_SAVE_MESSAGE':
      return { ...state, saveMessage: action.payload };
    case 'SET_DROPDOWN_VISIBLE':
      return { ...state, isDropdownVisible: action.payload };
    case 'SET_STREAMING_PASTE':
      return { ...state, streamingPaste: action.payload };
    case 'SET_INPUT_LINE_COUNT':
      return { ...state, inputLineCount: action.payload };
    default:
      return state;
  }
}

interface TUIContextType {
  state: TUIState;
  setFocus: (focused: boolean) => void;
  toggleFocus: () => void;
  setRenderError: (error: Error | null) => void;
  setShowInfoPanel: (show: boolean) => void;
  toggleInfoPanel: () => void;
  setSaveMessage: (message: string | null) => void;
  setIsDropdownVisible: (visible: boolean) => void;
  setStreamingPaste: (paste: string) => void;
  setInputLineCount: (count: number) => void;
}

const TUIContext = createContext<TUIContextType | undefined>(undefined);

export function TUIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tuiReducer, initialState);

  const setFocus = useCallback(
    (focused: boolean) => dispatch({ type: 'SET_FOCUS', payload: focused }),
    []
  );
  const toggleFocus = useCallback(() => dispatch({ type: 'TOGGLE_FOCUS' }), []);
  const setRenderError = useCallback(
    (error: Error | null) =>
      dispatch({ type: 'SET_RENDER_ERROR', payload: error }),
    []
  );
  const setShowInfoPanel = useCallback(
    (show: boolean) => dispatch({ type: 'SET_SHOW_INFO_PANEL', payload: show }),
    []
  );
  const toggleInfoPanel = useCallback(
    () => dispatch({ type: 'TOGGLE_INFO_PANEL' }),
    []
  );
  const setSaveMessage = useCallback(
    (message: string | null) =>
      dispatch({ type: 'SET_SAVE_MESSAGE', payload: message }),
    []
  );
  const setIsDropdownVisible = useCallback(
    (visible: boolean) =>
      dispatch({ type: 'SET_DROPDOWN_VISIBLE', payload: visible }),
    []
  );
  const setStreamingPaste = useCallback(
    (paste: string) =>
      dispatch({ type: 'SET_STREAMING_PASTE', payload: paste }),
    []
  );
  const setInputLineCount = useCallback(
    (count: number) =>
      dispatch({ type: 'SET_INPUT_LINE_COUNT', payload: count }),
    []
  );

  return (
    <TUIContext.Provider
      value={{
        state,
        setFocus,
        toggleFocus,
        setRenderError,
        setShowInfoPanel,
        toggleInfoPanel,
        setSaveMessage,
        setIsDropdownVisible,
        setStreamingPaste,
        setInputLineCount,
      }}
    >
      {children}
    </TUIContext.Provider>
  );
}

export function useTUI() {
  const context = useContext(TUIContext);
  if (context === undefined) {
    throw new Error('useTUI must be used within a TUIProvider');
  }
  return context;
}
