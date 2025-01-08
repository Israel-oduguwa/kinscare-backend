import express, { json } from 'express';
import emailRoutes from "./src/Routes/emailRoutes.js"
import forumRoutes from "./src/Routes/forumRoutes.js"
import uploadFiles from "./src/Routes/uploadFiles.cjs";
import deleteFiles from "./src/Routes/deleteFile.cjs";
import AuthRoutes from "./src/Routes/AuthRoutes.js";
import CaregiverRoutes from "./src/Routes/CaregiverRoutes.js";
import ProviderRoutes from "./src/Routes/ProviderRoutes.js"
import TwilioRoute from "./src/Routes/TwilioRoute.js"
import NotificationRoutes from "./src/Routes/NotificationRoutes.js"
import cors from "cors";
import bodyParser from "body-parser"
import { handleStripeWebhook } from './src/Payments/StripeWebhooks.js';
const app = express();
app.use(express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
     }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(json())

const allowedOrigins = [
    "https://kinscare.org",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "https://kinscarev2.vercel.app",
    "https://kinscare.wm.r.appspot.com",
    "http://192.168.1.133:3001"
];
app.use(
    cors({
        origin: allowedOrigins,
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        credentials: true,
        // allowedHeaders: "Content-Type,Authorization,secrete-api-key", // Add secrete-api-key to the list
    })
);

// The api and functions 

// Emails 
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/forum', forumRoutes)
// this upload files to s3 bucket 
app.use('/api/v1', uploadFiles)
app.use('/api/v1/', deleteFiles)


app.post(
    "/webhook",
    express.raw({ type: "application/json" }), // Raw body for Stripe
    handleStripeWebhook // Webhook handler
);

//user authentication 
app.use('/api/v1/auth', AuthRoutes);

//caregivers 
app.use('/api/v1/caregivers', CaregiverRoutes)

//providers
app.use('/api/v1/providers', ProviderRoutes)

//twilio
app.use('/api/v1/twilio', TwilioRoute)

// notification
app.use('/api/v1/notifications', NotificationRoutes)

app.get("/", (req, res) => {
    res.send("health Check, the server is healthy");
});


const PORT = process.env.PORT || 8081;

// Connect to the database=

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
