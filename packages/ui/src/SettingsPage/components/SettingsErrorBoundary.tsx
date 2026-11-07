import { Component, type ReactNode } from 'react';
import { Button } from '@pitchcrew/design-system/button';

/** A failed optional settings chunk must not take down workspace navigation. */
export class SettingsErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="settings-callout" role="alert">
        <p>This settings section could not load. Reload Pitchcrew to try again.</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Reload Pitchcrew
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
