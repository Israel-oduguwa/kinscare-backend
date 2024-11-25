import { Router } from "express";
import { createUserData, deleteUser, dynamicCRUDOperation, fetchUserData } from "../Auth/AuthFunctions.js";

const router = Router();

router.post('/create_user', createUserData);
router.get('/user/:userID', fetchUserData);
router.post('/crud-operation', dynamicCRUDOperation);
router.get('/delete_user', deleteUser);
export default router;