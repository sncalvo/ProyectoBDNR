import { parse } from 'yaml';
import { readFileSync } from 'fs';

import * as z from 'zod';
import neo4j, { Session } from 'neo4j-driver'

import { Obj, camelize } from './utils';
import getDriver from './driver';

const SUBJECTS_FILE_PATH = "./input/subjects.yml";
const GROUPS_FILE_PATH = "./input/groups.yml";
const PREREQUISITES_FILE_PATH = "./input/prerequisites.yml";

function makeid(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

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

const basePrerequisiteSchema = z.object({
  type: z.enum(['logical', 'subject', 'credits']).optional(),
  logicalOperator: z.enum(['and', 'or', 'not', 'at_least']).optional(),
  subjectNeededCode: z.string().optional(),
  needs: z.enum(['exam', 'course', 'all', 'enrollment']).optional(),
  subjectCode: z.string().optional(),
  isExam: z.boolean().optional(),
  credits: z.number().optional(),
  group: z.number().optional(),
});

const mapLogicalOperatorToType = {
  and: 'all',
  not: 'cant_have',
  or: 'one_of',
  at_least: 'at_least'
} as const;

type Prerequisite = z.infer<typeof basePrerequisiteSchema> & {
  operands?: Prerequisite[];
};

const prerequisiteSchema: z.ZodType<Prerequisite> = basePrerequisiteSchema.extend({
  operands: z.lazy(() => prerequisiteSchema.array()).optional(),
});

const prerequisitesSchema = z.array(prerequisiteSchema);

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

function readPrerequisites() {
  const fileBuffer = readFileSync(PREREQUISITES_FILE_PATH, 'utf8');
  const objects = Object.values(camelize(parse(fileBuffer) as Obj));

  return prerequisitesSchema.parse(objects);
}

// Goes over current prerequisite and creates the structure in the database. In is a recursive function.
function savePrerequisites(prerequisite: Prerequisite, prevId?: string, index?: number): [string, string[]] {
  const { subjectCode, type, logicalOperator, needs, subjectNeededCode, operands } = prerequisite;

  // Base prerequisite
  if (subjectCode && logicalOperator) {
    const operandsQueries = operands?.map((operand, index) => savePrerequisites(operand, "prerequisite", index)) ?? [];
    const { create, matches } = operandsQueries.reduce(
      (prev, [createQuery, matchQueries]) => {
        const create = [...prev.create, createQuery];
        const matches = matchQueries.length ? [...prev.matches, matchQueries.join(',\n')] : [...prev.matches];
        return ({ create, matches });
      },
      { create: [] as string[], matches: [] as string[] }
    );

    console.log({ create, matches });

    const query = `
      MATCH
        (subject: Subject { code: '${subjectCode}' })
          ${matches.length ? ',' : ''}
          ${matches.join(',') ?? ''}
      CREATE
        (subject)-[:HAS { type: '${mapLogicalOperatorToType[logicalOperator]}' }]->(prerequisite: Prerequisite)${create.length ? ',' : ''}
        ${create.join(',\n')}
    `;
    return [query, []];
  } else {
    switch (type) {
      case 'logical':
        const type = mapLogicalOperatorToType[logicalOperator ?? 'and'];
        const prerequisiteName = `${prevId}_${type}${index ? `_${index}` : ''}`;

        const operandsQueries = operands?.map((operand, index) => savePrerequisites(operand, "prerequisite", index)) ?? [];
        const { create, matches } = operandsQueries.reduce(
          (prev, [createQuery, matchQueries]) => {
            const create = [...prev.create, createQuery];
            const matches = matchQueries.length ? [...prev.matches, matchQueries.join(',\n')] : [...prev.matches];
            return ({ create, matches });
          },
          { create: [] as string[], matches: [] as string[] }
        );

        return [`
          (${prevId})-[:SATISFIES { type: '${type}' }]->(${prerequisiteName}:Prerequisite),
          ${
            create.join(',\n')
          }
        `.trim(),
          matches
        ];
      case 'subject':
        const subjectVarName = `subject_${index ? `_${index}` : ''}${prevId}_${needs}_${subjectNeededCode}`;

        return [`(${prevId})-[:NEEDS { type: '${needs}' }]->(${subjectVarName})`, [`(${subjectVarName}:Subject { code: '${subjectNeededCode}' })`]];
      case 'credits':
        if (prerequisite.group) {
          const groupVarName = `credits_${index ? `_${index}` : ''}${prevId}_${needs}_${subjectNeededCode}`;
          return [`(${prevId})-[:NEEDS { type: '${needs}', min: '${prerequisite.credits}' }]->(${groupVarName})`, [`(${groupVarName}:Group { code: '${prerequisite.group}' })`]];
        } else {
          return [`(${prevId})-[:NEEDS { type: '${needs}', min: '${prerequisite.credits}' }]->(:Prerequisite)`, []];
        }
      default:
        throw 'NOT IMPLEMENTED';
    }
  }
  // if subject, only relate to subject and return
  // if credits, only relate to group or specify credits
  
  // For each operand, call savePrerequisite with prevId id of subject just created
}

async function main(driver: Session) {
  const subjects = readSubjects();
  const groups = readGroups();

  console.log('Inserting ', subjects.length, ' subjects');

  for (const [index, subject] of subjects.entries()) { 
    const { name, code, credits, hasExam, subjectGroup } = subject;

    await driver.run(
      'CREATE (n: Subject { name: $name, code: $code, credits: $credits, hasExam: $hasExam, subjectGroup: $subjectGroup })',
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
      'CREATE (n: Group { name: $name, code: $code, minCredits: $minCredits })',
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
        (subject:Subject {code: $code}),
        (group:Group {code: $subjectGroup})
      CREATE (subject)-[:BELONGS]->(group)`,
      { code, subjectGroup },
    );

    console.log('Related ', { code, subjectGroup });
  }

  // const prerequisites = readPrerequisites();
}

const testPrerequisites = async (driver: Session) => {
  const prerequisites = readPrerequisites();

  for (const prerequisite of prerequisites) {
    const query = savePrerequisites(prerequisite);
    try {
      await driver.run(query[0]);
      console.log(prerequisite);
    } catch (error) {
      console.log(error, query, JSON.stringify(prerequisite));
    }

    // console.log('Inserted prerequisite ', prerequisite.subjectCode);
  }
} 


(async () => {
  const driver = getDriver().session();

  await main(driver);
  await testPrerequisites(driver);
})();
