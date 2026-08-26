import express from "express"
import { serveBasicFile } from "../controllers/serve.controller.js";
import { rateLimiter } from "../middleware/tokenBucket.js";

export const ServeRouter  = express.Router();

ServeRouter.get("/",rateLimiter,serveBasicFile);

