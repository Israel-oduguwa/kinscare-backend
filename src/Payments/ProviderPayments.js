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
      const { customerId, priceId, trialPeriodDays = 7 } = req.body;
  
      // Create a subscription with a free trial
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: "price_1QP2OuAoahxG9SLGNoc37Lxo" }],
        trial_period_days: trialPeriodDays, // Add free trial period
        expand: ['latest_invoice.payment_intent'],
      });
  
      res.status(200).json({
        success: true,
        message: 'Subscription with free trial created successfully',
        subscriptionId: subscription.id,
        subscription,
      });
    } catch (error) {
      console.error('Error creating subscription:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to create subscription',
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
  