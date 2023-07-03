import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Node, Integer, Path } from 'neo4j-driver'
import * as z from "zod";

type Subject = Node<Integer, {
  code: string,
  name: string,
  credits: number
}>

export const subjectsRouter = createTRPCRouter({
  all: protectedProcedure.input(z.string().optional()).query(async ({ ctx, input }) => {
    const userId = ctx.auth.userId;
    if (!userId) {
      throw 'NOT FOUND';
    }

    let whereClause = "";
    if (input && input !== "") {
      whereClause = `WHERE subject.name =~ '.*${input.toUpperCase()}.*'`;
    }

    const result = await ctx.neo4jSession.run<{ subject: Subject, passed: boolean }>(
      `MERGE (u:User { id: $userId }) WITH u
        MATCH (subject: Subject)
        ${whereClause}
        WITH subject, exists((u)-[:PASSED]->(subject)) AS passed
        RETURN subject, passed
        ORDER BY passed DESC`,
      { userId, nameSubstring: input }
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
      'MATCH (s: Subject{ code: $code }), (u: User{id: $userId}) CREATE (u)-[:PASSED { type: $type }]->(s)',
      { code, userId, type: 'exam' }
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

    const result = await ctx.neo4jSession.run<{ subject: Subject, priority: number, originatorList: Subject[] }>(
      `
      MATCH
        (user :User { id: $userId })-[:PASSED]->(originator :Subject)<-[:NEEDS]-(:Prerequisite)<-[:SATISFIES*]-(:Prerequisite)<-[:HAS]-(subject :Subject)
      WHERE NOT exists((user)-[:PASSED]->(subject))
      RETURN DISTINCT subject, count(DISTINCT originator) as priority, collect(DISTINCT originator) as originatorList ORDER BY priority DESC
      `,
      { userId }
    );

    const recommended = result.records.map((record) => ({
      ...record.get('subject').properties,
      originators: record.get('originatorList').map((subject) => subject.properties),
      priority: record.get('priority')})
    );

    return recommended;
  }),
  available: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId

    if (!userId) {
      throw 'NOT FOUND';
    }

    const recommended = await ctx.neo4jSession.run<{ code: string }>(
      `
      MATCH
        (user :User { id: $userId })-[:PASSED]->(originator :Subject)<-[:NEEDS]-(:Prerequisite)<-[:SATISFIES*]-(:Prerequisite)<-[:HAS]-(subject :Subject)
      WHERE NOT exists((user)-[:PASSED]->(subject))
      RETURN DISTINCT subject.code as code
      `,
      { userId }
    );

    const codes = recommended.records.map((record) => record.get('code'));

    const result = await ctx.neo4jSession.run<{ code: string, p: Path<number> }>(
      `
      UNWIND $codes as s
      MATCH
        p = (materia:Subject { code: s })-[:HAS]->(:Prerequisite)-[:SATISFIES|CANT*0..]->(:Prerequisite)-[:NEEDS|NEEDS_GROUP_CREDITS|NEEDS_CREDITS]->(:Subject|Group|Prerequisite)
      return materia.code as code, p
      `,
      { codes }
    );

    const credits = (await ctx.neo4jSession.run<{ credits: number, code: string }>(
      `
      MATCH (u :User { id: $userId })-[:PASSED]->(subject :Subject)-[:BELONGS]->(group :Group)
      RETURN count(group) as count, sum(subject.credits) as credits, group.code as code
      UNION
      MATCH (u :User { id: $userId })-[:PASSED]->(subject :Subject)
      RETURN 'total' as count, sum(subject.credits) as credits, 'total' as code
      `,
      { userId }
    )).records.map((record) => ({ credits: record.get('credits'), code: record.get('code') })).reduce((acc, group) => {
      acc[group.code] = group.credits;
      return acc;
    }, {} as Record<string, number>);

    const subjectsAndPrerequisites = result.records.map((record) => ({ path: record.get('p'), subject: record.get('code') }));
    const prerequisitesPaths = subjectsAndPrerequisites.reduce((acc, { path, subject }) => {
      if (acc[subject] == undefined) {
        acc[subject] = [path];
      } else {
        acc[subject]!.push(path)
      }

      return acc;
    }, {} as Record<string, Path<number>[]>);

    type Edge = {
      label: 'SATISFIES' | 'NEEDS' | 'CANT' | 'NEEDS_GROUP_CREDITS' | 'NEEDS_CREDITS',
      properties: { type: 'one_of' | 'all' | 'exam' | 'course' | undefined, credits: number | undefined },
      node: PreNode
    };
    
    type PreNode = {
      id: number,
      properties: Record<string, string | undefined>,
      edges: Record<string, Edge>
    }

    type PassedSubjects = { code: string,  type: 'exam' | 'course' | null };

    const passedSubjects = await ctx.neo4jSession.run<PassedSubjects>(
      `
      MATCH
        (u: User { id: $userId })-[passed :PASSED]->(s :Subject)
      RETURN s.code as code, passed.type as type
      `,
      { userId }
    );

    const subjects = Object.keys(prerequisitesPaths).filter((key) => {
      let baseNode: PreNode | undefined = undefined;
      let currentNode: PreNode | undefined = undefined;

      const paths = prerequisitesPaths[key]!;
      paths.forEach((path) => {
        if (baseNode === undefined) {
          baseNode = {
            id: path.start.identity,
            properties: path.start.properties,
            edges: {}
          }
        }
        currentNode = baseNode;

        const segments = path.segments;

        segments.forEach((segment) => {
          const currentRelationshipId = segment.relationship.identity.toString();
          if (currentNode!.edges[currentRelationshipId] === undefined) {
            currentNode!.edges[currentRelationshipId] = {
              label: segment.relationship.type as Edge["label"],
              properties: segment.relationship.properties as Edge["properties"],
              node: {
                id: segment.end.identity,
                properties: segment.end.properties,
                edges: {},
              }
            }
          }

          currentNode = currentNode!.edges[currentRelationshipId]?.node;
        });
      });

      const evaluatePrerequisites = (
        node: PreNode,
        passedSubjects: PassedSubjects[],
        evaluationType: 'one_of' | 'all' | 'cant_have' | 'exam' | 'course'
      ): boolean => {
        const result = Object.keys(node.edges).map((edgeId) => {
          const edge = node.edges[edgeId]!;
          if (['SATISFIES', 'HAS'].includes(edge.label)) {
            return evaluatePrerequisites(edge.node, passedSubjects, edge.properties.type!);
          } else if ('CANT' === edge.label) {
            return !evaluatePrerequisites(edge.node, passedSubjects, 'all');
          } else if ('NEEDS_GROUP_CREDITS' === edge.label) {
            const groupCredits = credits[edge.node.properties.code!];
            const result = edge.properties.credits! <= (groupCredits ?? 0);
            return result;
          } else if ('NEEDS_CREDITS' === edge.label) {
            return edge.properties.credits! <= (credits['total'] ?? 0);
          } else {
            // NEEDS
            const passedSubject = passedSubjects.find((passeSubjects) =>
              // If the needs egde has type all it automatically requires the passed edge to be of type exam
              passeSubjects.code === edge.node.properties.code! && 
              (passeSubjects.type === 'exam' || passeSubjects.type === edge.properties.type) 
            );
            return passedSubject !== undefined;
          }
        });

        switch(evaluationType) {
        case 'all':
          return result.every((el) => el);
        case 'one_of':
          return result.some((el) => el);
        default:
          return false;
        }
      }

      const result = evaluatePrerequisites(
        baseNode!,
        passedSubjects.records.map((record) => ({ code: record.get("code"), type: record.get("type")})),
        'all'
      );

      return result;
    });

    return subjects.map((subjectCode) => prerequisitesPaths[subjectCode]![0]?.start.properties);
  }),
});
