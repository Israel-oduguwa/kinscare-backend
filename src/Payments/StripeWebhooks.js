import Stripe from "stripe";
import dotenv from "dotenv";
import { connectToDatabase } from "../../utils/mongodb.js";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_TEST_SECRETE_KEY || "", {
    apiVersion: "2022-11-15 ",
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
            endpointSecret //process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            // 1. Subscription Created (Handles free trial start)
            case "customer.subscription.created": {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                // Fetch user associated with the Stripe customer
                const user = await contactsCollection.findOne({ customer_id: customerId });
                if (user) {
                    const trialEnd = subscription.trial_end
                        ? new Date(subscription.trial_end * 1000).toISOString()
                        : null;

                    // Update trial start and expiration in the database
                    await contactsCollection.updateOne(
                        { customer_id: customerId },
                        {
                            $set: {
                                subscribed: false,
                                trial: "active",
                                trial_end_date: trialEnd, // Optional: Store trial end date for reference
                            },
                        }
                    );
                    console.log(`Free trial started for userID: ${user.userID}`);
                }
                break;
            }

            // 2. Trial Will End (Reminder for free trial expiration)
            case "customer.subscription.trial_will_end": {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                const user = await contactsCollection.findOne({ customer_id: customerId });
                if (user) {
                    // Notify the user via email or in-app notification (optional)
                    console.log(`Free trial will end soon for userID: ${user.userID}`);
                }
                break;
            }

            // 3. Subscription Updated (Handles trial expiration)
            case "customer.subscription.updated": {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                const user = await contactsCollection.findOne({ customer_id: customerId });
                if (user) {
                    const isTrialExpired = subscription.status === "active" && subscription.trial_end;
                    const isTrialActive = subscription.status === "trialing";

                    const updateData = {
                        subscribed: subscription.status === "active",
                        trial: isTrialActive ? "active" : isTrialExpired ? "expired" : user.trial,
                    };

                    await contactsCollection.updateOne(
                        { customer_id: customerId },
                        { $set: updateData }
                    );

                    console.log(
                        `Subscription updated for userID: ${user.userID}. Trial: ${updateData.trial}, Subscribed: ${updateData.subscribed}`
                    );
                }
                break;
            }

            // 4. Subscription Deleted (Handles cancellation during free trial)
            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                const user = await contactsCollection.findOne({ customer_id: customerId });
                if (user) {
                    await contactsCollection.updateOne(
                        { customer_id: customerId },
                        { $set: { subscribed: false, trial: "expired" } }
                    );
                    console.log(`Subscription canceled for userID: ${user.userID}`);
                }
                break;
            }

            // 5. Payment Succeeded (First payment after trial)
            case "invoice.payment_succeeded": {
                const invoice = event.data.object;
                const customerId = invoice.customer;

                const user = await contactsCollection.findOne({ customer_id: customerId });
                if (user) {
                    console.log(`Payment succeeded for userID: ${user.userID}`);
                    // Optional: Update subscription payment history or log
                }
                break;
            }

            // 6. Payment Failed
            case "invoice.payment_failed": {
                const invoice = event.data.object;
                const customerId = invoice.customer;

                const user = await contactsCollection.findOne({ customer_id: customerId });
                if (user) {
                    console.error(`Payment failed for userID: ${user.userID}`);
                    // Optional: Notify user or retry payment
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
