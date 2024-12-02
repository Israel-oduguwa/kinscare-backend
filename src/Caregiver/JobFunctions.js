import { connectToDatabase } from "../../utils/mongodb.js";
import { ObjectId } from "mongodb";
// Fetch jobs based on user's location, page, and limit
export const fetchJobs = async (req, res, next) => {
    try {
        const { userID } = req.params;
        const { page = 1, limit = 5 } = req.query; // Default page is 1, default limit is 5

        // Ensure page and limit are numbers and greater than 0
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, parseInt(limit, 10));

        // Calculate how many jobs to skip based on the current page
        const skip = (pageNum - 1) * limitNum;

        // Connect to the database
        const { db } = await connectToDatabase();

        // Get the user data based on userID
        const userData = await db.collection("users").findOne({ userID });

        if (!userData) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if user has geocode_address with valid coordinates
        const coordinates = userData?.geocode_address?.coordinates;

        // Validate coordinates and build the aggregation pipeline
        const pipeline =
            coordinates && Array.isArray(coordinates) && coordinates.length === 2
                ? [
                    {
                        $geoNear: {
                            near: {
                                type: "Point", // Ensure type is set to "Point"
                                coordinates: [coordinates[0], coordinates[1]], // Longitude, Latitude
                            },
                            query: { draft: false }, // Only fetch jobs that aren't drafts
                            spherical: true, // Treat Earth as a sphere for accurate distance calculation
                            distanceField: "distance", // The calculated distance field
                            distanceMultiplier: 1 / 1609, // Convert distance from meters to miles
                        },
                    },
                    { $sort: { distance: 1, created: -1 } }, // Sort by closest, then newest
                    { $skip: skip }, // Skip jobs based on the page
                    { $limit: limitNum }, // Limit number of jobs to return
                ]
                : [
                    { $match: { draft: false } }, // Exclude draft jobs when no geolocation is available
                    { $sort: { created: -1 } }, // Sort by newest jobs first
                    { $skip: skip }, // Pagination: skip jobs based on the page
                    { $limit: limitNum }, // Limit number of jobs to return
                ];

        // Execute the aggregation pipeline to fetch jobs from the 'jobs' collection
        const jobs = await db.collection("jobs").aggregate(pipeline).toArray();

        // Get the total number of jobs for this query (without pagination)
        const totalJobs = await db.collection("jobs").countDocuments({ draft: false });

        // Return the fetched jobs and additional pagination information
        return res.status(200).json({
            totalJobs, // Total number of jobs in the database (or matching query)
            totalPages: Math.ceil(totalJobs / limitNum), // Total number of pages
            currentPage: pageNum, // The current page
            jobs, // The actual jobs data
        });
    } catch (error) {
        console.error("Error fetching jobs:", error);
        res.status(500).json({ error: "An error occurred while fetching jobs" });
    }
};

// Fetch job by job ID and find similar jobs
export const getJobById = async (req, res, next) => {
    try {
        const { jobId } = req.params;

        // Ensure jobId is valid
        if (!ObjectId.isValid(jobId)) {
            return res.status(400).json({ success: false, error: "Invalid jobId" });
        }

        // Connect to the database
        const { db } = await connectToDatabase();
        const jobsCollection = db.collection("jobs");

        // Aggregation pipeline to fetch job by ID
        const jobPipeline = [
            {
                $match: { _id: new ObjectId(jobId) }, // Match the job by _id
            },
            {
                $lookup: {
                    from: "users", // Join with the users collection
                    localField: "hash",
                    foreignField: "hash",
                    as: "results",
                },
            },
            {
                $unwind: "$results", // Unwind the results array to access user data
            },
            {
                $project: {
                    applicants: 1,
                    numberOfApplicants: {
                        $cond: {
                            if: { $isArray: "$applicants" },
                            then: { $size: "$applicants" },
                            else: 0,
                        },
                    },
                    contacts: 1,
                    contactAttempts: {
                        $cond: {
                            if: { $isArray: "$contacts" },
                            then: { $size: "$contacts" },
                            else: 0,
                        },
                    },
                    description: 1,
                    licenses: 1,
                    mobility: 1,
                    title: 1,
                    geocode_address: 1,
                    certifications: 1,
                    userID: 1,
                    compensation: 1,
                    created: 1,
                    city: "$results.city",
                    zipcode: "$results.zipcode",
                    isOnline: "$results.isOnline",
                    address: "$results.address",
                    minHours: 1,
                    schedule: 1,
                    trainer: "$results.trainer",
                    provider: "$results.name",
                    show_email: "$results.show_email",
                    show_tel: "$results.show_tel",
                    alert_preferences: "$results.settings.alert_preferences",
                    profileImage: "$results.profileImage",
                    settings: "$results.type_of_setting",
                },
            },
        ];

        // Fetch the job by ID
        const jobData = await jobsCollection.aggregate(jobPipeline).toArray();

        // If no job found, return a 404 response
        if (!jobData || jobData.length === 0) {
            return res.status(404).json({ success: false, message: "Job not found" });
        }

        const job = jobData[0]; // Get the first job (as it is the only match)

        // Similar jobs pipeline (based on similar fields like licenses, schedule, and location)
        const similarJobsPipeline = [
            {
                $search: {
                    index: "jobsIndex", // Assuming MongoDB Atlas Search index is set up
                    moreLikeThis: {
                        like: [
                            {
                                licenses: job.licenses,
                                schedule: job.schedule,
                                geocode_address: job.geocode_address,
                            },
                        ],
                    },
                },
            },
            {
                $match: { draft: false }, // Filter out draft jobs
            },
            {
                $project: {
                    title: 1,
                    licenses: 1,
                    schedule: 1,
                    "contacts.city": 1,
                    "contacts.address": 1,
                    "contacts.zipcode": 1,
                    "settings.alert_preferences": 1,
                },
            },
            {
                $limit: 5, // Limit to 5 similar jobs
            },
        ];

        // Fetch similar jobs using MongoDB Atlas Search
        const similarJobs = await jobsCollection
            .aggregate(similarJobsPipeline)
            .toArray();

        // Return both the job data and similar jobs
        return res.status(200).json({
            success: true,
            job,
            similarJobs,
        });
    } catch (error) {
        console.error("Error fetching job by ID:", error);
        return res.status(500).json({ success: false, error: "An error occurred while fetching the job" });
    }
};


export const applyForJob = async (req, res) => {
    try {
        const { jobId, caregiverId, providerName } = req.body;

        // Connect to the database
        const { db } = await connectToDatabase();
        const jobsCollection = db.collection("jobs");
        const usersCollection = db.collection("users");
        const notificationsCollection = db.collection("notifications");

        // Fetch the job and caregiver data in parallel
        const [job, caregiver] = await Promise.all([
            jobsCollection.findOne({ _id: new ObjectId(jobId) }),
            usersCollection.findOne({ userID: caregiverId }),
        ]);

        // Check if job and caregiver exist
        if (!job || !caregiver) {
            return res
                .status(404)
                .json({ message: !job ? "Job not found" : "Caregiver not found" });
        }

        // Check if caregiver has already applied
        if (job.applicants?.includes(caregiverId)) {
            return res
                .status(400)
                .json({ message: "Caregiver has already applied for this job." });
        }

        // Update job to add the caregiver's application

        const updateJobPromise = jobsCollection.updateOne(
            { _id: new ObjectId(jobId) },
            {
                $push: {
                    applicants: {
                        $each: [{
                            applied_on: new Date(),
                            userID: caregiverId, // assuming caregiverId is already defined as the user's ID
                            name: caregiver.fname + ' ' + caregiver.lname, // full name of the caregiver
                            availability: caregiver.availability, // assuming availability is passed in payload
                            licenses: caregiver.licenses // assuming licenses are passed in payload,
                        }],
                        $position: 0 // Inserts the new applicant at the beginning of the array
                    }
                }
            }
        );
        // Update caregiver's contact document with the job application details
        const updateCaregiverPromise = usersCollection.updateOne(
            { userID: caregiverId },
            {
                $push: {
                    application_submitted: {
                        $each: [{
                            date: new Date(),
                            jobId: new ObjectId(jobId),
                            provider: providerName,
                            providerID: job.userID,
                            email: job.contacts.email,
                            title: job.title,
                        }],
                        $position: 0 // Inserts the new application at the beginning of the array
                    }
                }
            }
        );

        // Create notification for the provider
        const notification = {
            type: "job_application",
            fromUserId: caregiverId,
            toUserId: job.userID,
            message: `${caregiver.fname} ${caregiver.lname} has applied for your job: ${job.title}`,
            jobId,
            caregiverName: `${caregiver.fname}, ${caregiver.lname}`,
            providerName,
            createdAt: new Date(),
            read: false,
            metadata: {
                jobTitle: job.title,
                caregiverId: caregiver.userID,
                providerId: job.userID,
                providerEmail: job.contacts?.email,
                providerName,
                caregiverName: `${caregiver.fname}, ${caregiver.lname}`
            },
        };

        // Insert notification into the database
        const insertNotificationPromise = notificationsCollection.insertOne(notification);

        // Wait for all database operations to complete
        await Promise.all([updateJobPromise, updateCaregiverPromise, insertNotificationPromise]);

        // Respond with success message
        res.status(200).json({
            message: "Application submitted successfully, provider has been notified.",
        });
    } catch (error) {
        console.error("Error applying for job:", error);
        res.status(500).json({ error: "An error occurred while applying for the job." });
    }
};


export const updateNotificationStatus = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { read } = req.body; // Boolean to mark as read or unread

        // Validate read is a boolean
        if (typeof read !== "boolean") {
            return res.status(400).json({ error: "Invalid read status" });
        }

        // Connect to the database
        const { db } = await connectToDatabase();

        // Update notification's read status
        const result = await db.collection("notifications").updateOne(
            { _id: new ObjectId(notificationId) },
            {
                $set: {
                    read,
                    readAt: read ? new Date() : null, // Set readAt only if it's marked as read
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Notification not found" });
        }

        res.status(200).json({ message: "Notification updated" });
    } catch (error) {
        console.error("Error updating notification:", error);
        res.status(500).json({ error: "Failed to update notification" });
    }
};

export const getUserNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.query; // status can be 'unread', 'read', or 'all'

        // Connect to the database
        const { db } = await connectToDatabase();

        // Build the query based on status
        const query = { toUserId: userId };
        if (status === 'unread') {
            query.read = false;
        } else if (status === 'read') {
            query.read = true;
        }

        // Sort notifications: unread first, then sort by createdAt (most recent first)
        const notifications = await db.collection('notifications')
            .find(query)
            .sort({ read: 1, createdAt: -1 }) // unread (read: false) comes first, then newest first
            .toArray();
        console.log("notification", userId, notifications)
        res.status(200).json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};



export const toggleJobAsFavorite = async (req, res) => {
    try {
        const { schedule, jobId, caregiverId, licenses, title, geocode_address, action } = req.body;
        // Assuming you have user information from the request, e.g., using authentication middleware

        // Connect to the MongoDB database
        const { db } = await connectToDatabase();
        const usersCollection = db.collection("users");

        let result;
        if (!caregiverId) {
            return res.status(400).json({ error: "Sign in to save job" });
        }
        switch (action) {
            case 'save':
                // Add job to the caregiver's `favorite_jobs` array
                result = await usersCollection.updateOne(
                    { userID: caregiverId },
                    {
                        "$push": {
                            "favorite_jobs": {
                                $each: [
                                    {
                                        created: new Date(),
                                        jobID: jobId,
                                        licenses,
                                        schedule,
                                        geocode_address,
                                        caregiverId,
                                        title
                                    }
                                ],
                                "$position": 0 // Inserts the new job at the start of the array
                            }
                        }
                    }
                );
                // console.log('Save job result:', JSON.stringify(result));
                res.status(200).json({ message: "Job saved successfully." });
                break;
            case 'unsave':
                // Remove the job from the caregiver's `favorite_jobs` array
                result = await usersCollection.updateOne(
                    { userID: caregiverId },
                    {
                        $pull: {
                            "favorite_jobs": {
                                jobID: jobId,
                                licenses,
                                caregiverId,
                                schedule,
                                geocode_address,
                                title
                            }
                        }
                    }
                );
                console.log('Unsave job result:', JSON.stringify(result));
                res.status(200).json({ message: "Job unsaved successfully." });
                break;

            default:
                res.status(400).json({ message: "Invalid action. Please provide either 'save' or 'unsave'." });
        }
    } catch (err) {
        console.error('Error toggling favorite job:', err);
        res.status(500).json({ error: "An error occurred while processing the request." });
    }
};



export const getAppliedJobs = async (req, res) => {
    try {
        const { userID } = req.params

        // Connect to the MongoDB database
        const { db } = await connectToDatabase();
        const usersCollection = db.collection("users");
        const jobsCollection = db.collection("jobs");

        // Find the user by ID
        const user = await usersCollection.findOne({ userID: userID });
        // console.log(user)
        if (!user || !user.application_submitted) {
            return res.status(404).json({ message: "User or applied jobs not found." });
        }

        // Extract job IDs from the user's application_submitted array
        const jobIds = user.application_submitted.map(application => new ObjectId(application.jobId));

        // Fetch the jobs that match the extracted job IDs
        const appliedJobs = await jobsCollection
            .find({ _id: { $in: jobIds } })
            .project({ _id: 1, title: 1, contacts: 1, certifications: 1, licenses: 1, schedule: 1, minHours: 1, compensation: 1, created: 1 })
            .toArray();

        // Respond with the jobs the user has applied for
        res.status(200).json({ success: true, jobs: appliedJobs });
    } catch (error) {
        console.error("Error fetching applied jobs:", error);
        res.status(500).json({ message: "An error occurred while fetching applied jobs." });
    }
};


export const getFavoriteJobs = async (req, res) => {
    try {
        const { userID } = req.params;
        console.log(userID)
        // Connect to the MongoDB database
        const { db } = await connectToDatabase();
        const usersCollection = db.collection("users");
        const jobsCollection = db.collection("jobs");

        // Find the user by ID
        const user = await usersCollection.findOne({ userID: userID });

        if (!user || !user.favorite_jobs) {
            return res.status(404).json({ message: "User or favorite jobs not found." });
        }

        // Extract job IDs from the user's favorite_jobs arrayc
        console.log(user.favorite_jobs)
        const favoriteJobIds = user.favorite_jobs.map(favJob => {
            // Check if the 'jobID' exists, otherwise use 'jobId'
            const jobId = favJob.jobID || favJob.jobId;
            return new ObjectId(jobId);
        });
        console.log(favoriteJobIds)

        // Fetch the jobs that match the extracted job IDs
        const favoriteJobs = await jobsCollection
            .find({ _id: { $in: favoriteJobIds } })
            .project({ _id: 1, title: 1, contacts: 1, certifications: 1, licenses: 1, schedule: 1, minHours: 1, compensation: 1, created: 1 })
            .toArray();

        // Respond with the user's favorite jobs
        res.status(200).json({ success: true, jobs: favoriteJobs });
    } catch (error) {
        console.error("Error fetching favorite jobs:", error);
        res.status(500).json({ message: "An error occurred while fetching favorite jobs." });
    }
};

export const filterJobs = async (req, res) => {
    const { licenses, schedule, minHours, page = 1, limit = 10 } = req.body;

    try {
        const { db } = await connectToDatabase();
        const jobsCollection = db.collection('jobs');

        // Pagination setup
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, parseInt(limit, 10));
        const skip = (pageNum - 1) * limitNum;

        // Match stage: Build conditions dynamically
        const matchConditions = { draft: false }; // Start with the default condition

        if (licenses && licenses.length > 0) {
            matchConditions.licenses = { $in: licenses }; // Match any license in the array
        }

        if (schedule) {
            matchConditions.schedule = schedule; // Exact match for schedule
        }

        if (minHours) {
            if (typeof minHours === 'object' && (minHours.min || minHours.max)) {
                matchConditions.minHours = {};
                if (minHours.min !== undefined) {
                    matchConditions.minHours.$gte = parseInt(minHours.min, 10); // Minimum value
                }
                if (minHours.max !== undefined) {
                    matchConditions.minHours.$lte = parseInt(minHours.max, 10); // Maximum value
                }
            } else {
                matchConditions.minHours = { $gte: parseInt(minHours, 10) }; // Minimum hours filter
            }
        }

        // Build the aggregation pipeline
        const pipeline = [
            { $match: matchConditions }, // Apply match conditions
            { $project: { applicants: 0 } }, // Exclude fields if necessary
            { $sort: { created: -1 } }, // Sort by newest jobs
            { $skip: skip }, // Pagination: Skip based on page
            { $limit: limitNum }, // Limit number of jobs returned
        ];

        // Execute the aggregation pipeline
        const jobs = await jobsCollection.aggregate(pipeline).toArray();

        // Count total jobs for pagination (without $skip and $limit)
        const totalJobs = await jobsCollection.countDocuments(matchConditions);

        // Return the filtered jobs and pagination info
        return res.status(200).json({
            success: true,
            totalJobs, // Total number of jobs matching the filters
            totalPages: Math.ceil(totalJobs / limitNum), // Total number of pages
            currentPage: pageNum, // The current page
            jobs, // The actual jobs data
        });
    } catch (error) {
        console.error('Error filtering jobs with pipeline:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while filtering jobs.',
        });
    }
};