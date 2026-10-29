export type BrowserViewportSetting =
  | { mode: 'fill' }
  | { mode: 'fixed'; width: number; height: number; name: string };
export const fillBrowserViewport: BrowserViewportSetting = { mode: 'fill' };
export const browserDevices = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone XR', width: 414, height: 896 },
  { name: 'iPhone 12 Pro', width: 390, height: 844 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'iPhone 15 Pro', width: 393, height: 852 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'Pixel 8', width: 412, height: 915 },
  { name: 'Galaxy S8+', width: 360, height: 740 },
  { name: 'Galaxy S20 Ultra', width: 412, height: 915 },
  { name: 'Galaxy S24', width: 360, height: 780 },
  { name: 'Galaxy A51/71', width: 412, height: 914 },
  { name: 'Galaxy Z Fold 5', width: 344, height: 882 },
  { name: 'Surface Duo', width: 540, height: 720 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'iPad Air', width: 820, height: 1180 },
  { name: 'iPad Pro', width: 1024, height: 1366 },
  { name: 'iPad Pro 11', width: 834, height: 1194 },
  { name: 'Surface Pro 7', width: 912, height: 1368 },
  { name: 'Asus Zenbook Fold', width: 853, height: 1280 },
  { name: 'Nest Hub', width: 1024, height: 600 },
  { name: 'Nest Hub Max', width: 1280, height: 800 },
  { name: 'Laptop 1280', width: 1280, height: 800 },
  { name: 'Laptop 1366', width: 1366, height: 768 },
  { name: 'Desktop 1440', width: 1440, height: 900 },
  { name: 'Desktop 1920', width: 1920, height: 1080 },
] as const;
export const boundedBrowserDimension = (value: number, axis: 'width' | 'height') =>
  Math.round(
    Math.max(
      axis === 'width' ? 240 : 160,
      Math.min(axis === 'width' ? 2560 : 2160, Number.isFinite(value) ? value : 800),
    ),
  );
