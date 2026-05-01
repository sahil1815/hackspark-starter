const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(express.json()); // JSON বডি পড়ার জন্য

const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Central API Configuration
const CENTRAL_API_URL = process.env.CENTRAL_API_URL;
const CENTRAL_API_TOKEN = process.env.CENTRAL_API_TOKEN;

const centralApi = axios.create({
  baseURL: CENTRAL_API_URL,
  headers: { 'Authorization': `Bearer ${CENTRAL_API_TOKEN}` }
});

// Postgres Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Database Initialization (টেবিল না থাকলে তৈরি করবে)
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        security_score INT DEFAULT 100
      );
    `);
    console.log("Postgres connected and Users table verified.");
  } catch (err) {
    console.error("DB Init error:", err);
  }
};
initDB();

// P1: Health Check
app.get('/status', (req, res) => {
  res.json({ service: "user-service", status: "OK" });
});

// P2: POST /users/register
app.post('/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Hash password (P2 Requirement: Plain text = 0 points)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );
    const user = result.rows[0];
    
    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') { // Postgres Unique Violation Error Code
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// P2: POST /users/login
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// P2: GET /users/me
app.get('/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch full profile from DB
    const result = await pool.query('SELECT id, name, email, security_score FROM users WHERE id = $1', [decoded.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// P6: GET /users/:id/discount
app.get('/users/:id/discount', async (req, res) => {
  try {
    const userId = req.params.id;

    // Data from central api
    const response = await centralApi.get(`/api/data/users/${userId}`);
    const { securityScore } = response.data;

    // calculate discount based on security score
    let discountPercent = 0;
    if (securityScore >= 80) discountPercent = 20;
    else if (securityScore >= 60) discountPercent = 15;
    else if (securityScore >= 40) discountPercent = 10;
    else if (securityScore >= 20) discountPercent = 5;
    else discountPercent = 0;

    // sending response
    res.json({
      userId: parseInt(userId),
      securityScore,
      discountPercent
    });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: "User not found in Central API" });
    }
    res.status(500).json({ error: "Failed to fetch user security score" });
  }
});

app.listen(PORT, () => console.log(`User service running on port ${PORT}`));