import { Router } from "express";
import { createUserData, deleteUser, dynamicCRUDOperation, fetchUserData, updateRoleAndTel} from "../Auth/AuthFunctions.js";
import { validatePhoneNumber } from "../Twilio/Validator.cjs";

const router = Router();

router.post('/create_user', createUserData);
router.get('/user/:userID', fetchUserData);
router.post('/crud-operation', dynamicCRUDOperation);
router.get('/delete_user', deleteUser);
// validate the user phone number  
router.post("/phone/validate", validatePhoneNumber);
router.post("/update-role-tel", updateRoleAndTel);

export default router;