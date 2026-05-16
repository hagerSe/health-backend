import express from 'express';
import { protect } from '../middleware/auth.js';
import { getUsersByLevel } from '../controllers/userController.js';

const router = express.Router();

// Protect all user routes
router.use(protect);

// Get users by level with hierarchical filtering
router.get('/by-level', getUsersByLevel);

export default router;