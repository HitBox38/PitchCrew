import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'Pitchcrew — Your job search, with a crew behind you';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const font = readFile(
  join(
    process.cwd(),
    'node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff',
  ),
);
const logo = readFile(join(process.cwd(), 'public/favicon.svg'));

export default async function OpenGraphImage() {
  const [fontData, logoData] = await Promise.all([font, logo]);
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        background: '#f2f1ec',
        padding: '58px 70px',
        color: '#2b2d31',
        fontFamily: 'Source Sans',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34 }}>
        <img
          alt=""
          src={`data:image/svg+xml;base64,${logoData.toString('base64')}`}
          width={64}
          height={64}
        />
        Pitchcrew
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 78,
          lineHeight: 1.1,
          letterSpacing: '-3px',
        }}
      >
        <span>Your job search,</span>
        <span>with a crew behind you.</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 25,
          color: '#3a5482',
        }}
      >
        <span>Scout. Writer. Reviewer. You.</span>
        <span>Free to download.</span>
      </div>
    </div>,
    { ...size, fonts: [{ name: 'Source Sans', data: fontData, weight: 600, style: 'normal' }] },
  );
}
