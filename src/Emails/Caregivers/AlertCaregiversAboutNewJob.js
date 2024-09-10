/**
 * This triggers sends email to caregivers when a new job is posted by an employer within 45 miles
 * @params - {changeEvent | Object } - the new job post that has been created
 * @returns - {none}
 */

import { APIClient, SendEmailRequest, RegionUS } from "customerio-node";
import { connectToDatabase } from "../../../utils/mongodb.js";

// Setting up the Customer.io API client
const customerIO = new APIClient(process.env.CUSTOMERIO_API_KEY, { region: RegionUS });

export default async function sendJobAlerts(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }
    const {
        geocode_address,
        userID,
        contacts,
        title,
        licenses,
        _id,
        schedule,
        compensation,
    } = req.body;
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection("users");

        // Extract coordinates
        const { coordinates } = geocode_address;

        // Aggregation pipeline to find caregivers within 45 miles (70,000 meters)
        const pipeline = [
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: [coordinates.lng, coordinates.lat],
                    },
                    distanceField: "distance",
                    maxDistance: 70000, // 70 kilometers ~ 45 miles
                    query: { role: "caregiver" }, // Adjust query as needed
                    spherical: true,
                    distanceMultiplier: 1 / 1609, // Convert meters to miles
                },
            },
            {
                $project: {
                    distance: { $ceil: "$distance" },
                    fname: 1,
                    lname: 1,
                    "settings.email": 1,
                },
            },
        ];

        // Fetch caregivers close to the job location
        const caregivers = await collection.aggregate(pipeline).toArray();

        if (!caregivers.length) {
            return res.status(200).json({ message: "No caregivers found within the specified distance." });
        }

        // Fetch the provider who posted the job
        const provider = await collection.findOne(
            { userID },
            { projection: { _id: 0, name: 1 } }
        );

        if (!provider) {
            return res.status(404).json({ message: "Provider not found." });
        }

        // Shuffle caregivers to randomize the selection
        const shuffledCaregivers = shuffle(caregivers);

        // Limit to max 1000 caregivers
        const maxCaregivers = 1000;
        const selectedCaregivers = shuffledCaregivers.slice(0, maxCaregivers);

        // Send emails to selected caregivers
        await Promise.all(
            selectedCaregivers.map(async (caregiver) => {
                if (!caregiver.settings || !caregiver.settings.email) {
                    console.warn(`Skipping caregiver ${caregiver.fname} ${caregiver.lname} due to missing email.`);
                    return;
                }

                const message_data = {
                    RECIPIENT: `${caregiver.fname} ${caregiver.lname}`,
                    PROVIDER: provider.name,
                    LOCATION: `${contacts.address} ${contacts.city}, ${contacts.zipcode}`,
                    LICENSES: licenses,
                    ID: _id,
                    SCHEDULE: schedule,
                    TITLE: title,
                    COMPENSATION: compensation,
                };

                const request = new SendEmailRequest({
                    to: caregiver.settings.email,
                    transactional_message_id: "12", // Replace with your transactional message id
                    message_data,
                    identifiers: {
                        email: caregiver.settings.email,
                    },
                });

                console.log(`Mail sent successfully to ${caregiver.settings.email}`);
                await customerIO.sendEmail(request);
            })
        );
        res.status(200).json({ message: "Job alert emails sent successfully.", recipients: selectedCaregivers.length });
    } catch (error) {
        console.error("Error sending job alerts:", error);
        res.status(500).json({ message: "An error occurred while sending job alerts.", error: error.message });
    }
}

// Utility function to shuffle an array
function shuffle(array) {
    let currentIndex = array.length,
        temporaryValue,
        randomIndex;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
