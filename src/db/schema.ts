import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  zip: text("zip").notNull(),
  city: text("city").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  country: text("country").notNull(),
  phone: text("phone").notNull(),
  fax: text("fax").notNull(),
  website: text("website").default(""),
  created_at: integer("created_at", {mode: "timestamp"}).notNull(),
  updated_at: integer("updated_at", {mode: "timestamp"}).notNull(),
  deleted_at: integer("deleted_at", {mode: "timestamp"}),
  email: text("email").default(""),
  has_sconto: integer("has_sconto").default(0),
});

export const objects = sqliteTable("Object", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  created_at: integer("created_at", {mode: "timestamp"}).notNull().$defaultFn(() => new Date()),
  updated_at: integer("updated_at", {mode: "timestamp"}).notNull().$defaultFn(() => new Date()),
  deleted_at: integer("deleted_at", {mode: "timestamp"}),
  user_id: integer("user_id").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  zip: text("zip").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  price_tag: text("price_tag").notNull(), 
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id").notNull(),
  object_id: integer("object_id").notNull(),
  created_at: integer("created_at", {mode: "timestamp"}).notNull(),
  updated_at: integer("updated_at", {mode: "timestamp"}).notNull(),
  deleted_at: integer("deleted_at", {mode: "timestamp"}),
});