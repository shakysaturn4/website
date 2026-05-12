const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files

// Database connection
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Test database connection
  pool.on('connect', () => {
    console.log('Connected to database');
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
} else {
  console.log('No DATABASE_URL provided - running without database');
}

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Basic routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// API routes for users
app.post('/api/users/register', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash]
    );

    res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users/login', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query('SELECT id, username, email, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API routes for posts/topics
app.get('/api/topics', async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    const result = await pool.query(`
      SELECT t.*, u.username as author_username
      FROM topics t
      JOIN users u ON t.author_id = u.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/topics', authenticateToken, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    const { title, body, type } = req.body;
    if (!title || !body || !type) {
      return res.status(400).json({ error: 'Title, body, and type are required' });
    }

    const result = await pool.query(
      'INSERT INTO topics (title, body, type, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, body, type, req.user.id]
    );

    res.status(201).json({ message: 'Topic created successfully', topic: result.rows[0] });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API routes for messages
app.get('/api/messages', authenticateToken, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    const result = await pool.query(`
      SELECT m.*, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.recipient_id = $1
      ORDER BY m.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  if (!pool) {
    return res.status(503).json({ error: 'Database not available' });
  }
  try {
    const { content, recipientId } = req.body;
    if (!content || !recipientId) {
      return res.status(400).json({ error: 'Content and recipient ID are required' });
    }

    // Check if recipient exists
    const recipientCheck = await pool.query('SELECT id FROM users WHERE id = $1', [recipientId]);
    if (recipientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const result = await pool.query(
      'INSERT INTO messages (content, sender_id, recipient_id) VALUES ($1, $2, $3) RETURNING *',
      [content, req.user.id, recipientId]
    );

    res.status(201).json({ message: 'Message sent successfully', message: result.rows[0] });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch all handler: send back index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});