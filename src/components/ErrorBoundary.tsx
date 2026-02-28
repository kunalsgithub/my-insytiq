import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
          <p className="font-semibold text-amber-800 mb-2">Something went wrong</p>
          <p className="text-sm text-amber-700 mb-4">Please refresh the page or try again.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
