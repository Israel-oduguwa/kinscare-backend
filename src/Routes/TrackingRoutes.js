import { Router } from "express";
import { SendGoogleAdsMixpanel } from "../Tracking/GoogleAdsMixpanel.js";
import { SendFacebookAdsMixpanel } from "../Tracking/FacebookAdsMixpanel.js";

const router = Router();


router.get("/google_ads_mixpanel", SendGoogleAdsMixpanel);
router.get("/facebook_ads_mixpanel", SendFacebookAdsMixpanel);

export default router