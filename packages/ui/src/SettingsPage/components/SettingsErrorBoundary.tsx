import { Component, type ReactNode } from 'react';
import { LoadFailure } from '@/LoadRecovery/index.tsx';

/** A failed optional settings chunk must not take down workspace navigation. */
export class SettingsErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error: error ?? new Error('This settings section could not load.') };
  }
  render() {
    return this.state.error ? (
      <LoadFailure
        subject="This settings section"
        error={this.state.error}
        onRetry={() => this.setState({ error: null })}
      />
    ) : (
      this.props.children
    );
  }
}
