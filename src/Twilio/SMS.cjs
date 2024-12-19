// this is used for validation
const twilio = require("twilio");
// Initialize Twilio client
const TWILIO_ACCOUNT_SID="ACf74503b1d79d4249214a626c95f3c7b2"
const TWILIO_ACCOUNT_AUTH_TOKEN="35fea1036f93945a92f915bfad682307"
const TWILIO_PHONE_NUMBER ="12063097500"
const client = twilio(
TWILIO_ACCOUNT_SID,
TWILIO_ACCOUNT_AUTH_TOKEN
);

module.exports.sendSMS = async (req, res) => {
  try {
    // Destructure body and recipient from the request body
    const { body: messageBody, to } = req.body;

    // Validate required fields
    if (!messageBody || !to) {
      return res.status(400).json({
        success: false,
        message: "Body and recipient ('to') are required.",
      });
    }

    // Send the SMS using Twilio
    const send = await client.messages.create({
      body: messageBody,
      from: TWILIO_PHONE_NUMBER, // Twilio verified phone number
      to,
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Message sent successfully.",
      data: {
        sid: send.sid, // Message SID
        to: send.to, // Recipient
        body: send.body, // Message body
        status: send.status, // Message status
      },
    });
  } catch (error) {
    console.error("Error sending message:", error.message);

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
      message: "Failed to send message.",
      error: error.message || "Unknown error occurred.",
    });
  }
};
