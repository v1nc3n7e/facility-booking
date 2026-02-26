const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/availabilityController");

router.get("/", ctrl.checkAvailability);

module.exports = router;
