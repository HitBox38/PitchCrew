import { chromium } from '../../packages/ui/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
const output=resolve('brag-output/composition/assets/app');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:2,reducedMotion:'reduce',colorScheme:'light'});
await page.goto('http://127.0.0.1:14417/crew');
await page.locator('.crew-card.scout').waitFor();
await page.evaluate(async()=>{document.documentElement.style.zoom='1.5';await document.fonts.ready;});
const frames:unknown[]=[];
for(const role of ['scout','writer','reviewer']){
 const card=page.locator(`.crew-card.${role}`);
 await card.scrollIntoViewIfNeeded();
 await card.screenshot({path:`${output}/crew-${role}-native.png`});
 const bounds=(await card.boundingBox())!;
 const description=(await card.locator('.crew-card-description').boundingBox())!;
 const clip={x:Math.max(0,bounds.x-7),y:Math.max(0,bounds.y-7),width:bounds.width+14,height:description.y+description.height-bounds.y+32};
 await page.screenshot({path:`${output}/crew-${role}-header.png`,clip});
 frames.push({role,clip});
}
await writeFile(`${output}/crew-frames.json`,JSON.stringify(frames,null,2));
await browser.close();
