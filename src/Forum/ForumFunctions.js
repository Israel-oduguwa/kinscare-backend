import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../utils/mongodb.js';

// Connect to the database once
const { db } = await connectToDatabase();


// Function to create a new thread
export const createThread = async (req, res) => {
    const { title, content, userID, categories, tags } = req.body;
    try {
        const threads = db.collection('threads');
        const posts = db.collection('posts');
        // create a new thread (topic)
        const newThread = {
            title,
            creator: new ObjectId(userID),
            categories: categories || [],
            tags: tags || [],
            status: 'open',
            posts: [], // Initialize with an empty array to hold post IDs
            views: 0,
            replies: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const threadResult = await threads.insertOne(newThread);
        const threadId = threadResult.insertedId;
        // Create the first post in this thread
        const newPost = {
            threadId: threadId,
            content,
            author: new ObjectId(userID),
            parent: null, // No parent since this is a direct post to the thread
            children: [],
            mentions: extractMentions(content),
            createdAt: new Date(),
        };

        const postResult = await posts.insertOne(newPost);

        // Update the thread with the first post's ID so the array of post in the threads would have an ID
        await threads.updateOne(
            { _id: threadId },
            { $push: { posts: postResult.insertedId } }
        );

        res.status(201).json({ success: true, threadId });
    } catch (error) {
        console.error('Error creating thread:', error);
        res.status(500).json({ success: false, message: 'Failed to create thread.' });
    }
};

// Function to create a new post in a thread. So users can comment to the post.
export const createPostInThread = async (req, res) => {
    const { threadId, content, userID } = req.body;

    try {
        const threads = db.collection('threads');
        const posts = db.collection('posts');

        // New post object for the thread
        const newPost = {
            threadId: new ObjectId(threadId),
            content,
            author: new ObjectId(userID),
            parent: null, // No parent since this is a direct post to the thread
            children: [],
            mentions: extractMentions(content),
            createdAt: new Date(),
        };

        // Insert the new post into the posts collection
        const postResult = await posts.insertOne(newPost);
        const postId = postResult.insertedId;

        // Update the thread to include the new post ID
        await threads.updateOne(
            { _id: new ObjectId(threadId) },
            {
                $push: { posts: postId },
                $inc: { replies: 1 },
                $set: { updatedAt: new Date() },
            }
        );

        res.status(201).json({ success: true, message: 'Post added to thread successfully', postId });
    } catch (error) {
        console.error('Error creating post in thread:', error);
        res.status(500).json({ success: false, message: 'Failed to create post in thread.' });
    }
};

// Function to reply to an existing post in a thread. comment to the post
export const replyToPostInThread = async (req, res) => {
    const { threadId, parentId, content, userID } = req.body;
    // the parentId is the post id of the post in the thread. the reply is pushed to the post
    try {
        const posts = db.collection('posts');
        const threads = db.collection('threads');

        // New reply object
        const newReply = {
            threadId: new ObjectId(threadId),
            content,
            author: new ObjectId(userID),
            parent: new ObjectId(parentId), // Parent post ID
            children: [],
            mentions: extractMentions(content),
            createdAt: new Date(),
        };

        // Insert the new reply into the posts collection
        const replyResult = await posts.insertOne(newReply);
        const replyId = replyResult.insertedId;

        // Update the parent post's children array to include the new reply ID
        await posts.updateOne(
            { _id: new ObjectId(parentId) },
            { $push: { children: replyId } }
        );

        // Update the thread to reflect the new reply
        await threads.updateOne(
            { _id: new ObjectId(threadId) },
            {
                $push: { posts: replyId },
                $inc: { replies: 1 },
                $set: { updatedAt: new Date() },
            }
        );

        res.status(201).json({ success: true, message: 'Reply added successfully', replyId });
    } catch (error) {
        console.error('Error replying to post in thread:', error);
        res.status(500).json({ success: false, message: 'Failed to reply to post in thread.' });
    }
};

// Function to get all threads
export const getThreads = async (req, res) => {
    try {
        const threads = db.collection('threads');
        const { filter, sort, category, tag, status } = req.query;

        const query = {};
        if (filter) query.title = { $regex: filter, $options: 'i' };
        if (category) query.categories = category;
        if (tag) query.tags = tag;
        if (status) query.status = status;

        const sortOption = sort === 'most_replied' ? { replies: -1 } : { createdAt: -1 };

        const allThreads = await threads.find(query).sort(sortOption).toArray();

        res.status(200).json({ success: true, data: allThreads });
    } catch (error) {
        console.error('Error retrieving threads:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve threads.' });
    }
};

// Function to get a thread by ID
export const getThreadById = async (req, res) => {
    const { threadId } = req.params;

    try {
        const threads = db.collection('threads');
        const posts = db.collection('posts');

        const thread = await threads.findOne({ _id: new ObjectId(threadId) });

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread not found' });
        }

        // Fetch all posts in this thread
        const allPosts = await posts.find({ threadId: new ObjectId(threadId) }).toArray();

        // Increment view count
        await threads.updateOne({ _id: new ObjectId(threadId) }, { $inc: { views: 1 } });

        res.status(200).json({ success: true, thread, posts: allPosts });
    } catch (error) {
        console.error('Error retrieving thread by ID:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve thread by ID.' });
    }
};
// this can work with the above in getting post in a thread 
export const getPostsInThread = async (req, res) => {
    const { threadId } = req.params;
    const { page = 1, limit = 10 } = req.query; // Pagination parameters
    try {
        const posts = db.collection('posts');

        const query = { threadId: new ObjectId(threadId), parent: null }; // Get only top-level posts
        const options = {
            skip: (page - 1) * limit, // Skip the records for pagination
            limit: parseInt(limit), // Limit the number of records
            sort: { createdAt: -1 }, // Sort by newest posts first
        };
        // Fetch the posts for the given threadId
        const threadPosts = await posts.find(query, options).toArray();

        res.status(200).json({ success: true, data: threadPosts });
    } catch (error) {
        console.error('Error retrieving posts in thread:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve posts in thread.' });
    }
};

//get the replies in a post 
export const getRepliesForPost = async (req, res) => {
    const { postId } = req.params;
    const { page = 1, limit = 10 } = req.query; // Pagination parameters

    try {
        const posts = db.collection('posts');

        const query = { parent: new ObjectId(postId) }; // Get only replies to the specific post
        const options = {
            skip: (page - 1) * limit,
            limit: parseInt(limit),
            sort: { createdAt: 1 }, // Sort by oldest replies first for natural reading order
        };

        // Fetch the replies for the given postId
        const replies = await posts.find(query, options).toArray();

        res.status(200).json({ success: true, data: replies });
    } catch (error) {
        console.error('Error retrieving replies for post:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve replies for post.' });
    }
};
// Utility function to extract mentions from content
const extractMentions = (content) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
        mentions.push(match[1]);
    }
    return mentions;
};
