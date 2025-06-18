import express from 'express';
import {createUser, loginUser, logoutUser, getCurrentUserProfile, updateCurrentUserProfile} from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router(); 

router.route('/').post(createUser);
router.post('/auth',loginUser);
router.post('/logout',logoutUser)

router
  .route("/profile")
  .get(authenticate, getCurrentUserProfile)
  .put(authenticate, updateCurrentUserProfile);
export default router;