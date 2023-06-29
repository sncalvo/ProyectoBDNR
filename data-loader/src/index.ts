import { parse } from 'yaml';
import { readFileSync } from 'fs';

import * as z from 'zod';
import neo4j from 'neo4j-driver'

import { Obj, camelize } from './utils';
import getDriver from './driver';

const SUBJECTS_FILE_PATH = "./input/subjects.yml";
const GROUPS_FILE_PATH = "./input/groups.yml";
const PREREQUISITES_FILE_PATH = "./input/redes.yml";

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
}); 

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

const mapLogicalOperatorToType = {
  and: 'all',
  not: 'cant_have',
  or: 'one_of',
  at_least: 'at_least'
} as const;

// Goes over current prerequisite and creates the structure in the database. In is a recursive function.
function savePrerequisites(prerequisite: Prerequisite, prevId?: string, index?: number): string {
  const { subjectCode, type, logicalOperator, needs, subjectNeededCode } = prerequisite;

  // Base prerequisite
  if (subjectCode && logicalOperator) {
    const query: string = `
      MATCH (subject: Subject { code: ${subjectCode} })
      CREATE
        (subject)-[:HAS { type: ${mapLogicalOperatorToType[logicalOperator]} }]->(prerequisite: Prerequisite)${ prerequisite.operands ? ',' : ''}
        ${
          prerequisite.operands?.map((operand, index) => 
          `// ${index} sub group
            ${savePrerequisites(operand, "prerequisite", index)}`).join(',\n')
        }
    `;
    return query;
  } else {
    switch (type) {
      case 'logical':
        const type = mapLogicalOperatorToType[logicalOperator ?? 'and'];
        const prerequisiteName = `${prevId}_${type}${ index ? `_${index}` : ''}`;
        return `
          (${prevId})-[:SATISFIES { type: '${type}' }]->(${prerequisiteName}:Prerequisite),
          ${
            prerequisite.operands?.map((operand, index) => savePrerequisites(operand, `${prerequisiteName}`, index)).join(',\n')
          }
        `.trim();
      case 'subject':
        return `(${prevId})-[:NEEDS { type: '${needs}' }]->(:Subject { code: '${subjectNeededCode}' })`;
      default:
        return 'NOT IMPLEMENTED'
    }
  }
  // if subject, only relate to subject and return
  // if credits, only relate to group or specify credits
  
  // For each operand, call savePrerequisite with prevId id of subject just created
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

  const prerequisites = readPrerequisites();

  console.log(prerequisites);

  await driver.close();
}

const testPrerequisites = async () => {

  const prerequisites = readPrerequisites();

  prerequisites.forEach((prerequisite) => {
    console.log(savePrerequisites(prerequisite));
  });
} 

testPrerequisites();
// main();
