import type { Page } from "puppeteer";

export function sleep(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

export async function clickSelector(clickSelector: string, page: Page, time?: number) {
  await page.waitForSelector(clickSelector);
  time && await sleep(time);
  await page.click(clickSelector);
}

export async function hoverSelector(hoverSelector: string, page: Page, time?: number) {
  await page.waitForSelector(hoverSelector);
  time && await sleep(time);
  await page.hover(hoverSelector);
}
