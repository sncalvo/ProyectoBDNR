import { parse } from 'yaml';
import { readFileSync } from 'fs';

import * as z from 'zod';
import { Obj, camelize } from './utils';

const SUBJECTS_FILE_PATH = "./input/subjects.yml";

const subjectSchema = z.object({
  code: z.string(),
  name: z.string(),
  credits: z.number(),
  hasExam: z.boolean(),
  subjectGroup: z.string().nullable(),
})

const subjectsSchema = z.array(subjectSchema);

async function readSubjects() {
  const fileBuffer = readFileSync(SUBJECTS_FILE_PATH, 'utf8');
  const objects = Object.values(camelize(parse(fileBuffer) as Obj));

  const subjects = subjectsSchema.parse(objects);

  return subjects
}

readSubjects();
