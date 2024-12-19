import { Router } from "express";
import { sendSMS } from "../Twilio/SMS.cjs";


const router = Router();


router.post("/sms/send", sendSMS);

export default router