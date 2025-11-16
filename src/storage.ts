import { Note } from './types';

async function ensureStorage() {
  // Prefer platform-provided storage, but fallback to localStorage for browser preview
  return;
}

export async function getAllNotes(): Promise<Note[]> {
  // If a `window.storage` API exists, use it. Otherwise, use localStorage as fallback.
  if ((window as any).storage && typeof (window as any).storage.list === 'function') {
    const result = await (window as any).storage.list('note:');
    if (!result || !result.keys || result.keys.length === 0) return [];
    const loaded = await Promise.all(result.keys.map(async (key: string) => {
      try {
        const data = await (window as any).storage.get(key);
        if (!data) return null;
        const value = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        return value as Note;
      } catch (err) {
        console.error(`Erreur chargement note ${key}:`, err);
        return null;
      }
    }));
    return loaded.filter(Boolean) as Note[];
  }

  // Fallback: read all keys from localStorage that start with 'note:'
  const notes: Note[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) as string;
    if (!key || !key.startsWith('note:')) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Note;
      notes.push(parsed);
    } catch (err) {
      console.error(`Erreur parse localStorage ${key}`, err);
    }
  }
  return notes;
}

export async function setNote(note: Note): Promise<void> {
  if ((window as any).storage && typeof (window as any).storage.set === 'function') {
    await (window as any).storage.set(`note:${note.id}`, JSON.stringify(note));
    return;
  }
  localStorage.setItem(`note:${note.id}`, JSON.stringify(note));
}

export async function deleteNoteById(id: string): Promise<void> {
  if ((window as any).storage && typeof (window as any).storage.delete === 'function') {
    await (window as any).storage.delete(`note:${id}`);
    return;
  }
  localStorage.removeItem(`note:${id}`);
}

export default { getAllNotes, setNote, deleteNoteById };
