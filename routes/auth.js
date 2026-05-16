// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import FederalAdmin from "../models/FederalAdmin.js";

const router = express.Router();

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });cd
    }

    // Find admin by email
    const admin = await FederalAdmin.findOne({ where: { email } });

    if (!admin) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        email: admin.email, 
        role: admin.role,
        name: `${admin.first_name} ${admin.last_name}`
      },
      process.env.JWT_SECRET || "your-secret-key-change-this",
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        first_name: admin.first_name,
        middle_name: admin.middle_name,
        last_name: admin.last_name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during login" 
    });
  }
});

// Test route
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Auth route is working" });
});

export default router;