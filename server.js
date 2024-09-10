import express, { json } from 'express';
import emailRoutes from "./src/Routes/emailRoutes.js"
import forumRoutes from "./src/Routes/forumRoutes.js"
import uploadFiles from "./src/Routes/uploadFiles.cjs";
import deleteFiles from "./src/Routes/deleteFile.cjs";
import cors from "cors";
import bodyParser from "body-parser"
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(json())
const allowedOrigins = [
    "https://kinscare.org",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "https://kinscarev2.vercel.app"
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
app.use('/api/email', emailRoutes);
app.use('/api/v1/forum', forumRoutes)
// this upload files to s3 bucket 
app.use('/api/v1', uploadFiles)
app.use('/api/v1/', deleteFiles)

app.get("/health", (req, res) => {
    res.send("health Check Latest"); 
});


const PORT = process.env.PORT || 8081;

// Connect to the database=

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
