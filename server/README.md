# Vocal Notes Server

Requirements:
- Node 18+
- MongoDB running (or set `MONGO_URI` in `.env`)

Setup:

1. Install dependencies

```bash
cd server
npm install
```

2. Configure `.env` (a default `.env` was created with your OpenAI key). Ensure `MONGO_URI` points to a running MongoDB.

3. Start server

```bash
npm run dev
# or
npm start
```

Endpoints:
- `POST /api/transcribe` - multipart form with `file` (audio). Returns `{ transcription, audioPath }`.
- `POST /api/analyze-note` - JSON { transcription }. Returns `{ title, category, content, priority }`.
- `GET /api/notes`, `POST /api/notes`, `PUT /api/notes/:id`, `DELETE /api/notes/:id` for notes storage.
