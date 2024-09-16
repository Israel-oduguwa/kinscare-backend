
import { Router } from "express";
import {
    getThreads,
    getThreadById,
    getPostsInThread,
    getRepliesForPost,
    createThread,
    createPostInThread,
    replyToPostInThread,
    updateThread,
    deleteThread,
    updatePost,
    deletePost,
    updateReply,
    likeItem,
    checkIfUserLikedItem,
    removeLikeFromItem,
    deleteReply,
} from "../Forum/ForumFunctionsV2.js"
const router = Router()


// Thread routes
router.get('/threads', getThreads); // Get all threads with optional filters
router.get('/threads/:threadId', getThreadById); // Get a specific thread by ID
router.post('/threads', createThread); // Create a new thread
router.put('/threads/:threadId', updateThread); // Edit a thread created by a user
router.post('/threads/:threadId', deleteThread); // Delete a thread

// Post routes
router.get('/threads/:threadId/posts', getPostsInThread); // Get all posts in a thread
router.post('/threads/posts/reply', createPostInThread); // Create a new post in a thread
router.put('/posts/:postId', updatePost); // Edit a post
router.post('/posts/:postId', deletePost); // Delete a post
 
// Reply routes
router.get('/posts/:postId/replies', getRepliesForPost); // Get all replies for a post
router.post('/posts/:postId/replies', replyToPostInThread); // Add a reply to a post
router.put('/replies/:replyId', updateReply); // Edit a reply
router.post('/replies/:replyId', deleteReply); // Delete a reply

// Voting routes
// Routes for liking and removing likes
router.post('/like/:itemType/:itemId', likeItem); // Like an item
router.post('/like/:itemType/:itemId/remove', removeLikeFromItem); // Remove a like from an item
router.get('/like/:itemType/:itemId/:userID', checkIfUserLikedItem); // Check if user has liked an item

export default router