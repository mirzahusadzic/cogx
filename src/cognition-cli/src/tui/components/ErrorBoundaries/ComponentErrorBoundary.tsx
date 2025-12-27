import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Text } from 'ink';

interface Props {
  children: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ComponentErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `Error in ${this.props.componentName || 'component'}:`,
      error,
      errorInfo
    );
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box
          flexDirection="column"
          borderColor="red"
          borderStyle="single"
          padding={1}
        >
          <Text color="red">
            💥 {this.props.componentName || 'Component'} Error:
          </Text>
          <Text>{this.state.error?.message}</Text>
          <Text dimColor>Please restart the TUI or check logs.</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
