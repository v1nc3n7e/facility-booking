const db = require("../models/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "bookspace_secret_key";

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({
          success: false,
          error: "name, email, and password are required.",
        });
    }

    // Check if email already exists
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ success: false, error: "Email already registered." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        hashedPassword,
        role || "student",
      ],
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "email and password are required." });
    }

    // Find user
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email.trim().toLowerCase(),
    ]);
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password." });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid email or password." });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, email, role FROM users WHERE id = $1",
      [req.user.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
