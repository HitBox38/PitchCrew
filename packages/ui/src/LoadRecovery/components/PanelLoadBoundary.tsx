import { Component, type ReactNode } from 'react';
import { retryFailedLoads } from '@/lib/retryable-lazy.ts';
import { PanelFailure } from './PanelFailure.tsx';

interface PanelLoadBoundaryProps {
  /** What failed, as a sentence subject: "Job details", "Add job". */
  subject: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Keeps a failed sheet or dialog from taking down the workspace. React requires a class for error
 * boundaries. Try again clears the recorded import failure and renders the panel again; Close
 * dismisses it through the panel's own close action, and the next open requests it again.
 */
export class PanelLoadBoundary extends Component<PanelLoadBoundaryProps, { error: unknown }> {
  state: { error: unknown } = { error: undefined };
  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('This panel could not be shown.') };
  }
  retry = () => {
    retryFailedLoads();
    this.setState({ error: undefined });
  };
  /** Closing arms a fresh import, so opening the panel again is a new attempt. */
  close = () => {
    retryFailedLoads();
    this.props.onClose();
  };
  render() {
    if (this.state.error === undefined) return this.props.children;
    return (
      <PanelFailure
        error={this.state.error}
        subject={this.props.subject}
        onRetry={this.retry}
        onClose={this.close}
      />
    );
  }
}
