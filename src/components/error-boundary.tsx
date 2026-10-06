"use client";

import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  const handleRetry = () => {
    retry();
  };

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-ink-200 shadow-card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-ink-900 mb-2">
          Bir Hata Oluştu
        </h2>
        <p className="text-ink-600 mb-6">
          Sayfa yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.
        </p>
        {error && (
          <details className="mb-4 text-left">
            <summary className="text-sm text-ink-500 cursor-pointer">
              Hata detayları
            </summary>
            <pre className="mt-2 text-xs text-ink-400 bg-ink-50 p-2 rounded overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
        <button
          onClick={handleRetry}
          className="w-full bg-gold-500 text-ink-950 py-2 px-4 rounded-lg font-semibold hover:bg-gold-400 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}

// Hook for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    console.error("Error captured by hook:", error);
    setError(error);
  }, []);

  return { error, resetError, captureError };
}
