import { Hono } from "hono";
import { authMiddleware } from "./middlewares/auth";
import { contextStorage } from "hono/context-storage";
import { dbMiddleware } from "./middlewares/db.middleware";
import { router as hostRouter } from "./api/game/host/+server";
import { router as roomsRouter } from "./api/game/rooms/+server";
import { router as userRouter } from "./api/user/+server";

const app = new Hono<{ Bindings: Env }>();
// cors
app.use(async (c, next) => {
  c.header("Access-Control-Allow-Origin", c.req.header("Origin") || "*");
  c.header("Access-Control-Allow-Credentials", "true");
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": c.req.header("Origin") || "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  await next();
});
app.use(dbMiddleware);
app.use(contextStorage());
app.use(authMiddleware);

app.route("/api/game/host", hostRouter);
app.route("/api/game/rooms", roomsRouter);
app.route("/api/user", userRouter);

export default app;
