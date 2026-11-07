import { Button } from '@pitchcrew/design-system/button';
export const SetupFooter = ({
  section,
  ready,
  signedIn,
  working,
  loaded,
  secondary,
  recovery = false,
  select,
  close,
}: {
  section: string;
  ready: boolean;
  signedIn: boolean;
  working: boolean;
  loaded: boolean;
  secondary: boolean;
  recovery?: boolean;
  select: (section: string) => void;
  close: () => void;
}) => (
  <footer className="runtime-setup-footer">
    <output className="quiet">
      {working
        ? 'Saving runtime settings. Please wait…'
        : recovery
          ? 'Authentication settings need recovery'
          : `Step ${section === 'installation' ? 1 : section === 'signin' ? 2 : 3} of 3`}
    </output>
    {recovery ? (
      <Button variant="outline" disabled={working} onClick={close}>
        Close
      </Button>
    ) : section === 'models' ? (
      <Button variant={secondary ? 'outline' : 'default'} disabled={working} onClick={close}>
        Done
      </Button>
    ) : (
      <Button
        variant={section === 'signin' && !signedIn ? 'ghost' : 'default'}
        disabled={working || !loaded || (section === 'installation' && !ready)}
        onClick={() => select(section === 'installation' ? 'signin' : 'models')}
      >
        {section === 'installation'
          ? 'Continue to sign-in'
          : signedIn
            ? 'View models'
            : 'Skip to models'}
      </Button>
    )}
  </footer>
);
