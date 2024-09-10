import { APIClient, SendEmailRequest, RegionUS } from "customerio-node";
import { connectToDatabase } from "../../../utils/mongodb.js";

// Setting up the Customer.io API client
const customerIO = new APIClient(process.env.CUSTOMERIO_API_KEY, { region: RegionUS });

export default async function sendCaregiversAlert(req, res){
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }
    const {
        geocode_address,
        lname,
        fname,
        zipcode,
        availability,
        licenses,
        role,
        settings,
        city,
        userID
    } = req.body;
    console.log(role)

    if (role !== "caregiver") {
        return res.status(405).json({ message: "Only caregiver" });
    }

    const { db } = await connectToDatabase();
    const collection = await db.collection("users");

    const { coordinates } = geocode_address;
    const pipeline = [
        { $match: { role: "provider" } },
        { $sample: { size: 1 } },
    ];

    try {
        const users = await collection.aggregate(pipeline).toArray();
        const emailPromises = users.map((provider) =>
            sendEmail(provider, {
                fname,
                lname,
                userID,
                city,
                zipcode,
                licenses,
                availability,
            })
        );
        await Promise.all(emailPromises);

        res.status(200).json({ status: "success" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error });
    }
};

function sendEmail(
    provider,
    { fname, lname, city, zipcode, licenses, availability, userID }
) {
    const message_data = {
        USER: `${fname} ${lname}`,
        PROVIDER: `${provider.name}`,
        LOCATION: `${city}, ${zipcode}`,
        LICENSES: `${licenses}`,
        ID: userID,
        AVAILABILITY: `${availability}`,
    };

    const request = new SendEmailRequest({
        to: provider?.settings?.email,
        message_data,
        transactional_message_id: "11", // Replace with your Customer.io message id
        identifiers: {
            email: provider?.settings?.email,
        },
    });

    return customerIO.sendEmail(request).catch((error) => console.error(error));
}
// provider.settings.email
// provider.settings.email