import { connectToDatabase } from "../../utils/mongodb.js";
import { ObjectId } from "mongodb";
import { getGeocodeAddress, isValidZipcode } from "../../utils/helper.js";
export const createOrUpdateResume = async (req, res) => {
  try {
    const { userID } = req.params; // User ID from request params
    const payload = req.body; // Data from the request body

    // Connect to the MongoDB database
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const contactsCollection = db.collection('contacts');

    // Check if the user exists
    const user = await usersCollection.findOne({ userID: userID });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate and get geocode address using zipcode and city
    let geocodeAddress = null;
    if (isValidZipcode(payload.zipcode) && payload.city) {
      geocodeAddress = await getGeocodeAddress(payload.zipcode, payload.city); // Get geocode address
    }

    // Update user profile data (with or without file uploads)
    const updateData = {
      availability: payload.availability,
      fname: payload.fname,
      lname: payload.lname,
      name: `${payload.fname} ${payload.lname}`,
      certifications: payload.certifications,
      city: payload.city,
      complete: true,
      licenses: payload.licenses,
      created: new Date(),
      updated: new Date(),
      geocode_address: geocodeAddress ? { type: 'Point', coordinates: geocodeAddress } : user.geocode_address,
      hash: payload.hash || user.hash,
      mobility: payload.mobility,
      profileImage: payload.profileImage,
      resumeDocument: payload.resumeDocument,
      settings: {
        alert_preferences: payload.settings.alert_preferences,
        email: payload.settings.email,
        tel: payload.settings.tel,
        role: "caregiver",
      },
      zipcode: payload.zipcode,
    };

    // Update or insert the user's resume data
    await usersCollection.updateOne(
      { userID: userID },
      { $set: updateData },
      { upsert: true } // Insert if the user data doesn't exist
    );

    // Update contacts collection (optional: updating contact preferences)
    await contactsCollection.updateOne(
      { userID: userID },
      { $set: { alert_preferences: payload.settings.alert_preferences, complete: true } }
    );

    // Send the updated user data as response
    const updatedUser = await usersCollection.findOne({ userID: userID });
    res.status(200).json({
      message: 'Your resume has been updated successfully.',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating resume:', error);
    res.status(500).json({ message: 'There was a server error', error: error.message });
  }
};

// the AI Chat for voice flow 

/**
 * Save career recommendations for a user based on userID.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const saveCareerRecommendation = async (req, res) => {
  const { userID, recommendation } = req.body;

  // Validate input
  if (!userID || !recommendation) {
    return res.status(400).json({ success: false, message: 'userID and recommendation are required.' });
  }

  try {
    // Connect to the database
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // Update user document with new recommendation
    const result = await usersCollection.updateOne(
      { userID }, // Match user by userID
      {
        $push: { careerRecommendations: recommendation }, // Append recommendation to an array
      },
      { upsert: true } // If user doesn't exist, create the document
    );

    if (result.modifiedCount > 0 || result.upsertedCount > 0) {
      return res.status(200).json({
        success: true,
        message: 'Career recommendation saved successfully.',
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'User not found. Recommendation was not saved.',
      });
    }
  } catch (error) {
    console.error('Error saving career recommendation:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const getProviderProfile = async (req, res) => {
  try {
    const { providerId } = req.params; // Provider's unique userID from the URL
    const { page = 1, limit = 10 } = req.query; // Pagination parameters

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required.",
      });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection("users");
    const contactsCollection = db.collection("contacts");
    const jobsCollection = db.collection("jobs");

    // Step 1: Fetch provider's data from the `users` collection
    const provider = await usersCollection.findOne({ userID: providerId });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found.",
      });
    }

    // Step 2: Fetch additional details from the `contacts` collection
    const contactDetails = await contactsCollection.findOne(
      { userID: providerId },
      {
        projection: {
          complete: 1,
          verified: 1,
          payment_verified: 1,
          auth_mode: 1,
        },
      }
    );

    // Step 3: Pagination setup for jobs
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    // Step 4: Fetch jobs posted by the provider
    const jobsPipeline = [
      { $match: { userID: providerId, draft: false } }, // Match jobs posted by the provider and exclude drafts
      { $sort: { created: -1 } }, // Sort by newest first
      { $skip: skip }, // Skip based on pagination
      { $limit: limitNum }, // Limit number of jobs per page
    ];

    const jobs = await jobsCollection.aggregate(jobsPipeline).toArray();

    // Count total jobs for pagination
    const totalJobs = await jobsCollection.countDocuments({
      userID: providerId,
      draft: false,
    });

    // Combine provider data and contact details
    const providerData = {
      ...provider,
      contactDetails, // Includes `complete`, `verified`, `payment_verified`, `auth_mode`
    };

    // Step 5: Return the complete provider profile and jobs
    return res.status(200).json({
      success: true,
      provider: providerData,
      jobs,
      pagination: {
        totalJobs,
        totalPages: Math.ceil(totalJobs / limitNum),
        currentPage: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching provider profile:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching provider profile.",
    });
  }
};
