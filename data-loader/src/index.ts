import { parse } from 'yaml';
import { readFileSync } from 'fs';

import * as z from 'zod';
import neo4j from 'neo4j-driver'

import { Obj, camelize } from './utils';
import getDriver from './driver';

const SUBJECTS_FILE_PATH = "./input/subjects.yml";
const GROUPS_FILE_PATH = "./input/groups.yml";

const subjectSchema = z.object({
  code: z.string(),
  name: z.string(),
  credits: z.number(),
  hasExam: z.boolean(),
  subjectGroup: z.string().nullable(),
});

const subjectsSchema = z.array(subjectSchema);

const groupSchema = z.object({
  code: z.string(),
  name: z.string(),
  minCredits: z.number(),
});

const groupsSchema = z.array(groupSchema);

function readSubjects() {
  const fileBuffer = readFileSync(SUBJECTS_FILE_PATH, 'utf8');
  const objects = Object.values(camelize(parse(fileBuffer) as Obj));

  return subjectsSchema.parse(objects);
}

function readGroups() {
  const fileBuffer = readFileSync(GROUPS_FILE_PATH, 'utf8');
  const objects = Object.values(camelize(parse(fileBuffer) as Obj));

  return groupsSchema.parse(objects);
}

async function main() {
  const subjects = readSubjects();
  const groups = readGroups();

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

  console.log('Inserting ', subjects.length, ' groups');
  for (const [index, group] of groups.entries()) { 
    const { name, code, minCredits } = group;

    await driver.run(
      'CREATE (n: Grupo { name: $name, code: $code, minCredits: $minCredits })',
      {
        name,
        code,
        minCredits: neo4j.int(minCredits),
      }
    );

    console.log('Inserted ', { name, code }, '---', index + 1, ' / ', groups.length);
  }

  console.log('Relating subjects to groups');
  for (const subject of subjects) {
    const { code, subjectGroup } = subject;

    if (!code || !subjectGroup) {
      continue;
    }

    await driver.run(
      `MATCH
        (subject:Materia {code: $code}),
        (group:Grupo {code: $subjectGroup})
      CREATE (subject)-[:PERTENECE]->(group)`,
      { code, subjectGroup },
    );

    console.log('Related ', { code, subjectGroup });
  }

  await driver.close();
}

main();
