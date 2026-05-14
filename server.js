// ===== DEPENDENCIES & IMPORTS =====
// Express: Web framework for building the API
const express = require('express');
// CORS: Allows requests from different domains
const cors = require('cors');
// bcryptjs: For hashing passwords securely
const bcrypt = require('bcryptjs');
// jsonwebtoken: For creating and verifying JWT authentication tokens
const jwt = require('jsonwebtoken');
// dotenv: Loads environment variables from .env file
require('dotenv').config();

// ===== SERVER SETUP =====
const app = express();
// Get port from environment or use default 3000
const port = process.env.PORT || 3000;
// Secret key for signing JWT tokens
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';

// ===== IN-MEMORY DATA STORAGE =====
// Note: Data is not persistent - it resets when server restarts
// In production, you would use a database like PostgreSQL
let users = [];        // Stores user accounts
let topics = [];       // Stores forum topics/discussions/questions
let messages = [];     // Stores private messages between users
let nextUserId = 1;    // Counter for generating unique user IDs
let nextTopicId = 1;   // Counter for generating unique topic IDs
let nextMessageId = 1; // Counter for generating unique message IDs

// ===== MIDDLEWARE SETUP =====
// Enable CORS to allow requests from different origins
app.use(cors());
// Parse incoming JSON request bodies
app.use(express.json());
// Serve static files (HTML, CSS, JS, etc.) from the current directory
app.use(express.static('.'));

console.log('🚀 Server starting with in-memory storage...');

// ===== JWT AUTHENTICATION MIDDLEWARE =====
// This middleware checks if requests have a valid JWT token
// If valid, it adds the user data to req.user
// If invalid, it returns an error
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Extract token from "Bearer <token>" format
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  // Verify token signature and expiration
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;  // Attach user data to request for use in route handlers
    next();
  });
};

// ===== HEALTH CHECK ENDPOINT =====
// Simple endpoint to verify the server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ===== USER REGISTRATION ENDPOINT =====
// POST /api/users/register
// Creates a new user account with username, email, and password
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if username or email already exists
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password using bcryptjs (10 salt rounds for security)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user object with profile fields
    const user = {
      id: nextUserId++,
      username,
      email,
      password_hash: passwordHash,
      profile_pic: null,        // URL to user's profile picture
      media: [],                // Array of media URLs for user's profile
      description: '',          // Short description
      bio: '',                  // Longer biographical text
      created_at: new Date().toISOString()
    };

    users.push(user);

    // Create JWT token that expires in 24 hours
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

// ===== USER LOGIN ENDPOINT =====
// POST /api/users/login
// Authenticates user with email and password, returns JWT token
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare provided password with stored hash
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
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

// ===== TOPICS/DISCUSSIONS ENDPOINTS =====
// GET /api/topics
// Retrieves all forum topics with author information and replies
app.get('/api/topics', async (req, res) => {
  try {
    // Map topics to include author's username instead of just ID
    const topicsWithAuthors = topics.map(topic => {
      const author = users.find(u => u.id === topic.author_id);
      // Also map replies to include reply author usernames
      const repliesWithAuthors = topic.replies.map(reply => {
        const replyAuthor = users.find(u => u.id === reply.author_id);
        return {
          ...reply,
          author_username: replyAuthor ? replyAuthor.username : 'Unknown'
        };
      });
      return {
        ...topic,
        author_username: author ? author.username : 'Unknown',
        replies: repliesWithAuthors
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(topicsWithAuthors);
  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/topics
// Creates a new topic (requires authentication)
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
      replies: [], // Initialize empty replies array
      created_at: new Date().toISOString()
    };

    topics.push(topic);

    res.status(201).json({ message: 'Topic created successfully', topic });
  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/topics/:id/replies
// Adds a reply to a topic (requires authentication)
app.post('/api/topics/:id/replies', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const { body } = req.body;
    if (!body) {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    const topic = topics.find(t => t.id === topicId);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const reply = {
      id: nextMessageId++, // Reuse message ID counter for simplicity
      body,
      author_id: req.user.id,
      created_at: new Date().toISOString()
    };

    topic.replies.push(reply);

    res.status(201).json({ message: 'Reply added successfully', reply });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/topics/:id
// Updates a topic (requires authentication, only author can edit)
app.put('/api/topics/:id', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const { title, body, type } = req.body;

    const topic = topics.find(t => t.id === topicId);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    if (topic.author_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own topics' });
    }

    if (title) topic.title = title;
    if (body) topic.body = body;
    if (type) topic.type = type;

    res.json({ message: 'Topic updated successfully', topic });
  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/topics/:id
// Deletes a topic (requires authentication, only author can delete)
app.delete('/api/topics/:id', authenticateToken, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id);
    const topicIndex = topics.findIndex(t => t.id === topicId);
    if (topicIndex === -1) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const topic = topics[topicIndex];
    if (topic.author_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own topics' });
    }

    topics.splice(topicIndex, 1);

    res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    console.error('Delete topic error:', error);
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

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});