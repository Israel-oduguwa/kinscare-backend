import { APIClient, SendEmailRequest, RegionUS } from "customerio-node";
import { connectToDatabase } from "../../../utils/mongodb.js";
const customerIO = new APIClient(process.env.CUSTOMERIO_API_KEY, { region: RegionUS });

export const sendReferralEmail = async () =>{
    // send refer emails to the employer 
}