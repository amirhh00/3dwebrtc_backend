import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { sql } from "drizzle-orm";
import { getContext } from "hono/context-storage";

type UserFromDb = Env["Variables"]["user"];

export const authMiddleware = async (c: Context<Env>, next: Next) => {
  const userId = getCookie(c, "userId");
  let user: UserFromDb | null = null;
  const { db } = getContext<Env>().var.dbClient;
  if (!userId) {
    user = await insertUser(db, c);
  } else {
    // get user from db
    const userFromDb = await db.execute<UserFromDb>(sql`SELECT * FROM users WHERE id=${userId}`);
    user = userFromDb[0];
    if (!user) {
      user = await insertUser(db, c);
    }
  }
  c.set("user", user);
  await next();
};

async function insertUser(db: Env["Variables"]["dbClient"]["db"], c: Context<Env>) {
  const user = (
    await db.execute<UserFromDb>(sql`
      INSERT INTO users (name, color) VALUES ('Guest', '#000000')
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `)
  )[0];
  setCookie(c, "userId", user.id, { httpOnly: true, sameSite: "None", secure: true, expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 400) });
  return user;
}
