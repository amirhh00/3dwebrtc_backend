import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",

  dbCredentials: {
    // @ts-expect-error - This file is not going to be run in the cloudflare worker
    url: process.env.POSTGRES_URL,
  },

  verbose: true,
  strict: true,
  dialect: "postgresql",
});
