import express from "express";
import { buffer } from "micro";
import Stripe from "stripe";
import { connectToDatabase } from "../../utils/mongodb.js";

const stripe = new Stripe(process.env.STRIPE_TEST_SECRETE_KEY || "", {
    apiVersion: "2022-11-15",
});

// const endpointSecret = "whsec_YBxJ9Ayi6t8Uh9ZtFNPRhxGjEWoaL6MA";
const endpointSecret = "whsec_YBxJ9Ayi6t8Uh9ZtFNPRhxGjEWoaL6MA";


export const handleStripeWebhook = async (req, res) => {
    let event;

    try {
        // Read the raw body using req.rawBody
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        const { db } = await connectToDatabase();
        const contactsCollection = db.collection("contacts");
        const customerId = event.data.object?.customer;

        // Switch-case to handle different webhook events
        switch (event.type) {
            case "invoice.payment_succeeded": {
                // console.log(`Payment succeeded for customer ${customerId}`);
                const invoice = event.data.object;

                // Check if there's a subscription attached to the payment
                const subscriptionId = invoice.subscription;
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                // Update the database
                await contactsCollection.updateOne(
                    { customer_id: customerId },
                    {
                        $set: {
                            subscription_id: subscriptionId, // Save subscription ID
                            subscribed: true, // Mark user as subscribed
                            trial: "expired", // Mark trial as expired
                            subscription_start_date: new Date(
                                subscription.current_period_start * 1000
                            ).toISOString(), // Start date in ISO format
                            subscription_end_date: new Date(
                                subscription.current_period_end * 1000
                            ).toISOString(), // End date in ISO format
                            subscription_status: "complete", // Subscription status
                            plan: subscription.plan.nickname, // Save the plan name (if available)
                            plan_id: subscription.plan.id, // Save the plan ID
                            payment_verified: true, // Payment verified
                        },
                    }
                );
                break;
            }

            case "invoice.payment_failed": {
                // console.log(`Payment failed for customer ${customerId}`);
                const invoice = event.data.object;

                // Update the database with payment failure status
                await contactsCollection.updateOne(
                    { customer_id: customerId },
                    {
                        $set: {
                            subscribed: false, // Mark as not subscribed
                            subscription_status: "payment_failed", // Status for payment failure
                            payment_verified: false, // Payment not verified
                            payment_failure_reason: invoice.failure_reason || "unknown", // Capture failure reason
                        },
                    }
                );
                break;
            }

            case "customer.subscription.created": {
                // console.log(`Subscription created for customer ${customerId}`);
                const subscriptionCreated = event.data.object;

                await contactsCollection.updateOne(
                    { customer_id: customerId },
                    {
                        $set: {
                            subscription_id: subscriptionCreated.id, // Save subscription ID
                            // subscription_status: "active", // Mark subscription as active
                            // subscribed: true, // Mark user as subscribed
                            subscription_start_date: new Date(
                                subscriptionCreated.current_period_start * 1000
                            ).toISOString(), // Start date in ISO format
                            subscription_end_date: new Date(
                                subscriptionCreated.current_period_end * 1000
                            ).toISOString(), // End date in ISO format
                            plan: subscriptionCreated.items.data[0].plan.nickname, // Save the plan name
                            plan_id: subscriptionCreated.items.data[0].plan.id, // Save the plan ID
                        },
                    }
                );
                break;
            }

            case "customer.subscription.updated": {
                // console.log(`Subscription updated for customer ${customerId}`);
                const subscriptionUpdated = event.data.object;

                await contactsCollection.updateOne(
                    { customer_id: customerId },
                    {
                        $set: {
                            subscription_status: subscriptionUpdated.status, // Update subscription status
                            subscription_start_date: new Date(
                                subscriptionUpdated.current_period_start * 1000
                            ).toISOString(), // Start date
                            subscription_end_date: new Date(
                                subscriptionUpdated.current_period_end * 1000
                            ).toISOString(), // End date
                            plan: subscriptionUpdated.items.data[0].plan.nickname, // Plan name
                            plan_id: subscriptionUpdated.items.data[0].plan.id, // Plan ID
                        },
                    }
                );
                break;
            }

            case "customer.subscription.deleted": {
                // console.log(`Subscription canceled for customer ${customerId}`);
                const subscriptionDeleted = event.data.object;

                await contactsCollection.updateOne(
                    { customer_id: customerId },
                    {
                        $set: {
                            subscription_status: "expired", // Mark as expired
                            subscribed: false, // Mark user as not subscribed
                            expiry_date: new Date(), // Record the date the subscription expired
                            trial: "expired", // Ensure trial is expired
                        },
                    }
                );
                break;
            }

            case "customer.updated": {
                // console.log(`Customer updated: ${customerId}`);
                const customerUpdated = event.data.object;

                await contactsCollection.updateOne(
                    { customer_id: customerUpdated.id },
                    { $set: { email: customerUpdated.email } } // Update other fields as needed
                );
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Acknowledge receipt of the event
        res.status(200).json({ received: true });
    } catch (err) {
        console.error("Error processing Stripe webhook:", err.message);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
