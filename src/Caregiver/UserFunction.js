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
            updated:new Date(),
            geocode_address: geocodeAddress ? { type: 'Point', coordinates: geocodeAddress } : user.geocode_address,
            hash: payload.hash || user.hash,
            mobility: payload.mobility,
            profileImage: payload.profileImage,
            resumeDocument: payload.resumeDocument,
            settings: {
                alert_preferences: payload.settings.alert_preferences,
                email: payload.settings.email,
                tel: payload.settings.tel,
                role:"caregiver",
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
