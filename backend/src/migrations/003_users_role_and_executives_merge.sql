ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'executive';

DROP TABLE IF EXISTS executives CASCADE;

UPDATE quotations SET executive_id = NULL
WHERE executive_id IS NOT NULL
  AND executive_id NOT IN (SELECT id FROM users);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_executive_id_fkey'
  ) THEN
    ALTER TABLE quotations
      ADD CONSTRAINT quotations_executive_id_fkey FOREIGN KEY (executive_id) REFERENCES users(id);
  END IF;
END $$;
