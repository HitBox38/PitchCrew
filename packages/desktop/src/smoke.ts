import { smokeRuntimeUpdates } from './smoke-runtime-updates.ts';
import { installSmokeShutdownCheck } from './smoke-shutdown.ts';
import { smokeUserQuestions, smokeDraftRequest, smokeDraftText } from './smoke-user-questions.ts';
import { app, clipboard, nativeTheme, type BrowserWindow, type NativeImage } from 'electron';
import { clickSmokeMcpCopy, smokeExternalMcp, smokeMcpCopyRequest } from './smoke-external-mcp.ts';
import { writeFile } from 'node:fs/promises';
import {
  smokeStreamAckFile,
  smokeStreamInputRequest,
  smokeStreamPartials,
  smokeStreamPrefix,
  smokeStreamRequest,
} from './smoke-stream.ts';
import { smokeConversations } from './smoke-conversations.ts';
import { smokeInsights } from './smoke-insights.ts';
import { smokeStyles } from './smoke-styles.ts';
import { smokeOnboarding } from './smoke-onboarding.ts';
import { smokeUpdates } from './smoke-updates.ts';
import { smokeAttachments } from './smoke-attachments.ts';
import { smokeRetainedRuntime } from './smoke-retained-runtime.ts';
import { smokeSheetBounds, smokeOpenCreation, smokeCloseCreation } from './smoke-sheets.ts';
import { smokeLinks } from './smoke-links.ts';

/** Runs only for the isolated desktop smoke harness, after the window's first load. */
export const installSmokeCheck = (window: BrowserWindow, appIcon: NativeImage) => {
  const smokeFile = process.env.PITCHCREW_SMOKE_FILE;
  let windowShown = window.isVisible();
  let windowFocused = window.isFocused();
  if (smokeFile) {
    window.webContents.on('console-message', (details) => {
      if (details.message === smokeMcpCopyRequest) {
        void clickSmokeMcpCopy(window).catch((error) => {
          console.error('Could not click the MCP copy button:', error);
          app.exit(1);
        });
        return;
      }
      if (details.message === smokeDraftRequest || details.message === smokeStreamInputRequest) {
        void (async () => {
          // Let Lexical handle Select All so its model selection changes with the DOM.
          // Native edit commands race selectionchange in hidden macOS windows.
          await window.webContents.executeJavaScript(`
            document.querySelector('.chat-rich-input').dispatchEvent(new KeyboardEvent('keydown', {
              key: 'a', code: 'KeyA', bubbles: true, cancelable: true,
              ${process.platform === 'darwin' ? 'metaKey' : 'ctrlKey'}: true,
            }));
          `);
          await window.webContents.insertText(
            details.message === smokeDraftRequest ? smokeDraftText : smokeStreamRequest,
          );
        })().catch((error) => {
          console.error('Could not type the smoke draft:', error);
          app.exit(1);
        });
        return;
      }
      const partial = details.message.slice(smokeStreamPrefix.length);
      if (!details.message.startsWith(smokeStreamPrefix) || !smokeStreamPartials.includes(partial))
        return;
      void writeFile(smokeStreamAckFile(smokeFile), partial).catch((error) => {
        console.error('Could not acknowledge the smoke streaming checkpoint:', error);
        app.exit(1);
      });
    });
    window.on('show', () => {
      windowShown = true;
    });
    window.on('focus', () => {
      windowFocused = true;
    });
  }
  const quit = smokeFile ? installSmokeShutdownCheck(window, smokeFile) : () => app.quit();
  if (smokeFile)
    window.webContents.once('did-finish-load', async () => {
      try {
        const result = await window!.webContents.executeJavaScript(
          `(async () => {
            const response = await fetch('/api/snapshot', { headers: { 'x-pitchcrew-client': 'ui' } });
            const snapshot = await response.json();
            const waitFor = async (test) => {
              for (let i = 0; i < 80; i++) {
                if (test()) return true;
                await new Promise((resolve) => setTimeout(resolve, 100));
              }
              return false;
            };
            const uiReady = await waitFor(() => !!document.querySelector('main'));
            const startup = window.pitchcrewStartup;
            if (!startup || Object.keys(startup).join(',') !== 'getTiming')
              throw new Error('Desktop startup bridge is missing or exposes extra capabilities.');
            const timing = await startup.getTiming();
            if (timing !== null && (!Number.isFinite(timing.duration_ms) || !Number.isFinite(timing.daemon_ready_ms) || timing.duration_ms < timing.daemon_ready_ms))
              throw new Error('Desktop startup bridge returned invalid timings.');
            const desktopUpdater = window.pitchcrewUpdates;
            if (!desktopUpdater || Object.keys(desktopUpdater).sort().join(',') !== 'check,download,getState,install,subscribe')
              throw new Error('Desktop updater bridge is missing or exposes extra capabilities.');
            const updateState = await desktopUpdater.getState();
            if (updateState.enabled || updateState.status !== 'disabled') throw new Error('Smoke updater must stay offline.');
            await desktopUpdater.check(); await desktopUpdater.download(); await desktopUpdater.install();
            await waitFor(() => !!document.querySelector('[data-slot="button"].button'));
            const blockedLinkToastReady = await (${smokeLinks})();
            const styleChecks = ${smokeStyles};
            let userQuestionsReady = null;
            let chatReady = null, chatResponded = null, chatTabsReady = null, chatStreamingUpdates = null, routerHistoryReady = null, featurePanelsReady = null, notificationPanelReady = null, notificationToastReady = null, notificationToastChecks = null;
            const notificationsInAppOnly = typeof window.pitchcrewNotifications === 'undefined';
            let runtimeUpdatesReady = null, onboardingReady = null, insightsReady = null, appUpdatesReady = null, retainedRuntimeReady = null, chatAttachmentsReady = null;
            const sheetChecks = {};
            const interactionChecks = {};
            let conversationNavigationReady = null;
            if (${JSON.stringify(process.env.PITCHCREW_SMOKE_CHAT === '1')}) {
              if (!snapshot.roles.every((role) => role.runtime === (role.id === 'writer' ? 'demo' : 'claude-code') && role.enabled)) throw new Error('Chat smoke test requires an isolated fixture workspace.');
              onboardingReady = await ${smokeOnboarding};
              retainedRuntimeReady = await ${smokeRetainedRuntime};
              interactionChecks.conversations = await ${smokeConversations};
              conversationNavigationReady = Object.values(interactionChecks.conversations).every(Boolean);
              // Action confirmations also have role=dialog; start the notification checks with a clean viewport.
              document.querySelectorAll('[data-slot="toast-close"]').forEach((button) => button.click());
              await waitFor(() => !document.querySelector('[data-slot="toast"]'));
              document.querySelector('a[href="/chat"]')?.click();
              chatReady = await waitFor(() => location.pathname === '/chat/scout' && !!document.querySelector('[role="textbox"][aria-label="Message Scout"]'));
              [...document.querySelectorAll('button')].find((button) => button.textContent === 'Ask about this role')?.click();
              await waitFor(() => !!document.querySelector('.chat-rich-input')?.textContent);
              const streamingInput = document.querySelector('.chat-rich-input');
              streamingInput.focus();
              console.info(${JSON.stringify(smokeStreamInputRequest)});
              if (!await waitFor(() => document.querySelector('.chat-prompt input[name="message"]')?.value === ${JSON.stringify(smokeStreamRequest)})) throw new Error('Could not type the streaming fixture request: ' + document.querySelector('.chat-prompt input[name="message"]')?.value);
              await waitFor(() => !streamingInput.closest('form').querySelector('button[type="submit"]').disabled);
              const partials = new Set();
              const observer = new MutationObserver(() => {
                const message = document.querySelector('.chat-message-content[aria-busy="true"]');
                if (message?.textContent && !partials.has(message.textContent)) {
                  partials.add(message.textContent);
                  console.info(${JSON.stringify(smokeStreamPrefix)} + message.textContent);
                }
              });
              observer.observe(document.querySelector('.chat-transcript'), { subtree: true, childList: true, characterData: true, attributes: true });
              document.querySelector('.chat-prompt')?.requestSubmit();
              chatResponded = await waitFor(() => [...document.querySelectorAll('.chat-message-content[aria-busy="false"]')].some((message) => message.textContent.includes('Second streaming checkpoint. This is a demo reply.')));
              observer.disconnect();
              const toastVisible = await waitFor(() => !!document.querySelector('[data-slot="toast"][data-kind="message"]:not([data-starting-style]):not([data-ending-style])'));
              const viewport = document.querySelector('[data-slot="toast-viewport"]');
              const messageToast = viewport?.querySelector('[data-slot="toast"][data-kind="message"]');
              messageToast?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
              messageToast?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
              await new Promise((resolve) => setTimeout(resolve, 6500));
              const hoverPaused = !!document.querySelector('[data-slot="toast"]:not([data-ending-style])');
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true }));
              viewport?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
              await new Promise((resolve) => setTimeout(resolve, 6500));
              const focusPaused = !!document.querySelector('[data-slot="toast"]:not([data-ending-style])') && viewport?.contains(document.activeElement);
              const bell = document.querySelector('.notification-bell');
              const unreadReady = await waitFor(() => bell?.getAttribute('aria-label') === 'Notifications, 1 unread');
              const bellBounds = bell.getBoundingClientRect();
              const notificationTriggerContained = [...bell.children].every((child) => {
                const bounds = child.getBoundingClientRect();
                return bounds.left >= bellBounds.left && bounds.right <= bellBounds.right && bounds.top >= bellBounds.top && bounds.bottom <= bellBounds.bottom;
              });
              bell?.click();
              const notificationsVisible = await waitFor(() => document.querySelector('.notification-list')?.textContent.includes('Scout sent a message'));
              sheetChecks.notifications = await ${smokeSheetBounds};
              [...document.querySelectorAll('.notification-controls button')].find((button) => button.textContent === 'Mark all read')?.click();
              const notificationsRead = await waitFor(() => bell?.getAttribute('aria-label') === 'Notifications, 0 unread');
              const inAppControlsOnly = !document.querySelector('.notification-controls')?.textContent.includes('Desktop alerts');
              [...document.querySelectorAll('.notification-panel button')].find((button) => button.textContent === 'Close')?.click();
              const notificationsClosed = await waitFor(() => !document.querySelector('[role="dialog"]:not([data-slot="toast"])'));
              interactionChecks.notifications = { notificationTriggerContained, unreadReady, notificationsVisible, notificationsRead, inAppControlsOnly, notificationsClosed, label: bell?.getAttribute('aria-label') };
              notificationPanelReady = notificationTriggerContained && unreadReady && notificationsVisible && notificationsRead && inAppControlsOnly && notificationsClosed;
              chatStreamingUpdates = partials.size;
              [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes('Crew work'))?.click();
              const workReady = await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('.chat-work-content'));
              document.querySelector('.chat-thread .role-avatar.writer')?.closest('a')?.click();
              const writerReady = await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('[role="textbox"][aria-label="Message Writer"]') && !!document.querySelector('.chat-empty'));
              document.querySelector('.chat-thread .role-avatar.scout')?.closest('a')?.click();
              await waitFor(() => !!document.querySelector('.chat-work-content'));
              history.back();
              const backReady = await waitFor(() => location.pathname === '/chat/writer' && !!document.querySelector('[role="textbox"][aria-label="Message Writer"]'));
              history.forward();
              routerHistoryReady = backReady && await waitFor(() => location.pathname === '/chat/scout' && !!document.querySelector('.chat-work-content'));
              [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes('Conversation'))?.click();
              chatTabsReady = !!document.querySelector('.chat-heading [role="tablist"][aria-label="Conversation view"]') && workReady && writerReady && await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('.chat-transcript'));
              document.querySelector('a[href="/skills"]')?.click();
              await waitFor(() => !!document.querySelector('.skills-view'));
              const addSkill = () => [...document.querySelectorAll('.workspace-heading-actions button')].find((button) => button.textContent.includes('Add skill'));
              await waitFor(() => !!addSkill());
              addSkill()?.click();
              const editorReady = await waitFor(() => !!document.querySelector('#skill-content'));
              const fill = (selector, value) => {
                const input = document.querySelector(selector);
                const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
                input.dispatchEvent(new Event('input', { bubbles: true }));
              };
              fill('#skill-name', 'Fictional smoke checklist');
              fill('#skill-content', '# Fictional checklist\\n\\nKeep fixture claims supported.');
              document.querySelector('#skill-content').form.requestSubmit();
              const skillSaved = await waitFor(() => !document.querySelector('[role="dialog"]:not([data-slot="toast"])') && document.querySelector('.skill-library')?.textContent.includes('Fictional smoke checklist'));
              document.querySelector('a[href="/crew"]')?.click();
              await waitFor(() => !!document.querySelector('.crew-card.scout'));
              [...document.querySelectorAll('.crew-card.scout button')].find((button) => button.textContent.includes('Configure'))?.click();
              const settingsReady = await waitFor(() => !!document.querySelector('.role-settings-panel'));
              sheetChecks.settings = await ${smokeSheetBounds};
              [...document.querySelectorAll('.role-settings-panel button')].find((button) => button.textContent === 'Cancel')?.click();
              const settingsClosed = await waitFor(() => !document.querySelector('[role="dialog"]:not([data-slot="toast"])'));
              interactionChecks.panels = { editorReady, skillSaved, settingsReady, settingsClosed };
              featurePanelsReady = editorReady && skillSaved && settingsReady && settingsClosed;
              insightsReady = await ${smokeInsights};
              document.querySelectorAll('[data-slot="toast-close"]').forEach((button) => button.click());
              await waitFor(() => !document.querySelector('[data-slot="toast"]'));
              document.querySelector('a[href="/chat"]')?.click();
              await waitFor(() => !!document.querySelector('[role="textbox"][aria-label="Message Scout"]'));

              await Promise.all(['scout', 'writer', 'reviewer'].map((role) => fetch('/api/roles/' + role + '/chat', {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-pitchcrew-client': 'ui' },
                body: JSON.stringify({ content: 'Fictional notification stack check.' }),
              })));
              const stackReady = await waitFor(() => document.querySelectorAll('[data-slot="toast"]:not([data-ending-style]):not([data-limited])').length === 3);
              interactionChecks.toastLinks = [...document.querySelectorAll('[data-slot="toast"]')].map((toast) => ({ text: toast.textContent, href: toast.querySelector('a')?.getAttribute('href') }));
              const scoutLink = document.querySelector('[data-slot="toast"] a[href="/chat/scout"]');
              const linksReady = document.querySelectorAll('[data-slot="toast"] a[href^="/chat/"]').length === 3;
              scoutLink?.click();
              const navigationReady = await waitFor(() => location.pathname === '/chat/scout' && document.querySelector('.notification-bell')?.getAttribute('aria-label') === 'Notifications, 2 unread');
              document.querySelectorAll('[data-slot="toast-close"]').forEach((button) => button.click());
              const dismissed = await waitFor(() => !document.querySelector('[data-slot="toast"]'));
              notificationToastChecks = { toastVisible, hoverPaused, focusPaused, stackReady, linksReady, navigationReady, dismissed };
              notificationToastReady = Object.values(notificationToastChecks).every(Boolean);
              chatAttachmentsReady = await ${smokeAttachments};
              appUpdatesReady = await ${smokeUpdates};
              userQuestionsReady = await ${smokeUserQuestions};
              runtimeUpdatesReady = await ${smokeRuntimeUpdates};
              interactionChecks.externalMcpConfiguration = await ${smokeExternalMcp};
            }
            return { blockedLinkToastReady, runtimeUpdatesReady, userQuestionsReady, conversationNavigationReady, interactionChecks, title: document.title, requireType: typeof require, apiStatus: response.status, cards: snapshot.cards.length, roles: snapshot.roles.length, uiReady, styleChecks, sheetChecks, onboardingReady, retainedRuntimeReady, insightsReady, appUpdatesReady, chatReady, chatResponded, chatTabsReady, chatAttachmentsReady, chatStreamingUpdates, routerHistoryReady, featurePanelsReady, notificationsInAppOnly, notificationPanelReady, notificationToastReady, notificationToastChecks };
          })()`,
        );
        if (result.interactionChecks?.externalMcpConfiguration) {
          // Windows stores native clipboard text with CRLF line endings.
          const actual = (await clipboard.readText()).replaceAll('\r\n', '\n');
          const expected = result.interactionChecks.externalMcpConfiguration;
          if (actual !== expected)
            throw new Error(
              'Desktop MCP copy did not write the exact configuration to the native clipboard.',
            );
          result.interactionChecks.externalMcpCopied = true;
          delete result.interactionChecks.externalMcpConfiguration;
        }
        if (result.appUpdatesReady) {
          await writeFile(
            `${smokeFile}.updates.png`,
            (await window.webContents.capturePage(undefined, { stayHidden: true })).toPNG(),
          );
          // The title-bar checks below expect the bounded chat layout, not a scrolling Settings page.
          await window.webContents.executeJavaScript(
            `(async () => { document.querySelector('a[href="/chat"]')?.click(); for (let i = 0; i < 80; i++) { if (document.querySelector('[role="textbox"][aria-label="Message Scout"]')) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error('Could not restore chat after update checks.'); })()`,
          );
        }
        const chrome = [];
        const initialTheme = nativeTheme.themeSource;
        for (const theme of ['light', 'dark'] as const) {
          const layout = await window!.webContents.executeJavaScript(
            `(async()=>{localStorage.setItem('pitchcrew-theme','${theme}');document.documentElement.dataset.theme='${theme}';await new Promise(r=>setTimeout(r,100));const bar=document.querySelector('.desktop-titlebar');const sidebar=document.querySelector('[data-slot="sidebar-container"]');return {platform:document.documentElement.dataset.desktop,height:bar.getBoundingClientRect().height,background:getComputedStyle(bar).backgroundColor,dragRegion:getComputedStyle(bar).getPropertyValue('-webkit-app-region'),sidebarTop:sidebar.getBoundingClientRect().top,overflow:document.documentElement.scrollHeight>innerHeight};})()`,
          );
          chrome.push({ theme, ...layout, nativeTheme: nativeTheme.themeSource });
          result.sheetChecks[theme] = await window.webContents.executeJavaScript(smokeOpenCreation);
          await writeFile(
            `${smokeFile}.sheet-${theme}.png`,
            (await window.webContents.capturePage(undefined, { stayHidden: true })).toPNG(),
          );
          result.sheetChecks[`${theme}Closed`] =
            await window.webContents.executeJavaScript(smokeCloseCreation);
          await window.webContents.executeJavaScript(
            `(async () => { document.querySelector('a[href="/chat"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 350)); })()`,
          );
          await writeFile(
            `${smokeFile}.${theme}.png`,
            (await window!.webContents.capturePage(undefined, { stayHidden: true })).toPNG(),
          );
        }
        await window!.webContents.executeJavaScript(
          `(()=>{const source='${initialTheme}';if(source==='system')localStorage.removeItem('pitchcrew-theme');else localStorage.setItem('pitchcrew-theme',source);document.documentElement.dataset.theme=source==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):source;})()`,
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
        await writeFile(
          `${smokeFile}.png`,
          (await window!.webContents.capturePage(undefined, { stayHidden: true })).toPNG(),
        );
        await writeFile(
          smokeFile,
          JSON.stringify({
            ...result,
            windowStayedHidden: !windowShown && !windowFocused,
            chrome,
            themeSourceRestored: nativeTheme.themeSource === initialTheme,
            iconLoaded: !appIcon.isEmpty(),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          }),
        );
        quit();
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
};
