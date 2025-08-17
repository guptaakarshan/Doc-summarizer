require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const app = express();

// Set up Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Load API key from environment variables for security
const apiKey = process.env.GOOGLE_API_KEY; 

app.post('/summarize', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded.' });
  }

  try {
    const dataBuffer = req.file.buffer;
    const data = await pdf(dataBuffer);
    const pdfText = data.text;

    const payload = {
      contents: [{
        role: "user",
        parts: [{ text: `Summarize this document: ${pdfText}` }]
      }],
    };
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Google API request failed with status: ${response.status}`);
    }

    const result = await response.json();
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error in processing the file or API call.' });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));