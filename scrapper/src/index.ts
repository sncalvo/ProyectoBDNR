import puppeteer from "puppeteer";
import { BEDELIAS_URL } from "./constants";

import { sleep } from "./utils";

async function start() {
  const browser = await puppeteer.launch({ headless: false });

  const page = await browser.newPage();

  await page.goto(BEDELIAS_URL);
  await page.setViewport({ width: 1280, height: 720 });
  const studyPlansDropdownSelector = "a ::-p-text(PLANES DE ESTUDIO)";
  await page.waitForSelector(studyPlansDropdownSelector);
  await page.hover(studyPlansDropdownSelector);

  const requirementsSelector = "a ::-p-text(Planes de estudio / Previas)";
  await page.waitForSelector(requirementsSelector);
  await sleep(2000);
  await page.click(requirementsSelector);

  const techDropdownSelector = "h3 ::-p-text(TECNOLOGÍA Y CIENCIAS DE LA NATURALEZA)";
  await page.waitForSelector(techDropdownSelector);
  await page.click(techDropdownSelector);

  await sleep(5000);

  await browser.close();
}

start();
