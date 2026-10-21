CREATE OR REPLACE FUNCTION easybill_assign_id() RETURNS trigger AS $$
BEGIN
  IF NEW.id IS NULL THEN
    NEW.id := nextval(pg_get_serial_sequence(format('%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME), 'id'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS planned_routes (
  id BIGSERIAL PRIMARY KEY,
  route_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  company_name TEXT DEFAULT '',
  company_id TEXT DEFAULT '',
  zip TEXT NOT NULL,
  city TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  country TEXT DEFAULT '',
  phone TEXT NOT NULL,
  fax TEXT DEFAULT '',
  website TEXT DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT,
  email TEXT DEFAULT '',
  has_sconto BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Object" (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "planned_route_Id" BIGINT REFERENCES planned_routes(id),
  sort_order BIGINT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT,
  user_id BIGINT NOT NULL REFERENCES clients(id),
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  zip TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DOUBLE PRECISION NOT NULL,
  price_tag TEXT NOT NULL,
  product_unit TEXT DEFAULT 'lfm',
  product_count DOUBLE PRECISION DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customer_products (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES clients(id),
  product_id BIGINT REFERENCES products(id),
  product_name TEXT NOT NULL DEFAULT '',
  custom_price DOUBLE PRECISION NOT NULL,
  custom_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  sort_order BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS object_products (
  id BIGSERIAL PRIMARY KEY,
  object_id BIGINT NOT NULL REFERENCES "Object"(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  custom_price DOUBLE PRECISION NOT NULL,
  custom_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  sort_order BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Offen',
  vat_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  gross_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  cash_discount_enabled BIGINT NOT NULL DEFAULT 0,
  cash_discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  payable_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  issue_date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  user_id BIGINT NOT NULL REFERENCES clients(id),
  object_id BIGINT NOT NULL REFERENCES "Object"(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT,
  invoice_path TEXT NOT NULL,
  total DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  product_id BIGINT REFERENCES products(id),
  product_name TEXT NOT NULL DEFAULT '',
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  price_at_time DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  street TEXT DEFAULT '',
  zip TEXT DEFAULT '',
  city TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  tax_number TEXT DEFAULT '',
  vat_id TEXT DEFAULT '',
  bank TEXT DEFAULT '',
  iban TEXT DEFAULT '',
  bic TEXT DEFAULT '',
  backup_path TEXT DEFAULT '',
  invoice_path TEXT DEFAULT '',
  logo_path TEXT DEFAULT '',
  next_invoice_number BIGINT NOT NULL DEFAULT 1
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['planned_routes','clients','Object','products','customer_products','object_products','invoices','invoice_items','settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS easybill_assign_id_trg ON %I', t);
    EXECUTE format('CREATE TRIGGER easybill_assign_id_trg BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION easybill_assign_id()', t);
  END LOOP;
END
$$;
