export interface ViewerFile {
  id: string;
  name: string;
  kind: 'pdf' | 'docx' | 'markdown' | 'text' | 'image';
  mimeType: string;
  bytes?: string;
  text?: string;
  downloadAllowed: boolean;
  pages?: number;
  findings?: import('@pitchcrew/core').DocumentFinding[];
}
export interface ViewerSettings {
  zoom: number;
  /** Automatic fits the width without enlarging a portrait page past 125%; landscape fits the page. */
  fit: 'auto' | 'width' | 'page' | 'actual';
  rotation: number;
  mode: 'rendered' | 'source';
  wrap: boolean;
  page: number;
  /** Counts page jumps: the page alone cannot tell a repeated jump from a manual scroll back. */
  pageRequest: number;
  thumbnails: boolean;
}
export const defaultViewerSettings: ViewerSettings = {
  zoom: 100,
  fit: 'auto',
  rotation: 0,
  mode: 'rendered',
  wrap: true,
  page: 1,
  pageRequest: 0,
  thumbnails: false,
};
