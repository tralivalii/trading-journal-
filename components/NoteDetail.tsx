
import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types';
import { useAppContext } from '../services/appState';
import { supabase } from '../services/supabase';
import { ICONS } from '../constants';

declare const DOMPurify: any;

interface NoteDetailProps {
    note: Note;
    isEditMode: boolean;
    onSetEditMode: (isEditing: boolean) => void;
    onUpdate: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

const NoteDetail: React.FC<NoteDetailProps> = ({ note, isEditMode, onSetEditMode, onUpdate, onDelete, showToast }) => {
    const { state } = useAppContext();
    const { currentUser, isGuest } = state;

    const [content, setContent] = useState(note.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setContent(note.content);
    }, [note]);
    
    const handleSave = () => {
        onUpdate(note.id, content);
    };

    const uploadAndInsertImage = async (file: File) => {
        if (isGuest || !currentUser) {
            showToast("Image upload is disabled in guest mode.", 'error');
            return;
        }

        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPosition = textarea.selectionStart;
        const placeholder = `\n![Uploading ${file.name}...]()\n`;
        const newContent = content.slice(0, cursorPosition) + placeholder + content.slice(cursorPosition);
        setContent(newContent);

        try {
            // FIX: Flattened the storage path to avoid potential issues with nested folder policies.
            const imageKey = `notes/${note.id}-${crypto.randomUUID()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('screenshots')
                .upload(`${currentUser.id}/${imageKey}`, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('screenshots')
                .getPublicUrl(`${currentUser.id}/${imageKey}`);

            const finalMarkdown = `\n![${file.name}](${publicUrl})\n`;
            setContent(currentContent => currentContent.replace(placeholder, finalMarkdown));
            showToast('Image uploaded successfully', 'success');
        } catch (error) {
            setContent(currentContent => currentContent.replace(placeholder, '\n[Upload failed]\n'));
            showToast('Image upload failed.', 'error');
            console.error(error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            Array.from(files).forEach(uploadAndInsertImage);
            // Reset file input to allow selecting the same file again
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
    
    const createSanitizedMarkup = (markdown: string) => {
        if (!markdown) return { __html: '' };
        
        let html = markdown;
        
        // Process hashtags with Unicode support and simplified styling
        html = html.replace(/#(\p{L}[\p{L}\p{N}_]*)/gu, '<span class="text-blue-400">#$1</span>');
        
        // Process images
        html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" class="my-4 rounded-lg max-w-full h-auto border border-gray-700" />');

        const clean = DOMPurify.sanitize(html, {
            ADD_TAGS: ['span'],
            ADD_ATTR: ['class']
        });

        return { __html: clean };
    };

    if (isEditMode) {
        return (
            <div className="flex flex-col h-full">
                <h2 className="text-xl font-semibold text-white mb-4">Edit Note</h2>
                <textarea 
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Write your thoughts..."
                    className="w-full bg-[#1A1D26] border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white flex-grow"
                    style={{ minHeight: '300px' }}
                />
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    hidden
                />
                <div className="flex justify-between items-center gap-3 mt-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm"
                    >
                        <span className="w-5 h-5">{ICONS.plus}</span> Add Photo
                    </button>
                    <div className="flex gap-3">
                        <button onClick={() => onSetEditMode(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-blue-500 transition-colors text-sm">Save Changes</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <div 
                 className="text-[#F0F0F0] whitespace-pre-wrap text-sm w-full flex-grow overflow-y-auto"
                 dangerouslySetInnerHTML={createSanitizedMarkup(note.content)}
            >
            </div>
            <div className="flex justify-end gap-3 pt-4 flex-shrink-0">
                <button onClick={() => onSetEditMode(true)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors text-sm">Edit</button>
                <button onClick={() => onDelete(note.id)} className="px-4 py-2 bg-[#EF4444] text-white rounded-lg hover:bg-red-700 transition-colors text-sm">Delete</button>
            </div>
        </div>
    );
};

export default NoteDetail;
