const express = require("express");
const { index, health } = require("../controllers/meta.controller");

const router = express.Router();

router.get("/", index);
router.get("/health", health);

module.exports = { metaRouter: router };
