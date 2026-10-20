import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProfileImportFile, ProfileSourcePreview } from '@pitchcrew/core';
import { ImportReview } from '@/components/ProfileSources/components/ImportReview.tsx';
import { AppMotion } from '@/AppMotion/index.tsx';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@/styles.css';

const file = (name: string, status: ProfileImportFile['status']): ProfileImportFile => {
  return {
    key: name,
    name,
    path: `Experience/${name}`,
    status,
    url: `https://example.com/${name}`,
    revision: 'fixture',
    digest: 'fixture',
    before:
      status === 'new'
        ? null
        : '# Experience\n\nBuilt an accessible scheduling tool for three teams.',
    content:
      '# Experience\n\nBuilt an accessible scheduling tool for eight teams.\n\n<script>window.injection = true</script>',
  };
};

const Fixture = () => {
  const [preview, setPreview] = useState<ProfileSourcePreview | null>(initial);
  const [selected, setSelected] = useState(
    initial.files.filter((f) => f.status === 'new' || f.status === 'changed').map((f) => f.name),
  );
  const [result, setResult] = useState('');
  return (
    <AppMotion>
      <output aria-label="Imported names">{result}</output>
      <ImportReview
        preview={preview}
        setPreview={setPreview}
        closeReview={() => setPreview(null)}
        selected={selected}
        setSelected={setSelected}
        toggle={(name) =>
          setSelected((current) =>
            current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
          )
        }
        progress={mode === 'busy' ? { label: 'Importing documents…' } : null}
        busy={mode === 'busy'}
        error=""
        importSelected={() => {
          setResult(JSON.stringify(selected));
          setPreview(null);
        }}
      />
    </AppMotion>
  );
};

const files = [
  file('edited.md', 'conflict'),
  file('updated.md', 'changed'),
  file('added.md', 'new'),
  file('same.md', 'unchanged'),
  ...Array.from({ length: 22 }, (_, i) => file(`Project-${String(i).padStart(2, '0')}.md`, 'new')),
];
const mode = new URLSearchParams(location.search).get('mode');
const initial: ProfileSourcePreview = {
  token: 'fixture',
  expiresAt: '2099-01-01T00:00:00Z',
  source: {
    id: 'fixture',
    label: 'Fictional profile notes',
    input: { provider: 'github', repository: 'fictional/notes', path: 'about-me' },
    importedAt: '',
    files: [],
  },
  files: mode === 'removed' ? [] : mode === 'unchanged' ? [file('same.md', 'unchanged')] : files,
  missing: mode === 'unchanged' ? [] : ['Experience/retired.md'],
};
createRoot(document.getElementById('root')!).render(<Fixture />);
