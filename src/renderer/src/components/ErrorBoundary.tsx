import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Catches rendering errors anywhere in the child tree and shows a
 * recovery UI instead of a blank screen. This is intentionally a class
 * component — React has no hook-based error boundary API.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] render crash:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 16,
            color: '#f5f5f7',
            fontFamily: 'system-ui, sans-serif',
            background: '#1a1a1a',
            padding: 40,
            textAlign: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20 }}>Something went wrong</h2>
          <pre
            style={{
              margin: 0,
              padding: 16,
              background: '#0a0a0a',
              borderRadius: 8,
              fontSize: 13,
              maxWidth: 600,
              overflow: 'auto',
              color: '#ff6b6b',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 20px',
              background: '#333',
              color: '#f5f5f7',
              border: '1px solid #555',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
