import { chromium } from '../../packages/ui/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('brag-output/composition/assets/app');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2,
  reducedMotion: 'reduce', colorScheme: 'light',
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
await page.goto('http://127.0.0.1:14417/');
await page.getByRole('button', { name: 'Open Senior UI Engineer at Waypoint', exact: true }).waitFor();
await page.evaluate(async () => { document.documentElement.dataset.theme = 'light'; await document.fonts.ready; });
await page.screenshot({ path: `${output}/board.png` });
console.log('BOARD', await page.locator('.board-workspace').boundingBox());
await page.getByRole('button', { name: 'Open Senior UI Engineer at Waypoint', exact: true }).click();
await page.getByRole('dialog').waitFor();
console.log('DETAIL', (await page.getByRole('dialog').innerText()).slice(0,10000));
await page.screenshot({ path: `${output}/job.png` });
await page.getByRole('tab', { name: 'Application', exact: true }).click();
console.log('APPLICATION', (await page.getByRole('dialog').innerText()).slice(0,12000));
await page.getByRole('button', { name: /^Documents/ }).click();
console.log('DOCUMENTS', (await page.getByRole('dialog').innerText()).slice(0,10000));
await page.screenshot({ path: `${output}/application.png` });
await page.getByRole('dialog').screenshot({path:`${output}/application-panel.png`});
await page.getByRole('button', { name: 'Open approval inbox', exact: true }).click();
await page.waitForURL(/\/inbox/);
await page.locator('.inbox-workspace').waitFor();
console.log('INBOX', (await page.locator('main').innerText()).slice(0,12000));
await page.screenshot({ path: `${output}/inbox.png` });
await writeFile(`${output}/capture-state.json`, JSON.stringify({viewport:{width:1600,height:1000},deviceScaleFactor:2,title:await page.title(),boardSource:'packages/ui/src/BoardPage',jobSource:'packages/ui/src/JobDetails'},null,2));
await page.goto('http://127.0.0.1:14417/crew');
await page.locator('.crew-card.scout').waitFor();
await page.screenshot({path:`${output}/crew.png`});
for(const role of ['scout','writer','reviewer']){await page.locator(`.crew-card.${role}`).screenshot({path:`${output}/crew-${role}.png`});}
await browser.close();
