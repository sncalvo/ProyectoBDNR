import neo4j from 'neo4j-driver'
import type { Driver } from 'neo4j-driver'
import { env } from "~/env.mjs";

let driver: Driver

const defaultOptions = {
  uri: env.NEO4J_URI,
  username: env.NEO4J_USER,
  password: env.NEO4J_PASSWORD,
}

// TODO: We need to figure out how to close the driver when the server is stopped.
// This https://nextjs.org/docs/pages/building-your-application/deploying#manual-graceful-shutdowns
// might be a good place to start, but I'm not sure if that would work on vercel hosted environments.
// Also, maybe it's not important since they haven't done it on their official example:
// https://github.com/vercel/next.js/tree/canary/examples/with-apollo-neo4j-graphql
export default function getDriver() {
  const { uri, username, password } = defaultOptions
  if (!driver) {
    // See https://github.com/neo4j/neo4j-javascript-driver#numbers-and-the-integer-type
    // for more info on the { disableLosslessIntegers: true } option
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password), { disableLosslessIntegers: true })
  }

  return driver
}