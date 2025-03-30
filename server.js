// Required dependencies
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'db name",
  password: '#here will be db passcode',
  port: 5432,
});

// Database tables creation
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        entry_charge DECIMAL(10,2),
        hourly_charge DECIMAL(10,2)
      );

      CREATE TABLE IF NOT EXISTS parking_entries (
        id SERIAL PRIMARY KEY,
        lot_number INTEGER NOT NULL,
        car_number VARCHAR(20) NOT NULL,
        car_name VARCHAR(100) NOT NULL,
        mobile_number VARCHAR(15) NOT NULL,
        entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        exit_time TIMESTAMP,
        total_charge DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'parked'
      );

      CREATE TABLE IF NOT EXISTS parking_bills (
        id SERIAL PRIMARY KEY,
        entry_id INTEGER REFERENCES parking_entries(id),
        fixed_charge DECIMAL(10,2) NOT NULL,
        hourly_charge DECIMAL(10,2) NOT NULL,
        total_hours DECIMAL(10,2) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(" Tables created successfully");
  } catch (err) {
    console.error(" Error creating tables:", err);
  }
};

createTables();

// Login endpoint
const bcrypt = require('bcrypt');
const RECAPTCHA_SECRET = "googlerecaptchv2key";
app.use(express.json())
// Registration endpoint with bcrypt hashing
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try{
  // Check if username already exists
    const checkUser = await pool.query('SELECT * FROM vendors WHERE username = $1', [username]);
    if (checkUser.rows.length > 0) {
      return res.json({ success: false, message: 'Username already exists' });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO vendors (username, password) VALUES ($1, $2) RETURNING *',
      [username, hashedPassword]
    );

    res.json({ success: true, vendor: { id: result.rows[0].id, username: result.rows[0].username } });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login endpoint with bcrypt password comparison
app.post('/api/login', async (req, res) => {
  const { username, password,recaptchaResponse } = req.body;
  try {
    const recaptchaVerify = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${recaptchaResponse}`,
      { method: "POST" }
  );

  const recaptchaData = await recaptchaVerify.json();
  if (!recaptchaData.success) {
      return res.status(400).json({ error: "reCAPTCHA verification failed" });
  }
    console.log("Login attempt:", username);
    const result = await pool.query('SELECT * FROM vendors WHERE username = $1', [username]);

    if (result.rows.length > 0) {
      const vendor = result.rows[0];

      // Compare hashed password
      const isMatch = await bcrypt.compare(password, vendor.password);
      if (isMatch) {
        console.log("Login successful for:", username);
        res.json({ success: true, vendor: { id: vendor.id, username: vendor.username } });
      } else {
        console.log("Login failed for:", username);
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      console.log("Login failed for:", username);
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update charges endpoint
app.post('/api/update-charges', async (req, res) => {
  const { vendorId, entryCharge, hourlyCharge } = req.body;
  
  try {
    console.log("Updating charges:", { vendorId, entryCharge, hourlyCharge });
    const result = await pool.query(
      'UPDATE vendors SET entry_charge = $1, hourly_charge = $2 WHERE id = $3 RETURNING *',
      [entryCharge, hourlyCharge, vendorId]
    );
    
    if (result.rows.length > 0) {
      console.log("Charges updated for vendor ID:", vendorId);
      res.json({ 
        success: true, 
        vendor: result.rows[0]
      });
    } else {
      console.log("Vendor not found:", vendorId);
      res.status(404).json({ 
        success: false, 
        message: 'Vendor not found' 
      });
    }
  } catch (error) {
    console.error('Update charges error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// New vehicle entry endpoint
app.post('/api/vehicle-entry', async (req, res) => {
  const { lotNumber, carNumber, carName, mobileNumber } = req.body;
  try {
    console.log("Adding new vehicle:", { lotNumber, carNumber, carName, mobileNumber });
    const result = await pool.query(
      'INSERT INTO parking_entries (lot_number, car_number, car_name, mobile_number) VALUES ($1, $2, $3, $4) RETURNING *',
      [lotNumber, carNumber, carName, mobileNumber]
    );
    console.log("Vehicle added successfully:", result.rows[0]);
    res.json({ success: true, entry: result.rows[0] });
  } catch (error) {
    console.error("Vehicle entry error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search by lot number endpoint
app.get('/api/search-lot/:lotNumber', async (req, res) => {
  try {
    console.log("Searching for lot number:", req.params.lotNumber);
    const result = await pool.query(
      'SELECT * FROM parking_entries WHERE lot_number = $1 AND status = $2',
      [req.params.lotNumber, 'parked']
    );
    console.log(`Found ${result.rows.length} entries for lot number ${req.params.lotNumber}`);
    res.json({ success: true, entries: result.rows });
  } catch (error) {
    console.error("Search lot error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search by car number endpoint
app.get('/api/search-car/:carNumber', async (req, res) => {
  try {
    console.log("Searching for car number:", req.params.carNumber);
    const result = await pool.query(
      `SELECT * FROM parking_entries 
       WHERE car_number ILIKE $1 AND status = $2 
       ORDER BY lot_number ASC`,
      [`%${req.params.carNumber}%`, 'parked']
  );
  
    console.log(`Found ${result.rows.length} entries for car number ${req.params.carNumber}`);
    res.json({ success: true, entries: result.rows });
  } catch (error) {
    console.error("Search car error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// View parking lot endpoint
app.get('/api/parking-lot', async (req, res) => {
  try {
    console.log("Fetching parking lot data");
    const result = await pool.query(
      'SELECT * FROM parking_entries WHERE status = $1',
      ['parked']
    );
    console.log(`Found ${result.rows.length} active parking entries`);
    res.json({ success: true, entries: result.rows });
  } catch (error) {
    console.error("Parking lot fetch error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Vehicle exit endpoint
app.post('/api/vehicle-exit', async (req, res) => {
  const { entryId } = req.body;
  console.log("Processing vehicle exit for entry ID:", entryId);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get entry details
    const entryResult = await client.query(
      'SELECT * FROM parking_entries WHERE id = $1 AND status = $2',
      [entryId, 'parked']
    );

    if (entryResult.rows.length === 0) {
      console.log(`Entry ID ${entryId} not found or already exited`);
      throw new Error('Vehicle entry not found or already exited');
    }

    const entry = entryResult.rows[0];
    console.log("Found entry:", entry);
    
    // Get vendor charges
    const vendorResult = await client.query('SELECT entry_charge, hourly_charge FROM vendors LIMIT 1');
    
    if (vendorResult.rows.length === 0) {
      console.log("No vendor found with charge information");
      throw new Error('No vendor charge information available');
    }
    
    const { entry_charge, hourly_charge } = vendorResult.rows[0];
    console.log("Vendor charges:", { entry_charge, hourly_charge });
    
    // Calculate charges
    const exitTime = new Date();
    const entryTime = new Date(entry.entry_time);
    const hours = Math.ceil((exitTime - entryTime) / (1000 * 60 * 60));
    const totalAmount = parseFloat(entry_charge) + (parseFloat(hourly_charge) * hours);
    
    console.log("Charge calculation:", { 
      entryTime: entryTime.toISOString(), 
      exitTime: exitTime.toISOString(), 
      hours, 
      totalAmount 
    });
    
    // Update parking entry
    await client.query(
      'UPDATE parking_entries SET exit_time = $1, total_charge = $2, status = $3 WHERE id = $4',
      [exitTime, totalAmount, 'exited', entryId]
    );
    
    // Create bill
    const billResult = await client.query(
      'INSERT INTO parking_bills (entry_id, fixed_charge, hourly_charge, total_hours, total_amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [entryId, entry_charge, hourly_charge, hours, totalAmount]
    );
    
    await client.query('COMMIT');
    console.log("Vehicle exit processed successfully");
    
    res.json({
      success: true,
      bill: {
        ...billResult.rows[0],
        car_number: entry.car_number,
        car_name: entry.car_name,
        mobile_number: entry.mobile_number,
        entry_time: entry.entry_time,
        exit_time: exitTime
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Vehicle exit error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
});
