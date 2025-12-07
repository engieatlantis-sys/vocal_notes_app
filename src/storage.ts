import { API_BASE_URL } from './apiConfig';
import { Note } from './types';

export async function getAllNotes(): Promise<Note[]> {
  const res = await fetch(`${API_BASE_URL}/api/notes`);
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
    await fetch(`${API_BASE_URL}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return;
  }
  await fetch(`${API_BASE_URL}/api/notes/${note.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) });
}

export async function deleteNoteById(id: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/notes/${id}`, { method: 'DELETE' });
}

export default { getAllNotes, setNote, deleteNoteById };
