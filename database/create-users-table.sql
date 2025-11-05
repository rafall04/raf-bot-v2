-- Create users table in SQLite database
-- This is required for the system to work properly

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    password TEXT,
    phone_number TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    subscription TEXT,
    device_id TEXT,
    status TEXT DEFAULT 'active',
    paid INTEGER DEFAULT 0,
    send_invoice INTEGER DEFAULT 1,
    is_corporate INTEGER DEFAULT 0,
    pppoe_username TEXT,
    pppoe_password TEXT,
    connected_odp_id INTEGER,
    bulk TEXT, -- JSON array stored as text
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_pppoe ON users(pppoe_username);

-- Insert sample data (optional - remove if not needed)
INSERT INTO users (name, username, phone_number, address, subscription, device_id, status, paid)
VALUES 
    ('Test User 1', 'testuser1', '6285233047094', 'Jl. Test No. 1', 'Basic', 'TEST001', 'active', 1),
    ('Test User 2', 'testuser2', '6285233047095', 'Jl. Test No. 2', 'Premium', 'TEST002', 'active', 0);
