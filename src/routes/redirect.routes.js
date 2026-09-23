const express = require("express");
const { redirect } = require("../controllers/redirect.controller");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

router.get("/:shortCode", asyncHandler(redirect));

module.exports = { redirectRouter: router };
