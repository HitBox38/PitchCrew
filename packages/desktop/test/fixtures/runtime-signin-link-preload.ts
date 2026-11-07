import { ipcRenderer } from 'electron';
import { linkFeedbackChannel } from '../../src/link-feedback.ts';

ipcRenderer.on(linkFeedbackChannel, (_event, reason: unknown) => {
  ipcRenderer.send('pitchcrew:signin-link-test-feedback', reason);
});
