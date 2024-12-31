import { Router } from "express";
import { createOrUpdateJob, deleteJobById, getBestMatchCaregivers, getCaregiverDetails, getFavoriteCaregivers, getJobBestMatchingCaregivers, getJobsByProvider, searchCaregivers, searchCaregiversFilter, updateFavoriteCandidate, updateProviderProfile } from "../Provider/ProviderFunctions.js";
import { cancelSubscription, createCustomer, createSetupIntent, createSubscription, createSubscriptionWithSavedCard, fetchSavedCards, getBillingHistory, getSubscriptionDetails, resumeSubscription, updateSubscription, updateSubscriptionPlan } from "../Payments/ProviderPayments.js";
import { handleStripeWebhook } from "../Payments/StripeWebhooks.js";

const router = Router();

// Route to get the best-match caregivers when the page loads (geolocation and preferences based)
router.get('/caregivers/match/:userID', getBestMatchCaregivers);
router.get('/jobs/:jobId/matching-caregivers', getJobBestMatchingCaregivers);

// Route to perform an advanced caregiver search with filters and pagination
router.get('/caregivers/search', searchCaregivers);
router.get('/caregivers/:caregiverID', getCaregiverDetails);
router.get("/find-caregivers/filter", searchCaregiversFilter); // search with filter 

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
// router.post('/webhook',  handleStripeWebhook);
// GET /api/payment-methods
router.post("/payment-methods", fetchSavedCards);
// POST /api/subscription
router.post("/subscription", createSubscriptionWithSavedCard);

// Route to get the user's current subscription details
router.get("/subscription/:customerId", getSubscriptionDetails);

// Route to update the subscription plan
router.post("/subscription/update", updateSubscriptionPlan);

// Route to resume a canceled subscription
router.post("/subscription/resume", resumeSubscription);

// Route to get the user's billing history
router.get("/billing-history/:customerId", getBillingHistory);
export default router;

