import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Node, Integer } from 'neo4j-driver'
import * as z from "zod";

type Subject = Node<Integer, {
  code: string,
  name: string,
  credits: number
}>

export const subjectsRouter = createTRPCRouter({
  all: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw 'NOT FOUND';
    }

    const result = await ctx.neo4jSession.run<{ subject: Subject, passed: boolean }>(
      `MERGE (u:User { id: $userId }) WITH u
        MATCH (subject: Subject)
        WITH subject, exists((u)-[:PASSED]->(subject)) AS passed
        RETURN subject, passed
        ORDER BY passed DESC LIMIT 25`,
      { userId }
    );

    const subjects = result.records.map((record) =>
      ({ ...record.get('subject').properties, passed: record.get('passed') })
    );

    return subjects;
  }),
  addPassed: protectedProcedure.input(z.object({ code: z.string() })).mutation(async ({ input: { code }, ctx }) => {
    const subjectResult = await ctx.neo4jSession.run<{ s: Subject }>(
      'MATCH (s: Subject{ code: $code }) RETURN s',
      { code }
    );
    const subject = subjectResult.records.map((record) => record.get('s').properties).at(0);
    const userId = ctx.auth.userId

    if (!subject || !userId) {
      throw 'NOT FOUND';
    }

    await ctx.neo4jSession.run(
      'MATCH (s: Subject{ code: $code }), (u: User{id: $userId}) CREATE (u)-[:PASSED]->(s)',
      { code, userId }
    );
  }),
  removePassed: protectedProcedure.input(z.object({ code: z.string() })).mutation(async ({ input: { code }, ctx }) => {
    const subjectResult = await ctx.neo4jSession.run<{ s: Subject }>(
      'MATCH (s: Subject{ code: $code }) RETURN s',
      { code }
    );
    const subject = subjectResult.records.map((record) => record.get('s').properties).at(0);
    const userId = ctx.auth.userId

    if (!subject || !userId) {
      throw 'NOT FOUND';
    }

    await ctx.neo4jSession.run(
      'MATCH (u: User{id: $userId})-[p:PASSED]->(s: Subject{ code: $code }) DELETE p',
      { code, userId }
    );
  }),
  recommended: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw 'NOT FOUND';
    }

    const result = await ctx.neo4jSession.run<{ s: Subject }>(
      `MATCH
        (u: User{id: $userId})-[:PASSED]->(:Subject)<-[r:NEEDS]-(:Prerequisite)<-[:SATISFIES*]-(:Prerequisite)<-[:HAS]-(s: Subject)
      RETURN s`,
      { userId }
    );

    const recommended = result.records.map((record) => record.get('s').properties);

    return recommended;
  }),
});
