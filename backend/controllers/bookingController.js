const db = require("../models/database");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateTimeRange(date, start_time, end_time) {
  if (!DATE_RE.test(date)) return "date must be YYYY-MM-DD.";
  if (!TIME_RE.test(start_time)) return "start_time must be HH:MM (24h).";
  if (!TIME_RE.test(end_time)) return "end_time must be HH:MM (24h).";
  if (start_time >= end_time) return "start_time must be before end_time.";
  const validMinutes = ["00", "30"];
  if (!validMinutes.includes(start_time.split(":")[1]))
    return "start_time must be on a 30-minute interval (e.g. 09:00 or 09:30).";
  if (!validMinutes.includes(end_time.split(":")[1]))
    return "end_time must be on a 30-minute interval (e.g. 09:00 or 09:30).";
  return null;
}
async function hasConflict(
  facility_id,
  date,
  start_time,
  end_time,
  excludeId = null,
) {
  let sql = `
    SELECT id FROM bookings
    WHERE facility_id = $1
      AND date        = $2
      AND status     != 'cancelled'
      AND start_time  < $3
      AND end_time    > $4
  `;
  const params = [facility_id, date, end_time, start_time];
  if (excludeId) {
    sql += " AND id != $5";
    params.push(excludeId);
  }
  const result = await db.query(sql, params);
  return result.rows[0] || null;
}

exports.getAllBookings = async (req, res) => {
  try {
    const { facility_id, user_id, date, status } = req.query;
    let sql = `
      SELECT b.*,
             f.name     AS facility_name,
             f.location AS facility_location,
             u.name     AS user_name,
             u.email    AS user_email
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      JOIN users      u ON b.user_id     = u.id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (facility_id) {
      sql += ` AND b.facility_id = $${i++}`;
      params.push(facility_id);
    }
    if (user_id) {
      sql += ` AND b.user_id = $${i++}`;
      params.push(user_id);
    }
    if (date) {
      sql += ` AND b.date = $${i++}`;
      params.push(date);
    }
    if (status) {
      sql += ` AND b.status = $${i++}`;
      params.push(status);
    }
    sql += " ORDER BY b.date, b.start_time";

    const result = await db.query(sql, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT b.*,
             f.name AS facility_name, f.location AS facility_location,
             u.name AS user_name, u.email AS user_email
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      JOIN users      u ON b.user_id     = u.id
      WHERE b.id = $1
    `,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Booking not found." });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const { facility_id, user_id, date, start_time, end_time, notes } =
      req.body;
    if (!facility_id || !user_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error:
          "facility_id, user_id, date, start_time, and end_time are required.",
      });
    }
    const timeErr = validateTimeRange(date, start_time, end_time);
    if (timeErr)
      return res.status(400).json({ success: false, error: timeErr });

    const facility = await db.query("SELECT id FROM facilities WHERE id = $1", [
      facility_id,
    ]);
    if (facility.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Facility not found." });
    }
    const user = await db.query("SELECT id FROM users WHERE id = $1", [
      user_id,
    ]);
    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }
    const conflict = await hasConflict(facility_id, date, start_time, end_time);
    if (conflict) {
      return res.status(409).json({
        success: false,
        error: `Booking conflict with booking #${conflict.id}.`,
      });
    }
    const result = await db.query(
      `INSERT INTO bookings (facility_id, user_id, date, start_time, end_time, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6) RETURNING *`,
      [facility_id, user_id, date, start_time, end_time, notes?.trim() || null],
    );
    const newBooking = await db.query(
      `
      SELECT b.*, f.name AS facility_name, u.name AS user_name, u.email AS user_email
      FROM bookings b JOIN facilities f ON b.facility_id=f.id JOIN users u ON b.user_id=u.id
      WHERE b.id = $1
    `,
      [result.rows[0].id],
    );
    res.status(201).json({ success: true, data: newBooking.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query("SELECT * FROM bookings WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Booking not found." });
    }
    const e = existing.rows[0];
    if (e.status === "cancelled") {
      return res
        .status(400)
        .json({ success: false, error: "Cannot update a cancelled booking." });
    }
    const { date, start_time, end_time, status, notes } = req.body;
    const updated = {
      date: date ?? e.date,
      start_time: start_time ?? e.start_time,
      end_time: end_time ?? e.end_time,
      status: status ?? e.status,
      notes: notes ?? e.notes,
    };
    const timeErr = validateTimeRange(
      updated.date,
      updated.start_time,
      updated.end_time,
    );
    if (timeErr)
      return res.status(400).json({ success: false, error: timeErr });

    if (updated.status !== "cancelled") {
      const conflict = await hasConflict(
        e.facility_id,
        updated.date,
        updated.start_time,
        updated.end_time,
        id,
      );
      if (conflict)
        return res.status(409).json({
          success: false,
          error: `Booking conflict with booking #${conflict.id}.`,
        });
    }
    const result = await db.query(
      "UPDATE bookings SET date=$1, start_time=$2, end_time=$3, status=$4, notes=$5 WHERE id=$6 RETURNING *",
      [
        updated.date,
        updated.start_time,
        updated.end_time,
        updated.status,
        updated.notes,
        id,
      ],
    );
    const updatedBooking = await db.query(
      `
      SELECT b.*, f.name AS facility_name, u.name AS user_name, u.email AS user_email
      FROM bookings b JOIN facilities f ON b.facility_id=f.id JOIN users u ON b.user_id=u.id
      WHERE b.id = $1
    `,
      [id],
    );
    res.json({ success: true, data: updatedBooking.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.query("SELECT * FROM bookings WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Booking not found." });
    }
    if (existing.rows[0].status === "cancelled") {
      return res
        .status(400)
        .json({ success: false, error: "Booking is already cancelled." });
    }
    await db.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [id]);
    res.json({ success: true, message: `Booking #${id} has been cancelled.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
