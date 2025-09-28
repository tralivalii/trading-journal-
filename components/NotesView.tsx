import React, { useState } from 'react';
import { Note } from '../types';

interface NotesViewProps {
    notes: Note[];
    onAddNote: (content: string) => void;
    onViewNote: (note: Note) => void;
}

const NotesView: React.FC<NotesViewProps> = ({ notes, onAddNote, onViewNote }) => {
    const [newNoteContent, setNewNoteContent] = useState('');

    const handleAddClick = () => {
        if (newNoteContent.trim()) {
            onAddNote(newNoteContent);
            setNewNoteContent('');
        }
    };
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-6">New note</h1>
                <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4 space-y-3">
                    <textarea 
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Write down your thoughts, observations, or psychological notes..."
                        rows={5}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                    />
                    <div className="flex justify-end">
                        <button 
                            onClick={handleAddClick}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                            disabled={!newNoteContent.trim()}
                        >
                            Add Note
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-semibold text-white mb-4">Your Notes</h2>
                {notes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {notes.map(note => (
                            <div 
                                key={note.id} 
                                onClick={() => onViewNote(note)}
                                className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 hover:border-blue-500 hover:bg-gray-800 transition-all cursor-pointer flex flex-col justify-between"
                            >
                                <p className="text-gray-300 text-sm mb-2 line-clamp-6">
                                    {note.content}
                                </p>
                                <p className="text-xs font-semibold text-gray-400 mt-2 self-end">{new Date(note.date).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <p className="text-gray-500">
                            You haven't written any notes yet.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotesView;