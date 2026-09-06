@AGENTS.md

# Project Context

Das ist eine App zur einfachen Verwaltung von Rechnungen für kleine Unternehmen.

# Tech Stack

- Frontend: React (Vite/Next.js)
- Database ORM: Drizzle ORM
- Database: SQLite
- Language: TypeScript (Strict Mode)

# Architecture

- `/src/components`: Wiederverwendbare React-UI-Komponenten.
- `/src/hooks`: Eigene Custom Hooks für wiederkehrende Logik.
- `/src/db/schema.ts`: Drizzle Tabellen- und Relationsdefinitionen.
- `/src/db/queries`: Ausgelagerte Datenbankabfragen (Trennung von UI und DB-Logik).
- `/drizzle`: Speicherort für generierte Drizzle-Migrationen.

# Coding Guidelines

## React & Frontend

- Verwende ausschließlich funktionale Komponenten und Hooks (keine Class Components).
- Nutze TypeScript konsequent für Props und State. Kein `any`.
- Halte Komponenten klein und lagere komplexe Logik in Custom Hooks aus.
- [Falls du Tailwind nutzt: Verwende Tailwind CSS für das Styling, keine separaten CSS-Dateien.]

## Drizzle ORM & Datenbank

- Verwende Drizzle's typsicheres SQL-ähnliches API (z. B. `eq()`, `and()`) anstelle von rohen SQL-Strings.
- Definiere das Datenbankschema strikt in TypeScript und exportiere die Typen (z. B. `typeof table.$inferSelect`), damit das Frontend diese direkt nutzen kann.
- Mische keine Datenbankabfragen direkt in die React-Komponenten. Erstelle stattdessen saubere Service-Funktionen oder nutze Tools wie React Query für das Data-Fetching.
- Nutze Drizzle Relational Queries (`db.query.tableName.findMany()`) für komplexe Joins, um den Code lesbar zu halten, es sei denn, reine Performance erfordert den Query Builder.