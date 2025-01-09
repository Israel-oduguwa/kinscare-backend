import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

import { corsConfig } from "./src/configs/corsConfig.js";
import { stripeRawBody } from "./src/middlewares/stripeRawBody.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";
import { notFoundHandler } from "./src/middlewares/notFoundHandler.js";
import { handleStripeWebhook } from './src/Payments/StripeWebhooks.js';
import logger from "./utils/logger.js";


import emailRoutes from "./src/Routes/emailRoutes.js"
import forumRoutes from "./src/Routes/forumRoutes.js"
import uploadFiles from "./src/Routes/uploadFiles.cjs";
import deleteFiles from "./src/Routes/deleteFiles.cjs";
import AuthRoutes from "./src/Routes/AuthRoutes.js";
import CaregiverRoutes from "./src/Routes/CaregiverRoutes.js";
import ProviderRoutes from "./src/Routes/ProviderRoutes.js"
import TwilioRoute from "./src/Routes/TwilioRoute.js"
import NotificationRoutes from "./src/Routes/NotificationRoutes.js"
import TrackingRoutes from "./src/Routes/TrackingRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081; // using Port 8081 AWS 

// Middleware
app.use(cors(corsConfig)); 
app.use(express.json()); 
app.use(bodyParser.json({ limit: "50mb" })); 
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Stripe Webhook Raw Body
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeRawBody(handleStripeWebhook)
);

// Routes
app.get("/", (req, res) => res.send("Health Check: The server is healthy!"));

app.use("/api/v1/email", emailRoutes);
app.use("/api/v1/forum", forumRoutes);
app.use("/api/v1", uploadFiles);
app.use("/api/v1", deleteFiles);
app.use("/api/v1/tracking", TrackingRoutes);
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/caregivers", CaregiverRoutes);
app.use("/api/v1/providers", ProviderRoutes);
app.use("/api/v1/twilio", TwilioRoute);
app.use("/api/v1/notifications", NotificationRoutes);

// 404 and Error Handlers
app.use(notFoundHandler); // Handles undefined routes
app.use(errorHandler); // Centralized error handling

// Start Server
app.listen(PORT, () => logger.info(`Server running at http://localhost:${PORT}`));
