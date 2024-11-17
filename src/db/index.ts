import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import postgres from "postgres";

function getDb(POSTGRES_URL: string) {
  const postgresClient = postgres(POSTGRES_URL);
  const db = drizzle(postgresClient, { schema });
  return { db, postgresClient };
}

export default getDb;
