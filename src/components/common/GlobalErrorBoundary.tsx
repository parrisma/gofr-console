import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { logger } from '../../services/logging';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error({
      event: 'ui_unhandled_error',
      message: 'Unhandled UI error caught by boundary',
      component: 'GlobalErrorBoundary',
      operation: 'render',
      result: 'failure',
      data: {
        error: error.message,
        stack: error.stack,
        component_stack: errorInfo.componentStack,
      },
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            <Typography variant="h6" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2">
              An unexpected UI error occurred. Please refresh and try again.
            </Typography>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}
