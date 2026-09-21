import express from "express"
import { serveBasicFile, serveBasicJSON } from "../controllers/serve.controller.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

export const ServeRouter  = express.Router();

ServeRouter.get("/api/normal",rateLimiter,serveBasicJSON);

ServeRouter.get("/api/priority",rateLimiter,serveBasicJSON);

ServeRouter.get("/",rateLimiter,serveBasicFile);