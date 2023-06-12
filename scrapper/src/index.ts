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

  await sleep(1000);
  const fingSelector = "td ::-p-text(FING - FACULTAD DE INGENIERÍA)";
  await page.waitForSelector(fingSelector);
  await page.click(fingSelector);

  await sleep(2000);
  const compSelector = `tr[data-ri="36"] > td[role="gridcell"]`;
  await page.waitForSelector(compSelector);
  await page.click(compSelector);

  const compActiveSelector = `td::-p-text(INGENIERIA EN COMPUTACION) ~ td::-p-text(Si) + td > a[title="Ver más datos"]`;
  await page.waitForSelector(compActiveSelector);
  await page.click(compActiveSelector);

  // const basicSubjectsSelector = "span.ui-tree-toggler:has(~ span::-p-text(2436 - MATERIAS BASICAS - min: 80 créditos))";
  // await sleep(1000);
  const basicSubjectTextSelector = "span::-p-text(2436 - MATERIAS BASICAS - min: 80 créditos)";
  // await page.waitForSelector(basicSubjectsSelector);
  // await page.click(basicSubjectsSelector);
  // const basicSubjectSpan = await page.waitForSelector(basicSubjectSpan);

  await sleep(5000);

  await browser.close();
}

start();
