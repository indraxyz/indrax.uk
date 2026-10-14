-- Shared by all Worker locations. Conditional UPSERTs reserve quota before forwarding.
-- Keep month rows: deleting/resetting the current month removes the spending guard.
CREATE TABLE IF NOT EXISTS analytics_quota (
  month TEXT NOT NULL,
  category TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (units >= 0),
  bytes INTEGER NOT NULL CHECK (bytes >= 0),
  PRIMARY KEY (month, category)
);
