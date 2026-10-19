import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * `prisma generate` only reads `schema.prisma` — it never opens a connection, so
 * it must not require DATABASE_URL. A fresh clone or a CI build would otherwise
 * fail before it generated the client, and every `import … from
 * "@prisma/client"` downstream would break with a confusing "no exported member"
 * error instead of the one line that actually matters.
 *
 * Commands that do connect — `migrate`, `db seed` — still need the variable;
 * Prisma reports that itself, at the point of use.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});