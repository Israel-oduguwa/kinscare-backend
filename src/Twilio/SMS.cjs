// this is used for validation
const twilio = require("twilio");
// Initialize Twilio client
const SID="ACf74503b1d79d4249214a626c95f3c7b2";
const AuthT="4893f8fac21f9c8a2d24fdfaba8d3f76";

const PhoneNumber ="12063097500" 
const client = twilio(
SID,
AuthT
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
      from: PhoneNumber, // Twilio verified phone number
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
