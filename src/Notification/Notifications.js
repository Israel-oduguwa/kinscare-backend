import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../utils/mongodb.js";
export const handleNotifications = async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    if (req.method === "POST") {
      // **Create Notification**
      const {
        type,
        fromUserId,
        toUserId,
        message,
        metadata,
        senderType, // Added field for user type
      } = req.body;

      // Validate payload
      if (!type || !toUserId || !message || !senderType) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: 'type', 'toUserId', 'message', or 'senderType'.",
        });
      }

      // Construct the notification object
      const notification = {
        type,
        fromUserId,
        toUserId,
        senderType, // Specify whether it's for a provider or caregiver
        message,
        createdAt: new Date(),
        read: false, // Default to unread
        metadata: metadata || {}, // Optional metadata
      };

      // Insert the notification into the database
      const result = await notificationsCollection.insertOne(notification);

      return res.status(201).json({
        success: true,
        message: "Notification created successfully.",
        notificationId: result.insertedId,
      });
    }
  } catch (error) {
    console.error("Error handling notifications:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the request.",
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const { notificationId } = req.body;

    // Validate the notification ID
    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "'notificationId' is required.",
      });
    }

    let objectId;
    try {
      objectId = new ObjectId(notificationId); // Convert string to ObjectId
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format.",
      });
    }

    // Update the read status of the specified notification
    const result = await notificationsCollection.updateOne(
      { _id: objectId },
      { $set: { read: true } }
    );

    // Check if the notification was found and updated
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while marking the notification as read.",
    });
  }
};


export const fetchNotifications = async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection("notifications");

    const { userId, page = 1, limit = 10, unreadOnly = false } = req.query;

    // Validate required query parameter
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "'userId' query parameter is required.",
      });
    }

    // Pagination setup
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = { toUserId: userId }; // Match recipient
    if (unreadOnly === "true") {
      query.read = false; // Fetch only unread notifications if specified
    }

    // Fetch notifications
    const notifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 }) // Sort by most recent
      .skip(skip) // Skip based on pagination
      .limit(limitNum) // Limit results
      .toArray();

    // Get total notification count for pagination
    const totalNotifications = await notificationsCollection.countDocuments(query);

    // Build response
    return res.status(200).json({
      success: true,
      notifications,
      pagination: {
        total: totalNotifications,
        currentPage: pageNum,
        totalPages: Math.ceil(totalNotifications / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching notifications.",
    });
  }
};
