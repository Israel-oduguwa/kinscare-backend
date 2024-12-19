import { ObjectId } from "mongodb";
import { getGeocodeAddress, isValidZipcode } from '../../utils/helper.js';
import { connectToDatabase } from "../../utils/mongodb.js";
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import axios from "axios";

export const getGeoLocation = async (ip) => {
    const  testIp = "67.183.58.7"
    try {
        const response = await axios.get(`http://api.ipstack.com/${testIp}?access_key=b4edc01b56d1f59a053bd88eba5a2c73`);
        // console.log(response)
        if (response.status === 200 && response.data) {
            const { latitude, longitude } = response.data;
            if (latitude && longitude) {
                return { lat: latitude, lng: longitude };
            }
        }
        throw new Error("Failed to retrieve geolocation");
    } catch (error) {
        console.error("Error fetching geolocation:", error.message);
        throw error;
    }
};
// Helper function for phone number validation and formatting
const formatPhoneNumber = (tel) => {
    const phoneNumber = parsePhoneNumberFromString(tel, 'US');
    return phoneNumber ? phoneNumber.format('E.164') : null;
};

// Fetch jobs based on user's location, page, and limit

export const getBestMatchCaregivers = async (req, res) => {
    // const {  } = req.user; // Assuming provider's user data is attached to the request
    const { page = 1, limit = 10, userID } = req.query;
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    try {
        const { db } = await connectToDatabase();
        const users = db.collection('users');

        // Get provider's data
        const provider = await users.findOne({ userID: userID });
        if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

        // Build the aggregation pipeline
        const pipeline = [
            // Geolocation or city or zip code matching
            provider.geocode_address?.coordinates
                ? {
                    $geoNear: {
                        near: {
                            type: 'Point',
                            coordinates: [provider.geocode_address.coordinates.lng, provider.geocode_address.coordinates.lat],
                        },
                        distanceField: 'distance',
                        maxDistance: 50000, // 50 km radius
                        spherical: true,
                    },
                }
                : provider.city
                    ? { $match: { city: provider.city } }
                    : provider.zipcode
                        ? { $match: { zipcode: provider.zipcode } }
                        : { $match: {} },
            {
                $match: {
                    role: 'caregiver',
                    complete: true, // Only complete profiles
                },
            },
        ];

        // Optional match on alert preferences if the provider has them
        if (provider.settings?.alert_preferences?.length) {
            pipeline.push({
                $match: {
                    'settings.alert_preferences': { $in: provider.settings.alert_preferences },
                },
            });
        }

        // Pagination stages
        pipeline.push({ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum });

        // Count total caregivers
        const [candidates, totalData] = await Promise.all([
            users.aggregate(pipeline).toArray(),
            users.aggregate([...pipeline, { $count: 'total' }]).toArray(),
        ]);

        const totalCandidates = totalData.length ? totalData[0].total : 0;
        const totalPages = Math.ceil(totalCandidates / limitNum);

        return res.status(200).json({
            success: true,
            candidates,
            pagination: { totalCandidates, totalPages, currentPage: pageNum, limit: limitNum },
        });
    } catch (error) {
        console.error('Error fetching caregivers:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch caregivers.' });
    }
};

export const searchCaregivers = async (req, res) => {
    const { page = 1, limit = 10, name, alert_preferences, licenses, availability, city, zipcode } = req.query;
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);

    try {
        const { db } = await connectToDatabase();
        const users = db.collection('users');

        // Build the aggregation pipeline
        const pipeline = [
            {
                $match: {
                    role: 'caregiver',
                    complete: true, // Only fetch complete profiles
                    ...(name && {
                        $or: [
                            { fname: { $regex: name, $options: 'i' } }, // Case-insensitive first name match
                            { lname: { $regex: name, $options: 'i' } }, // Case-insensitive last name match
                        ],
                    }),
                    ...(alert_preferences && { 'settings.alert_preferences': { $in: alert_preferences.split(',') } }),
                    ...(licenses && { licenses: { $in: licenses.split(',') } }),
                    ...(availability && { availability: { $in: availability.split(',') } }),
                    ...(city && { city }),
                    ...(zipcode && { zipcode }),
                },
            },
        ];

        // Pagination stages
        pipeline.push({ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum });

        // Fetch caregivers and count total matches
        const [candidates, totalData] = await Promise.all([
            users.aggregate(pipeline).toArray(),
            users.aggregate([...pipeline, { $count: 'total' }]).toArray(),
        ]);

        const totalCandidates = totalData.length ? totalData[0].total : 0;
        const totalPages = Math.ceil(totalCandidates / limitNum);

        return res.status(200).json({
            success: true,
            candidates,
            pagination: { totalCandidates, totalPages, currentPage: pageNum, limit: limitNum },
        });
    } catch (error) {
        console.error('Error searching caregivers:', error);
        return res.status(500).json({ success: false, message: 'Failed to search caregivers.' });
    }
};

// Function to get caregiver details and similar caregivers
export const getCaregiverDetails = async (req, res) => {
    const { caregiverID } = req.params; // Assuming caregiverID is passed as a route parameter
    const { limit = 4 } = req.query; // Limit for similar caregivers

    try {
        const { db } = await connectToDatabase();
        const users = db.collection('users');

        // 1. Fetch the caregiver's details
        const caregiver = await users.findOne({ userID: caregiverID, role: 'caregiver' });

        if (!caregiver) {
            return res.status(404).json({ success: false, message: 'Caregiver not found' });
        }

        // 2. Build the aggregation pipeline to find similar caregivers
        const pipeline = [
            {
                $match: {
                    role: 'caregiver',
                    userID: { $ne: caregiverID }, // Exclude the current caregiver
                    complete: true, // Only fetch complete profiles
                },
            },
            {
                $match: {
                    // Similar caregivers should have at least one matching field
                    $or: [
                        { city: caregiver.city }, // Same city
                        { zipcode: caregiver.zipcode }, // Same ZIP code
                        { 'geocode_address.coordinates': caregiver.geocode_address?.coordinates }, // Same geolocation
                        { licenses: { $in: caregiver.licenses } }, // Same licenses
                        { availability: { $in: caregiver.availability } }, // Similar availability
                    ],
                },
            },
            { $limit: parseInt(limit) }, // Limit the number of similar caregivers returned
        ];

        // Fetch similar caregivers
        const similarCaregivers = await users.aggregate(pipeline).toArray();
        console.log(caregiver)
        // 3. Return caregiver details and similar caregivers
        return res.status(200).json({
            success: true,
            caregiver,
            similarCaregivers,
        });
    } catch (error) {
        console.error('Error fetching caregiver details:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch caregiver details.' });
    }
};

// Function to create or update a job post
export const createOrUpdateJob = async (req, res) => {
    const payload = req.body;
    const { userID, title, description, contacts } = payload;

    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('jobs');
        const users = db.collection('users');

        // Retrieve user data for geocode address based on userID
        const user = await users.findOne({ userID: userID });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Get geocode address based on user's location data
        let geocodeAddress = null;
        if (isValidZipcode(contacts?.zipcode) && contacts?.city) {
            geocodeAddress = await getGeocodeAddress(contacts?.zipcode, contacts?.city); // Get geocode address
        }
        // console.log(geocodeAddress)
        // Prepare job data for creation or update
        const jobData = {
            userID,
            title,
            description,
            contacts: contacts || user.contacts, // Use provided contacts or fallback to user's contacts
            created: payload.created || new Date(),
            compensation: payload.compensation,
            licenses: payload.licenses,
            certifications: payload.certifications,
            schedule: payload.schedule,
            mobility: payload.mobility,
            minHours: payload.minHours,
            profileImage: payload.profileImage,
            draft: payload.draft,
            autoSave: payload.autoSave,
            geocode_address: geocodeAddress ? { type: 'Point', coordinates: geocodeAddress } : null, // Geocode address if available
            hash: payload.hash,
            settings: payload.settings,
            ...(payload.care_task ? { care_task: payload.care_task } : {}),
        };
        // If job ID exists, update the job, else create a new job
        const result = payload._id
            ? await updateJobPost(payload._id, jobData, collection)
            : await createJobPost(jobData, collection);

        // Send success response with job data
        return res.status(result.success ? 200 : 201).json(result);
    } catch (err) {
        console.error(`Error processing job post: ${err.message}`);
        return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
    }
};

// Helper function to create a new job post
const createJobPost = async (jobData, collection) => {
    try {
        const result = await collection.insertOne(jobData);
        const job = await collection.findOne({ _id: result.insertedId });
        return {
            success: true,
            message: 'Job post created successfully.',
            jobData: job,
            id: result.insertedId,
        };
    } catch (err) {
        console.error('Error creating job post:', err.message);
        return { success: false, message: `Failed to create job post: ${err.message}` };
    }
};

// Helper function to update an existing job post
const updateJobPost = async (jobId, jobData, collection) => {
    try {
        const result = await collection.updateOne({ _id: new ObjectId(jobId) }, { $set: jobData });
        if (result.matchedCount === 0) {
            return { success: false, message: 'Job post not found' };
        }
        return {
            success: true,
            message: 'Job post updated successfully.',
            jobData: await collection.findOne({ _id: new ObjectId(jobId) }),
        };
    } catch (err) {
        console.error('Error updating job post:', err.message);
        return { success: false, message: `Failed to update job post: ${err.message}` };
    }
};


export const getJobBestMatchingCaregivers = async (req, res) => {
    const { jobId } = req.params; // jobId passed as a route parameter

    try {
        const { db } = await connectToDatabase();
        const jobsCollection = db.collection('jobs');
        const caregiversCollection = db.collection('users');

        // 1. Fetch the job details using jobId
        const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });
        if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

        // 2. Prepare the matching criteria (geolocation, licenses, availability, mobility)
        const { geocode_address, licenses, schedule, mobility: jobMobility } = job;

        // Basic match criteria: role, licenses, availability
        const matchCriteria = {
            role: 'caregiver', // Ensure we're fetching only caregivers
            complete: true,    // Only fetch complete profiles
            ...(licenses ? { licenses: { $in: licenses } } : {}), // Match licenses if job has them
            ...(schedule ? { availability: { $in: [schedule] } } : {}), // Match caregivers based on availability
        };

        // Add mobility criteria based on the job requirements
        if (jobMobility === 'car_needed') {
            matchCriteria.mobility = 'has_car'; // Caregiver must have a car
        } else if (jobMobility === 'no_car_needed') {
            matchCriteria.mobility = { $in: ['has_car', 'no_car'] }; // Caregiver can have or not have a car
        }

        // 3. Add geolocation matching using the job's geocode_address (if available)
        const pipeline = [];
        if (geocode_address?.coordinates) {
            pipeline.push({
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [geocode_address.coordinates.lng, geocode_address.coordinates.lat],
                    },
                    distanceField: 'distance',
                    maxDistance: 50000, // 50 km radius (adjust as needed)
                    spherical: true,
                },
            });
        } else {
            pipeline.push({ $match: matchCriteria });
        }

        // 4. Fetch caregivers matching the criteria
        pipeline.push({ $match: matchCriteria });

        // 5. Limit the results to, say, the top 10 caregivers
        pipeline.push({ $limit: 4 });

        const caregivers = await caregiversCollection.aggregate(pipeline).toArray();

        // 6. Return the caregivers as the response
        return res.status(200).json({
            success: true,
            caregivers,
            total: caregivers.length,
        });
    } catch (error) {
        console.error(`Error fetching best caregivers for job: ${error.message}`);
        return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
};

/**
 * This function updates provider's settings and formats the phone to E164 format.
 * It also creates geocode coordinates based on the provided address.
 * 
 * @params {Object} payload - data containing provider details
 * @returns {Object} - updated provider settings and success message
 */
export const updateProviderProfile = async (req, res) => {
    const payload = req.body; // The data sent in the request payload
    const { userID } = req.params
    try {
        const { db } = await connectToDatabase(); // Establish database connection
        const users = db.collection('users');
        const contacts = db.collection('contacts');
        console.log(payload.zipcode)
        // 1. Format phone number to E164 format (Helper function)
        // const tel = formatPhoneNumber(payload.settings.tel); validate at the client-side using twilio

        // 2. Construct the full address for geocoding
        // const address = `${payload.address} ${payload.city} ${payload.zipcode}`;

        // 3. Get geocode coordinates (Helper function for geocoding);

        let geocodeAddress = null;
        if (isValidZipcode(payload.zipcode) && payload.city) {
            geocodeAddress = await getGeocodeAddress(payload.zipcode, payload.city); // Get geocode address
        }

        // 4. Update user's settings in the 'users' collection
        const updateResult = await users.updateMany(
            { userID: userID }, // Match user by their unique hash
            {
                $set: {
                    address: payload.address,
                    city: payload.city,
                    complete: true, // Mark profile as complete
                    fname: payload.fname,
                    lname: payload.lname,
                    profileImage: payload.profileImage ? payload.profileImage : "",
                    geocode_address: {
                        type: 'Point',
                        coordinates: geocodeAddress, // Use the geocode result
                    },
                    hash: payload.hash,
                    settings: payload.settings,
                    name: payload.name,
                    role: "provider", // Assign role as provider
                    userID: userID,
                    trainer: payload.trainer,
                    type_of_setting: payload.type_of_setting,
                    zipcode: payload.zipcode,
                },
            },
            { upsert: true } // Insert if the user doesn't already exist
        );

        // 5. Update contact details in the 'contacts' collection
        const contactResult = await contacts.updateOne(
            { userID: userID }, // Match by user ID
            {
                $set: {
                    hr_email: payload.settings.email,
                    alert_preferences: payload.settings.alert_preferences,
                    complete: true, // Mark contacts as complete
                    // customer_id: customer.id, this is the stripe customer id 
                },
            },
            { upsert: true } // Insert if the contact record doesn't exist
        );

        // 6. Check if update was successful and return the result
        if (updateResult.modifiedCount > 0) {
            const updatedUser = await users.findOne({ userID: userID });
            return res.status(200).json({
                success: true,
                message: 'Your settings have been updated - you can now create a job post',
                data: updatedUser,
            });
        } else {
            return res.status(200).json({ success: false, message: 'No changes were made to the settings' });
        }
    } catch (err) {
        console.error('Error updating provider profile:', err);
        return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
};

export const getJobsByProvider = async (req, res) => {
    const { hash } = req.params; // Get userID from query parameters
    console.log(hash)
    try {
        const { db } = await connectToDatabase();
        const jobsCollection = db.collection('jobs');

        // 1. Validate if userID is provided
        if (!hash) {
            return res.status(400).json({ success: false, message: 'userID is required' });
        }

        const pipeline = [
            {
                $match: { hash: hash },
            },
            {
                $sort: { created: -1 },
            },
        ];

        const results = await jobsCollection.aggregate(pipeline)
        // 2. Find jobs by userID
        const jobs = await results.toArray();
        console.log(jobs)
        // 3. Return the jobs posted by the provider
        return res.status(200).json({
            success: true,
            message: `Jobs posted by provider`,
            totalJobs: jobs.length,
            jobs,
        });
    } catch (err) {
        console.error(`Error fetching jobs`, err);
        return res.status(500).json({
            success: false,
            message: `Server error: ${err.message}`,
        });
    }
};

export const getFavoriteCaregivers = async (req, res) => {
    const { userID } = req.params; // Get userID from the request parameters

    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        // MongoDB aggregation pipeline to fetch saved candidates and their full data
        const pipeline = [
            {
                $match: { userID: userID }, // Match the provider by their userID
            },
            {
                $project: { _id: 0, saved_candidates: 1 }, // Only project the saved_candidates field
            },
            {
                $unwind: "$saved_candidates", // Unwind saved_candidates to work with each saved candidate
            },
            {
                // Lookup caregiver full details from the same users collection
                $lookup: {
                    from: 'users', // Same users collection
                    localField: 'saved_candidates.userID', // Match saved candidate's userID
                    foreignField: 'userID', // Find the caregiver by their userID
                    as: 'caregiverData', // Store the matched caregiver data in this field
                },
            },
            {
                $unwind: "$caregiverData", // Unwind the matched caregiver data
            },
            {
                // Project only necessary fields from caregiver data
                $project: {
                    "caregiverData._id": 0,
                    "caregiverData.hash": 0, // Hide any unnecessary internal fields
                    "caregiverData.password": 0, // Hide password field if it exists
                    "caregiverData.auth": 0, // Hide auth details if they exist
                },
            },
        ];

        const caregivers = await usersCollection.aggregate(pipeline).toArray();

        // Check if results exist and return full caregiver data
        if (caregivers.length > 0) {
            return res.status(200).json({
                success: true,
                data: caregivers.map(c => c.caregiverData), // Extract full caregiver data
                message: 'Saved caregivers retrieved successfully',
            });
        } else {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No saved caregivers found',
            });
        }
    } catch (error) {
        console.error(`Error fetching saved caregivers: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`,
        });
    }
};

export const deleteJobById = async (req, res) => {
    const { id } = req.params; // Extract job ID from the request parameters

    try {
        // 1. Validate the ID
        // if (!new ObjectId.isValid(id)) {
        //     return res.status(400).json({ success: false, message: 'Invalid job ID format' });
        // }

        const { db } = await connectToDatabase();
        const jobsCollection = db.collection('jobs');

        // 2. Attempt to delete the job by its ID
        const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });

        // 3. Check if the job was successfully deleted
        if (result.deletedCount === 1) {
            return res.status(200).json({
                success: true,
                message: 'Job successfully deleted',
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Job not found or already deleted',
            });
        }
    } catch (err) {
        console.error(`Error deleting job: ${err.message}`);
        return res.status(500).json({
            success: false,
            message: `Server error: ${err.message}`,
        });
    }
};

export const updateFavoriteCandidate = async (req, res) => {
    const payload = req.body; // Payload from the request body

    // Destructure the relevant variables from the payload
    const { userID, fname, lname, licenses, hash, availability, type, geocode_address } = payload;

    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        // Determine the operation type (add or remove)
        switch (type) {
            case 'add':
                // 1. Add candidate to saved_candidates
                const addResult = await usersCollection.updateMany(
                    { hash: hash }, // Match the provider (employer) by their hash
                    {
                        $push: {
                            saved_candidates: {
                                $each: [
                                    {
                                        userID,
                                        availability,
                                        fname,
                                        lname,
                                        geocode_address,
                                        licenses,
                                    },
                                ],
                                $position: 0, // Add the new candidate at the beginning of the array
                            },
                        },
                    }
                );

                if (addResult.modifiedCount > 0) {
                    return res.status(200).json({
                        success: true,
                        message: 'Candidate has been added to favorites',
                    });
                } else {
                    return res.status(404).json({
                        success: false,
                        message: 'No matching provider found or no changes made',
                    });
                }

            case 'remove':
                // 2. Remove candidate from saved_candidates
                const removeResult = await usersCollection.updateMany(
                    { hash: hash }, // Match the provider (employer) by their hash
                    {
                        $pull: {
                            saved_candidates: {
                                userID,
                                availability,
                                fname,
                                lname,
                                geocode_address,
                                licenses,
                            },
                        },
                    }
                );

                if (removeResult.modifiedCount > 0) {
                    return res.status(200).json({
                        success: true,
                        message: 'Candidate has been removed from favorites',
                    });
                } else {
                    return res.status(404).json({
                        success: false,
                        message: 'No matching provider or candidate found for removal',
                    });
                }

            default:
                // If type is not 'add' or 'remove', return a 400 Bad Request
                return res.status(400).json({
                    success: false,
                    message: 'Invalid operation type. Use "add" or "remove".',
                });
        }
    } catch (err) {
        console.error(`Error updating favorite candidates: ${err.message}`);
        return res.status(500).json({
            success: false,
            message: `Server error: ${err.message}`,
        });
    }
};

export const searchCaregiversFilter = async (req, res) => {
    try {
      // Extract query parameters
      const { availability = [], licenses = [], page = 1, limit = 10 } = req.query;
       console.log(req.query)
      const { db } = await connectToDatabase();
      const caregiversCollection = db.collection("users");
  
      // Parse availability and licenses to arrays
      const availabilityFilter = Array.isArray(availability) ? availability : availability.split(",");
      const licensesFilter = Array.isArray(licenses) ? licenses : licenses.split(",");
        console.log(availabilityFilter)
      // Get user's IP address
      const userIp = req.headers["x-forwarded-for"] || req.connection.remoteAddress || "";
      if (!userIp) {
        return res.status(400).json({ success: false, message: "Cannot determine IP address" });
      }
  
      // Fetch geolocation using the helper function
      const { lat, lng } = await getGeoLocation(userIp);
  
      // Ensure page and limit are valid numbers
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, parseInt(limit));
      const skip = (pageNum - 1) * limitNum; // Calculate how many caregivers to skip
  
      // Build the aggregation pipeline
      const pipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [lng, lat], // Longitude, Latitude
            },
            distanceField: "dist.calculated",
            maxDistance: 50000, // 50 km radius
            spherical: true,
          },
        },
        {
          $match: {
            role: "caregiver", // Ensure only caregivers are matched
            complete:true,
            ...(availabilityFilter.length && { availability: { $all: availabilityFilter } }),
            ...(licensesFilter.length && { licenses: { $all: licensesFilter } }),
          },
        },
        {
          $sort: { created: -1 }, // Sort by the newest caregivers
        },
        {
          $skip: skip, // Skip caregivers for pagination
        },
        {
          $limit: limitNum, // Limit results for pagination
        },
      ];
  
      // Execute the pipeline
      const caregivers = await caregiversCollection.aggregate(pipeline).toArray();
  
      // Count total caregivers for the given query
      const totalCountPipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [lng, lat],
            },
            distanceField: "dist.calculated",
            maxDistance: 50000,
            spherical: true,
          },
        },
        {
          $match: {
            role: "caregiver",
            ...(availabilityFilter.length && { availability: { $all: availabilityFilter } }),
            ...(licensesFilter.length && { licenses: { $all: licensesFilter } }),
          },
        },
      ];
      const totalCaregivers = await caregiversCollection.aggregate(totalCountPipeline).toArray();
  
      // Return the caregivers and pagination info
      return res.status(200).json({
        success: true,
        message: "Caregivers fetched successfully",
        caregivers,
        pagination: {
          totalCaregivers: totalCaregivers.length,
          totalPages: Math.ceil(totalCaregivers.length / limitNum),
          currentPage: pageNum,
          limit: limitNum,
        },
      });
    } catch (error) {
      console.error("Error searching caregivers:", error.message);
      return res.status(500).json({
        success: false,
        message: "An error occurred while searching caregivers",
      });
    }
};
