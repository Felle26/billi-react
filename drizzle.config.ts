import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle", // Hier landen später die generierten SQL-Migrationen
  dialect: "sqlite",
  dbCredentials: {
    url: "sqlite.db", // Der Name deiner lokalen Datenbank-Datei
  },
});
