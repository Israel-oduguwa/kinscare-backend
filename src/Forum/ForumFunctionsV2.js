import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../utils/mongodb.js';
import sanitizeHtml from 'sanitize-html';
// Connect to the database once when the module is loaded
const { db } = await connectToDatabase();

/**
 * Creates a new thread with an initial post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const createThread = async (req, res) => {
    // Extract data from the request body
    const { title, content, userID, categories, tags, imageUrl } = req.body;
    // we would sanitize the html before entering into the server 
    const cleanContent = sanitizeHtml(content);
    try {
        // Get references to the collections we'll be working with
        const threads = db.collection('threads');
        const posts = db.collection('posts');

        // Create a new thread object
        const newThread = {
            title,
            creator: new ObjectId(userID),
            categories: categories || [],
            tags: tags || [],
            status: 'open',
            posts: [], // Will store post IDs
            views: 0,
            imageUrl,
            replies: 0,
            content: cleanContent,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Insert the new thread into the database
        const threadResult = await threads.insertOne(newThread);
        const threadId = threadResult.insertedId;

        // // Create the initial post for this thread
        // const newPost = {
        //     threadId: threadId,
        //     content,
        //     author: new ObjectId(userID),
        //     parent: null, // This is a top-level post
        //     children: [], // Will store reply IDs
        //     mentions: extractMentions(content),
        //     createdAt: new Date(),
        // };

        // // Insert the new post into the database
        // const postResult = await posts.insertOne(newPost);

        // // Update the thread to include the ID of the initial post
        // await threads.updateOne(
        //     { _id: threadId },
        //     { $push: { posts: postResult.insertedId } }
        // );

        // There is no need to create another post for the thread, since the user is the one posting it  the content should be along the post 

        // Send a success response
        res.status(201).json({ success: true, threadId });
    } catch (error) {
        console.error('Error creating thread:', error);
        res.status(500).json({ success: false, message: 'Failed to create thread.' });
    }
};

/**
 * Creates a new post in an existing thread
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const createPostInThread = async (req, res) => {
    // Extract data from the request body
    const { threadId, content, userID } = req.body;
    console.log(threadId)
    try {
        // Get references to the collections we'll be working with
        const threads = db.collection('threads');
        const posts = db.collection('posts');

        // we would sanitize the html before entering into the server 
        const cleanContent = sanitizeHtml(content);

        // Create a new post object
        const newPost = {
            threadId: new ObjectId(threadId),
            content: cleanContent,
            author: new ObjectId(userID),
            parent: null, // This is a top-level post
            children: [], // Will store reply IDs
            mentions: extractMentions(content),
            createdAt: new Date(),
        };

        // Insert the new post into the database
        const postResult = await posts.insertOne(newPost);
        const postId = postResult.insertedId;

        // Update the thread to include the new post and increment reply count
        await threads.updateOne(
            { _id: new ObjectId(threadId) },
            {
                $push: { posts: postId },
                $inc: { replies: 1 },
                $set: { updatedAt: new Date() },
            }
        );

        // Send a success response
        res.status(201).json({ success: true, message: 'Post added to thread successfully', postId });
    } catch (error) {
        console.error('Error creating post in thread:', error);
        res.status(500).json({ success: false, message: 'Failed to create post in thread.' });
    }
};

/**
 * Adds a reply to an existing post in a thread
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const replyToPostInThread = async (req, res) => {
    // Extract data from the request body
    const { threadId, parentId, content, userID } = req.body;

    try {
        // Get references to the collections we'll be working with
        const posts = db.collection('posts');
        const threads = db.collection('threads');

        // we would sanitize the html before entering into the server 
        const cleanContent = sanitizeHtml(content);

        // Create a new reply object
        const newReply = {
            threadId: new ObjectId(threadId),
            content: cleanContent,
            author: userID, // UserID is a string
            parent: new ObjectId(parentId), // This links the reply to its parent post
            mentions: extractMentions(content), // Function to extract mentioned user IDs from content
            createdAt: new Date(),
        };

        // Insert the new reply into the database
        const replyResult = await posts.insertOne(newReply);
        const replyId = replyResult.insertedId;

        // Update the parent post to include this reply in its children array
        await posts.updateOne(
            { _id: new ObjectId(parentId) },
            {
                $push: { children: replyId },
                $inc: { replies: 1 }, // Increment reply count for the parent post
                $set: { updatedAt: new Date() } // Update the timestamp for last activity
            }
        );
        // Send a success response
        res.status(201).json({ success: true, message: 'Reply added successfully', replyId });
    } catch (error) {
        console.error('Error replying to post in thread:', error);
        res.status(500).json({ success: false, message: 'Failed to reply to post in thread.' });
    }
};


/**
 * Retrieves a paginated list of threads with optional filtering and sorting
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
// export const getThreads = async (req, res) => {
//     try {
//         const threads = db.collection('threads');
//         const { filter, sort, category, tag, status, page = 1, limit = 10 } = req.query;

//         // Build the query object based on provided filters
//         const query = {};
//         if (filter) query.title = { $regex: filter, $options: 'i' }; // Case-insensitive title search
//         if (category) query.categories = category;
//         if (tag) query.tags = tag;
//         if (status) query.status = status;

//         // Determine the sort order
//         const sortOption = sort === 'most_replied' ? { replies: -1 } : { createdAt: -1 };

//         // Build the aggregation pipeline
//         const pipeline = [
//             { $match: query }, // Apply filters
//             { $sort: sortOption }, // Apply sorting
//             {
//                 $addFields: {
//                     creatorString: { $toString: "$creator" } // Convert ObjectId to string
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'users', // The collection name where user information is stored
//                     localField: 'creatorString', // The field in 'threads' collection that contains the user ID
//                     foreignField: 'userID', // The field in 'users' collection that contains the user ID
//                     as: 'creator' // The name of the field to add to each output document
//                 }
//             },

//             {
//                 $unwind: {
//                     path: '$creator',
//                     preserveNullAndEmptyArrays: true // Keep threads even if no user information is found
//                 }
//             },
//             {
//                 $facet: {
//                     metadata: [{ $count: "total" }, { $addFields: { page: Number(page), limit: Number(limit) } }],
//                     data: [{ $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) }]
//                 }
//             }
//         ];

//         // Execute the aggregation
//         const result = await threads.aggregate(pipeline).toArray();

//         // Extract metadata and data from the result
//         const metadata = result[0].metadata[0] || { total: 0, page, limit };
//         const data = result[0].data;

//         // Map over data to format the creator object
//         const formattedData = data.map(thread => ({
//             ...thread,
//             creator: thread.creator ? {
//                 userID: thread.creator.userID,
//                 complete: thread.creator.complete,
//                 fname: thread.creator.fname,
//                 lname: thread.creator.lname
//             } : null
//         }));

//         // Send the response with pagination info
//         res.status(200).json({
//             success: true,
//             data: formattedData,
//             pagination: {
//                 total: metadata.total,
//                 page: metadata.page,
//                 limit: metadata.limit,
//                 pages: Math.ceil(metadata.total / metadata.limit)
//             }
//         });
//     } catch (error) {
//         console.error('Error retrieving threads:', error);
//         res.status(500).json({ success: false, message: 'Failed to retrieve threads.' });
//     }
// };

/**
 * Retrieves a specific thread by its ID, including all its posts
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const getThreadById = async (req, res) => {
    const { threadId } = req.params;

    try {
        const { db } = await connectToDatabase();
        const threads = db.collection("threads");
        const posts = db.collection("posts");
        const users = db.collection("users");

        // Find the thread by its ID
        const thread = await threads.findOne({ _id: new ObjectId(threadId) });

        // If the thread doesn't exist, return a 404 error
        if (!thread) {
            return res.status(404).json({ success: false, message: "Thread not found" });
        }

        // Fetch the user data for the creator
        const user = await users.findOne({ userID: thread.creator });

        if (!user) {
            return res.status(404).json({ success: false, message: "Creator not found" });
        }

        // Increment the view count for this thread
        await threads.updateOne({ _id: new ObjectId(threadId) }, { $inc: { views: 1 } });

        // Return the thread data and all user data
        res.status(200).json({ success: true, thread, creator: user });
    } catch (error) {
        console.error("Error retrieving thread by ID:", error);
        res.status(500).json({ success: false, message: "Failed to retrieve thread by ID." });
    }
};


export const getPostsInThread = async (req, res) => {
    console.log("hit Db");
    // Extract the threadId from the request parameters
    const { threadId } = req.params;
    // Extract pagination parameters from the query string, with defaults
    const { page = 1, limit = 10000 } = req.query;

    try {
        const posts = db.collection('posts');
        const users = db.collection('users');

        // Build the aggregation pipeline
        const pipeline = [
            {
                $match: {
                    threadId: new ObjectId(threadId),
                    parent: null
                }
            }, // Get only top-level posts
            {
                $sort: {
                    createdAt: -1
                }
            }, // Sort by creation date, newest first
            {
                $addFields: {
                    authorString: { $toString: "$author" } // Convert ObjectId to string
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'authorString', // Use the converted string field
                    foreignField: 'userID', // Field in the users collection (string)
                    as: 'authorData'
                }
            },
            {
                $unwind: {
                    path: '$authorData',
                    preserveNullAndEmptyArrays: true // If no match is found, `authorData` will be null
                }
            },
            {
                $facet: {
                    // Get metadata (total count and pagination info)
                    metadata: [{ $count: "total" }, { $addFields: { page: Number(page), limit: Number(limit) } }],
                    // Get paginated data
                    data: [{ $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) }]
                }
            }
        ];

        // Execute the aggregation
        const result = await posts.aggregate(pipeline).toArray();

        // Extract metadata and data from the result
        const metadata = result[0].metadata[0] || { total: 0, page, limit };
        const data = result[0].data;
        console.log(data)
        // Send the response with pagination info
        res.status(200).json({
            success: true,
            posts: data.map(post => ({
                ...post,
                author: post.authorData ? { // Transform `authorData` to only include desired fields
                    userID: post.authorData.userID,
                    complete: post.authorData.complete,
                    fname: post.authorData.fname,
                    lname: post.authorData.lname
                } : null
            })),
            pagination: {
                total: metadata.total,
                page: metadata.page,
                limit: metadata.limit,
                pages: Math.ceil(metadata.total / metadata.limit)
            }
        });
    } catch (error) {
        console.error('Error retrieving posts in thread:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve posts in thread.' });
    }
};


/**
 * Retrieves a paginated list of replies to a specific post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */

export const getRepliesForPost = async (req, res) => {
    // Extract the postId from the request parameters
    const { postId } = req.params;
    // Extract pagination parameters from the query string, with defaults
    const { page = 1, limit = 300 } = req.query;

    try {
        const posts = db.collection('posts');

        // Build the aggregation pipeline
        const pipeline = [
            { $match: { parent: new ObjectId(postId) } }, // Get only replies to the specified post
            { $sort: { createdAt: 1 } }, // Sort by creation date, oldest first
            {
                $addFields: {
                    authorString: { $toString: "$author" } // Convert ObjectId to string
                }
            },
            {
                $lookup: {
                    from: 'users', // The collection name where user information is stored
                    localField: 'authorString', // The field in 'posts' collection that contains the user ID
                    foreignField: 'userID', // The field in 'users' collection that contains the user ID
                    as: 'authorData' // The name of the field to add to each output document
                }
            },
            {
                $unwind: {
                    path: '$authorData',
                    preserveNullAndEmptyArrays: true // Keep posts even if no user information is found
                }
            },
            {
                $facet: {
                    // Get metadata (total count and pagination info)
                    metadata: [{ $count: "total" }, { $addFields: { page: Number(page), limit: Number(limit) } }],
                    // Get paginated data
                    data: [{ $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) }]
                }
            }
        ];

        // Execute the aggregation
        const result = await posts.aggregate(pipeline).toArray();

        // Extract metadata and data from the result
        const metadata = result[0].metadata[0] || { total: 0, page, limit };
        const data = result[0].data;

        // Send the response with pagination info
        res.status(200).json({
            success: true,
            replies: data.map(reply => ({
                ...reply,
                author: reply.authorData ? { // Transform `authorData` to only include desired fields
                    userID: reply.authorData.userID,
                    complete: reply.authorData.complete,
                    fname: reply.authorData.fname,
                    lname: reply.authorData.lname
                } : null,
            })),
            pagination: {
                total: metadata.total,
                page: metadata.page,
                limit: metadata.limit,
                pages: Math.ceil(metadata.total / metadata.limit)
            }
        });
    } catch (error) {
        console.error('Error retrieving replies for post:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve replies for post.' });
    }
};


/**
 * Utility function to extract mentions from content
 * @param {string} content - The content to extract mentions from
 * @returns {string[]} An array of usernames mentioned in the content
 */
const extractMentions = (content) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
        mentions.push(match[1]);
    }
    return mentions;
};

// TimeLine 3 Weeks 

// Week 1 

// reply to post,(done)
// update and delete the contents (done)

// Upvote the post or replies (done)
// Sorting each post and replies 
// Optimizations 
// Profile handling of account for provider and caregivers 

// Migration of API's from Mongodb Realm to EBS
// Migration of Tracking Api from Vercel to EBS
// Migration for Cronjobs from Vercel to EBS
// Migration of Email Sending from Vercel to EBS

// Handling of Payments for Stripe
// Stripe Webhooks and Events

// User Online Status Tracking And Notification to EBS
// Twilio Chat Api and Improve Chat API

// Authentication Using Twilio and Normal Routes

// Push Notification Setup with Customerio

// Provider and Caregiver Vetting systems and Monitoring Systems



// Week 2 and 3 

// The User InterFace Building 









// Updates and Deleting of Posts and thread 
/**
 * Updates an existing thread created by a user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const updateThread = async (req, res) => {
    const { threadId } = req.params; // Extract the thread ID from the route parameters
    const { title, content, categories, tags, imageUrl, userID } = req.body; // Extract updated data and user ID
    // we would sanitize the html before entering into the server 
    const cleanContent = sanitizeHtml(content);
    try {
        const threads = db.collection('threads');

        // Find the thread to ensure it exists and get its creator
        const thread = await threads.findOne({ _id: new ObjectId(threadId) });

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread not found.' });
        }

        // Check if the user is the creator
        if (thread.creator.toString() !== userID) {
            return res.status(403).json({ success: false, message: 'Permission denied. Only the creator can edit this thread.' });
        }

        // Update the thread with new data
        await threads.updateOne(
            { _id: new ObjectId(threadId) },
            {
                $set: {
                    title,
                    content: cleanContent,
                    categories,
                    tags,
                    imageUrl,
                    edited: true,
                    updatedAt: new Date(),
                }
            }
        );

        res.status(200).json({ success: true, message: 'Thread updated successfully.' });
    } catch (error) {
        console.error('Error updating thread:', error);
        res.status(500).json({ success: false, message: 'Failed to update thread.' });
    }
};

/**
 * Deletes an existing thread and all its associated posts and replies
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const deleteThread = async (req, res) => {
    const { threadId } = req.params; // Extract the thread ID from the route parameters
    const { userID } = req.body; // Extract the user ID from the request body

    try {
        const threads = db.collection('threads');
        const posts = db.collection('posts');

        // Find the thread to ensure it exists and get its creator
        const thread = await threads.findOne({ _id: new ObjectId(threadId) });

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread not found.' });
        }

        // Check if the user is the creator
        if (thread.creator.toString() !== userID) {
            return res.status(403).json({ success: false, message: 'Permission denied. Only the creator can delete this thread.' });
        }

        // check the likes under the thread and delete them 

        // Delete all posts and replies associated with the thread
        await posts.deleteMany({ threadId: new ObjectId(threadId) });

        // Delete the thread
        await threads.deleteOne({ _id: new ObjectId(threadId) });

        res.status(200).json({ success: true, message: 'Thread and all associated posts and replies deleted successfully.' });
    } catch (error) {
        console.error('Error deleting thread:', error);
        res.status(500).json({ success: false, message: 'Failed to delete thread.' });
    }
};




/**
 * Updates an existing post created by a user
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const updatePost = async (req, res) => {
    const { postId } = req.params; // Extract the post ID from the route parameters
    const { content, userID } = req.body; // Extract updated content and user ID
    // we would sanitize the html before entering into the server 
    const cleanContent = sanitizeHtml(content);
    try {
        const posts = db.collection('posts');

        // Find the post to ensure it exists and get its author
        const post = await posts.findOne({ _id: new ObjectId(postId) });

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }

        // Check if the user is the author
        if (post.author.toString() !== userID) {
            return res.status(403).json({ success: false, message: 'Permission denied. Only the author can edit this post.' });
        }

        // Update the post with new content
        await posts.updateOne(
            { _id: new ObjectId(postId) },
            {
                $set: {
                    content: cleanContent,
                    edited: true,
                    updatedAt: new Date(),
                }
            }
        );

        res.status(200).json({ success: true, message: 'Post updated successfully.' });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ success: false, message: 'Failed to update post.' });
    }
};

/**
 * Deletes an existing post and all its associated replies
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const deletePost = async (req, res) => {
    const { postId } = req.params; // Extract the post ID from the route parameters
    const { userID } = req.body; // Extract the user ID from the request body

    try {
        const posts = db.collection('posts');

        // Find the post to ensure it exists and get its author
        const post = await posts.findOne({ _id: new ObjectId(postId) });

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }

        // Check if the user is the author
        if (post.author.toString() !== userID) {
            return res.status(403).json({ success: false, message: 'Permission denied. Only the author can delete this post.' });
        }

        // Delete all replies associated with the post
        await posts.deleteMany({ parent: new ObjectId(postId) });

        // Delete the post
        await posts.deleteOne({ _id: new ObjectId(postId) });

        res.status(200).json({ success: true, message: 'Post and all associated replies deleted successfully.' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ success: false, message: 'Failed to delete post.' });
    }
};


/**
 * Updates an existing reply to a post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const updateReply = async (req, res) => {
    const { replyId } = req.params; // Extract the reply ID from the route parameters
    const { content, userID } = req.body; // Extract updated content and user ID
    // we would sanitize the html before entering into the server 
    const cleanContent = sanitizeHtml(content);
    try {
        const posts = db.collection('posts');

        // Find the reply to ensure it exists and get its author
        const reply = await posts.findOne({ _id: new ObjectId(replyId) });

        if (!reply) {
            return res.status(404).json({ success: false, message: 'Reply not found.' });
        }

        // Check if the user is the author
        if (reply.author.toString() !== userID) {
            return res.status(403).json({ success: false, message: 'Permission denied. Only the author can edit this reply.' });
        }

        // Update the reply with new content
        await posts.updateOne(
            { _id: new ObjectId(replyId) },
            {
                $set: {
                    content: cleanContent,
                    edited: true,
                    updatedAt: new Date(),
                }
            }
        );

        res.status(200).json({ success: true, message: 'Reply updated successfully.' });
    } catch (error) {
        console.error('Error updating reply:', error);
        res.status(500).json({ success: false, message: 'Failed to update reply.' });
    }
};

/**
 * Deletes an existing reply to a post
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const deleteReply = async (req, res) => {
    const { replyId } = req.params; // Extract the reply ID from the route parameters
    const { userID } = req.body; // Extract the user ID from the request body

    try {
        const posts = db.collection('posts');

        // Find the reply to ensure it exists and get its author
        const reply = await posts.findOne({ _id: new ObjectId(replyId) });

        if (!reply) {
            return res.status(404).json({ success: false, message: 'Reply not found.' });
        }

        // Check if the user is the author
        if (reply.author.toString() !== userID) {
            return res.status(403).json({ success: false, message: 'Permission denied. Only the author can delete this reply.' });
        }

        // Delete the reply
        await posts.deleteOne({ _id: new ObjectId(replyId) });

        res.status(200).json({ success: true, message: 'Reply deleted successfully.' });
    } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).json({ success: false, message: 'Failed to delete reply.' });
    }
};



// Voting in Posts and comments 

export const likeItem = async (req, res) => {
    const { itemId, itemType } = req.params; // Extract the item ID and type from the route parameters
    const { userID } = req.body; // Extract user ID from the request body
    console.log(userID, itemType, itemId)
    try {
        const collection = getCollectionForItemType(itemType); // Determine the collection based on the item type

        if (!collection) {
            return res.status(400).json({ success: false, message: 'Invalid item type.' });
        }

        // Check if the user has already liked this item
        const likeExists = await db.collection('likes').findOne({ itemId, userID });
        // console.log(likeExists)

        if (likeExists) {
            return res.status(400).json({ success: false, message: 'User has already liked this item.' });
        }

        // Add the user's like to the item
        await collection.updateOne(
            { _id: new ObjectId(itemId) },
            { $push: { likes: userID }, $inc: { likesCount: 1 } } // Increment the likes count
        );

        // Track the like in the 'likes' collection
        await db.collection('likes').insertOne({
            userID,
            itemId,
            itemType,
            createdAt: new Date()
        });
        res.status(200).json({ success: true, message: 'Item liked successfully.' });
    } catch (error) {
        console.error('Error liking item:', error);
        res.status(500).json({ success: false, message: 'Failed to like item.' });
    }
};


/**
 * Removes a like from an item (thread, post, or reply)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */

export const removeLikeFromItem = async (req, res) => {
    const { itemId, itemType } = req.params; // Extract the item ID and type from the route parameters
    const { userID } = req.body; // Extract user ID from the request body

    try {
        const collection = getCollectionForItemType(itemType); // Determine the collection based on the item type

        if (!collection) {
            return res.status(400).json({ success: false, message: 'Invalid item type.' });
        }

        // Remove the user's like from the item
        const result = await collection.updateOne(
            { _id: new ObjectId(itemId) },
            { $pull: { likes: userID }, $inc: { likesCount: -1 } } // Decrement the likes count
        );

        if (result.modifiedCount === 0) {
            return res.status(400).json({ success: false, message: 'Like not found or already removed.' });
        }

        // Remove the like from the 'likes' collection
        await db.collection('likes').deleteOne({ itemId, userID });

        res.status(200).json({ success: true, message: 'Like removed successfully.' });
    } catch (error) {
        console.error('Error removing like from item:', error);
        res.status(500).json({ success: false, message: 'Failed to remove like from item.' });
    }
};

export const checkIfUserLikedItem = async (req, res) => {
    const { itemId, itemType, userID } = req.params; // Extract the item ID, type, and user ID from the route parameters
    // console.log(itemId, itemType, userID)
    try {
        // Validate item type
        const validItemTypes = ['thread', 'post', 'reply'];
        if (!validItemTypes.includes(itemType)) {
            return res.status(400).json({ success: false, message: 'Invalid item type.' });
        }
        console.log()
        // Check if the like exists in the 'likes' collection
        const likeExists = await db.collection('likes').findOne({ itemId, userID, itemType });
        console.log(likeExists)
        if (likeExists) {
            return res.status(200).json({ success: true, liked: true }); // User has liked the item
        } else {
            return res.status(200).json({ success: true, liked: false }); // User has not liked the item
        }
    } catch (error) {
        console.error('Error checking if user liked item:', error);
        res.status(500).json({ success: false, message: 'Failed to check if user liked item.' });
    }
};
/**
 * Helper function to determine the correct collection based on the item type
 * @param {string} itemType - The type of the item ('thread', 'post', 'reply')
 * @returns {Object} The MongoDB collection reference
 */
function getCollectionForItemType(itemType) {
    switch (itemType) {
        case 'thread':
            return db.collection('threads');
        case 'post':
            return db.collection('posts');
        case 'reply':
            return db.collection('replies');
        default:
            return null; // Invalid item type
    }
}




// Query 

export const getThreads = async (req, res) => {
    try {
        // Connect to the DB
        const { db } = await connectToDatabase();
        const threadsCollection = db.collection('threads');

        // Get query parameters from request
        const { categories, tags, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', sortReplies } = req.query;
        // console.log(sortReplies)
        // Convert page and limit to numbers
        const pageNum = Number(page);
        const limitNum = Number(limit);

        // Build the match query for categories and tags
        const matchQuery = {};

        if (categories) {
            // If there are multiple categories, split them into an array and match against the categories array field
            const categoriesArray = categories.split(',');
            matchQuery.categories = { $in: categoriesArray };
        }

        if (tags) {
            // If there are multiple tags, split them into an array and match against the tags array field
            const tagsArray = tags.split(',');
            matchQuery.tags = { $in: tagsArray };
        }

        // Sorting criteria based on sortBy and sortOrder query params
        const sortOptions = {};

        if (sortReplies) {
            // If sorting by replies, use it directly
            sortOptions.replies = sortReplies === 'most' ? -1 : 1; // Sort by most or least replies
        } else {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1; // Default sorting by other fields (like createdAt, views, etc.)
        }

        // Aggregation pipeline
        const pipeline = [
            { $match: matchQuery },
            { $sort: sortOptions },
            {
                $addFields: {
                    creatorString: { $toString: "$creator" } // Convert ObjectId to string for lookup
                }
            },
            {
                $lookup: {
                    from: 'users', // The collection name where user information is stored
                    localField: 'creatorString', // The field in 'threads' collection that contains the user ID
                    foreignField: 'userID', // The field in 'users' collection that contains the user ID
                    as: 'creator' // The name of the field to add to each output document
                }
            },
            {
                $unwind: {
                    path: '$creator',
                    preserveNullAndEmptyArrays: true // Keep threads even if no user information is found
                }
            },
            {
                $facet: {
                    metadata: [
                        { $count: "total" }, // Get the total count of matching documents
                        { $addFields: { page: pageNum, limit: limitNum } }
                    ],
                    data: [
                        { $skip: (pageNum - 1) * limitNum },
                        { $limit: limitNum } // Paginated data
                    ]
                }
            }
        ];
        // console.log(JSON.stringify(pipeline))

        // Execute the aggregation
        const result = await threadsCollection.aggregate(pipeline).toArray();

        // Extract metadata and data from the result
        const metadata = result[0].metadata[0] || { total: 0, page: pageNum, limit: limitNum };
        const threads = result[0].data;

        // If no threads are found, fallback behavior: fetch all threads (no filters)
        if (threads.length === 0) {
            const fallbackPipeline = [
                { $sort: sortOptions },
                {
                    $addFields: {
                        creatorString: { $toString: "$creator" } // Convert ObjectId to string for lookup
                    }
                },
                {
                    $lookup: {
                        from: 'users', // The collection name where user information is stored
                        localField: 'creatorString', // The field in 'threads' collection that contains the user ID
                        foreignField: 'userID', // The field in 'users' collection that contains the user ID
                        as: 'creator' // The name of the field to add to each output document
                    }
                },
                {
                    $unwind: {
                        path: '$creator',
                        preserveNullAndEmptyArrays: true // Keep threads even if no user information is found
                    }
                },
                {
                    $facet: {
                        metadata: [
                            { $count: "total" },
                            { $addFields: { page: pageNum, limit: limitNum } }
                        ],
                        data: [
                            { $skip: (pageNum - 1) * limitNum },
                            { $limit: limitNum }
                        ]
                    }
                }
            ];

            const fallbackResult = await threadsCollection.aggregate(fallbackPipeline).toArray();
            const fallbackMetadata = fallbackResult[0].metadata[0] || { total: 0, page: pageNum, limit: limitNum };
            const fallbackThreads = fallbackResult[0].data;

            return res.status(200).json({
                success: true,
                threads: fallbackThreads,
                fallback: true,
                pagination: {
                    total: fallbackMetadata.total,
                    page: fallbackMetadata.page,
                    limit: fallbackMetadata.limit,
                    pages: Math.ceil(fallbackMetadata.total / fallbackMetadata.limit)
                }
            });
        }

        // Send response with pagination info for filtered threads
        res.status(200).json({
            success: true,
            threads,
            fallback: false,
            pagination: {
                total: metadata.total,
                page: metadata.page,
                limit: metadata.limit,
                pages: Math.ceil(metadata.total / metadata.limit)
            }
        });
    } catch (error) {
        console.error('Error retrieving threads:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve threads.' });
    }
};

// if (sort) {
//     switch (sort) {
//         case 'createdAt':
//             sortOptions = { createdAt: -1 }; // Sort by creation date, newest first
//             break;
//         case "updatedAt":
//             sortOptions = { updatedAt: -1 };// soe
//         case 'replies':
//             sortOptions = { replies: -1 }; // Sort by the number of replies, descending
//             break;
//         case 'views':
//             sortOptions = { views: -1 }; // Sort by views, descending
//             break;
//         default:
//             break;
//     }
// }