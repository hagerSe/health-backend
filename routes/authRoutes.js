import express from 'express';
import { 
  login, 
  getProfile, 
  refreshToken, 
  changePassword,
  forgotPassword,
  resetPassword,
  resendVerification,
  verifyEmail,
  setPassword  // ← ADD THIS
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ==================== PUBLIC ROUTES ====================
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-verification', resendVerification);
router.post('/set-password', setPassword);  // ← ADD THIS LINE
router.get('/verify-email/:token', verifyEmail);

// ==================== PROTECTED ROUTES ====================
router.get('/profile', protect, getProfile);
router.post('/refresh-token', protect, refreshToken);
router.post('/change-password', protect, changePassword);

// ==================== DEBUG ROUTE (remove in production) ====================
router.get('/debug-routes', (req, res) => {
  const routes = [];
  router.stack.forEach(layer => {
    if (layer.route) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      });
    }
  });
  res.json({ 
    success: true,
    message: "Available auth routes",
    routes: routes 
  });
});

export default router;