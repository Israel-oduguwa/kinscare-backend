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
export const getThreads = async (req, res) => {
    try {
        const threads = db.collection('threads');
        const { filter, sort, category, tag, status, page = 1, limit = 10 } = req.query;

        // Build the query object based on provided filters
        const query = {};
        if (filter) query.title = { $regex: filter, $options: 'i' }; // Case-insensitive title search
        if (category) query.categories = category;
        if (tag) query.tags = tag;
        if (status) query.status = status;

        // Determine the sort order
        const sortOption = sort === 'most_replied' ? { replies: -1 } : { createdAt: -1 };

        // Build the aggregation pipeline
        const pipeline = [
            { $match: query }, // Apply filters
            { $sort: sortOption }, // Apply sorting
            {
                $addFields: {
                    creatorString: { $toString: "$creator" } // Convert ObjectId to string
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
                    metadata: [{ $count: "total" }, { $addFields: { page: Number(page), limit: Number(limit) } }],
                    data: [{ $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) }]
                }
            }
        ];

        // Execute the aggregation
        const result = await threads.aggregate(pipeline).toArray();

        // Extract metadata and data from the result
        const metadata = result[0].metadata[0] || { total: 0, page, limit };
        const data = result[0].data;

        // Map over data to format the creator object
        const formattedData = data.map(thread => ({
            ...thread,
            creator: thread.creator ? {
                userID: thread.creator.userID,
                complete: thread.creator.complete,
                fname: thread.creator.fname,
                lname: thread.creator.lname
            } : null
        }));

        // Send the response with pagination info
        res.status(200).json({
            success: true,
            data: formattedData,
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

/**
 * Retrieves a specific thread by its ID, including all its posts
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const getThreadById = async (req, res) => {
    // Extract the threadId from the request parameters
    const { threadId } = req.params;
    // console.log(threadId)
    try {
        // Get references to the collections we'll be working with
        const threads = db.collection('threads');
        const posts = db.collection('posts');
        const users = db.collection('users'); // Reference to the users collection

        // Find the thread by its ID
        const thread = await threads.findOne({ _id: new ObjectId(threadId) });

        // If the thread doesn't exist, return a 404 error
        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread not found' });
        }

        // Fetch all posts associated with this thread
        // const allPosts = await posts.find({ threadId: new ObjectId(threadId) }).toArray();
        const userID = thread.creator.toString();
        // Fetch the user data using the creator's userID
        const user = await users.findOne(
            { userID }, // Assuming `creator` is the user ID stored in the thread
            { projection: { userID: 1, complete: 1, fname: 1, lname: 1 } } // Only return the specified fields
        );
        // console.log(user)
        // Increment the view count for this thread
        await threads.updateOne({ _id: new ObjectId(threadId) }, { $inc: { views: 1 } });

        // Send the response with the thread, its posts, and the creator's user data
        res.status(200).json({ success: true, thread, creator: user });
    } catch (error) {
        console.error('Error retrieving thread by ID:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve thread by ID.' });
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

/**
 * Votes on an item (thread, post, or reply)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const voteOnItem = async (req, res) => {
    const { itemId } = req.params; // Extract the item ID from the route parameters
    const { userID, type } = req.body; // Extract user ID and type ('upvote' or 'downvote')

    try {
        const items = db.collection('items'); // Generic collection reference
        const item = await items.findOne({ _id: new ObjectId(itemId) });

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        // Check if the user has already voted on this item
        const existingVote = await items.findOne({ _id: new ObjectId(itemId), 'votes.userID': userID });

        if (existingVote) {
            return res.status(400).json({ success: false, message: 'User has already voted on this item.' });
        }

        // Update the item with the new vote
        const voteField = type === 'upvote' ? 'upvotes' : 'downvotes';

        await items.updateOne(
            { _id: new ObjectId(itemId) },
            {
                $push: { votes: { userID, type } },
                $inc: { [voteField]: 1 }
            }
        );

        res.status(200).json({ success: true, message: `Item ${type}d successfully.` });
    } catch (error) {
        console.error('Error voting on item:', error);
        res.status(500).json({ success: false, message: 'Failed to vote on item.' });
    }
};

/**
 * Removes a vote from an item (thread, post, or reply)
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
export const removeVoteOnItem = async (req, res) => {
    const { itemId } = req.params; // Extract the item ID from the route parameters
    const { userID } = req.body; // Extract user ID

    try {
        const items = db.collection('items'); // Generic collection reference
        const item = await items.findOne({ _id: new ObjectId(itemId) });

        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        // Check if the user has voted on this item
        const userVote = item.votes.find(vote => vote.userID === userID);

        if (!userVote) {
            return res.status(400).json({ success: false, message: 'User has not voted on this item.' });
        }

        // Update the item by removing the vote
        const voteField = userVote.type === 'upvote' ? 'upvotes' : 'downvotes';

        await items.updateOne(
            { _id: new ObjectId(itemId) },
            {
                $pull: { votes: { userID } },
                $inc: { [voteField]: -1 }
            }
        );

        res.status(200).json({ success: true, message: 'Vote removed successfully.' });
    } catch (error) {
        console.error('Error removing vote on item:', error);
        res.status(500).json({ success: false, message: 'Failed to remove vote on item.' });
    }
};
