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
  fit: 'width' | 'page' | 'actual';
  rotation: number;
  mode: 'rendered' | 'source';
  wrap: boolean;
  page: number;
  thumbnails: boolean;
  expanded: boolean;
}
export const defaultViewerSettings: ViewerSettings = {
  zoom: 100,
  fit: 'width',
  rotation: 0,
  mode: 'rendered',
  wrap: true,
  page: 1,
  thumbnails: false,
  expanded: false,
};
