"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyber/10 mb-4">
            <span className="text-cyber text-[22px]">!</span>
          </div>
          <h2 className="text-[16px] font-semibold text-foreground mb-2">
            Quelque chose s&apos;est mal passe
          </h2>
          <p className="text-[13px] text-muted-foreground mb-4 max-w-md text-center">
            {this.state.error?.message || "Erreur inattendue"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-[13px] text-primary hover:underline font-mono"
          >
            reessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
