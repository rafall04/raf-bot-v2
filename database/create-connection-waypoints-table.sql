-- Create connection_waypoints table untuk menyimpan waypoints manual
-- Waypoints digunakan untuk membuat garis koneksi yang mengikuti jalur yang ditentukan manual

CREATE TABLE IF NOT EXISTS connection_waypoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_type TEXT NOT NULL, -- 'odc-odp' atau 'customer-odp'
    source_id TEXT NOT NULL, -- ID ODC atau Customer
    target_id TEXT NOT NULL, -- ID ODP
    waypoints TEXT NOT NULL, -- JSON array of [lat, lng] coordinates
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    UNIQUE(connection_type, source_id, target_id)
);

-- Create indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_waypoints_connection ON connection_waypoints(connection_type, source_id, target_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_source ON connection_waypoints(source_id);
CREATE INDEX IF NOT EXISTS idx_waypoints_target ON connection_waypoints(target_id);

