import express from 'express';
import { getCurrentUserProfile, updateCurrentUserProfile } from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

// Sign-up, sign-in and sign-out live in the shared auth service
// (auth.shrijit.tech); this router only serves the app's own profile.
router
  .route("/profile")
  .get(authenticate, getCurrentUserProfile)
  .put(authenticate, updateCurrentUserProfile);

export default router;