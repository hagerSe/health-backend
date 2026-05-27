import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from 'jsonwebtoken'; // ✅ ADD THIS IMPORT
import sequelize from "./config/database.js";
import "./models/index.js";
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from "./routes/authRoutes.js";
import federalRoutes from './routes/federalRoutes.js';
import regionalRoutes from './routes/regionalRoutes.js';
import ReportService from './Services/reportService.js';
import zoneRoutes from './routes/zoneRoutes.js';
import woredaRoutes from './routes/woredaRoutes.js'; 
import kebeleRoutes from './routes/kebeleRoutes.js'; 
import hospitalRoutes from './routes/hospitalRoutes.js';
import userRoutes from './routes/userRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import nurseRoutes from './routes/nurseRoutes.js';
import labRoutes from './routes/labRoutes.js';
import radiologyRoutes from './routes/radiologyRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import bedRoutes from './routes/bedRoutes.js';
import midwifeRoutes from './routes/midwifeRoutes.js';
import hrRoutes from './routes/hrRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import uploadRoutes from "./routes/uploadRoutes.js";

// ===== NEW HOSPITAL MANAGEMENT ROUTES =====
import cardofficeRoutes from './routes/cardofficeRoutes.js';
import triageRoutes from './routes/triageRoutes.js';
import wardRoutes from './routes/wardRoutes.js';

// Initialize app
const app = express();
dotenv.config();

// ==================== CORS CONFIGURATION ====================
// Allowed origins (frontend URLs)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ager-indol.vercel.app',
  'https://ager-3lwu2spxn-fullstacks-projects-a4c7a5f9.vercel.app',
  'https://health-backend-2-gqv6.onrender.com',
  'https://health-frontend-cav3.vercel.app',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  /\.vercel\.app$/
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  return allowedOrigins.some((allowed) => {
    if (allowed instanceof RegExp) {
      return allowed.test(origin);
    }
    return allowed === origin;
  });
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    console.warn(`❌ CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
};

// ==================== SOCKET.IO SETUP ====================
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      console.log(`🔍 Socket.IO CORS check for origin: ${origin}`);
      
      if (!origin) {
        console.log(`✅ No origin provided, allowing`);
        return callback(null, true);
      }
      
      if (isOriginAllowed(origin)) {
        console.log(`✅ Socket.IO CORS allowed: ${origin}`);
        return callback(null, true);
      }
      
      console.warn(`❌ Socket CORS blocked origin: ${origin}`);
      console.warn(`   Allowed origins: ${JSON.stringify(allowedOrigins)}`);
      callback(new Error('Not allowed by Socket CORS'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Content-Range"]
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});

// ===== ADD AUTHENTICATION MIDDLEWARE HERE =====
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    console.error('❌ Socket connection rejected: No token provided');
    return next(new Error('Authentication required'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.user = decoded;
    console.log(`✅ Socket authenticated: ${socket.id} - User: ${decoded.email || decoded.id}`);
    next();
  } catch (err) {
    console.error('❌ Socket authentication failed:', err.message);
    next(new Error('Invalid token'));
  }
});

// ===== SOCKET EVENT HANDLERS =====
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  console.log('👤 Authenticated user:', socket.user?.email || socket.user?.id);

  // Join hospital-specific room
  socket.on('join_hospital', (hospitalId) => {
    const roomName = `hospital_${hospitalId}`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined hospital room: ${roomName}`);
    
    socket.emit('joined_hospital', { 
      room: roomName, 
      success: true,
      hospitalId 
    });
  });

  // Join ward-specific room (for doctors/nurses)
  socket.on('join_ward', (data) => {
    const { hospitalId, ward } = data;
    const roomName = `hospital_${hospitalId}_ward_${ward}`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined ward room: ${roomName}`);
    
    socket.emit('joined_ward', { 
      room: roomName, 
      success: true,
      ward: ward 
    });
  });

  // Join triage room
  socket.on('join_triage', (hospitalId) => {
    const roomName = `hospital_${hospitalId}_triage`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined triage room: ${roomName}`);
    
    socket.emit('joined_triage', { 
      room: roomName, 
      success: true 
    });
  });

  // Join lab room
  socket.on('join_lab', (hospitalId) => {
    const roomName = `hospital_${hospitalId}_lab`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined lab room: ${roomName}`);
    
    socket.emit('joined_lab', { 
      room: roomName, 
      success: true,
      hospitalId 
    });
  });

  // Join pharmacy room
  socket.on('join_pharmacy', (hospitalId) => {
    const roomName = `hospital_${hospitalId}_pharmacy`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined pharmacy room: ${roomName}`);
    
    socket.emit('joined_pharmacy', { 
      room: roomName, 
      success: true,
      hospitalId 
    });
  });

  // Join radiology room
  socket.on('join_radiology', (hospitalId) => {
    const roomName = `hospital_${hospitalId}_radiology`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined radiology room: ${roomName}`);
    
    socket.emit('joined_radiology', { 
      room: roomName, 
      success: true,
      hospitalId 
    });
  });

  // Join doctor-specific room
  socket.on('join_doctor', (data) => {
    const { hospitalId, doctorId } = data;
    const roomName = `hospital_${hospitalId}_doctor_${doctorId}`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined doctor room: ${roomName}`);
    
    socket.emit('joined_doctor', { 
      room: roomName, 
      success: true,
      doctorId 
    });
  });

  // Join HR room (for human resources staff)
  socket.on('join_hr', (hospitalId) => {
    const roomName = `hospital_${hospitalId}_hr`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined HR room: ${roomName}`);
    
    socket.emit('joined_hr', { 
      room: roomName, 
      success: true,
      hospitalId 
    });
  });

  // Join staff-specific room (for individual staff notifications)
  socket.on('join_staff', (data) => {
    const { staffId, hospitalId } = data;
    const roomName = `hospital_${hospitalId}_staff_${staffId}`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined staff room: ${roomName}`);
    
    socket.emit('joined_staff', { 
      room: roomName, 
      success: true,
      staffId 
    });
  });

  // Join card office room
  socket.on('join_cardoffice', (hospitalId) => {
    const roomName = `hospital_${hospitalId}_cardoffice`;
    socket.join(roomName);
    console.log(`📡 Socket ${socket.id} joined card office room: ${roomName}`);
    
    socket.emit('joined_cardoffice', { 
      room: roomName, 
      success: true,
      hospitalId 
    });
  });

  // Leave room
  socket.on('leave_room', (room) => {
    socket.leave(room);
    console.log(`📡 Socket ${socket.id} left room: ${room}`);
  });

  // Get all rooms socket is in
  socket.on('get_rooms', () => {
    const rooms = Array.from(socket.rooms);
    console.log(`Socket ${socket.id} is in rooms:`, rooms);
    socket.emit('rooms_info', rooms);
  });

  // Test event for debugging
  socket.on('test_pharmacy', (data) => {
    console.log('🧪 Test pharmacy event received:', data);
    socket.emit('test_response', { received: true, data });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ===== MAKE SOCKET.IO AVAILABLE TO ROUTES =====
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Normalize malformed duplicate API prefixes like /api/api/... to /api/...
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/api/')) {
    req.url = req.url.replace(/^\/api\/api(\/|$)/, '/api$1');
  }
  next();
});

// Add test endpoint for Socket.io
app.get('/api/socket-test', (req, res) => {
  res.json({
    success: true,
    message: 'Socket.io is available',
    clients: io.engine.clientsCount,
    rooms: Array.from(io.sockets.adapter.rooms.keys()).length
  });
});

// Make io accessible to routes
app.set('io', io);

// ==================== MIDDLEWARE ====================
// Apply CORS first (handles preflight automatically)
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== ROUTES ====================
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// Test route
app.get("/", (req, res) => {
  res.send("✅ NHMS Server is running!");
});

// Admin & Report Routes
app.use("/api/auth", authRoutes);
app.use('/api/federal', federalRoutes);
app.use('/api/regional', regionalRoutes);
app.use('/api/zone', zoneRoutes); 
app.use('/api/woreda', woredaRoutes); 
app.use('/api/kebele', kebeleRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/nurse', nurseRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/radiology', radiologyRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/midwife', midwifeRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/staff', staffRoutes);
app.use("/api", uploadRoutes);

// Debug route for doctor routes
app.get('/api/debug/doctor-routes', (req, res) => {
  res.json({
    success: true,
    routes: [
      '/api/doctor/queue',
      '/api/doctor/stats',
      '/api/doctor/assign-patient',
      '/api/doctor/save-diagnosis',
      '/api/doctor/save-prescriptions',
      '/api/doctor/lab-results/:patientId',
      '/api/doctor/radiology-results/:patientId',
      '/api/doctor/available-beds',
      '/api/doctor/admit-patient',
      '/api/doctor/request-lab',
      '/api/doctor/request-radiology',
      '/api/doctor/discharge-patient',
      '/api/doctor/refer-patient',
      '/api/doctor/discharged-patients',
      '/api/doctor/reports/inbox',
      '/api/doctor/reports/outbox',
      '/api/doctor/reports/unread-count',
      '/api/doctor/hospital-admins',
      '/api/doctor/hospital-staff'
    ]
  });
});

// ===== NEW HOSPITAL MANAGEMENT ROUTES =====
// Add this BEFORE your cardoffice routes
app.get('/api/debug/cardoffice-status', (req, res) => {
  res.json({
    success: true,
    message: 'Card Office routes are registered',
    timestamp: new Date().toISOString()
  });
});

// Add global error handler for debugging
app.use('/api/cardoffice', (req, res, next) => {
  console.log(`📡 Card Office API called: ${req.method} ${req.url}`);
  console.log(`🔑 Headers:`, req.headers.authorization ? 'Has token' : 'No token');
  next();
});
app.use('/api/cardoffice', cardofficeRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/ward', wardRoutes);

// Serve uploaded files (radiology images, message attachments, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket debug endpoint
app.get('/api/socket/debug', (req, res) => {
  const rooms = io.sockets.adapter.rooms;
  const roomList = Array.from(rooms.keys());
  const roomSizes = {};
  roomList.forEach(room => {
    roomSizes[room] = rooms.get(room)?.size || 0;
  });
  
  res.json({
    success: true,
    connected_clients: io.engine.clientsCount,
    rooms: roomList,
    room_sizes: roomSizes,
    total_rooms: rooms.size
  });
});

// Debug uploads endpoint
app.get('/api/debug/uploads', (req, res) => {
  const uploadsPath = path.join(__dirname, 'uploads');
  
  try {
    const files = fs.readdirSync(uploadsPath);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    res.json({
      success: true,
      uploads_directory: uploadsPath,
      total_files: files.length,
      image_files: imageFiles,
      urls: imageFiles.map(f => `${baseUrl}/uploads/${f}`)
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const radiologyDir = path.join(__dirname, 'uploads/radiology');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

if (!fs.existsSync(radiologyDir)) {
  fs.mkdirSync(radiologyDir, { recursive: true });
  console.log('📁 Created radiology uploads directory');
}

// Create patient cards directory
const patientCardsDir = path.join(__dirname, 'uploads/patient-cards');
if (!fs.existsSync(patientCardsDir)) {
  fs.mkdirSync(patientCardsDir, { recursive: true });
  console.log('📁 Created patient cards directory');
}

// ==================== SERVER START ====================

const PORT = process.env.PORT || 5001;

// Start HTTP server - Bind to 0.0.0.0 for Render
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Root route: http://localhost:${PORT}/ - You should see "NHMS Server is running!"`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`✅ Socket.io test: http://localhost:${PORT}/api/socket-test`);
});

// Connect to database asynchronously
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully!");

    // Auto-run verification fields migration if needed (self-healing migration)
    try {
      const migrationTables = [
        'federal_admins',
        'regional_admins', 
        'zone_admins',
        'woreda_admins',
        'kebele_admins',
        'hospital_admins',
        'hospital_staff'
      ];
      for (const table of migrationTables) {
        const [results] = await sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = '${table}'
          );
        `);
        if (results[0].exists) {
          await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;`);
          await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS verification_token TEXT;`);
          await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP;`);
          await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS reset_password_token TEXT;`);
          await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;`);
          await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;`);
        }
      }
      console.log("✅ Out-of-band verification fields migration checked/completed successfully.");
    } catch (migError) {
      console.error("⚠️ Out-of-band migration check failed:", migError.message);
    }

    if (process.env.NODE_ENV === 'production') {
      await sequelize.sync({ alter: false });
    } else {
      await sequelize.sync({ alter: true, except: ['users'] });
    }
    console.log("✅ Models synced");

    // Schedule auto-close reports job (runs daily at midnight)
    cron.schedule('0 0 * * *', async () => {
      console.log('🔄 Running auto-close reports job...');
      try {
        const result = await ReportService.autoCloseReports();
        console.log(`✅ Auto-closed ${result.count} reports`);
      } catch (error) {
        console.error('❌ Auto-close job failed:', error);
      }
    });

    // Schedule weekly hours reset (every Sunday at midnight)
    cron.schedule('0 0 * * 0', async () => {
      console.log('🔄 Resetting weekly staff hours...');
      try {
        await sequelize.query(`
          UPDATE hospital_staff 
          SET total_hours_this_week = 0 
          WHERE status = 'active'
        `);
        console.log('✅ Weekly hours reset completed');
      } catch (error) {
        console.error('❌ Failed to reset weekly hours:', error);
      }
    });

    // Print all available routes
    console.log("\n" + "=".repeat(60));
    console.log("📋 AVAILABLE API ROUTES");
    console.log("=".repeat(60));
    
    console.log("\n🏛️ ADMIN ROUTES:");
    console.log(`   ✅ Auth: http://localhost:${PORT}/api/auth/login`);
    console.log(`   ✅ Federal: http://localhost:${PORT}/api/federal/profile`);
    console.log(`   ✅ Regional: http://localhost:${PORT}/api/regional/profile`);
    console.log(`   ✅ Zone: http://localhost:${PORT}/api/zone/profile`);
    console.log(`   ✅ Woreda: http://localhost:${PORT}/api/woreda/profile`);
    console.log(`   ✅ Kebele: http://localhost:${PORT}/api/kebele/profile`);
    
    console.log("\n🏥 HOSPITAL MANAGEMENT ROUTES:");
    console.log(`   ✅ Card Office: http://localhost:${PORT}/api/cardoffice/patients/recent`);
    console.log(`   ✅ Triage: http://localhost:${PORT}/api/triage/queue`);
    console.log(`   ✅ OPD Ward: http://localhost:${PORT}/api/ward/opd/patients`);
    console.log(`   ✅ EME Ward: http://localhost:${PORT}/api/ward/eme/patients`);
    console.log(`   ✅ ANC Ward: http://localhost:${PORT}/api/ward/anc/patients`);
    
    console.log("\n👨‍⚕️ DEPARTMENT ROUTES:");
    console.log(`   ✅ Doctor: http://localhost:${PORT}/api/doctor/queue`);
    console.log(`   ✅ Lab: http://localhost:${PORT}/api/lab/pending`);
    console.log(`   ✅ Radiology: http://localhost:${PORT}/api/radiology/pending`);
    console.log(`   ✅ Pharmacy: http://localhost:${PORT}/api/pharmacy/pending`);
    console.log(`   ✅ Bed Management: http://localhost:${PORT}/api/beds/available`);
    console.log(`   ✅ Midwife: http://localhost:${PORT}/api/midwife/patients`);
    
    console.log("\n👥 HUMAN RESOURCES ROUTES:");
    console.log(`   ✅ HR Staff: http://localhost:${PORT}/api/hr/staff`);
    console.log(`   ✅ HR Schedules: http://localhost:${PORT}/api/hr/schedules`);
    console.log(`   ✅ HR Leave Requests: http://localhost:${PORT}/api/hr/leave-requests`);
    console.log(`   ✅ HR Stats: http://localhost:${PORT}/api/hr/stats`);
    console.log(`   ✅ HR Auto-Schedule: http://localhost:${PORT}/api/hr/schedule/auto-generate`);
    
    console.log("\n📁 OTHER ROUTES:");
    console.log(`   ✅ Users: http://localhost:${PORT}/api/users/by-level`);
    console.log(`   ✅ Uploads: http://localhost:${PORT}/uploads/`);
    console.log(`   ✅ Debug Uploads: http://localhost:${PORT}/api/debug/uploads`);
    console.log(`   ✅ Socket Debug: http://localhost:${PORT}/api/socket/debug`);
    console.log(`   ✅ Socket Test: http://localhost:${PORT}/api/socket-test`);
    
    console.log("\n" + "=".repeat(60));
    console.log("🔌 SOCKET.IO ROOMS AVAILABLE:");
    console.log(`   • hospital_{hospitalId}`);
    console.log(`   • hospital_{hospitalId}_triage`);
    console.log(`   • hospital_{hospitalId}_cardoffice`);
    console.log(`   • hospital_{hospitalId}_ward_OPD`);
    console.log(`   • hospital_{hospitalId}_ward_EME`);
    console.log(`   • hospital_{hospitalId}_ward_ANC`);
    console.log(`   • hospital_{hospitalId}_lab`);
    console.log(`   • hospital_{hospitalId}_pharmacy`);
    console.log(`   • hospital_{hospitalId}_radiology`);
    console.log(`   • hospital_{hospitalId}_hr`);
    console.log(`   • hospital_{hospitalId}_doctor_{doctorId}`);
    console.log(`   • hospital_{hospitalId}_staff_{staffId}`);
    console.log("=".repeat(60) + "\n");
    
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    console.log("⚠️ Server is still running on http://localhost:" + PORT);
    console.log("⚠️ Database-dependent routes may not work properly");
  }
})();