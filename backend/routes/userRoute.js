import express from 'express';
import {createUser, loginUser, logoutUser, getCurrentUserProfile, updateCurrentUserProfile, checkDuplicate} from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router(); 

router.route('/').post(createUser);
router.post('/auth',loginUser);
router.post('/logout',logoutUser);
router.post("/verify", checkDuplicate);
router.get('/test', (req, res) => {
  console.log("User route is working");
  res.send("User route is working");
}
);
router
  .route("/profile")
  .get(authenticate, getCurrentUserProfile)
  .put(authenticate, updateCurrentUserProfile);
export default router;