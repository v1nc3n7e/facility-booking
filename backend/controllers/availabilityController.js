const db = require("../models/database");

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function toTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

exports.checkAvailability = async (req, res) => {
  try {
    const { facility_id, date } = req.query;

    if (!facility_id || !date) {
      return res.status(400).json({
        success: false,
        error: "facility_id and date query parameters are required.",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ success: false, error: "date must be YYYY-MM-DD." });
    }

    const facilityResult = await db.query(
      "SELECT * FROM facilities WHERE id = $1",
      [facility_id],
    );
    if (facilityResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Facility not found." });
    }
    const facility = facilityResult.rows[0];

    const bookingsResult = await db.query(
      `
      SELECT b.start_time, b.end_time, b.status, b.id,
             u.name AS user_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.facility_id = $1
        AND b.date = $2
        AND b.status != 'cancelled'
      ORDER BY b.start_time
    `,
      [facility_id, date],
    );

    const bookings = bookingsResult.rows;

    const DAY_START = 8 * 60;
    const DAY_END = 22 * 60;
    const SLOT_LEN = 30;

    const slots = [];
    for (let t = DAY_START; t < DAY_END; t += SLOT_LEN) {
      const slotStart = toTime(t);
      const slotEnd = toTime(t + SLOT_LEN);

      const overlapping = bookings.find((b) => {
        const bStart = toMinutes(b.start_time.slice(0, 5));
        const bEnd = toMinutes(b.end_time.slice(0, 5));
        return bStart < t + SLOT_LEN && bEnd > t;
      });

      slots.push({
        start_time: slotStart,
        end_time: slotEnd,
        available: !overlapping,
        booking_id: overlapping?.id || null,
        booked_by: overlapping?.user_name || null,
        status: overlapping?.status || null,
      });
    }

    const availableCount = slots.filter((s) => s.available).length;

    res.json({
      success: true,
      facility,
      date,
      total_slots: slots.length,
      available_slots: availableCount,
      booked_slots: slots.length - availableCount,
      slots,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
