const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const { getSummary } = require("../controllers/reportController");

router.get("/summary", verifyToken, getSummary);

module.exports = router;