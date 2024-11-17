import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { getContext } from "hono/context-storage";
import { getCurrentRoomState, hashUUIDtoSimpleInteger } from "../../../utils/db.functions";
// import { getDBListener } from "../../../db/db-listener";

async function waitForAnswerSdp(dbClient: Env["Variables"]["dbClient"], userId: string, roomId: string, sdp: string) {
  return new Promise<string>((resolve) => {
    const { db, postgresClient } = dbClient;
    // listen for answer sdp from host
    console.log(`LISTEN sdp_${hashUUIDtoSimpleInteger(userId)}`);
    postgresClient.listen(`sdp_${hashUUIDtoSimpleInteger(userId)}`, (payload) => {
      console.log(`UNLISTEN sdp_${hashUUIDtoSimpleInteger(userId)}`);
      db.execute(sql`UNLISTEN sdp_${hashUUIDtoSimpleInteger(userId)}`);
      resolve(payload);
    });
    // notify host to send answer sdp
    postgresClient.notify(`room_${hashUUIDtoSimpleInteger(roomId)}`, JSON.stringify({ id: userId, sdp }));
  });
}

export const router = new Hono<{ Bindings: Env }>();

router.get("/", async (c) => {
  const { db } = getContext<Env>().var.dbClient;
  const rows = await db.execute(
    sql`SELECT rooms.id AS "roomId",
        MAX(CASE WHEN users.is_host THEN users.name END) AS "roomName",
        COUNT(users.id) AS "playersCount"
      FROM rooms
      INNER JOIN users ON users.room_id = rooms.id
      GROUP BY rooms.id;`
  );

  return c.json(rows);
});

/**
 * @description join a room by roomId
 */
router.post("/", async (c) => {
  const dbClient = getContext<Env>().var.dbClient;
  const user = getContext<Env>().var.user;
  const { roomId, sdp } = await c.req.json();
  if (!roomId || !sdp) {
    return c.text("Bad Request", 400);
  }
  try {
    c.req.raw.signal.onabort = () => {
      throw new Error("Request aborted");
    };

    const answerSdp = await waitForAnswerSdp(dbClient, user.id, roomId, sdp);
    const roomState = await getCurrentRoomState(roomId, dbClient.db);
    roomState.users = roomState.users.map((user) => {
      if (user.is_host) {
        // @ts-expect-error sdp is not defined in user yet
        user.sdp = JSON.parse(answerSdp);
      }
      return user;
    });
    return c.json(roomState);
  } catch (error) {
    return c.text("Internal Server Error", 500);
  }
});
