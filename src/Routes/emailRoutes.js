import { Router } from "express";
import AlertCaregiversAboutNewJob from "../Emails/Caregivers/AlertCaregiversAboutNewJob.js";
import sendCaregiversAlert from "../Emails/Providers/AlertProvidersAboutNewCandidate.js";
import supportResources from "../Emails/Campigns/caregiver_training_support_resources.js";
import { inviteFriends, referToEmployer, invitedEmployerEmail } from "../Emails/Caregivers/CareerProfileEmail.js";
const router = Router()

// caregivers 
router.post('/send-job-alerts', AlertCaregiversAboutNewJob)

//providers
router.post('/send-new-caregivers-alert', sendCaregiversAlert)

router.post("/invite-friend", inviteFriends)
router.post('/refer-employer', referToEmployer)
router.post('/invited-employer-email', invitedEmployerEmail)


router.post('/support-resources', supportResources)
export default router