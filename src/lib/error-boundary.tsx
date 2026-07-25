"use client";
/**
 * error-boundary.tsx — React error boundary for SentinelRoute.
 *
 * Catches unhandled render errors in the component tree and renders a
 * clean fallback UI instead of a blank screen.
 *
 * Usage (wrap page sections or the entire app shell):
 *   <ErrorBoundary>
 *     <SomeComplexWidget />
 *   </ErrorBoundary>
 *
 *   // With custom fallback:
 *   <ErrorBoundary fallback={<p>Widget failed to load.</p>}>
 *     <SomeComplexWidget />
 *   </ErrorBoundary>
 *
 * Next.js already provides a file-based error.tsx boundary per segment,
 * but this component lets you wrap individual sub-trees more granularly.
 */

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Props / State ────────────────────────────────────────────────────────────

interface Props {
  children:  ReactNode;
  /** Optional custom fallback UI. */
  fallback?: ReactNode;
  /** Optional CSS class to apply to the default fallback container. */
  className?: string;
}

interface State {
  hasError:  boolean;
  errorMsg:  string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(err: unknown): State {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred";
    return { hasError: true, errorMsg: msg };
  }

  override componentDidCatch(err: Error, info: ErrorInfo): void {
    // Log to console in dev; in production a real error tracker (e.g. Sentry)
    // would be integrated here.
    console.error("[ErrorBoundary] Caught render error:", err, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMsg: "" });
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30",
          "bg-destructive/5 px-6 py-10 text-center",
          this.props.className
        )}
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle className="w-8 h-8 text-destructive/70" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-destructive">Something went wrong</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            {this.state.errorMsg}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Retry loading this section"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }
}

// ─── Convenience wrapper ─────────────────────────────────────────────────────

/**
 * withErrorBoundary — HOC version.
 *
 * const SafeWidget = withErrorBoundary(MyWidget);
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `WithErrorBoundary(${Component.displayName ?? Component.name})`;
  return Wrapped;
}
