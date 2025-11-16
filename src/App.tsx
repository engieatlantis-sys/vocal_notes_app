import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Wrench, AlertCircle, Mic, Trash2, Edit, Bell, Check, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Note, NewNote } from './types';
import { getAllNotes, setNote as storageSetNote, deleteNoteById } from './storage';

const VocalNotesApp: React.FC = () => {
  const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  const [notes, setNotes] = useState<Note[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [newNote, setNewNote] = useState<NewNote>({
    title: '',
    content: '',
    category: 'rdv',
    hasNotification: false,
    notificationDate: ''
  });

  const categories = [
    { id: 'rdv', label: 'Rendez-vous', icon: Calendar, color: 'bg-blue-500' },
    { id: 'tache', label: 'Tâches', icon: Check, color: 'bg-green-500' },
    { id: 'intervention', label: 'Interventions', icon: Wrench, color: 'bg-orange-500' }
  ];

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    loadNotes();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const loadNotes = async () => {
    try {
      const loaded = await getAllNotes();
      setNotes(loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Erreur chargement des notes:', error);
    }
  };

  // Use real recording via MediaRecorder and send audio to backend for transcription
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // send to backend for transcription
        const fd = new FormData();
        fd.append('file', blob, 'note.webm');
        try {
          const resp = await fetch(`${API_BASE}/api/transcribe`, { method: 'POST', body: fd });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Transcription failed: ${text}`);
          }
          const data = await resp.json();
          const transcription = data.transcription || '';
          // ask backend to analyze
          const analyze = await fetch(`${API_BASE}/api/analyze-note`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcription }) });
          const analyzed = analyze.ok ? await analyze.json() : { title: transcription.slice(0, 60), category: 'intervention', content: transcription, priority: 'normale' };
          setNewNote({ title: analyzed.title?.substring(0,100) || 'Note vocale', content: analyzed.content || transcription, category: analyzed.category || 'intervention', hasNotification: analyzed.priority === 'urgente', notificationDate: '' });
          setShowNewNoteModal(true);
        } catch (err) {
          console.error('Upload/transcribe error', err);
          setNewNote({ title: 'Note vocale', content: 'Erreur transcription', category: 'intervention', hasNotification: false, notificationDate: '' });
          setShowNewNoteModal(true);
        }
      };
      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Micro inaccessible', err);
      alert('Impossible d\'accéder au micro. Vérifiez les permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const saveNote = async () => {
    if (!newNote.title.trim() || !newNote.content.trim()) return;
    const note: Note = {
      id: editingNote?.id || `note_${Date.now()}`,
      ...newNote,
      createdAt: editingNote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed: editingNote?.completed || false
    };
    try {
      await storageSetNote(note);
      await loadNotes();
      setShowNewNoteModal(false);
      setEditingNote(null);
      setNewNote({ title: '', content: '', category: 'rdv', hasNotification: false, notificationDate: '' });
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      await deleteNoteById(noteId);
      await loadNotes();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const toggleComplete = async (note: Note) => {
    const updated = { ...note, completed: !note.completed } as Note;
    try {
      await storageSetNote(updated);
      await loadNotes();
    } catch (error) {
      console.error('Erreur toggle complété:', error);
    }
  };

  const editNote = (note: Note) => {
    setEditingNote(note);
    setNewNote({ title: note.title, content: note.content, category: note.category, hasNotification: note.hasNotification, notificationDate: note.notificationDate || '' });
    setShowNewNoteModal(true);
  };

  const filteredNotes = notes.filter((note: Note) => {
    const matchesCategory = activeCategory === 'all' || note.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = (note.title || '').toLowerCase().includes(q) || (note.content || '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const stats = categories.map(cat => ({ ...cat, count: notes.filter(n => n.category === cat.id).length }));

  const CategoryIcon = ({ category }: { category: string }) => {
    const cat = categories.find(c => c.id === category);
    const Icon = cat?.icon || AlertCircle;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 px-6 py-4 sticky top-0 z-10">
        <h1 className="text-2xl font-bold">Notes Vocales</h1>
        <p className="text-slate-400 text-sm">Assistant virtuel pour responsable de site</p>
      </div>
      <div className="px-6 py-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {stats.map(stat => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.id} className={`${stat.color} bg-opacity-20 border border-opacity-30 ${stat.color.replace('bg-', 'border-')} rounded-xl p-4 text-center`}>
                <StatIcon className="w-6 h-6 mx-auto mb-2 opacity-90" />
                <div className="text-2xl font-bold">{stat.count}</div>
                <div className="text-xs opacity-80">{stat.label}</div>
              </div>
            );
          })}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Rechercher une note..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          <button onClick={() => setActiveCategory('all')} className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${activeCategory === 'all' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Tout ({notes.length})</button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 transition ${activeCategory === cat.id ? `${cat.color} text-white` : 'bg-slate-800 text-slate-300'}`}>
              <cat.icon className="w-4 h-4" />
              {cat.label} ({stats.find(s => s.id === cat.id)?.count || 0})
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-24 space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Mic className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Aucune note pour le moment</p>
            <p className="text-sm">Appuyez sur le bouton micro pour commencer</p>
          </div>
        ) : (
          filteredNotes.map(note => {
            const cat = categories.find(c => c.id === note.category);
            const isExpanded = expandedNote === note.id;
            return (
              <div key={note.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className={`${cat?.color} bg-opacity-20 p-2 rounded-lg`}>
                    <CategoryIcon category={note.category} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className={`font-semibold ${note.completed ? 'line-through opacity-60' : ''}`}>{note.title}</h3>
                      <button onClick={() => setExpandedNote(isExpanded ? null : note.id)} className="text-slate-400 hover:text-white transition">{isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</button>
                    </div>
                    <p className={`text-sm text-slate-400 mb-3 ${!isExpanded ? 'line-clamp-2' : ''}`}>{note.content}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      <span>{new Date(note.createdAt).toLocaleDateString('fr-FR')}</span>
                      {note.hasNotification && note.notificationDate && (
                        <span className="flex items-center gap-1 text-yellow-400"><Bell className="w-3 h-3" />{new Date(note.notificationDate).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="flex gap-2">
                        {note.category === 'tache' && (
                          <button onClick={() => toggleComplete(note)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${note.completed ? 'bg-slate-700 text-slate-400' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>{note.completed ? <><X className="w-4 h-4 inline mr-1" />Réouvrir</> : <><Check className="w-4 h-4 inline mr-1" />Terminer</>}</button>
                        )}
                        <button onClick={() => editNote(note)} className="flex-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 py-2 px-3 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition"><Edit className="w-4 h-4 inline mr-1" />Modifier</button>
                        <button onClick={() => deleteNote(note.id)} className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-2 px-3 rounded-lg text-sm font-medium hover:bg-red-500/30 transition"><Trash2 className="w-4 h-4 inline mr-1" />Supprimer</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2">
        <button onClick={() => isRecording ? stopRecording() : startRecording()} className={`${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'} text-white p-6 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed`}>
          <Mic className="w-8 h-8" />
        </button>
        {isRecording && (
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-slate-800 px-4 py-2 rounded-full text-sm whitespace-nowrap">Enregistrement...</div>
        )}
      </div>

      {showNewNoteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingNote ? 'Modifier la note' : 'Nouvelle note'}</h2>
              <button onClick={() => { setShowNewNoteModal(false); setEditingNote(null); setNewNote({ title: '', content: '', category: 'rdv', hasNotification: false, notificationDate: '' }); }} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Titre</label>
                <input type="text" value={newNote.title} onChange={(e) => setNewNote({...newNote, title: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Titre de la note" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contenu</label>
                <textarea value={newNote.content} onChange={(e) => setNewNote({...newNote, content: e.target.value})} rows={4} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Description détaillée..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Catégorie</label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => setNewNote({...newNote, category: cat.id})} className={`p-3 rounded-lg flex flex-col items-center gap-2 transition ${newNote.category === cat.id ? `${cat.color} text-white` : 'bg-slate-900 text-slate-400'}`}><cat.icon className="w-5 h-5" /><span className="text-xs">{cat.label}</span></button>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={newNote.hasNotification} onChange={(e) => setNewNote({...newNote, hasNotification: e.target.checked})} className="w-5 h-5 rounded" /><span className="text-sm font-medium">Ajouter une notification</span></label>
              </div>
              {newNote.hasNotification && (
                <div>
                  <label className="block text-sm font-medium mb-2">Date et heure de notification</label>
                  <input type="datetime-local" value={newNote.notificationDate} onChange={(e) => setNewNote({...newNote, notificationDate: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <button onClick={saveNote} disabled={!newNote.title || !newNote.content} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition">{editingNote ? 'Mettre à jour' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VocalNotesApp;
