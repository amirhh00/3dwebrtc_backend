interface Env {
  Bindings: {
    POSTGRES_URL: string;
  };
  Variables: {
    user: typeof import("./src/db/schema").users.$inferSelect;
    dbClient: ReturnType<typeof import("./src/db").default>;
  };
}
