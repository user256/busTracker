-- Replace expression unique index that races during active flip in one transaction.
DROP INDEX IF EXISTS feed_versions_one_active;

-- Partial unique on a constant enforces a single active row.
CREATE UNIQUE INDEX feed_versions_one_active
  ON feed_versions ((1))
  WHERE status = 'active';
