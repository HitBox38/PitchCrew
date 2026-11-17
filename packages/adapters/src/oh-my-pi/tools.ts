import { isReviewedMcpTool } from '@pitchcrew/core';
import { piAgentTools } from '../pi/tools.ts';

/**
 * oh-my-pi shares Pi's events but names MCP tools `mcp__<server>_<tool>`, dropping a tool's
 * repeated server prefix: `pitchcrew_get_card` becomes `mcp__pitchcrew_get_card`, while a
 * connector tool such as `gmail_search_messages` keeps its name. Pi's `mcp__pitchcrew__` form is
 * read too.
 */
export const ohMyPiTools = piAgentTools((name) => {
  const tool = /^mcp__pitchcrew__?(.+)$/.exec(name)?.[1];
  if (!tool) return undefined;
  return isReviewedMcpTool(tool) ? tool : `pitchcrew_${tool}`;
});
