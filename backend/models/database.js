require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS facilities (
      id          SERIAL PRIMARY KEY,
      name        TEXT    NOT NULL,
      location    TEXT    NOT NULL,
      capacity    INTEGER NOT NULL CHECK(capacity > 0),
      description TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT,
      role       TEXT    NOT NULL CHECK(role IN ('admin','staff','student')) DEFAULT 'student',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id          SERIAL PRIMARY KEY,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
      date        DATE    NOT NULL,
      start_time  TIME    NOT NULL,
      end_time    TIME    NOT NULL,
      status      TEXT    NOT NULL CHECK(status IN ('confirmed','pending','cancelled')) DEFAULT 'confirmed',
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT NOW(),
      CHECK (start_time < end_time)
    );
  `);

  // Add password column if it doesn't exist
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
  `);
};

const seedData = async () => {
  const { rows } = await pool.query("SELECT COUNT(*) as c FROM facilities");
  if (parseInt(rows[0].c) > 0) return;

  await pool.query(`
    INSERT INTO facilities (name, location, capacity, description) VALUES
    ('Main Conference Room', 'Building A, Floor 2', 20, 'Large boardroom with projector and video conferencing.'),
    ('Innovation Lab', 'Building B, Floor 1', 12, 'Creative space with movable furniture and 4K displays.'),
    ('Lecture Hall 101', 'Academic Block, Floor 1', 150, 'Tiered seating hall with AV system.'),
    ('Rooftop Lounge', 'Main Building, Roof', 40, 'Open-air space for social events.'),
    ('Recording Studio', 'Media Centre, Floor 2', 6, 'Soundproofed studio with professional audio.');
  `);

  const bcrypt = require("bcrypt");
  const hashedPassword = await bcrypt.hash("admin123", 10);

  await pool.query(
    `
    INSERT INTO users (name, email, password, role) VALUES
    ('Alice Johnson', 'alice@university.edu', $1, 'admin'),
    ('Bob Chen',      'bob@university.edu',   $1, 'staff'),
    ('Carol Diaz',    'carol@university.edu', $1, 'student'),
    ('David Kim',     'david@university.edu', $1, 'student'),
    ('Eve Osei',      'eve@university.edu',   $1, 'staff');
  `,
    [hashedPassword],
  );

  await pool.query(`
    INSERT INTO bookings (facility_id, user_id, date, start_time, end_time, status, notes) VALUES
    (1, 1, CURRENT_DATE,     '09:00', '10:00', 'confirmed', 'Weekly leadership sync'),
    (2, 2, CURRENT_DATE,     '13:00', '15:00', 'confirmed', 'Design sprint session'),
    (3, 3, CURRENT_DATE + 1, '10:00', '11:30', 'pending',   'Guest lecture'),
    (1, 4, CURRENT_DATE + 1, '14:00', '15:00', 'confirmed', 'Project review'),
    (5, 5, CURRENT_DATE,     '16:00', '18:00', 'confirmed', 'Podcast recording');
  `);

  console.log("✅  Database seeded with sample data.");
};

const init = async () => {
  try {
    await createTables();
    await seedData();
    console.log("✅  PostgreSQL connected and ready.");
  } catch (err) {
    console.error("❌  Database error:", err.message);
    process.exit(1);
  }
};

init();

module.exports = pool;
