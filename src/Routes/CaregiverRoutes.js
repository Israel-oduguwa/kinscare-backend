import { Router } from "express";
import { fetchJobs, getJobById, applyForJob, toggleJobAsFavorite, updateNotificationStatus, getUserNotifications, getFavoriteJobs, getAppliedJobs, filterJobs, fetchAndFilterJobsSSR} from "../Caregiver/JobFunctions.js";
import { createOrUpdateResume, getProviderProfile, saveCareerRecommendation } from "../Caregiver/UserFunction.js";
const router = Router();

router.get('/jobs/:userID', fetchJobs);
router.get('/job/:jobId', getJobById);
router.post('/job/apply', applyForJob) // web_apply_for_job
router.post('/job/favorite', toggleJobAsFavorite); // web_add_or_remove_job_as_favorite
router.get('/notifications/:userId', getUserNotifications);
router.get('/jobs/favorite/:userID', getFavoriteJobs)
router.get('/jobs/applied-job/:userID', getAppliedJobs)
router.post('/jobs/filter', filterJobs);
router.get('/jobs-search', fetchAndFilterJobsSSR);
// Route for marking a notification as read/unread
router.post('/notifications/:notificationId', updateNotificationStatus);
// web_add_caregiver_application

router.post('/resume/update/:userID', createOrUpdateResume);
router.post('/save-recommendation', saveCareerRecommendation);


// provider data
router.get("/get-provider/:providerId", getProviderProfile);


export default router; 