const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const {
  soloAdmin,
  getUsers,
  updateUserStatus,
  getUserDoses,
  getGlobalStats,
  getAdherenceDaily,
  getAdherenceByMedication,
  getOmissionsByHour,
  getTopUsers,
} = require("../controllers/adminController");

router.use(verifyToken, soloAdmin);

// Usuarios
router.get("/users", getUsers);
router.put("/users/:id/estado", updateUserStatus);
router.get("/users/:id/doses", getUserDoses);

// Stats generales
router.get("/stats", getGlobalStats);

// Analytics (gráficas)
router.get("/analytics/adherence-daily", getAdherenceDaily);
router.get("/analytics/adherence-by-medication", getAdherenceByMedication);
router.get("/analytics/omissions-by-hour", getOmissionsByHour);
router.get("/analytics/top-users", getTopUsers);

module.exports = router;