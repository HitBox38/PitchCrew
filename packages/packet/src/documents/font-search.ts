import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, delimiter, join } from 'node:path';

/** A font file to try, with the face to use when the file is a collection. */
export interface FontLocation {
  path: string;
  face?: string;
}
/**
 * Lists fallback font files, best first. PDF rendering calls it only when the bundled fonts miss
 * a character, and reads the files itself; nothing is fetched or executed.
 */
export type FontSearch = () => Promise<FontLocation[]>;

export interface SystemFontOptions {
  /** Folders searched before the system folders, such as the data folder's `fonts` folder. */
  folders?: string[];
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  home?: string;
  /** Prefix for the fixed system folders, so tests never read the machine's own fonts. */
  root?: string;
}

const fontFile = /\.(?:ttf|otf|ttc|otc)$/i;
const folderDepth = 6;
const entryBudget = 20_000;

// CJK fonts that come with each system or its usual font packages, best first. Japanese faces
// lead, so Han characters shared with Chinese take Japanese forms. A named face picks one font
// from a collection; otherwise every face of the file is tried in order.
const known: [file: string, face?: string][] = [
  // Windows
  ['YuGothR.ttc'],
  ['YuGothB.ttc'],
  ['YuGothM.ttc'],
  ['meiryo.ttc'],
  ['meiryob.ttc'],
  ['msgothic.ttc'],
  ['msyh.ttc'],
  ['msyhbd.ttc'],
  ['msjh.ttc'],
  ['msjhbd.ttc'],
  ['malgun.ttf'],
  ['malgunbd.ttf'],
  // macOS
  ['ヒラギノ角ゴシック W3.ttc', 'HiraginoSans-W3'],
  ['ヒラギノ角ゴシック W6.ttc', 'HiraginoSans-W6'],
  ['Hiragino Sans GB.ttc'],
  ['PingFang.ttc'],
  ['AppleSDGothicNeo.ttc'],
  ['Arial Unicode.ttf'],
  // Linux
  ['NotoSansCJK-Regular.ttc', 'NotoSansCJKjp-Regular'],
  ['NotoSansCJK-Bold.ttc', 'NotoSansCJKjp-Bold'],
  ['NotoSansCJKjp-Regular.otf'],
  ['NotoSansCJKjp-Bold.otf'],
  ['NotoSansJP-Regular.otf'],
  ['NotoSansJP-Bold.otf'],
  ['NotoSansJP-Regular.ttf'],
  ['NotoSansJP-Bold.ttf'],
  ['SourceHanSans-Regular.ttc', 'SourceHanSans-Regular'],
  ['SourceHanSans-Bold.ttc', 'SourceHanSans-Bold'],
  ['SourceHanSansJP-Regular.otf'],
  ['SourceHanSansJP-Bold.otf'],
  ['ipaexg.ttf'],
  ['ipag.ttf'],
  ['TakaoPGothic.ttf'],
  ['VL-PGothic-Regular.ttf'],
  ['NotoSansCJKsc-Regular.otf'],
  ['wqy-microhei.ttc'],
  ['wqy-zenhei.ttc'],
  ['NanumGothic.ttf'],
  ['NanumGothicBold.ttf'],
  ['DroidSansFallbackFull.ttf'],
];

// macOS may store Japanese file names decomposed, and Windows ignores case.
const fileKey = (name: string) => name.normalize('NFC').toLowerCase();

function systemFolders({
  env,
  platform,
  home,
  root,
}: Required<Omit<SystemFontOptions, 'folders'>>) {
  const fixed = (path: string) => join(root, path);
  if (platform === 'win32')
    return [
      join(env.WINDIR ?? env.SystemRoot ?? 'C:\\Windows', 'Fonts'),
      ...(env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')] : []),
    ];
  if (platform === 'darwin')
    return [
      fixed('/System/Library/Fonts'),
      fixed('/System/Library/Fonts/Supplemental'),
      fixed('/Library/Fonts'),
      join(home, 'Library', 'Fonts'),
    ];
  // The folders fontconfig reads by default.
  return [
    join(env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'fonts'),
    join(home, '.fonts'),
    fixed('/usr/local/share/fonts'),
    fixed('/usr/share/fonts'),
  ];
}

// Font files under a folder in sorted order, so the same folders always give the same list.
async function fontFiles(folder: string, depth = folderDepth, budget = { left: entryBudget }) {
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    return files;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (--budget.left < 0) break;
    const path = join(folder, entry.name);
    if (entry.isDirectory() && depth > 0) files.push(...(await fontFiles(path, depth - 1, budget)));
    else if (fontFile.test(entry.name) && (entry.isFile() || entry.isSymbolicLink()))
      files.push(path);
  }
  return files;
}

async function pointedFonts(entry: string): Promise<string[]> {
  try {
    const info = await stat(entry);
    if (info.isDirectory()) return fontFiles(entry);
    return info.isFile() && fontFile.test(entry) ? [entry] : [];
  } catch {
    return [];
  }
}

/**
 * Fonts named by `PITCHCREW_FONTS` (files or folders, separated like PATH), then fonts in the
 * given folders, then well-known CJK fonts in the platform font folders.
 */
export function systemFonts(options: SystemFontOptions = {}): FontSearch {
  return async () => {
    const env = options.env ?? process.env;
    const platform = options.platform ?? process.platform;
    const locations: FontLocation[] = [];
    for (const entry of (env.PITCHCREW_FONTS ?? '').split(delimiter))
      if (entry.trim())
        for (const path of await pointedFonts(entry.trim())) locations.push({ path });
    for (const folder of options.folders ?? [])
      for (const path of await fontFiles(folder)) locations.push({ path });
    const installed = new Map<string, string>();
    const home = options.home ?? homedir();
    const root = options.root ?? '/';
    for (const folder of systemFolders({ env, platform, home, root }))
      for (const path of await fontFiles(folder)) {
        const key = fileKey(basename(path));
        if (!installed.has(key)) installed.set(key, path);
      }
    for (const [file, face] of known) {
      const path = installed.get(fileKey(file));
      if (path) locations.push({ path, face });
    }
    const seen = new Set<string>();
    return locations.filter((location) => {
      const key = `${location.path}\0${location.face ?? ''}`;
      return !seen.has(key) && !!seen.add(key);
    });
  };
}
