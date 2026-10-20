import { calendarTools } from './tools/calendar.ts';
import { driveTools } from './tools/drive.ts';
import { githubTools } from './tools/github.ts';
import { gmailTools } from './tools/gmail.ts';
import { sheetsTools } from './tools/sheets.ts';
export const getConnectorTool = (name: string) => {
  if (!Object.hasOwn(connectorTools, name)) throw new Error('This connector tool is not allowed.');
  return connectorTools[name as ConnectorToolName];
};

export type { ConnectorRequest } from './tools/helpers.ts';
export const connectorTools = {
  ...githubTools,
  ...gmailTools,
  ...driveTools,
  ...sheetsTools,
  ...calendarTools,
};
export type ConnectorToolName = keyof typeof connectorTools;
