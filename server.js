const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';

// In-memory storage
let users = [];
let topics = [];
let messages = [];
let nextUserId = 1;
let nextTopicId = 1;
let nextMessageId = 1;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files

console.log('🚀 Server starting with in-memory storage...');

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, jwtSecret, (err, user) => {
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
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = {
      id: nextUserId++,
      username,
      email,
      password_hash: passwordHash,
      created_at: new Date().toISOString()
    };

    users.push(user);

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API routes for posts/topics
app.get('/api/topics', async (req, res) => {
  try {
    // Return topics with author information
    const topicsWithAuthors = topics.map(topic => {
      const author = users.find(u => u.id === topic.author_id);
      return {
        ...topic,
        author_username: author ? author.username : 'Unknown'
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(topicsWithAuthors);
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/topics', authenticateToken, async (req, res) => {
  try {
    const { title, body, type } = req.body;
    if (!title || !body || !type) {
      return res.status(400).json({ error: 'Title, body, and type are required' });
    }

    const topic = {
      id: nextTopicId++,
      title,
      body,
      type,
      author_id: req.user.id,
      created_at: new Date().toISOString()
    };

    topics.push(topic);

    res.status(201).json({ message: 'Topic created successfully', topic });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API routes for messages
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    // Return messages for the current user with sender information
    const userMessages = messages
      .filter(msg => msg.recipient_id === req.user.id)
      .map(msg => {
        const sender = users.find(u => u.id === msg.sender_id);
        return {
          ...msg,
          sender_username: sender ? sender.username : 'Unknown'
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(userMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { content, recipientId } = req.body;
    if (!content || !recipientId) {
      return res.status(400).json({ error: 'Content and recipient ID are required' });
    }

    // Check if recipient exists
    const recipient = users.find(u => u.id === parseInt(recipientId));
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const message = {
      id: nextMessageId++,
      content,
      sender_id: req.user.id,
      recipient_id: parseInt(recipientId),
      created_at: new Date().toISOString()
    };

    messages.push(message);

    res.status(201).json({ message: 'Message sent successfully', message });
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