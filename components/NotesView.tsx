
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppContext } from '../services/appState';
import { Note } from '../types';
import NoteDetail from './NoteDetail';
import { ICONS } from '../constants';
import { supabase } from '../services/supabase';
import Modal from './ui/Modal';

interface NotesViewProps {
    showToast: (message: string, type?: 'success' | 'error') => void;
}

const NotesSidebar: React.FC<{
    notes: Note[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onTagClick: (tag: string) => void;
    activeTag: string | null;
}> = ({ notes, searchQuery, onSearchChange, onTagClick, activeTag }) => {
    
    const displayTags = useMemo(() => {
        const allTags = notes.flatMap(note => note.tags || []);
        const uniqueTags = [...new Set(allTags)];
        
        // Shuffle and pick 30
        for (let i = uniqueTags.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [uniqueTags[i], uniqueTags[j]] = [uniqueTags[j], uniqueTags[i]];
        }
        return uniqueTags.slice(0, 30);

    }, [notes]);

    return (
        <div className="bg-[#232733] rounded-lg flex flex-col h-full">
            <div className="p-4 border-b border-gray-700/50">
                <h3 className="text-lg font-semibold text-white mb-3">Search Tags</h3>
                <input 
                    type="text"
                    placeholder="e.g., eurusd"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full bg-[#1A1D26] border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white"
                />
            </div>
            <div className="p-4 overflow-y-auto">
                <h3 className="text-lg font-semibold text-white mb-3">Discover Tags</h3>
                <div className="flex flex-wrap gap-2">
                    {displayTags.length > 0 ? displayTags.map(tag => (
                        <button 
                            key={tag}
                            onClick={() => onTagClick(tag)}
                            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                                activeTag === tag 
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                            }`}
                        >
                            #{tag}
                        </button>
                    )) : (
                        <p className="text-sm text-gray-500 italic">No tags found. Add notes with #hashtags to see them here.</p>
                    )}
                </div>
                 {activeTag && (
                    <button 
                        onClick={() => onTagClick('')} 
                        className="text-xs text-blue-400 hover:underline mt-4"
                    >
                        Clear filter
                    </button>
                )}
            </div>
        </div>
    );
};


const NotesView: React.FC<NotesViewProps> = ({ showToast }) => {
    const { state, dispatch } = useAppContext();
    const { userData, currentUser, isGuest } = state;
    const notes = userData?.notes || [];

    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

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
            showToast("This feature is disabled in guest mode.", 'error');
            return;
        }
        if (!currentUser) return;

        const newNoteData = {
            content: '',
            user_id: currentUser.id,
            date: new Date().toISOString(),
            tags: [],
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
                date: data.date,
                content: data.content,
                tags: data.tags || [],
            };

            dispatch({ type: 'UPDATE_NOTES', payload: [fullNewNote, ...notes] });
            setSelectedNote(fullNewNote);
            setIsEditMode(true);
            showToast('Note created.', 'success');
        } catch (error) {
            console.error('Failed to create note:', error);
            showToast('Failed to create note.', 'error');
        }
    };
    
    const parseTags = (content: string): string[] => {
        const tags = [...content.matchAll(/#(\p{L}[\p{L}\p{N}_]*)/gu)].map(match => match[1].toLowerCase());
        return [...new Set(tags)];
    };

    const handleUpdateNote = async (id: string, content: string) => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.", 'error');
            setIsEditMode(false);
            return;
        }
        if (!currentUser) return;
        
        const tags = parseTags(content);
        
        try {
            const { data, error } = await supabase
                .from('notes')
                .update({ content, tags })
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            
            const updatedNote: Note = {
                id: data.id,
                date: data.date,
                content: data.content,
                tags: data.tags || [],
            };

            const updatedNotes = notes.map(n => n.id === id ? updatedNote : n);
            dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
            setSelectedNote(updatedNote);
            setIsEditMode(false);
            showToast('Note updated.', 'success');
        } catch (error) {
             console.error('Failed to update note:', error);
            showToast('Failed to update note.', 'error');
        }
    };
    
    const handleDeleteNote = async (id: string) => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.", 'error');
            return;
        }
        if (!currentUser) return;
        if (!confirm('Are you sure you want to delete this note?')) return;
        
        try {
            const { error } = await supabase.from('notes').delete().eq('id', id);
            if (error) throw error;
            
            const updatedNotes = notes.filter(n => n.id !== id);
            dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
            showToast('Note deleted.', 'success');
            if (selectedNote?.id === id) {
                setSelectedNote(null);
                setIsEditMode(false);
            }
        } catch (error) {
            console.error('Failed to delete note:', error);
            showToast('Failed to delete note.', 'error');
        }
    };
    
    const handleTagClick = (tag: string) => {
        setSearchQuery('');
        setActiveTag(prev => prev === tag ? null : tag);
    };
    
    const handleBackToList = () => {
        setSelectedNote(null);
        setIsEditMode(false);
    };

    const filteredNotes = useMemo(() => {
        let notesToFilter = [...notes];
        
        if (activeTag) {
            notesToFilter = notesToFilter.filter(note => note.tags?.includes(activeTag));
        }

        if (searchQuery) {
             notesToFilter = notesToFilter.filter(note => 
                note.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        return notesToFilter.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [notes, searchQuery, activeTag]);

    return (
        <div>
            {/* --- MOBILE-ONLY HEADER --- */}
            <div className="lg:hidden flex justify-between items-center mb-4">
                {!selectedNote ? (
                    <>
                        <h2 className="text-xl font-semibold text-white">All Notes ({filteredNotes.length})</h2>
                        <button 
                            onClick={() => setIsSearchModalOpen(true)} 
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                            aria-label="Search and filter tags"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
                            Tags
                        </button>
                    </>
                ) : (
                    <button onClick={handleBackToList} className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        <span>Back to Notes</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[75vh]">
                {/* Note List */}
                <div className={`lg:col-span-3 bg-[#232733] rounded-lg border border-gray-700/50 flex-col ${selectedNote ? 'hidden' : 'flex'} lg:flex`}>
                    <div className="p-4 border-b border-gray-700/50 flex-shrink-0 hidden lg:block">
                        <h2 className="text-xl font-semibold text-white">All Notes ({filteredNotes.length})</h2>
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
                <div className={`lg:col-span-6 bg-[#232733] rounded-lg border border-gray-700/50 p-4 ${selectedNote ? 'block' : 'hidden'} lg:block`}>
                    {selectedNote ? (
                        <NoteDetail 
                            note={selectedNote}
                            isEditMode={isEditMode}
                            onSetEditMode={setIsEditMode}
                            onUpdate={handleUpdateNote}
                            onDelete={handleDeleteNote}
                            onTagClick={handleTagClick}
                            showToast={showToast}
                        />
                    ) : (
                        <div className="hidden lg:flex flex-col items-center justify-center h-full text-gray-500">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <p className="mt-4 text-lg">Select a note to view or edit</p>
                            <p>Or, <button onClick={handleAddNewNote} className="text-[#3B82F6] hover:underline">create a new note</button>.</p>
                        </div>
                    )}
                </div>
                
                {/* Sidebar (desktop-only) */}
                <div className="lg:col-span-3 hidden lg:block">
                    <NotesSidebar 
                        notes={notes} 
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onTagClick={handleTagClick}
                        activeTag={activeTag}
                    />
                </div>
            </div>

            {/* --- SEARCH MODAL for mobile --- */}
            <Modal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} title="Search & Discover Tags">
                 <div className="lg:col-span-3">
                    <NotesSidebar 
                        notes={notes} 
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onTagClick={(tag) => {
                            handleTagClick(tag);
                            setIsSearchModalOpen(false);
                        }}
                        activeTag={activeTag}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default NotesView;
