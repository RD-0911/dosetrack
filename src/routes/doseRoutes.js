const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const {
  generateTodayDoses,
  getTodayDoses,
  updateDoseStatus,
  getDoseHistory,
} = require("../controllers/doseController");

router.post("/generate-today", verifyToken, generateTodayDoses);
router.get("/today", verifyToken, getTodayDoses);
router.get("/history", verifyToken, getDoseHistory);
router.put("/:id/status", verifyToken, updateDoseStatus);

module.exports = router;