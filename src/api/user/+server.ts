import { Hono } from "hono";
import { getContext } from "hono/context-storage";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";

export const router = new Hono<{ Bindings: Env }>();

router.get("/", async (c) => {
  const user = getContext<Env>().var.user;
  return c.json(user);
});

/**
 * @description users can update their name and color using this endpoint
 */
router.put("/", async (c) => {
  const { db } = getContext<Env>().var.dbClient;
  const user = getContext<Env>().var.user;

  const { name, color } = await c.req.json();
  if (!name && !color) {
    return c.text("No data to update", 400);
  }

  let updatedUser: (typeof user)[] | null = null;
  if (name && color) {
    updatedUser = await db.update(users).set({ name, color }).where(eq(users.id, user.id)).returning();
  } else if (name) {
    updatedUser = await db.update(users).set({ name }).where(eq(users.id, user.id)).returning();
  } else if (color) {
    updatedUser = await db.update(users).set({ color }).where(eq(users.id, user.id)).returning();
  }

  if (!updatedUser) return c.text("No data to update", 400);

  return c.json(updatedUser[0]);
});
