import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_TEST_SECRETE_KEY);


export const createCustomer = async (req, res) => {
  try {
    const { email, name } = req.body;

    // Create a customer in Stripe
    const customer = await stripe.customers.create({
      email,
      name,
    });

    // Respond with customer ID
    res.status(200).json({
      success: true,
      message: 'Customer created successfully',
      customerId: customer.id,
    });
  } catch (error) {
    console.error('Error creating customer:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message,
    });
  }
};

export const createSetupIntent = async (req, res) => {
  try {
    const { customerId } = req.body;

    // Create a SetupIntent in Stripe
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    //   console.log(setupIntent)

    // Respond with client secret for Stripe Elements
    res.status(200).json({
      success: true,
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating SetupIntent:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create SetupIntent',
      error: error.message,
    });
  }
};

export const createSubscription = async (req, res) => {
  try {
    const { customerId, priceId } = req.body;
    if (!customerId || !priceId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID and Price ID are required.",
      });
    }
    // Create a subscription in "default_incomplete" mode
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete", // Subscription will remain incomplete until confirmed
      expand: ["latest_invoice.payment_intent"], // Expand to include the payment intent
    });
    // Extract the client secret for the payment intent
    const clientSecret = subscription.latest_invoice.payment_intent.client_secret;

    res.status(200).json({
      success: true,
      subscription,
      message: "Subscription created successfully.",
      subscriptionId: subscription.id,
      clientSecret, // Return the client secret to the client
      subscription,
    });
  } catch (error) {
    console.error("Error creating subscription:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create subscription.",
      error: error.message,
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    // Cancel the subscription immediately
    const canceledSubscription = await stripe.subscriptions.del(subscriptionId);

    res.status(200).json({
      success: true,
      message: 'Subscription canceled successfully',
      canceledSubscription,
    });
  } catch (error) {
    console.error('Error canceling subscription:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message,
    });
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { subscriptionId, priceId } = req.body;

    // Update the subscription to a new plan
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].id,
          price: priceId, // New price ID
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      updatedSubscription,
    });
  } catch (error) {
    console.error('Error updating subscription:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription',
      error: error.message,
    });
  }
};

export const fetchSavedCards = async (req, res) => {
  try {
    const { customerId } = req.body;

    // Validate input
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required.",
      });
    }

    // Fetch saved payment methods for the customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    // Return the saved payment methods
    return res.status(200).json({
      success: true,
      message: "Saved cards fetched successfully.",
      data: paymentMethods.data,
    });
  } catch (error) {
    console.error("Error fetching saved cards:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching saved cards.",
      error: error.message,
    });
  }
};

export const createSubscriptionWithSavedCard = async (req, res) => {
  try {
    const { customerId, paymentMethodId, priceId } = req.body;

    // Validate input
    if (!customerId || !paymentMethodId || !priceId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID, Payment Method ID, and Price ID are required.",
      });
    }

    // Attach the payment method to the customer if not already attached
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

    // Set the default payment method for the customer
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Create a subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ["latest_invoice.payment_intent"],
    });

    // Return the subscription details
    return res.status(200).json({
      success: true,
      message: "Subscription created successfully.",
      subscriptionId: subscription.id,
      subscription,
    });
  } catch (error) {
    console.error("Error creating subscription:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while creating the subscription.",
      error: error.message,
    });
  }
};

export const getSubscriptionDetails = async (req, res) => {
  try {
    const { customerId } = req.params; // Get Stripe customer ID from request

    // Fetch subscription details for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all", // Fetch active, canceled, and past_due subscriptions
      limit: 1,
    });

    if (!subscriptions.data.length) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found for this customer.",
      });
    }

    const subscription = subscriptions.data[0]; // Get the most recent subscription

    return res.status(200).json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error("Error fetching subscription details:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching subscription details.",
      error: error.message,
    });
  }
};

export const updateSubscriptionPlan = async (req, res) => {
  try {
    const { subscriptionId, newPriceId } = req.body; // Get subscription ID and new plan's price ID

    // Update the subscription to the new plan
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: "create_prorations", // Adjust billing for the remaining period
    });

    return res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully.",
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("Error updating subscription plan:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update subscription plan.",
      error: error.message,
    });
  }
};

export const resumeSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    // Resume the subscription by updating its status
    const resumedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false, // Resume subscription
    });

    return res.status(200).json({
      success: true,
      message: "Subscription resumed successfully.",
      subscription: resumedSubscription,
    });
  } catch (error) {
    console.error("Error resuming subscription:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to resume subscription.",
      error: error.message,
    });
  }
};

export const getBillingHistory = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Fetch invoices for the customer
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 10, // Fetch the last 10 invoices
    });

    return res.status(200).json({
      success: true,
      message: "Billing history retrieved successfully.",
      invoices: invoices.data,
    });
  } catch (error) {
    console.error("Error fetching billing history:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch billing history.",
      error: error.message,
    });
  }
};
