const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const {
  createMedication,
  getMedications,
} = require("../controllers/medicationController");

router.post("/", verifyToken, createMedication);
router.get("/", verifyToken, getMedications);

module.exports = router;