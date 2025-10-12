import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext, saveNoteAction, deleteNoteAction, fetchMoreNotesAction } from '../services/appState';
import { Note } from '../types';
import NoteDetail from './NoteDetail';
import { ICONS } from '../constants';
import Skeleton from './ui/Skeleton';

const NotesView: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { notes, hasMoreNotes, isFetchingMoreNotes } = state.userData!;
    
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredNotes = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return notes
            .filter(note =>
                note.content.toLowerCase().includes(lowerCaseSearchTerm) ||
                (note.tags || []).some(tag => tag.toLowerCase().includes(lowerCaseSearchTerm))
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [notes, searchTerm]);

    const selectedNote = useMemo(() => {
        return notes.find(note => note.id === selectedNoteId) || null;
    }, [notes, selectedNoteId]);
    
    const handleSelectNote = (note: Note) => {
        if (isEditMode && selectedNoteId) {
            if (window.confirm("You have unsaved changes. Are you sure you want to switch notes?")) {
                setIsEditMode(false);
            } else {
                return;
            }
        }
        setSelectedNoteId(note.id);
        setIsEditMode(false);
    };

    const handleCreateNewNote = async () => {
        if (isEditMode) {
             if (window.confirm("You have unsaved changes. Are you sure you want to create a new note?")) {
                setIsEditMode(false);
            } else {
                return;
            }
        }
        const newNoteData = {
            date: new Date().toISOString(),
            content: '# New Note\n\n',
        };
        const newNote = await saveNoteAction(dispatch, state, newNoteData, false);
        setSelectedNoteId(newNote.id);
        setIsEditMode(true);
    };

    const handleUpdateNote = async (id: string, content: string) => {
        const noteToUpdate = notes.find(n => n.id === id);
        if (!noteToUpdate) return;
        
        // Extract tags from content
        const tagRegex = /#(\p{L}[\p{L}\p{N}_]*)/gu;
        const tags = Array.from(content.matchAll(tagRegex), m => m[1]);

        const updatedNoteData = { ...noteToUpdate, content, tags };
        await saveNoteAction(dispatch, state, updatedNoteData, true);
        setIsEditMode(false);
    };

    const handleDeleteNote = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
            await deleteNoteAction(dispatch, state, id);
            if (selectedNoteId === id) {
                setSelectedNoteId(null);
                setIsEditMode(false);
            }
        }
    };
    
    const handleTagClick = (tag: string) => {
        setSearchTerm(`#${tag}`);
    };
    
    const handleLoadMore = () => {
        fetchMoreNotesAction(dispatch, state, 20);
    };
    
    const NotesListSkeleton: React.FC = () => (
        <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="p-3 bg-[#2A2F3B] rounded-md">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            ))}
        </div>
    );

    return (
        <div className="flex h-full gap-6">
            {/* Left Column: Note List */}
            <div className="w-1/3 max-w-sm flex flex-col bg-[#232733] rounded-lg border border-gray-700/50">
                <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-white">Notes</h2>
                        <button onClick={handleCreateNewNote} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm">
                            <span className="w-4 h-4">{ICONS.plus}</span>
                            New Note
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search notes or #tags..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1A1D26] border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pl-8"
                        />
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute top-1/2 left-2.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
                <div className="overflow-y-auto flex-grow p-2">
                    {state.isLoading ? (
                        <NotesListSkeleton />
                    ) : filteredNotes.length > 0 ? (
                        <div className="space-y-2">
                            {filteredNotes.map(note => (
                                <div
                                    key={note.id}
                                    onClick={() => handleSelectNote(note)}
                                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                                        selectedNoteId === note.id ? 'bg-blue-600/30' : 'bg-[#2A2F3B] hover:bg-gray-700/50'
                                    }`}
                                >
                                    <h3 className="font-semibold text-white truncate">{note.content.split('\n')[0].replace(/^#+\s*/, '') || 'Untitled Note'}</h3>
                                    <p className="text-xs text-gray-400">{new Date(note.date).toLocaleDateString()}</p>
                                </div>
                            ))}
                            {hasMoreNotes && (
                                <div className="mt-4 text-center">
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={isFetchingMoreNotes}
                                        className="text-sm text-blue-400 hover:underline disabled:text-gray-500"
                                    >
                                        {isFetchingMoreNotes ? 'Loading...' : 'Load More'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 pt-10">
                            <p>{searchTerm ? 'No notes match your search.' : 'No notes yet. Create one!'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Note Detail */}
            <div className="flex-1 bg-[#232733] rounded-lg border border-gray-700/50 p-6 relative">
                {selectedNote ? (
                    <NoteDetail
                        note={selectedNote}
                        isEditMode={isEditMode}
                        onSetEditMode={setIsEditMode}
                        onUpdate={handleUpdateNote}
                        onDelete={handleDeleteNote}
                        onTagClick={handleTagClick}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        <h3 className="text-lg font-semibold">Select a note to view or edit</h3>
                        <p className="max-w-xs">Or, create a new note to start jotting down your thoughts, ideas, or trade plans.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotesView;
