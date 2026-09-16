ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'executive';

DROP TABLE IF EXISTS executives CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_executive_id_fkey'
  ) THEN
    ALTER TABLE quotations
      ADD CONSTRAINT quotations_executive_id_fkey FOREIGN KEY (executive_id) REFERENCES users(id);
  END IF;
END $$;
