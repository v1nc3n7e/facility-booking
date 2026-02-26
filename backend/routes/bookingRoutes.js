const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/bookingController");

router.get("/", ctrl.getAllBookings);
router.get("/:id", ctrl.getBookingById);
router.post("/", ctrl.createBooking);
router.put("/:id", ctrl.updateBooking);
router.delete("/:id", ctrl.deleteBooking);

module.exports = router;
