import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors in the page tree so a single bad component
 * doesn't white-screen the whole app. In App.tsx it's keyed by route, so
 * navigating away clears the error automatically.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a console trace for debugging; swap for a logger/Sentry later.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="text-center py-20 fade-in">
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Algo deu errado ao carregar esta página
        </h2>
        <p className="text-[13px] mb-5" style={{ color: 'var(--text-m)' }}>
          Tente novamente. Se o problema persistir, recarregue a página.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={this.handleRetry}
            className="text-[13px] font-medium rounded-[var(--rx)] px-4 py-2"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Tentar de novo
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-[13px] font-medium rounded-[var(--rx)] px-4 py-2"
            style={{ border: '1px solid var(--border)', color: 'var(--text-s)' }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
