import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { getContext } from "hono/context-storage";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import { getCurrentRoomState, hashUUIDtoSimpleInteger } from "../../../utils/db.functions";

export const router = new Hono<{ Bindings: Env }>();

/**
 * @description create a new room using server sent events (SSE) and return the roomId while listening for the room's changes (notifiacations)
 */
router.get(
  "/",
  upgradeWebSocket(async (c) => {
    const user = getContext<Env>().var.user;
    const { db, postgresClient } = getContext<Env>().var.dbClient;
    if (user.is_host) {
      // remove the user from the room if it is already a host and delete the room
      await db.execute(sql`
      WITH updated_host AS (
        UPDATE users
        SET is_host = false
        WHERE id=${user.id}
      ),
      deleted_room AS (
        DELETE FROM rooms
        WHERE id=${user.room_id}
      )
      SELECT 1;
    `);
    }

    const result = await db.execute(sql`
      WITH new_room AS (
        INSERT INTO rooms DEFAULT VALUES
        RETURNING *
      )
      UPDATE users
      SET room_id = new_room.id, is_host = true
      FROM new_room
      WHERE users.id = ${user.id}
      RETURNING new_room.*;
    `);

    const room = result[0] as { id: string };
    let isRoomSent = false;
    return {
      async onMessage(event, ws) {
        if (isRoomSent) {
          console.log("Connection already established");
          ws.close();
        }
        try {
          const message = JSON.parse(event.data);
          if (message.type === "roomState") {
            isRoomSent = true;
            ws.send(
              JSON.stringify({
                type: "roomState",
                content: await getCurrentRoomState(room.id, db),
              })
            );
            console.log(`LISTEN room_${hashUUIDtoSimpleInteger(room.id)}`);
            postgresClient.listen(`room_${hashUUIDtoSimpleInteger(room.id)}`, async (payload) => {
              const newUser = JSON.parse(payload);
              ws.send(
                JSON.stringify({
                  type: "newUser",
                  content: await getCurrentRoomState(room.id, db, { newUser }),
                })
              );
            });
          }
        } catch (error) {
          await dbCleanup(user.id, room.id, db, isRoomSent);
          ws.close();
        }
      },
      onClose: async (ev, ws) => {
        // send close event to the client
        await dbCleanup(user.id, room.id, db, isRoomSent);
        ws.close();
      },
    };
  })
);

async function dbCleanup(userId: string, roomId: string, db: Env["Variables"]["dbClient"]["db"], isListener = false) {
  if (isListener) {
    db.execute(sql`UNLISTEN room_${hashUUIDtoSimpleInteger(roomId)}`);
  }
  await db.execute(sql`
            WITH updated_host AS (
              UPDATE users
              SET is_host = false
              WHERE id=${userId} OR room_id=${roomId}
            ),
            deleted_room AS (
              DELETE FROM rooms
              WHERE id=${roomId}
            )
            SELECT 1;
          `);
}

/**
 * @description send answer sdp to the player from host
 */
router.post("/", async (c) => {
  const user = getContext<Env>().var.user;

  if (!user.is_host) {
    return c.text("Unauthorized", 401);
  }

  const { sdp, playerId } = await c.req.json();
  if (!sdp || !playerId) {
    return c.text("Bad Request", 400);
  }

  const { db } = getContext<Env>().var.dbClient;
  // console.log(`notify sdp_${hashUUIDtoSimpleInteger(playerId)}`, sdp);
  // postgresClient.notify(`sdp_${hashUUIDtoSimpleInteger(playerId)}`, sdp);
  const notif = await db.execute(`NOTIFY sdp_${hashUUIDtoSimpleInteger(playerId)}, '${JSON.stringify(sdp)}'`);
  console.log("notify", notif);
  return c.text("Answer sent to player", 200);
});

/**
 * @description add player to the room in the database
 */
router.put("/", async (c) => {
  const user = getContext<Env>().var.user;

  if (!user.is_host) {
    return c.text("Unauthorized", 401);
  }

  const { playerId } = await c.req.json();
  if (!playerId) {
    return c.text("Bad Request", 400);
  }

  const { db } = getContext<Env>().var.dbClient;
  try {
    const result = await db.execute(sql`
      UPDATE users
      SET room_id=${user.room_id}
      WHERE id=${playerId} AND room_id IS NULL
      RETURNING *;
    `);

    return c.json(result[0]);
  } catch (error) {
    return c.text("Bad Request", 400);
  }
});

/**
 * @description remove player from the room in the database
 */
router.delete("/", async (c) => {
  const user = getContext<Env>().var.user;

  if (!user.is_host) {
    return c.text("Unauthorized", 401);
  }

  const { playerId } = await c.req.json();
  if (!playerId) {
    return c.text("Bad Request", 400);
  }

  const { db } = getContext<Env>().var.dbClient;
  const result = await db.execute(sql`
    UPDATE users
    SET room_id=NULL
    WHERE id=${playerId} AND room_id=${user.room_id}
    RETURNING *;
  `);

  return c.json(result[0]);
});
