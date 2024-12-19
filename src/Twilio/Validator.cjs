// this is used for validation
const twilio = require("twilio");
// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_ACCOUNT_AUTH_TOKEN
);

module.exports.validatePhoneNumber = async (req, res) => {
  try {
    // Ensure it's a POST request
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method Not Allowed" });
    }

    // Destructure phone number from the request body
    const { phone } = req.body;

    // Validate input
    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required." });
    }

    // Use Twilio Lookup API to validate the phone number
    const phoneInfo = await client.lookups.v2.phoneNumbers(phone).fetch();

    // Check if the phone number is valid
    if (phoneInfo.valid) {
      return res.status(200).json({
        success: true,
        message: "Phone number is valid.",
        data: {
          phoneNumber: phoneInfo.phoneNumber,
          countryCode: phoneInfo.countryCode,
          carrier: phoneInfo.carrier, // Includes carrier information if available
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number.",
      });
    }
  } catch (error) {
    console.error("Error validating phone number:", error.message);

    // Handle Twilio-specific errors
    if (error.code) {
      return res.status(400).json({
        success: false,
        message: `Twilio error: ${error.message}`,
        code: error.code,
      });
    }

    // Generic server error
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred.",
    });
  }
};
