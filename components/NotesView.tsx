import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../services/appState';
import { Note } from '../types';
import NoteDetail from './NoteDetail';
import { ICONS } from '../constants';
import { supabase } from '../services/supabase';
import Modal from './ui/Modal';

interface NotesViewProps {}

const generateNoteTitle = (note: Note, allNotes: Note[]): string => {
    const noteDate = new Date(note.date);
    const dateString = noteDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const sameDayNotes = allNotes
        .filter(n => new Date(n.date).toDateString() === noteDate.toDateString())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const noteIndex = sameDayNotes.findIndex(n => n.id === note.id);

    if (noteIndex > 0) {
        return `${dateString} #${noteIndex + 1}`;
    }
    return dateString;
};

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
        
        for (let i = uniqueTags.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [uniqueTags[i], uniqueTags[j]] = [uniqueTags[j], uniqueTags[i]];
        }
        return uniqueTags.slice(0, 30);

    }, [notes]);

    return (
        <div className="p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Search Tags</h3>
            <input 
                type="text"
                placeholder="e.g., eurusd"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-[#1A1D26] border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white"
            />
            <h3 className="text-lg font-semibold text-white my-3">Discover Tags</h3>
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
                    <p className="text-sm text-gray-500 italic">No tags found.</p>
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
    );
};

const NewNoteCreator: React.FC<{
    onSave: (content: string) => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ onSave, onCancel, isSaving }) => {
    const { state, dispatch } = useAppContext();
    const { currentUser, isGuest } = state;
    const [content, setContent] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const uploadAndInsertImage = async (file: File) => {
        if (isGuest || !currentUser) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: "Image upload is disabled in guest mode.", type: 'error' } });
            return;
        }

        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPosition = textarea.selectionStart;
        const placeholder = `\n![Uploading ${file.name}...]()\n`;
        const newContent = content.slice(0, cursorPosition) + placeholder + content.slice(cursorPosition);
        setContent(newContent);

        try {
            const fileExtension = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID()}.${fileExtension}`;
            const filePath = `${currentUser.id}/${fileName}`;
            const buffer = await file.arrayBuffer();

            const { error: uploadError } = await supabase.storage.from('screenshots').upload(filePath, buffer, { contentType: file.type });
            if (uploadError) throw uploadError;
            
            const finalMarkdown = `\n![${file.name}](storage://${filePath})\n`;

            setContent(currentContent => currentContent.replace(placeholder, finalMarkdown));
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Image uploaded successfully', type: 'success' } });
        } catch (error) {
            setContent(currentContent => currentContent.replace(placeholder, '\n[Upload failed]\n'));
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Image upload failed.', type: 'error' } });
            console.error(error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            Array.from(files).forEach(uploadAndInsertImage);
            e.target.value = ''; 
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    uploadAndInsertImage(file);
                }
            }
        }
    };

    return (
        <div className="flex flex-col h-full">
             <textarea 
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                placeholder="Write your thoughts... #hashtags will be automatically detected."
                className="w-full bg-[#1A1D26] border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white flex-grow"
                style={{ minHeight: '300px' }}
                autoFocus
            />
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple hidden />
            <div className="flex justify-between items-center gap-3 mt-4">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm">
                    <span className="w-5 h-5">{ICONS.plus}</span> Add Photo
                </button>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm">Cancel</button>
                    <button onClick={() => onSave(content)} disabled={isSaving || !content.trim()} className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-blue-500 transition-colors text-sm disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {isSaving ? 'Creating...' : 'Create Note'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const NotesEmptyState: React.FC<{ onNewNote: () => void }> = ({ onNewNote }) => (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <h3 className="text-xl font-semibold text-white mt-4">Capture Your Thoughts</h3>
        <p className="mt-2 max-w-sm">
            Use notes to document market analysis, trading psychology, or anything that helps you on your journey.
        </p>
        <button 
            onClick={onNewNote}
            className="flex items-center justify-center gap-2 mt-6 px-5 py-2.5 bg-[#3B82F6] text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
            <span className="w-5 h-5">{ICONS.plus}</span> Create Your First Note
        </button>
    </div>
);


const NotesView: React.FC<NotesViewProps> = () => {
    const { state, dispatch } = useAppContext();
    const { userData, currentUser, isGuest } = state;
    const notes = userData?.notes || [];

    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [isCreatingNewNote, setIsCreatingNewNote] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        if (selectedNote && !notes.find(n => n.id === selectedNote.id)) {
            setSelectedNote(null);
            setIsEditMode(false);
        }
    }, [notes, selectedNote]);
    
    const handleSelectNote = (note: Note) => {
        if (isCreatingNewNote) setIsCreatingNewNote(false);
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
    
    const handleInitiateNewNote = () => {
        if (isSavingNote) return;
        if (isGuest) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
            return;
        }
        setSelectedNote(null);
        setIsEditMode(false);
        setIsCreatingNewNote(true);
    };

    const parseTags = (content: string): string[] => {
        const tags = [...content.matchAll(/#(\p{L}[\p{L}\p{N}_]*)/gu)].map(match => match[1].toLowerCase());
        return [...new Set(tags)];
    };
    
    const handleCreateNote = async (content: string) => {
        if (isGuest || !currentUser) return;
        if (!content.trim()) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: "Note cannot be empty.", type: 'error' } });
            return;
        }
        setIsSavingNote(true);

        const newNoteData = {
            content,
            user_id: currentUser.id,
            date: new Date().toISOString(),
            tags: parseTags(content),
        };

        try {
            const { data, error } = await supabase.from('notes').insert(newNoteData).select().single();
            if (error) throw error;
            
            const fullNewNote: Note = { id: data.id, date: data.date, content: data.content, tags: data.tags || [] };

            const updatedNotes = [fullNewNote, ...notes];
            dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
            setSelectedNote(fullNewNote);
            setIsCreatingNewNote(false);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Note created.', type: 'success' } });
        } catch (error) {
            console.error('Failed to create note:', error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to create note.', type: 'error' } });
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleUpdateNote = async (id: string, content: string) => {
        if (isGuest || !currentUser) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
            setIsEditMode(false);
            return;
        }
        setIsSavingNote(true);
        const tags = parseTags(content);
        
        try {
            const { data, error } = await supabase.from('notes').update({ content, tags }).eq('id', id).select().single();
            if (error) throw error;
            
            const updatedNote: Note = { id: data.id, date: data.date, content: data.content, tags: data.tags || [] };
            const updatedNotes = notes.map(n => n.id === id ? updatedNote : n);
            dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
            setSelectedNote(updatedNote);
            setIsEditMode(false);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Note updated.', type: 'success' } });
        } catch (error) {
             console.error('Failed to update note:', error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to update note.', type: 'error' } });
        } finally {
            setIsSavingNote(false);
        }
    };
    
    const handleDeleteNote = async (id: string) => {
        if (isGuest || !currentUser) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
            return;
        }
        if (!confirm('Are you sure you want to delete this note?')) return;
        
        try {
            const { error } = await supabase.from('notes').delete().eq('id', id);
            if (error) throw error;
            
            const updatedNotes = notes.filter(n => n.id !== id);
            dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Note deleted.', type: 'success' } });
            if (selectedNote?.id === id) {
                setSelectedNote(null);
                setIsEditMode(false);
            }
        } catch (error) {
            console.error('Failed to delete note:', error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to delete note.', type: 'error' } });
        }
    };
    
    const handleTagClick = (tag: string) => {
        setSearchQuery('');
        setActiveTag(prev => prev === tag ? null : tag);
    };
    
    const handleBackToList = () => {
        setSelectedNote(null);
        setIsCreatingNewNote(false);
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

    const noteTitles = useMemo(() => {
        const titles = new Map<string, string>();
        filteredNotes.forEach(note => {
            titles.set(note.id, generateNoteTitle(note, notes));
        });
        return titles;
    }, [filteredNotes, notes]);
    
    if (notes.length === 0 && !isCreatingNewNote) {
        return <NotesEmptyState onNewNote={handleInitiateNewNote} />;
    }

    return (
        <div>
            <div className="lg:hidden flex justify-between items-center mb-4">
                { !selectedNote && !isCreatingNewNote ? (
                    <>
                        <h2 className="text-xl font-semibold text-white">All Notes ({filteredNotes.length})</h2>
                        <button onClick={() => setIsSearchModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm">
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className={`lg:col-span-3 flex-col ${selectedNote || isCreatingNewNote ? 'hidden' : 'flex'} lg:flex`}>
                    <div className="p-4 flex-shrink-0">
                        <h2 className="text-xl font-semibold text-white">All Notes ({filteredNotes.length})</h2>
                    </div>
                     <div className="bg-[#232733] rounded-lg border border-gray-700/50 flex flex-col flex-grow min-h-[65vh]">
                        <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
                            <button onClick={handleInitiateNewNote} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-blue-500 transition-colors">
                                <span className="w-5 h-5">{ICONS.plus}</span> New Note
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-grow">
                            {filteredNotes.map(note => (
                                <div key={note.id} onClick={() => handleSelectNote(note)} className={`p-4 cursor-pointer border-l-4 ${selectedNote?.id === note.id ? 'border-[#3B82F6] bg-gray-700/50' : 'border-transparent hover:bg-gray-800/50'}`}>
                                    <p className="text-white font-medium truncate">{noteTitles.get(note.id) || 'Untitled Note'}</p>
                                    <p className="text-xs text-gray-400 mt-1 truncate">{note.content.split('\n')[0] || 'No content'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={`lg:col-span-6 flex-col ${selectedNote || isCreatingNewNote ? 'flex' : 'hidden'} lg:flex`}>
                     <div className="p-4 flex-shrink-0 h-[57px] flex items-center">
                        <h2 className="text-xl font-semibold text-white truncate">
                           {isCreatingNewNote ? 'Create New Note' : (selectedNote ? noteTitles.get(selectedNote.id) : ' ')}
                        </h2>
                    </div>
                    <div className="bg-[#232733] rounded-lg border border-gray-700/50 flex flex-col flex-grow p-6 relative min-h-[65vh]">
                        {isCreatingNewNote ? (
                           <NewNoteCreator onSave={handleCreateNote} onCancel={() => setIsCreatingNewNote(false)} isSaving={isSavingNote} />
                        ) : selectedNote ? (
                            <NoteDetail note={selectedNote} isEditMode={isEditMode} onSetEditMode={setIsEditMode} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} onTagClick={handleTagClick} />
                        ) : (
                            <div className="hidden lg:flex flex-col items-center justify-center h-full text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                <p className="mt-4 text-lg">Select a note to view or edit</p>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="lg:col-span-3 hidden lg:block">
                     <div className="p-4 flex-shrink-0 h-[57px] flex items-center">
                        <h2 className="text-xl font-semibold text-white">Search & Discover</h2>
                    </div>
                    <div className="bg-[#232733] rounded-lg border border-gray-700/50 min-h-[65vh]">
                        <NotesSidebar notes={notes} searchQuery={searchQuery} onSearchChange={setSearchQuery} onTagClick={handleTagClick} activeTag={activeTag} />
                    </div>
                </div>
            </div>

            <Modal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} title="Search & Discover Tags">
                <NotesSidebar notes={notes} searchQuery={searchQuery} onSearchChange={setSearchQuery} onTagClick={(tag) => { handleTagClick(tag); setIsSearchModalOpen(false); }} activeTag={activeTag} />
            </Modal>
        </div>
    );
};

export default NotesView;