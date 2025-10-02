import React, { useState } from 'react';
import { Note } from '../types';

interface NotesViewProps {
    notes: Note[];
    onAddNote: (title: string, content: string) => void;
    onViewNote: (note: Note) => void;
}

const NotesView: React.FC<NotesViewProps> = ({ notes, onAddNote, onViewNote }) => {
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');

    const handleAddClick = () => {
        if (newNoteTitle.trim() && newNoteContent.trim()) {
            onAddNote(newNoteTitle, newNoteContent);
            setNewNoteTitle('');
            setNewNoteContent('');
        }
    };
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-6">New note</h1>
                <div className="bg-[#232733] rounded-lg border border-gray-700/50 p-4 space-y-3">
                    <input 
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                        placeholder="Note Title"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white"
                    />
                    <textarea 
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Write down your thoughts, observations, or psychological notes..."
                        rows={5}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white"
                    />
                    <div className="flex justify-end">
                        <button 
                            onClick={handleAddClick}
                            className="px-6 py-2 bg-transparent border border-[#3B82F6] text-[#3B82F6] rounded-md hover:bg-[#3B82F6] hover:text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!newNoteTitle.trim() || !newNoteContent.trim()}
                        >
                            Add Note
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-semibold text-white mb-4">Your Notes</h2>
                {notes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {notes.map(note => (
                            <div 
                                key={note.id} 
                                onClick={() => onViewNote(note)}
                                className="bg-[#232733] p-6 rounded-lg border border-gray-700/50 hover:border-[#3B82F6] transition-all cursor-pointer flex flex-col justify-between min-h-[200px]"
                            >
                                <div>
                                    <h3 className="text-lg font-semibold text-[#F0F0F0] mb-2 truncate">{note.title}</h3>
                                    <p className="text-sm text-[#8A91A8] line-clamp-4">
                                        {note.content}
                                    </p>
                                </div>
                                <p className="text-xs text-[#8A91A8] mt-4 self-end">{new Date(note.date).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-[#232733] rounded-lg border border-gray-700/50">
                        <p className="text-[#8A91A8]">
                            You haven't written any notes yet.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotesView;