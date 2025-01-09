import { FacebookAdsApi, AdAccount } from "facebook-nodejs-business-sdk";
import { init } from "mixpanel";
import dotenv from "dotenv";

dotenv.config();

// Initialize Mixpanel
const mixpanel = init(process.env.MIXPANEL_TOKEN, {
  host: process.env.MIXPANEL_HOST,
  secret: process.env.MIXPANEL_SECRET,
});

// Initialize Facebook Ads API
FacebookAdsApi.init(process.env.FACEBOOK_TOKEN);

// Fetch Facebook Ads campaign data
const fetchFacebookCampaigns = async () => {
  try {
    const account = new AdAccount(`act_${process.env.FACEBOOK_AD_ACCOUNT}`);
    const insights = await account.getInsights(
      ["campaign_id", "campaign_name", "spend", "impressions", "clicks"],
      {
        level: "campaign",
        date_preset: "yesterday",
        filtering: [
          {
            field: "spend",
            operator: "GREATER_THAN",
            value: 0,
          },
        ],
      }
    );
    return insights.map((insight) => ({
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      spend: parseFloat(insight.spend),
      impressions: parseInt(insight.impressions, 10),
      clicks: parseInt(insight.clicks, 10),
      date_start: insight.date_start,
    }));
  } catch (error) {
    console.error("Error fetching Facebook Ads metrics:", error.message);
    throw error;
  }
};

// Transform Facebook campaign data to Mixpanel event format
const transformCampaignToEvent = (campaign) => ({
  event: "Ad Data",
  properties: {
    $insert_id: `FB-${campaign.date_start}-${campaign.campaign_id}`,
    time: new Date(campaign.date_start).getTime(),
    source: "Facebook",
    campaign_id: campaign.campaign_id,
    utm_source: "facebook",
    utm_campaign: campaign.campaign_name,
    cost: campaign.spend,
    impressions: campaign.impressions,
    clicks: campaign.clicks,
  },
});

// Controller function to handle Facebook Ads → Mixpanel
export async function SendFacebookAdsMixpanel(req, res) {
  try {
    // Fetch campaigns from Facebook Ads
    const campaigns = await fetchFacebookCampaigns();
    console.log("Fetched Campaigns:", campaigns);

    // Transform campaigns into Mixpanel events
    const events = campaigns.map(transformCampaignToEvent);
    console.log("Transformed Events:", events);

    // Send events to Mixpanel
    mixpanel.import_batch(events, (err) => {
      if (err) {
        console.error("Mixpanel Import Error:", err);
        throw err;
      }
      res.status(200).send(`Imported ${events.length} events to Mixpanel.`);
    });
  } catch (err) {
    console.error("Error in Facebook Ads to Mixpanel:", err);
    res.status(500).send(err.message);
  }
}
