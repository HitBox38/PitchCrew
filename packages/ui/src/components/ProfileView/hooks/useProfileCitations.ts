import { citationRows, noteCitations } from '../helpers.ts';
import type { ProfileViewModel, ProfileWorkspaceModel } from '../types.ts';

/** Packets whose registered claims quote the open note, and whether they sit beside it. */
export const useProfileCitations = (
  controller: Pick<ProfileViewModel, 'data' | 'activeSavedName'>,
  workspace: Pick<ProfileWorkspaceModel, 'railRoom' | 'citationsOpen'>,
) => {
  const rows = controller.activeSavedName
    ? citationRows(noteCitations(controller.data.cards, controller.activeSavedName))
    : [];
  return {
    rows,
    rail: workspace.railRoom && workspace.citationsOpen && rows.length > 0,
  };
};
