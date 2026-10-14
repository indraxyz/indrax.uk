-- Required by the local Neon HTTP proxy's mock control plane.
-- These endpoints correspond to the loopback hosts accepted by lib/db/index.server.ts.
CREATE SCHEMA IF NOT EXISTS neon_control_plane;
CREATE TABLE IF NOT EXISTS neon_control_plane.endpoints (
  endpoint_id VARCHAR(255) PRIMARY KEY,
  allowed_ips VARCHAR(255)
);
INSERT INTO neon_control_plane.endpoints (endpoint_id, allowed_ips)
VALUES ('127', '0.0.0.0/0'), ('localhost', '0.0.0.0/0')
ON CONFLICT (endpoint_id) DO NOTHING;
