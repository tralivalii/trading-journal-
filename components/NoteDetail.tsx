import React, { useState, useEffect } from 'react';
import { Note } from '../types';

interface NoteDetailProps {
    note: Note;
    isEditMode: boolean;
    onSetEditMode: (isEditing: boolean) => void;
    onUpdate: (id: string, content: string) => void;
    onDelete: (id: string) => void;
}

const NoteDetail: React.FC<NoteDetailProps> = ({ note, isEditMode, onSetEditMode, onUpdate, onDelete }) => {
    const [content, setContent] = useState(note.content);

    useEffect(() => {
        setContent(note.content);
    }, [note]);
    
    const handleSave = () => {
        onUpdate(note.id, content);
    };

    if (isEditMode) {
        return (
            <div className="space-y-4">
                <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={10}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                />
                <div className="flex justify-end gap-3">
                    <button onClick={() => onSetEditMode(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm">Save Changes</button>
                </div>
            </div>
        )
    }

    return (
        <div>
            <p className="text-gray-300 whitespace-pre-wrap text-sm w-full min-h-[200px] bg-gray-900/50 p-4 rounded-md">
                {note.content}
            </p>
            <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => onSetEditMode(true)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors text-sm">Edit</button>
                <button onClick={() => onDelete(note.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">Delete</button>
            </div>
        </div>
    );
};

export default NoteDetail;