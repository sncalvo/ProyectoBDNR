import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Node, Integer } from 'neo4j-driver'

type Subject = Node<Integer, {
  code: string,
  name: string,
  credits: number
}>

export const subjectsRouter = createTRPCRouter({
  all: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.neo4jSession.run<{ n: Subject }>('MATCH (n: Materia) RETURN n LIMIT 25');

      return result.records.map((record) => record.get('n').properties);
    }),
});
