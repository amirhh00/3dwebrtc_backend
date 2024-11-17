import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { sql } from "drizzle-orm";
import { getContext } from "hono/context-storage";

export const authMiddleware = async (c: Context<Env>, next: Next) => {
  const userId = getCookie(c, "userId");
  type UserFromDb = Env["Variables"]["user"];
  let user: UserFromDb | null = null;
  const { db } = getContext<Env>().var.dbClient;
  if (!userId) {
    user = (
      await db.execute<UserFromDb>(sql`
      INSERT INTO users (name, color) VALUES ('Guest', '#000000')
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `)
    )[0];
    setCookie(c, "userId", user.id, { httpOnly: true, sameSite: "None", secure: true, expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 400) });
  } else {
    // get user from db
    const userFromDb = await db.execute<UserFromDb>(sql`SELECT * FROM users WHERE id=${userId}`);
    user = userFromDb[0];
    if (!user) {
      // reload page to create a new user
      setCookie(c, "userId", "", { expires: new Date(0), httpOnly: true, sameSite: "None", secure: true });
      return c.redirect("/");
    }
  }
  c.set("user", user);
  await next();
};
