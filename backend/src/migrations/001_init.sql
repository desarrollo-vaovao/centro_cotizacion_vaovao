CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS executives (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_lines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  correlativo_general TEXT NOT NULL,
  correlativo_cliente TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  validez_dias INTEGER NOT NULL DEFAULT 30,
  client_id INTEGER REFERENCES clients(id),
  cliente_nombre_libre TEXT,
  pais TEXT NOT NULL,
  linea_servicio TEXT NOT NULL,
  executive_id INTEGER REFERENCES executives(id),
  proyecto TEXT NOT NULL,
  descripcion TEXT,
  detalle JSONB NOT NULL DEFAULT '[]',
  monto NUMERIC(12,2) NOT NULL,
  impuestos NUMERIC(12,2) NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'GTQ',
  estatus TEXT NOT NULL DEFAULT 'Enviada',
  fecha_aprobacion DATE,
  fecha_cierre_proyecto DATE,
  observaciones TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  previous_version_id INTEGER REFERENCES quotations(id),
  superseded_by INTEGER REFERENCES quotations(id),
  root_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotations_client ON quotations(client_id);
CREATE INDEX IF NOT EXISTS idx_quotations_executive ON quotations(executive_id);
CREATE INDEX IF NOT EXISTS idx_quotations_estatus ON quotations(estatus);
CREATE INDEX IF NOT EXISTS idx_quotations_fecha ON quotations(fecha);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  general_seq INTEGER NOT NULL DEFAULT 0,
  logo_agencia TEXT,
  logo_velarc TEXT,
  CONSTRAINT settings_single_row CHECK (id = 1)
);
INSERT INTO settings (id, general_seq) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
