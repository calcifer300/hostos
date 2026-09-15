"use client";

import * as React from "react";

/**
 * An error boundary that renders nothing when its subtree throws. For the
 * shell's optional extras — quick notes, banners, the palette — which must
 * never take every page down with them: a broken corner widget is a missing
 * corner widget, not an error page. Logs once so it is still noticed.
 */
export class QuietBoundary extends React.Component<{ name: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error(`[${this.props.name}] hidden after an error:`, error);
  }

  render(): React.ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
