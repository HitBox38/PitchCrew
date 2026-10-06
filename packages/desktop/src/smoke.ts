import { app, nativeTheme, type BrowserWindow, type NativeImage } from 'electron';
import { writeFile } from 'node:fs/promises';
import { smokeInsights } from './smoke-insights.ts';
import { smokeStyles } from './smoke-styles.ts';
import { smokeOnboarding } from './smoke-onboarding.ts';
import { smokeUpdates } from './smoke-updates.ts';
import { smokeSheetBounds, smokeOpenCreation, smokeCloseCreation } from './smoke-sheets.ts';

/** Runs only for the isolated desktop smoke harness, after the window's first load. */
export function installSmokeCheck(window: BrowserWindow, appIcon: NativeImage) {
  const smokeFile = process.env.PITCHCREW_SMOKE_FILE;
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
            await waitFor(() => !!document.querySelector('[data-slot="button"].button'));
            const styleChecks = ${smokeStyles};
            let chatReady = null, chatResponded = null, chatTabsReady = null, chatStreamingUpdates = null, routerHistoryReady = null, featurePanelsReady = null, notificationPanelReady = null, notificationToastReady = null, notificationToastChecks = null;
            const notificationsInAppOnly = typeof window.pitchcrewNotifications === 'undefined';
            let onboardingReady = null, insightsReady = null, appUpdatesReady = null;
            const sheetChecks = {};
            if (${JSON.stringify(process.env.PITCHCREW_SMOKE_CHAT === '1')}) {
              if (!snapshot.roles.every((role) => role.runtime === 'claude-code' && role.enabled)) throw new Error('Chat smoke test requires an isolated fixture workspace.');
              onboardingReady = await ${smokeOnboarding};
              document.querySelector('a[href="/chat"]')?.click();
              chatReady = await waitFor(() => location.pathname === '/chat/scout' && !!document.querySelector('textarea[aria-label="Message Scout"]'));
              [...document.querySelectorAll('button')].find((button) => button.textContent === 'Ask about this role')?.click();
              await waitFor(() => !!document.querySelector('textarea')?.value);
              const partials = new Set();
              const observer = new MutationObserver(() => {
                const message = document.querySelector('.chat-message-content[aria-busy="true"]');
                if (message?.textContent) partials.add(message.textContent);
              });
              observer.observe(document.querySelector('.chat-transcript'), { subtree: true, childList: true, characterData: true, attributes: true });
              document.querySelector('textarea')?.form?.requestSubmit();
              chatResponded = await waitFor(() => [...document.querySelectorAll('.chat-message-content[aria-busy="false"]')].some((message) => message.textContent.includes('This is a demo reply.')));
              observer.disconnect();
              const toastVisible = await waitFor(() => !!document.querySelector('[data-slot="toast"]'));
              const viewport = document.querySelector('[data-slot="toast-viewport"]');
              viewport?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              await new Promise((resolve) => setTimeout(resolve, 6500));
              const hoverPaused = !!document.querySelector('[data-slot="toast"]:not([data-ending-style])');
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F6', bubbles: true }));
              viewport?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
              await new Promise((resolve) => setTimeout(resolve, 6500));
              const focusPaused = !!document.querySelector('[data-slot="toast"]:not([data-ending-style])') && viewport?.contains(document.activeElement);
              const bell = document.querySelector('.notification-bell');
              const unreadReady = await waitFor(() => bell?.getAttribute('aria-label') === 'Notifications, 1 unread');
              bell?.click();
              const notificationsVisible = await waitFor(() => document.querySelector('.notification-list')?.textContent.includes('Scout sent a message'));
              sheetChecks.notifications = await ${smokeSheetBounds};
              [...document.querySelectorAll('.notification-controls button')].find((button) => button.textContent === 'Mark all read')?.click();
              const notificationsRead = await waitFor(() => bell?.getAttribute('aria-label') === 'Notifications, 0 unread');
              const inAppControlsOnly = !document.querySelector('.notification-controls')?.textContent.includes('Desktop alerts');
              [...document.querySelectorAll('.notification-panel button')].find((button) => button.textContent === 'Close')?.click();
              const notificationsClosed = await waitFor(() => !document.querySelector('[role="dialog"]'));
              notificationPanelReady = unreadReady && notificationsVisible && notificationsRead && inAppControlsOnly && notificationsClosed;
              chatStreamingUpdates = partials.size;
              [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes('Crew work'))?.click();
              const workReady = await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('.chat-work-content'));
              document.querySelector('.chat-thread .role-avatar.writer')?.closest('button')?.click();
              const writerReady = await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('textarea[aria-label="Message Writer"]') && !!document.querySelector('.chat-empty'));
              document.querySelector('.chat-thread .role-avatar.scout')?.closest('button')?.click();
              await waitFor(() => !!document.querySelector('.chat-work-content'));
              history.back();
              const backReady = await waitFor(() => location.pathname === '/chat/writer' && !!document.querySelector('textarea[aria-label="Message Writer"]'));
              history.forward();
              routerHistoryReady = backReady && await waitFor(() => location.pathname === '/chat/scout' && !!document.querySelector('.chat-work-content'));
              [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes('Conversation'))?.click();
              chatTabsReady = workReady && writerReady && await waitFor(() => document.querySelectorAll('[role="tabpanel"]').length === 1 && !!document.querySelector('.chat-transcript'));
              document.querySelector('a[href="/skills"]')?.click();
              await waitFor(() => !!document.querySelector('.skills-view'));
              [...document.querySelectorAll('.skill-actions button')].find((button) => button.textContent.includes('Add skill'))?.click();
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
              const skillSaved = await waitFor(() => !document.querySelector('[role="dialog"]') && document.querySelector('.skill-library')?.textContent.includes('Fictional smoke checklist'));
              document.querySelector('a[href="/crew"]')?.click();
              await waitFor(() => !!document.querySelector('.crew-card.scout'));
              [...document.querySelectorAll('.crew-card.scout button')].find((button) => button.textContent.includes('Configure'))?.click();
              const settingsReady = await waitFor(() => !!document.querySelector('.role-settings-panel'));
              sheetChecks.settings = await ${smokeSheetBounds};
              [...document.querySelectorAll('.role-settings-panel button')].find((button) => button.textContent === 'Cancel')?.click();
              const settingsClosed = await waitFor(() => !document.querySelector('[role="dialog"]'));
              featurePanelsReady = editorReady && skillSaved && settingsReady && settingsClosed;
              insightsReady = await ${smokeInsights};
              document.querySelector('a[href="/chat"]')?.click();
              await waitFor(() => !!document.querySelector('textarea[aria-label="Message Scout"]'));

              await Promise.all(['scout', 'writer', 'reviewer'].map((role) => fetch('/api/roles/' + role + '/chat', {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-pitchcrew-client': 'ui' },
                body: JSON.stringify({ content: 'Fictional notification stack check.' }),
              })));
              const stackReady = await waitFor(() => document.querySelectorAll('[data-slot="toast"]:not([data-ending-style]):not([data-limited])').length === 3);
              const scoutLink = document.querySelector('[data-slot="toast"] a[href="/chat/scout"]');
              const linksReady = document.querySelectorAll('[data-slot="toast"] a[href^="/chat/"]').length === 3;
              scoutLink?.click();
              const navigationReady = await waitFor(() => location.pathname === '/chat/scout' && document.querySelector('.notification-bell')?.getAttribute('aria-label') === 'Notifications, 2 unread');
              document.querySelectorAll('[data-slot="toast-close"]').forEach((button) => button.click());
              const dismissed = await waitFor(() => !document.querySelector('[data-slot="toast"]'));
              notificationToastChecks = { toastVisible, hoverPaused, focusPaused, stackReady, linksReady, navigationReady, dismissed };
              notificationToastReady = Object.values(notificationToastChecks).every(Boolean);
              appUpdatesReady = await ${smokeUpdates};
            }
            return { title: document.title, requireType: typeof require, apiStatus: response.status, cards: snapshot.cards.length, roles: snapshot.roles.length, uiReady, styleChecks, sheetChecks, onboardingReady, insightsReady, appUpdatesReady, chatReady, chatResponded, chatTabsReady, chatStreamingUpdates, routerHistoryReady, featurePanelsReady, notificationsInAppOnly, notificationPanelReady, notificationToastReady, notificationToastChecks };
          })()`,
        );
        if (result.appUpdatesReady) {
          await writeFile(
            `${smokeFile}.updates.png`,
            (await window.webContents.capturePage()).toPNG(),
          );
          // The title-bar checks below expect the bounded chat layout, not a scrolling Settings page.
          await window.webContents.executeJavaScript(
            `(async () => { document.querySelector('a[href="/chat"]')?.click(); for (let i = 0; i < 80; i++) { if (document.querySelector('textarea[aria-label="Message Scout"]')) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error('Could not restore chat after update checks.'); })()`,
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
            (await window.webContents.capturePage()).toPNG(),
          );
          result.sheetChecks[`${theme}Closed`] =
            await window.webContents.executeJavaScript(smokeCloseCreation);
          await window.webContents.executeJavaScript(
            `(async () => { document.querySelector('a[href="/chat"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 350)); })()`,
          );
          await writeFile(
            `${smokeFile}.${theme}.png`,
            (await window!.webContents.capturePage()).toPNG(),
          );
        }
        await window!.webContents.executeJavaScript(
          `(()=>{const source='${initialTheme}';if(source==='system')localStorage.removeItem('pitchcrew-theme');else localStorage.setItem('pitchcrew-theme',source);document.documentElement.dataset.theme=source==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):source;})()`,
        );
        await new Promise((resolve) => setTimeout(resolve, 800));
        await writeFile(`${smokeFile}.png`, (await window!.webContents.capturePage()).toPNG());
        await writeFile(
          smokeFile,
          JSON.stringify({
            ...result,
            chrome,
            themeSourceRestored: nativeTheme.themeSource === initialTheme,
            iconLoaded: !appIcon.isEmpty(),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          }),
        );
        app.quit();
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
}
