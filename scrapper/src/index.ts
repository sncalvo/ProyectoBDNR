import puppeteer, { ElementHandle } from "puppeteer";
import { BEDELIAS_URL } from "./constants";

import { clickSelector, hoverSelector, sleep } from "./utils";

async function start() {
  const browser = await puppeteer.launch({ headless: false });

  const page = await browser.newPage();

  await page.goto(BEDELIAS_URL);
  await page.setViewport({ width: 1280, height: 720 });

  const studyPlansDropdownSelector = "a::-p-text(PLANES DE ESTUDIO)";
  await hoverSelector(studyPlansDropdownSelector, page);

  const requirementsSelector = "a::-p-text(Planes de estudio / Previas)";
  await clickSelector(requirementsSelector, page, 2000);

  const techDropdownSelector = "h3::-p-text(TECNOLOGÍA Y CIENCIAS DE LA NATURALEZA)";
  await clickSelector(techDropdownSelector, page);

  await sleep(1000);
  const fingSelector = "td::-p-text(FING - FACULTAD DE INGENIERÍA)";
  await clickSelector(fingSelector, page);

  await sleep(2000);
  const compSelector = `tr[data-ri="36"] > td[role="gridcell"]`;
  await clickSelector(compSelector, page);

  const compActiveSelector = `td::-p-text(INGENIERIA EN COMPUTACION) ~ td::-p-text(Si) + td > a[title="Ver más datos"]`;
  await clickSelector(compActiveSelector, page);

  // Search through XPath span that is sibling of MATERIAS BASICAS (the arrow that is clicked to dropdown the menu)
  const basicSubjectXPathSelector = "//span[contains(text(), '2436 - MATERIAS BASICAS - min: 80 créditos')]/preceding-sibling::span";
  // need to sleep because page is loading. Maybe we can wait for page to stop loading by checking elements?
  await sleep(2000);
  const result = await page.$x(basicSubjectXPathSelector);
  // Type shananigans. Refactor into clickXPathSelector
  (result[0] as ElementHandle<Element>).click();

  // TODO: Click on group and continue

  await sleep(5000);

  await browser.close();
}

start();
