// import { connectToDatabase } from "../../utils/mongodb";
import { APIClient, RegionUS } from "customerio-node";

const customerIO = new APIClient(process.env.CUSTOMERIO_API_KEY, {
  region: RegionUS,
});

export default async  function supportResources(req, res){
  // Construct pipeline for fetching caregivers who have selected to be alerted by email
  try {
    // Get users collections
    const data= {}
    const campaignId = "27";
    customerIO.triggerBroadcast(campaignId, data, { segment: { id: 29 } });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log("error in sending daily job opening transactional -> ", err);
    return res.status(500).json({ err });
  }
};

// DONE 