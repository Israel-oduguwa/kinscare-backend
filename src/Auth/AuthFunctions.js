import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../utils/mongodb.js';
import crypto from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// apitesting@gmail.com
// {userID:"66fba4a882ab502fcebdcd93"}
//kinscaredev db name 

// caregiver testing 
// apicaregivertesting@gmail.com
// "66fbb15bb960639d1e3c7324" {userID:"66fbb15bb960639d1e3c7324"}

// apiprovidertesting@gmail.com


// Ensure DB connection is set up once
const { db } = await connectToDatabase();



import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_TEST_SECRETE_KEY);

// Helper to create a Stripe customer
const createStripeCustomer = async (email, name) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
    });
    return customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error.message);
    throw new Error('Failed to create Stripe customer');
  }
}
// Utility function for creating MD5 hashes
const createHash = (data) => crypto.createHash('md5').update(data).digest('hex');

// Helper function for phone number validation and formatting
const formatPhoneNumber = (tel) => {
  const phoneNumber = parsePhoneNumberFromString(tel, 'US');
  return phoneNumber ? phoneNumber.format('E.164') : null;
};

// Centralized error handler for missing fields
const validateRequiredFields = (payload, requiredFields) => {
  const missingFields = requiredFields.filter(field => !payload[field]);
  if (missingFields.length) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
};

// Modular helper function for updating or inserting records
const upsertUserAndContact = async (userObject, contactObject, users, contacts, emailHash) => {
  await Promise.all([
    users.updateOne({ hash: emailHash }, { $set: userObject }, { upsert: true }),
    contacts.updateOne({ email: contactObject.email }, { $set: contactObject }, { upsert: true })
  ]);
};

// Main controller function for creating/updating user data
export const createUserData = async (req, res, next) => {
  try {
    const {
      email,
      tel,
      auth_mode,
      fname,
      lname,
      userID,
      role,
      userIp,
      route,
      geocode_address,
      city,
      address,
      otp_hash,
    } = req.body;

    // Validate required fields
    validateRequiredFields(req.body, ['email', 'auth_mode', 'userID']);

    // Access collections
    const users = db.collection('users');
    const contacts = db.collection('contacts');
    const trials_track = db.collection('trials_track');

    // Check trial status
    const trialCheck = await trials_track.findOne({ email });
    const trial = !trialCheck || !(trialCheck.jobsPosted > 2 || trialCheck.hasUsedFreeTrial);

    // Format the phone number if provided
    const formattedTel = formatPhoneNumber(tel);

    // Create email hash for users and contacts
    const emailHash = createHash(email);

    // Create Stripe Customer if role is 'provider'
    let customer_id = null;
    if (role === 'provider') {
      try {
        customer_id = await createStripeCustomer(email, `${fname} ${lname}`);
      } catch (error) {
        console.error('Failed to create Stripe customer. Proceeding without it:', error.message);
      }
    }

    // Build reusable contact and user objects based on common logic
    const contactObject = {
      email,
      auth_mode,
      userID,
      tel: formattedTel,
      role,
      route,
      created: new Date(),
      trial: role === 'provider' ? trial : undefined,
      fname: fname || '',
      lname: lname || '',
      otp_hash: auth_mode === 'otp' ? otp_hash : '',
      customer_id, // Add Stripe customer ID here so no matter where the user is coming from customer Id would always be created here
      hash: emailHash,
      verified: auth_mode === 'oauth2-google' || auth_mode === 'oauth2-facebook',
      telVerification: false,
    };

    const userObject = {
      auth: {
        mode: auth_mode,
        email,
        tel: formattedTel,
        acquisition_channel: 'Web',
      },
      userID,
      role: role || '',
      userIp,
      geocode_address: geocode_address ? { type: 'Point', coordinates: geocode_address } : undefined,
      city,
      address,
      fname: fname || '',
      lname: lname || '',
      returning: false,
      complete: false,
      created: new Date(),
      hash: emailHash,
      customer_id, // Add Stripe customer ID here
    };

    // Insert or update user and contact records
    await upsertUserAndContact(userObject, contactObject, users, contacts, emailHash);

    // Return the added or updated user data
    const addedUser = await users.findOne({ 'auth.email': email });
    res.status(200).json({
      message: 'User has been added or updated.',
      data: addedUser,
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    next(error); // Pass error to Express error handling middleware
  }
};

export const fetchUserData = async (req, res, next) => {
  try {
    const { userID } = req.params;

    if (!userID) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Connect to the MongoDB database
    const { db } = await connectToDatabase();

    // Query the database to find the user by userID
    const userData = await db.collection('users').findOne({ userID });

    // Handle case where user is not found
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return the user data in the response
    res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// This is for performing crud operations from the client side 
export const dynamicCRUDOperation = async (req, res) => {
  const { collectionName, operation, filter, update, options, pipeline } = req.body; // Destructure incoming request

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(collectionName); // Get the collection dynamically

    let result;

    switch (operation) {
      case 'updateOne':
        // Perform updateOne operation
        result = await collection.updateOne(filter, update, options || {});
        break;

      case 'updateMany':
        // Perform updateMany operation
        result = await collection.updateMany(filter, update, options || {});
        break;

      case 'deleteOne':
        // Perform deleteOne operation
        result = await collection.deleteOne(filter);
        break;

      case 'deleteMany':
        // Perform deleteMany operation
        result = await collection.deleteMany(filter);
        break;

      case 'findOne':
        // Perform findOne operation
        result = await collection.findOne(filter, options || {});
        break;

      case 'find':
        // Perform find operation (return array)
        result = await collection.find(filter, options || {}).toArray();
        break;

      case 'aggregate':
        // Perform aggregation pipeline operation
        if (!Array.isArray(pipeline)) {
          return res.status(400).json({
            success: false,
            message: 'Pipeline must be an array for aggregate operation.',
          });
        }
        result = await collection.aggregate(pipeline).toArray();
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid operation. Use updateOne, updateMany, deleteOne, deleteMany, findOne, find, or aggregate.',
        });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: `${operation} operation performed successfully.`,
      result,
    });
  } catch (error) {
    console.error(`Error performing ${operation}: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
    });
  }
};


// Function to delete user data by email
export const deleteUser = async (req, res) => {
  try {
    // Connect to MongoDB
    const { db } = await connectToDatabase();
    const users = db.collection("users");
    const contacts = db.collection("contacts");
    const jobs = db.collection("jobs");
    const trialsTrack = db.collection("trials_track");

    // List of emails to delete
    const emailsToDelete = [
      "apiprovidertesting@gmail.com"
    ];

    const deleted = []; // Array to store deleted user details

    // Iterate through each email and delete associated documents
    for (const email of emailsToDelete) {
      // Step 1: Find user by email in the contacts collection
      const userToDelete = await contacts.findOne({ email });

      if (userToDelete) {
        const userID = userToDelete.userID;

        // Step 2: Delete related documents in users, contacts, and jobs collections
        await users.deleteOne({ userID });
        await contacts.deleteMany({ userID });
        await jobs.deleteMany({ userID });

        // Step 3: Delete documents in trials_track collection where email matches
        await trialsTrack.deleteMany({ email });

        // Add the deleted user to the array
        deleted.push(userToDelete);
      }
    }

    // Return success response
    res.status(200).json({ message: "Data deletion successful", deleted });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};