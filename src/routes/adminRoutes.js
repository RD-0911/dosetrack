const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const {
  soloAdmin,
  getUsers,
  updateUserStatus,
  getUserDoses,
  getGlobalStats,
} = require("../controllers/adminController");

router.use(verifyToken, soloAdmin);

router.get("/users", getUsers);
router.put("/users/:id/estado", updateUserStatus);
router.get("/users/:id/doses", getUserDoses);
router.get("/stats", getGlobalStats);

module.exports = router;