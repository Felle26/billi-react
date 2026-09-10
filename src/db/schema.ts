import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  company_name: text("company_name").default(""),
  company_id: text("company_id").default(""),
  zip: text("zip").notNull(),
  city: text("city").notNull(),
  street: text("street").notNull(),
  number: text("number").notNull(),
  country: text("country").default(""),
  phone: text("phone").notNull(),
  fax: text("fax").default(""),
  website: text("website").default(""),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  deleted_at: integer("deleted_at", { mode: "timestamp" }),
  email: text("email").default(""),
  has_sconto: integer("has_sconto").default(0),
});

export const usersRelations = relations(users, ({ many }) => ({
  objects: many(objects), // Ein Kunde hat viele Objekte
  invoices: many(invoices), // Ein Kunde hat viele Rechnungen
}));

export const objects = sqliteTable("Object", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  deleted_at: integer("deleted_at", { mode: "timestamp" }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id),
  street: text("street").notNull(),
  number: text("number").notNull(),
  zip: text("zip").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
});

export const objectsRelations = relations(objects, ({ one, many }) => ({
  user: one(users, {
    fields: [objects.user_id],
    references: [users.id],
  }), // Ein Objekt gehört zu genau einem Kunden
  invoices: many(invoices), // Für ein Objekt kann es viele Rechnungen geben
}));

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  price_tag: text("price_tag").notNull(),
});

export const productsRelations = relations(products, ({ many }) => ({
  invoiceItems: many(invoiceItems), // Ein Produkt kann auf vielen Rechnungen stehen
}));

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: integer("user_id")
    .notNull()
    .references(() => users.id),
  object_id: integer("object_id")
    .notNull()
    .references(() => objects.id),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  deleted_at: integer("deleted_at", { mode: "timestamp" }),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.user_id],
    references: [users.id],
  }), // Die Rechnung gehört zu einem Kunden
  object: one(objects, {
    fields: [invoices.object_id],
    references: [objects.id],
  }), // Die Rechnung gehört zu einem Objekt
  items: many(invoiceItems), // Die Rechnung hat viele Positionen
}));

export const invoiceItems = sqliteTable("invoice_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoice_id: integer("invoice_id")
    .notNull()
    .references(() => invoices.id),
  product_id: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: real("quantity").notNull().default(1),
  // Friert den Preis ein, falls sich der Produktpreis in der products-Tabelle später ändert
  price_at_time: real("price_at_time").notNull(),
});

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoice_id],
    references: [invoices.id],
  }), // Die Position gehört zu genau einer Rechnung
  product: one(products, {
    fields: [invoiceItems.product_id],
    references: [products.id],
  }), // Die Position referenziert ein Produkt
}));