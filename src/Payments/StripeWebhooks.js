import Stripe from 'stripe';
import dotenv from "dotenv";
import { connectToDatabase } from "../../utils/mongodb.js";
dotenv.config();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_TEST_SECRETE_KEY || "", {
  apiVersion: "2022-11-15",
});
const endpointSecret = "whsec_YBxJ9Ayi6t8Uh9ZtFNPRhxGjEWoaL6MA";


export const handleStripeWebhook = async (req, res) => {
  const { db } = await connectToDatabase();
  const contactsCollection = db.collection("contacts");
  let event;

  try {
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // Subscription Created
      case "customer.subscription.created": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Fetch userID from the Stripe customer ID
        const user = await contactsCollection.findOne({ customer_id: customerId });
        if (user) {
          await contactsCollection.updateOne(
            { customer_id: customerId },
            { $set: { subscribed: true } }
          );
          console.log(`Subscription created for userID: ${user.userID}`);
        }
        break;
      }

      // Subscription Updated
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const user = await contactsCollection.findOne({ customer_id: customerId });
        if (user) {
          const trialEnded = subscription.status !== "trialing";
          const updateData = {
            subscribed: subscription.status === "active",
            trial: trialEnded ? "expired" : user.trial,
          };

          await contactsCollection.updateOne(
            { customer_id: customerId },
            { $set: updateData }
          );
          console.log(`Subscription updated for userID: ${user.userID}`);
        }
        break;
      }

      // Subscription Deleted
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const user = await contactsCollection.findOne({ customer_id: customerId });
        if (user) {
          await contactsCollection.updateOne(
            { customer_id: customerId },
            { $set: { subscribed: false, trial: "expired" } }
          );
          console.log(`Subscription deleted for userID: ${user.userID}`);
        }
        break;
      }

      // Payment Succeeded
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const user = await contactsCollection.findOne({ customer_id: customerId });
        if (user) {
          console.log(`Payment succeeded for userID: ${user.userID}`);
          // Optional: Update any subscription-related details
        }
        break;
      }

      // Payment Failed
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const user = await contactsCollection.findOne({ customer_id: customerId });
        if (user) {
          console.error(`Payment failed for userID: ${user.userID}`);
          // Optional: Add logic to notify the user or retry payment
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Error handling webhook event:", err.message);
    res.status(500).send(`Server Error: ${err.message}`);
  }
};