import { Context, Next } from "hono";
import getDb from "../db";

export const dbMiddleware = async (c: Context<Env>, next: Next) => {
  const dbClient = getDb(c.env.POSTGRES_URL);
  c.set("dbClient", dbClient);
  await next();
};
