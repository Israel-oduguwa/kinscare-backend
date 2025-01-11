import { APIClient, SendEmailRequest, RegionUS } from "customerio-node";
import { connectToDatabase } from "../../../utils/mongodb.js";
import {generateReferralCode} from '../../../utils/helper.js'
// Initialize Customer.io API Client
const customerIO = new APIClient(process.env.CUSTOMERIO_API_KEY, { region: RegionUS });

/**
 * Sends referral emails to employers asking them to refer other employers.
 * @param {Object} payload - Data for sending referral email
 * @param {string} payload.to - Recipient email (employer)
 * @param {string} payload.employerName - Employer's name
 * @param {string} payload.organization - Organization name
 * @param {string} payload.referralLink - Unique referral link
 */
export const referToEmployer = async (req, res) => {
    // Ensure DB connection is set up once
    const { db } = await connectToDatabase();

    try {
        const {
            to, // Employer's email
            supervisorName, // Name of the supervisor/employer
            senderName, // Full name of the sender
            senderEmail, // Email of the sender
            organizationName, // Name of the organization
            senderUserID, // User ID of the sender
        } = req.body;
         console.log(req.body)

        // Validate required fields
        if (!to || !supervisorName || !senderName || !senderEmail || !organizationName || !senderUserID) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: 'to', 'supervisorName', 'senderName', 'senderEmail', 'organizationName', or 'senderUserID'.",
            });
        }
        
        // referralLink
        const referal_code = generateReferralCode(8);
        const referralLink  = `https://kinscarev2.vercel.app/employer/join?referal_code=${referal_code}` //${process.env.FRONTEND_BASEURL}
        
        // store the referral in the database

        const collection = db.collection("referral"); // Replace with your collection name

        // Document to be inserted
        const document = {
            referred_user: "id_pending",
            referred_by: senderUserID,
            referral_type: "employer",
            referral_code: referal_code,
            referral_email: to
        };

        // Insert the document into the collection
        const result = await collection.insertOne(document);


        // Prepare the email request for Customer.io
        const emailRequest = new SendEmailRequest({
            to,
            transactional_message_id: "28", // Replace with your actual Customer.io Transactional Message ID
            message_data: {
                supervisorName,
                senderName,
                senderEmail,
                organizationName,
                senderUserID,
                referralLink
            },
            identifiers: {
                email: to, // Ensure the recipient is uniquely identified
            },
        });
        
        // Send the email
        await customerIO.sendEmail(emailRequest);
        console.log(`Referral email sent successfully to: ${to}`);


        // Success response
        return res.status(200).json({
            success: true,
            message: `Referral email successfully sent to ${to}.`,
        });
    } catch (error) {
        console.error("Error sending referral email:", error.message);

        // Error response
        return res.status(500).json({
            success: false,
            message: "Failed to send the referral email.",
            error: error.message,
        });
    }
};


/**
 * Sends an invitation email to a friend's email.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const inviteFriends = async (req, res) => {
    try {
        const { to, senderName, referrerID, recipientName } = req.body;

        // Validate required fields
        if (!to || !senderName || !referrerID || !recipientName) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: 'to', 'senderName', 'referrerID', 'recipientName'.",
            });
        }

        // Prepare the email request for Customer.io
        const emailRequest = new SendEmailRequest({
            to,
            transactional_message_id: "29", // Replace with your Customer.io Transactional Message ID
            message_data: {
                senderName,
                referrerID,
                recipientName,
            },
            identifiers: {
                email: to,
            },
        });

        // Send the email
        await customerIO.sendEmail(emailRequest);
        console.log(`Invitation email sent successfully to: ${to}`);

        // Success response
        return res.status(200).json({
            success: true,
            message: `Invitation email sent to ${to}.`,
        });
    } catch (error) {
        console.error("Error sending invitation email:", error.message);

        // Error response
        return res.status(500).json({
            success: false,
            message: "Failed to send the invitation email.",
            error: error.message,
        });
    }
};
