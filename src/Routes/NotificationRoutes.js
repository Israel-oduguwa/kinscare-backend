import { Router } from "express";
import { fetchNotifications, handleNotifications, markNotificationAsRead,  } from "../Notification/Notifications.js";



const router = Router();
router.post("/send", handleNotifications);
router.get('/fetch', fetchNotifications)
router.post("/mark-as-read", markNotificationAsRead);

export default router