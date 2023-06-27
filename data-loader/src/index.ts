import { parse } from 'yaml';
import { readFileSync } from 'fs';

import * as z from 'zod';
import neo4j from 'neo4j-driver'

import { Obj, camelize } from './utils';
import getDriver from './driver';

const SUBJECTS_FILE_PATH = "./input/subjects.yml";

const subjectSchema = z.object({
  code: z.string(),
  name: z.string(),
  credits: z.number(),
  hasExam: z.boolean(),
  subjectGroup: z.string().nullable(),
})

const subjectsSchema = z.array(subjectSchema);

function readSubjects() {
  const fileBuffer = readFileSync(SUBJECTS_FILE_PATH, 'utf8');
  const objects = Object.values(camelize(parse(fileBuffer) as Obj));

  return subjectsSchema.parse(objects);
}

async function main() {
  const subjects = readSubjects();

  const driver = getDriver().session();

  console.log('Inserting ', subjects.length, ' subjects');

  for (const [index, subject] of subjects.entries()) { 
    const { name, code, credits, hasExam, subjectGroup } = subject;

    await driver.run(
      'CREATE (n: Materia { name: $name, code: $code, credits: $credits, hasExam: $hasExam, subjectGroup: $subjectGroup })',
      {
        name,
        code,
        credits: neo4j.int(credits),
        hasExam: neo4j.int(+hasExam),
        subjectGroup,
      }
    );

    console.log('Inserted ', { name, code }, '---', index + 1, ' / ', subjects.length);
  }

  await driver.close();
}

main();
