import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="prata-regular text-3xl text-gray-800">Something went wrong</p>
        <p className="max-w-md text-sm text-gray-500">An unexpected error occurred. Please refresh the page to continue shopping.</p>
        <button onClick={() => window.location.assign('/')} className="btn-primary">
          Back to home
        </button>
      </div>
    );
  }
}
