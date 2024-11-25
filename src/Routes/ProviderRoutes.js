import { Router } from "express";
import { createOrUpdateJob, deleteJobById, getBestMatchCaregivers, getCaregiverDetails, getFavoriteCaregivers, getJobBestMatchingCaregivers, getJobsByProvider, searchCaregivers, updateFavoriteCandidate, updateProviderProfile } from "../Provider/ProviderFunctions.js";
import { cancelSubscription, createCustomer, createSetupIntent, createSubscription, updateSubscription } from "../Payments/ProviderPayments.js";
import { handleStripeWebhook } from "../Payments/StripeWebhooks.js";

const router = Router();

// Route to get the best-match caregivers when the page loads (geolocation and preferences based)
router.get('/caregivers/match/:userID', getBestMatchCaregivers);
router.get('/jobs/:jobId/matching-caregivers', getJobBestMatchingCaregivers);

// Route to perform an advanced caregiver search with filters and pagination
router.get('/caregivers/search', searchCaregivers);
router.get('/caregivers/:caregiverID', getCaregiverDetails);

router.post('/post-job', createOrUpdateJob); // Create or update job post
router.post('/settings/update/:userID', updateProviderProfile);// update the provider profile
router.get('/posted-jobs/:hash', getJobsByProvider); //get the jobs by the provider 
router.get('/favorite-caregivers/:userID', getFavoriteCaregivers); //get the saved caregivers for providers 
router.delete('/job/delete/:id', deleteJobById);
router.post('/set_favorites', updateFavoriteCandidate );
// Provider job routes  web_add_provider_job_post 


// Payments
router.post('/create-customer', createCustomer);
router.post('/create-setup-intent', createSetupIntent);
router.post('/create-subscription', createSubscription);
router.post('/cancel-subscription', cancelSubscription);
router.post('/update-subscription', updateSubscription);
router.post('/webhook',  handleStripeWebhook);
export default router;

