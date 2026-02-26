const db = require("../models/database");

exports.getAllFacilities = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM facilities ORDER BY name");
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getFacilityById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM facilities WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: `Facility ${id} not found.` });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createFacility = async (req, res) => {
  try {
    const { name, location, capacity, description } = req.body;
    if (!name || !location || !capacity) {
      return res
        .status(400)
        .json({
          success: false,
          error: "name, location, and capacity are required.",
        });
    }
    const result = await db.query(
      "INSERT INTO facilities (name, location, capacity, description) VALUES ($1, $2, $3, $4) RETURNING *",
      [
        name.trim(),
        location.trim(),
        Number(capacity),
        description?.trim() || null,
      ],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateFacility = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query("SELECT * FROM facilities WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: `Facility ${id} not found.` });
    }
    const e = existing.rows[0];
    const { name, location, capacity, description } = req.body;
    const updated = {
      name: name?.trim() ?? e.name,
      location: location?.trim() ?? e.location,
      capacity: capacity != null ? Number(capacity) : e.capacity,
      description: description?.trim() ?? e.description,
    };
    const result = await db.query(
      "UPDATE facilities SET name=$1, location=$2, capacity=$3, description=$4 WHERE id=$5 RETURNING *",
      [
        updated.name,
        updated.location,
        updated.capacity,
        updated.description,
        id,
      ],
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteFacility = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query("SELECT * FROM facilities WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: `Facility ${id} not found.` });
    }
    await db.query("DELETE FROM facilities WHERE id = $1", [id]);
    res.json({
      success: true,
      message: `Facility "${existing.rows[0].name}" deleted.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
