import { GoogleAdsApi } from "google-ads-api";
import { init } from "mixpanel";
import dotenv from "dotenv";

dotenv.config();

const mixpanel = init(process.env.MIXPANEL_TOKEN, {
    host: "api.mixpanel.com",
    secret: process.env.MIXPANEL_SECRET,
});

const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

// Fetch campaigns with ad spend data for "Yesterday"
const fetchGoogleAdsCampaigns = async () => {
    const customer = client.Customer({
        customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
        refresh_token: process.env.GOOGLE_CLIENT_REFRESH_TOKEN,
    });

    return customer.query(`
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions
    FROM
      campaign
    WHERE
      metrics.cost_micros > 0
    AND
      segments.date DURING YESTERDAY
  `);
};

// Transform campaign data into Mixpanel event
const transformCampaignToEvent = (campaign) => ({
    event: "Ad Data",
    properties: {
        $insert_id: `G-${campaign.segments.date}-${campaign.campaign.id}`,
        time: new Date(campaign.segments.date).getTime(), // Unix timestamp
        source: "Google",
        campaign_id: campaign.campaign.id,
        utm_source: "google",
        utm_campaign: campaign.campaign.name,
        cost: campaign.metrics.cost_micros / 1_000_000, // Convert to currency
        impressions: campaign.metrics.impressions,
        clicks: campaign.metrics.clicks,
    },
});

// Controller function to fetch data and send to Mixpanel
export async function SendGoogleAdsMixpanel(req, res) {
    try {
        // Fetch Google Ads campaigns
        const campaigns = await fetchGoogleAdsCampaigns();
        console.log("Campaigns:", campaigns);

        // Transform campaigns into Mixpanel events
        const events = campaigns.map(transformCampaignToEvent);
        console.log("Events:", events);

        // Send events to Mixpanel
        mixpanel.import_batch(events, (err) => {
            if (err) {
                console.error("Mixpanel Import Error:", err);
                throw err;
            }
            res.status(200).send(`Imported ${events.length} events to Mixpanel.`);
        });
    } catch (err) {
        console.error("Error in Google Ads to Mixpanel:", err);
        res.status(500).send(err.message);
    }
}
