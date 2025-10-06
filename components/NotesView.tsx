import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../services/appState';
import { Note } from '../types';
import NoteDetail from './NoteDetail';
import { ICONS } from '../constants';
import { supabase } from '../services/supabase';

interface NotesViewProps {
    showToast: (message: string) => void;
}

const NotesView: React.FC<NotesViewProps> = ({ showToast }) => {
    const { state, dispatch } = useAppContext();
    const { userData, currentUser, isGuest } = state;
    const notes = userData?.notes || [];

    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // If the selected note is deleted from the list, deselect it.
        if (selectedNote && !notes.find(n => n.id === selectedNote.id)) {
            setSelectedNote(null);
            setIsEditMode(false);
        }
    }, [notes, selectedNote]);
    
    const handleSelectNote = (note: Note) => {
        if (selectedNote?.id === note.id && isEditMode) {
            if (confirm("You have unsaved changes. Are you sure you want to switch?")) {
                setIsEditMode(false);
                setSelectedNote(note);
            }
        } else {
            setIsEditMode(false);
            setSelectedNote(note);
        }
    };

    const handleAddNewNote = async () => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.");
            return;
        }
        if (!currentUser) return;

        const newNoteData = {
            content: 'New Note...',
            user_id: currentUser.id
        };

        try {
            const { data, error } = await supabase
                .from('notes')
                .insert(newNoteData)
                .select()
                .single();

            if (error) throw error;
            
            const fullNewNote: Note = {
                id: data.id,
                date: data.created_at,
                content: data.content,
            };

            dispatch({ type: 'UPDATE_NOTES', payload: [fullNewNote, ...notes] });
            setSelectedNote(fullNewNote);
            setIsEditMode(true);
            showToast('Note created.');
        } catch (error) {
            console.error('Failed to create note:', error);
            showToast('Failed to create note.');
        }
    };

    const handleUpdateNote = async (id: string, content: string) => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.");
            setIsEditMode(false);
            return;
        }
        if (!currentUser) return;
        
        try {
            const { data, error } = await supabase
                .from('notes')
                .update({ content })
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            const updatedNotes = notes.map(n => n.id === id ? { ...n, content: data.content } : n);
            dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
            setSelectedNote(prev => prev ? {...prev, content: data.content} : null);
            setIsEditMode(false);
            showToast('Note updated.');
        } catch (error) {
             console.error('Failed to update note:', error);
            showToast('Failed to update note.');
        }
    };
    
    const handleDeleteNote = async (id: string) => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.");
            return;
        }
        if (!currentUser) return;
        if (!confirm('Are you sure you want to delete this note?')) return;
        
        try {
            const { error } = await supabase.from('notes').delete().eq('id', id);
            if (error) throw error;
            
            const updatedNotes = notes.filter(n => n.id !== id);
            dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
            showToast('Note deleted.');
            if (selectedNote?.id === id) {
                setSelectedNote(null);
                setIsEditMode(false);
            }
        } catch (error) {
            console.error('Failed to delete note:', error);
            showToast('Failed to delete note.');
        }
    };

    const filteredNotes = useMemo(() => {
        return notes
            .filter(note => note.content.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [notes, searchQuery]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8 min-h-[75vh]">
            {/* Note List */}
            <div className="md:col-span-1 lg:col-span-1 bg-[#232733] rounded-lg border border-gray-700/50 flex flex-col">
                <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-white mb-3">All Notes</h2>
                    <input 
                        type="text"
                        placeholder="Search notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#1A1D26] border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white"
                    />
                </div>
                <div className="overflow-y-auto flex-grow">
                    {filteredNotes.map(note => (
                        <div 
                            key={note.id}
                            onClick={() => handleSelectNote(note)}
                            className={`p-4 cursor-pointer border-l-4 ${selectedNote?.id === note.id ? 'border-[#3B82F6] bg-gray-700/50' : 'border-transparent hover:bg-gray-800/50'}`}
                        >
                            <p className="text-white font-medium truncate">{note.content.split('\n')[0] || 'Untitled Note'}</p>
                            <p className="text-xs text-gray-400 mt-1">{new Date(note.date).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-700/50 flex-shrink-0">
                    <button onClick={handleAddNewNote} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-blue-500 transition-colors">
                        <span className="w-5 h-5">{ICONS.plus}</span> New Note
                    </button>
                </div>
            </div>

            {/* Note Detail */}
            <div className="md:col-span-2 lg:col-span-3 bg-[#232733] rounded-lg border border-gray-700/50 p-6">
                {selectedNote ? (
                    <NoteDetail 
                        note={selectedNote}
                        isEditMode={isEditMode}
                        onSetEditMode={setIsEditMode}
                        onUpdate={handleUpdateNote}
                        onDelete={handleDeleteNote}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <p className="mt-4 text-lg">Select a note to view or edit</p>
                        <p>Or, <button onClick={handleAddNewNote} className="text-[#3B82F6] hover:underline">create a new note</button>.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotesView;