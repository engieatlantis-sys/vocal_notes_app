require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Ensure uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const upload = multer({ storage });

// MongoDB model
const noteSchema = new mongoose.Schema({
  title: String,
  content: String,
  category: String,
  hasNotification: Boolean,
  notificationDate: String,
  createdAt: String,
  updatedAt: String,
  completed: Boolean,
  audioPath: String
});
const Note = mongoose.model('Note', noteSchema);

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vocal_notes_app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

// Routes
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;

    // Use OpenAI whisper transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1'
    });

    // Extract text from response
    const text = transcription.text || '';
    
    // Clean up uploaded file after transcription
    fs.unlink(filePath, (err) => { if (err) console.error('cleanup error', err); });

    return res.json({ transcription: text, audioPath: `/uploads/${path.basename(filePath)}` });
  } catch (err) {
    console.error('Transcription error:', err.message || err);
    res.status(500).json({ error: `Transcription failed: ${err.message}` });
  }
});

app.post('/api/analyze-note', async (req, res) => {
  try {
    const { transcription } = req.body;
    if (!transcription) return res.status(400).json({ error: 'transcription required' });

    const systemPrompt = `Tu es un assistant qui extrait un titre concis, une catégorie parmi [rdv,tache,intervention], un contenu structuré et une priorité (normale|urgente) à partir d'une transcription de note vocale en français. Réponds uniquement en JSON avec les clefs: title, category, content, priority.`;

    console.log('Calling OpenAI Chat with transcription:', transcription.slice(0, 100));
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transcription: ${transcription}` }
      ],
      max_tokens: 500
    });

    const reply = chat?.choices?.[0]?.message?.content || '';
    console.log('OpenAI reply:', reply);

    // Try to parse JSON from reply
    let parsed = null;
    try { 
      parsed = JSON.parse(reply); 
    } catch (e) {
      console.warn('Failed to parse JSON, using fallback');
      // Fallback: put transcription into content
      parsed = { title: transcription.slice(0, 60), category: 'intervention', content: transcription, priority: 'normale' };
    }

    res.json(parsed);
  } catch (err) {
    console.error('Analyze error:', err.message || err);
    res.status(500).json({ error: `Analyze failed: ${err.message}` });
  }
});

// Notes CRUD
app.get('/api/notes', async (req, res) => {
  try {
    const docs = await Note.find().sort({ createdAt: -1 }).lean();
    const notes = docs.map(d => ({ ...d, id: d._id }));
    console.log(`GET /api/notes -> ${notes.length} notes`);
    res.json(notes);
  } catch (err) {
    console.error('GET /api/notes error:', err.message || err);
    res.status(500).json({ error: 'Failed to list notes' });
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    // Defensive: do not pass a client-provided non-ObjectId `id` as `_id` to MongoDB
    const payload = { ...req.body };
    if (payload.id) {
      // if it's a valid ObjectId, allow using it as _id, otherwise drop it so Mongo generates one
      if (mongoose.Types.ObjectId.isValid(payload.id)) {
        payload._id = payload.id;
      }
      delete payload.id;
    }

    const n = await Note.create(payload);
    const obj = n.toObject();
    obj.id = n._id;
    console.log('Created note:', { id: obj.id.toString(), title: obj.title, createdAt: obj.createdAt });
    res.json(obj);
  } catch (err) {
    console.error('POST /api/notes error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'create failed', detail: err && (err.message || String(err)) });
  }
});

app.put('/api/notes/:id', async (req, res) => {
  try {
    const n = await Note.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(n);
  } catch (err) {
    console.error('PUT /api/notes error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'update failed', detail: err && (err.message || String(err)) });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    await Note.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/notes error:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'delete failed', detail: err && (err.message || String(err)) });
  }
});

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
