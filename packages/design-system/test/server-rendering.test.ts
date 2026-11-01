import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import { Sidebar, SidebarContent, SidebarProvider } from '@pitchcrew/design-system/sidebar';

// Import the package's public contracts without the desktop app's Vite aliases or providers.
describe('shared components on the server', () => {
  it('renders interactive controls for a server-rendered consumer', () => {
    const html = renderToString(
      createElement(
        'form',
        null,
        createElement(Input, { 'aria-label': 'Email', defaultValue: 'person@example.test' }),
        createElement(Button, { variant: 'secondary' }, 'Continue'),
      ),
    );
    expect(html).toContain('aria-label="Email"');
    expect(html).toContain('value="person@example.test"');
    expect(html).toContain('type="button"');
    expect(html).toContain('Continue');
  });

  it('uses a stable desktop sidebar snapshot without browser globals', () => {
    const html = renderToString(
      createElement(
        SidebarProvider,
        null,
        createElement(Sidebar, null, createElement(SidebarContent, null, 'Navigation')),
      ),
    );
    expect(html).toContain('data-state="expanded"');
    expect(html).toContain('Navigation');
  });
});
