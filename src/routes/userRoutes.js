const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const { getProfile } = require("../controllers/userController");

router.get("/profile", verifyToken, getProfile);

module.exports = router;