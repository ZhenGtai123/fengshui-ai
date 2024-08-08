// node --version # Should be >= 18
// npm install @google/generative-ai express

const express = require('express');
const path = require('path');
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require('@google/generative-ai');
const dotenv = require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json());

const MODEL_NAME = "gemini-pro";
const API_KEY = process.env.API_KEY;
const JWT_SECRET = 'random_secret_key'; // Replace with your own secret key


// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',  // Replace with your MySQL username
  password: '1011',  // Replace with your MySQL password
  database: 'fengshui'  // The database you created
});

db.connect((err) => {
  if (err) {
      throw err;
  }
  console.log('Connected to MySQL');
});

const users = [];

async function runChat(userInput) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.9,
    topK: 1,
    topP: 1,
    maxOutputTokens: 1000,
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    // ... other safety settings
  ];

  const chat = model.startChat({
    generationConfig,
    safetySettings,
    history: [
      {
        role: "user",
        parts: [
          {
            text: "You are Fengshui AI Chatbot, a friendly assistant who can analyse Fengshui for people's houses.",
          },
        ],
      },
      {
        role: "model",
        parts: [{ text: "Hello! Welcome to Fengshui AI Chatbot." }],
      },
      {
        role: "user",
        parts: [{ text: "Hi" }],
      },
      {
        role: "model",
        parts: [
          { text: "Hi there! Thanks for reaching out to Fengshui AI Chatbot. " },
        ],
      },
    ],
  });

  const result = await chat.sendMessage(userInput);
  const response = result.response;
  return response.text();
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/assets/img/loader.gif', (req, res) => {
  res.sendFile(path.join(__dirname + '/assets/img/loader.gif'));
});
app.post('/chat', async (req, res) => {
  try {
    const userInput = req.body?.userInput;
    console.log('incoming /chat req', userInput);
    if (!userInput) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const response = await runChat(userInput);
    res.json({ response });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Register endpoint
app.post('/register', async (req, res) => {
  const { firstName, lastName, username, email, password, country } = req.body;
  // Check if user already exists (based on email)
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, result) => {
        if (result.length > 0) {
            return res.status(400).send('User already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        const user = { first_name: firstName, last_name: lastName, username, email, password: hashedPassword, country };
        db.query('INSERT INTO users SET ?', user, (err, result) => {
            if (err) {
                throw err;
            }
            res.status(201).send('User registered successfully');
        });
    });
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

    // Find user (by email or username)
    db.query('SELECT * FROM users WHERE email = ? OR username = ?', [usernameOrEmail, usernameOrEmail], async (err, result) => {
        if (err) {
            throw err;
        }
        if (result.length === 0) {
            return res.status(400).send('User not found');

        }

        const user = result[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid credentials');

        }

        // Generate JWT
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    });
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
