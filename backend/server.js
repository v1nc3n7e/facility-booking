require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./models/database");

const facilityRoutes = require("./routes/facilityRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use("/auth", authRoutes);
app.use("/facilities", facilityRoutes);
app.use("/bookings", bookingRoutes);
app.use("/availability", availabilityRoutes);

app.get("/users", async (_req, res) => {
  try {
    const result = await db.query("SELECT id, name, email, role FROM users");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date() }),
);

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(
    `\n🏢  Facility Booking API running at http://localhost:${PORT}\n`,
  );
});
