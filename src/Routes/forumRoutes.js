
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
    voteOnItem,
    removeVoteOnItem,
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
router.post('/vote/:itemId', voteOnItem); // Vote on a thread, post, or reply
router.delete('/vote/:itemId', removeVoteOnItem); // Remove a vote from a thread, post, or reply



export default router