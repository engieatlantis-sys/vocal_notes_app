import { Note } from './types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export async function getAllNotes(): Promise<Note[]> {
  const res = await fetch(`${API_BASE}/api/notes`);
  if (!res.ok) return [];
  const data = await res.json();
  return data as Note[];
}

export async function setNote(note: Note): Promise<void> {
  if (!note.id || note.id.startsWith('note_')) {
    // create
    const payload = { ...note } as any;
    // don't send the temporary client id to server; let server generate _id
    delete payload.id;
    await fetch(`${API_BASE}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return;
  }
  await fetch(`${API_BASE}/api/notes/${note.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) });
}

export async function deleteNoteById(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/notes/${id}`, { method: 'DELETE' });
}

export default { getAllNotes, setNote, deleteNoteById };
