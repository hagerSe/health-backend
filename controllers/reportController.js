export const createZoneAdmin = async (req, res) => {
  try {
    const { 
      zone_name, first_name, middle_name, last_name, 
      gender, age, email, password, phone 
    } = req.body;
    
    console.log("📝 Creating zone admin with email:", email);
    console.log("📝 Password provided:", password ? "Yes" : "No");
    
    // Validate required fields
    if (!zone_name || !first_name || !last_name || !gender || !age || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "All required fields must be provided" 
      });
    }
    
    // Check if email already exists
    const existingAdmin = await ZoneAdmin.findOne({ 
      where: { email } 
    });
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        message: "Email already registered" 
      });
    }
    
    // Get regional admin info
    const regional = await RegionalAdmin.findByPk(req.user.id);
    
    if (!regional) {
      return res.status(404).json({
        success: false,
        message: "Regional admin not found"
      });
    }
    
    console.log("👤 Creating zone admin for regional:", regional.email);
    
    // IMPORTANT: Do NOT hash the password here - let the model hook handle it
    // Just pass the plain password to the model
    
    const zoneAdmin = await ZoneAdmin.create({
      regional_id: req.user.id,
      zone_name,
      first_name,
      middle_name,
      last_name,
      gender,
      age: parseInt(age),
      email,
      password: password, // Pass plain password - model hook will hash it
      phone,
      role: "Zone_Admin",
      status: "active"
    });
    
    console.log("✅ Zone admin created with ID:", zoneAdmin.id);
    console.log("✅ Email:", zoneAdmin.email);
    console.log("✅ Password has been hashed by model hook");
    
    // Generate notification number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const notificationNumber = `NOT-${year}${month}${day}-${random}`;
    
    // Create notification for regional admin
    try {
      await Notification.create({
        notification_number: notificationNumber,
        title: "New Zone Admin Created",
        message: `Zone admin ${first_name} ${last_name} for ${zone_name} zone was created`,
        type: "success",
        priority: "medium",
        
        sender_id: req.user.id,
        sender_type: "regional",
        sender_name: `${regional.first_name} ${regional.last_name}`,
        
        recipient_id: req.user.id,
        recipient_type: "regional",
        recipient_name: `${regional.first_name} ${regional.last_name}`,
        
        related_user_id: zoneAdmin.id,
        related_user_type: "zone",
        
        action_url: "/zones",
        action_text: "View Zones"
      });
      console.log("✅ Notification created for zone admin creation");
    } catch (notifError) {
      console.warn("⚠️ Notification creation failed, but zone was created:", notifError.message);
    }
    
    // Return created admin without password
    const created = await ZoneAdmin.findByPk(zoneAdmin.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.status(201).json({ 
      success: true, 
      zoneAdmin: created,
      message: `Zone admin created successfully. Login with email: ${email} and password: ${password}` 
    });
    
  } catch (error) {
    console.error("❌ Create zone admin error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error creating zone admin"
    });
  }
};