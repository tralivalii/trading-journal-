import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types';
import { useAppContext } from '../services/appState';
import { supabase } from '../services/supabase';
import { ICONS } from '../constants';
import NoteEditorToolbar from './ui/NoteEditorToolbar';
import { saveImage } from '../services/imageDB';
import { getImage } from '../services/imageDB';

declare const DOMPurify: any;
declare const marked: any;

interface NoteDetailProps {
    note: Note;
    isEditMode: boolean;
    onSetEditMode: (isEditing: boolean) => void;
    onUpdate: (id: string, content: string) => void;
    onDelete: (id: string) => void;
    onTagClick: (tag: string) => void;
}

const KebabMenu: React.FC<{
    onEdit: () => void;
    onDelete: () => void;
}> = ({ onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Note options"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" /></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700/50 z-20">
                    <ul className="py-1">
                        <li><button onClick={() => { onEdit(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3">Edit</button></li>
                        <li><button onClick={() => { onDelete(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-3">Delete</button></li>
                    </ul>
                </div>
            )}
        </div>
    );
};


const NoteDetail: React.FC<NoteDetailProps> = ({ note, isEditMode, onSetEditMode, onUpdate, onDelete, onTagClick }) => {
    const { state, dispatch } = useAppContext();
    const { currentUser, isGuest } = state;

    const [content, setContent] = useState(note.content);
    const [renderedContent, setRenderedContent] = useState('');
    const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const viewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setContent(note.content);
        if(isEditMode && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [note, isEditMode]);

    useEffect(() => {
        const createdUrls: string[] = [];

        const processContent = async () => {
            if (isEditMode || !note.content) {
                setRenderedContent('');
                return;
            }

            let tempContent = note.content;
            const imageRegex = /!\[(.*?)\]\((idb|storage):\/\/(.*?)\)/g;

            // Find all image markdown matches
            const matches = Array.from(tempContent.matchAll(imageRegex));
            const replacements = new Map<string, string>();

            // Process all found images in parallel
            await Promise.all(matches.map(async (match) => {
                const [fullMatch, alt, protocol, keyOrPath] = match;

                if (protocol === 'idb') {
                    try {
                        const blob = await getImage(keyOrPath);
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            createdUrls.push(url);
                            replacements.set(fullMatch, `<img src="${url}" alt="${alt}" data-fullscreen-src="${url}" class="my-4 rounded-lg w-full h-auto border border-gray-700 mx-auto block cursor-pointer" />`);
                        } else {
                            replacements.set(fullMatch, `<p class="text-center text-sm text-yellow-400 my-2">[Local image not found: ${alt}]</p>`);
                        }
                    } catch (e) {
                        console.error("Failed to get image from IndexedDB for key:", keyOrPath, e);
                        replacements.set(fullMatch, `<p class="text-center text-sm text-red-400 my-2">[Error loading local image: ${alt}]</p>`);
                    }
                } else if (protocol === 'storage') {
                    if (navigator.onLine) {
                        try {
                            const { data } = await supabase.storage.from('screenshots').createSignedUrl(keyOrPath, 3600);
                            if (data?.signedUrl) {
                                replacements.set(fullMatch, `<img src="${data.signedUrl}" alt="${alt}" data-fullscreen-src="${data.signedUrl}" class="my-4 rounded-lg w-full h-auto border border-gray-700 mx-auto block cursor-pointer" />`);
                            }
                        } catch (e) {
                             console.error("Failed to create signed URL for", keyOrPath, e);
                             replacements.set(fullMatch, `<p class="text-center text-sm text-red-400 my-2">[Error loading cloud image: ${alt}]</p>`);
                        }
                    } else {
                        replacements.set(fullMatch, `<p class="text-center text-sm text-gray-500 my-2 p-4 bg-gray-900/50 rounded-md">[Image unavailable offline: ${alt}]</p>`);
                    }
                }
            }));
            
            // Apply all replacements to the content
            for (const [original, replacement] of replacements.entries()) {
                tempContent = tempContent.replace(original, replacement);
            }

            // Process hashtags and markdown formatting
            let finalHtml = tempContent.replace(/#(\p{L}[\p{L}\p{N}_]*)/gu, '<a href="#" data-tag="$1" class="text-blue-400 no-underline hover:underline">#$1</a>');
            // FIX: The modern version of the `marked` library returns a Promise. The result must be awaited
            // to get the HTML string before passing it to DOMPurify. This resolves a type error, as a Promise
            // object is not a valid input for DOMPurify. The reported iterator error on a different line is
            // likely a misleading artifact of the build process.
            finalHtml = await marked.parse(finalHtml);
            const cleanHtml = DOMPurify.sanitize(finalHtml, {
                ADD_TAGS: ['a', 'img', 'h1', 'h2', 'strong', 'ul', 'ol', 'li', 'p', 'br', 'em'],
                ADD_ATTR: ['class', 'data-tag', 'href', 'src', 'alt', 'data-fullscreen-src'],
                ALLOWED_URI_REGEXP: /.*/
            });

            setRenderedContent(cleanHtml);
        };

        processContent();

        return () => {
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [note.content, isEditMode]);


    useEffect(() => {
        const viewEl = viewRef.current;
        if (!viewEl || isEditMode) return;

        const handleContentClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'A' && target.dataset.tag) {
                e.preventDefault();
                onTagClick(target.dataset.tag);
            } else if (target.tagName === 'IMG' && target.dataset.fullscreenSrc) {
                e.preventDefault();
                setFullscreenSrc(target.dataset.fullscreenSrc);
            }
        };

        viewEl.addEventListener('click', handleContentClick);
        return () => viewEl.removeEventListener('click', handleContentClick);
    }, [renderedContent, isEditMode, onTagClick]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setFullscreenSrc(null);
            }
        };

        if (fullscreenSrc) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [fullscreenSrc]);

    const handleSave = () => {
        onUpdate(note.id, content);
    };

    const uploadAndInsertImage = async (file: File) => {
        if (isGuest) {
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
            const localImageKey = await saveImage(currentUser?.id || 'guest', file);
            const finalMarkdown = `\n![${file.name}](idb://${localImageKey})\n`;

            setContent(currentContent => currentContent.replace(placeholder, finalMarkdown));
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Image saved locally', type: 'success' } });
        } catch (error) {
            setContent(currentContent => currentContent.replace(placeholder, '\n[Save failed]\n'));
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Image save failed.', type: 'error' } });
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

    if (isEditMode) {
        return (
            <div className="flex flex-col h-full">
                <NoteEditorToolbar textareaRef={textareaRef} content={content} setContent={setContent} />
                <textarea 
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Write your thoughts..."
                    className="w-full bg-[#1A1D26] border border-gray-600 rounded-b-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white flex-grow rounded-t-none"
                    style={{ minHeight: '300px' }}
                />
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple hidden />
                <div className="flex justify-between items-center gap-3 mt-4">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm">
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
             <div className="absolute top-4 right-4 z-10">
                <KebabMenu onEdit={() => onSetEditMode(true)} onDelete={() => onDelete(note.id)} />
             </div>
             <style>{`
                .prose-custom h1 { font-size: 1.5rem; font-weight: 600; margin-top: 1.25em; margin-bottom: 0.5em; }
                .prose-custom h2 { font-size: 1.25rem; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; }
                .prose-custom p { margin-bottom: 1em; }
                .prose-custom strong { color: #F0F0F0; }
                .prose-custom ul { list-style-type: disc; margin-left: 1.5em; margin-bottom: 1em; }
                .prose-custom ol { list-style-type: decimal; margin-left: 1.5em; margin-bottom: 1em; }
                .prose-custom li { margin-bottom: 0.25em; }
             `}</style>
             <div 
                 ref={viewRef}
                 className="text-[#F0F0F0] whitespace-pre-wrap text-sm w-full flex-grow overflow-y-auto prose-custom"
                 dangerouslySetInnerHTML={{ __html: renderedContent || (note.content ? '<p class="animate-pulse">Loading content...</p>' : '<p class="text-gray-500">This note is empty.</p>') }}
            >
            </div>
            {fullscreenSrc && (
                <div 
                  className="fixed inset-0 bg-black/80 z-[60] flex justify-center items-center p-8" 
                  onClick={() => setFullscreenSrc(null)}
                >
                  <div
                    className="relative w-auto h-auto max-w-full max-h-full flex"
                    onClick={e => e.stopPropagation()}
                  >
                    <img 
                      src={fullscreenSrc} 
                      alt="Fullscreen view" 
                      className="block max-w-[85vw] max-h-[85vh] object-contain rounded-lg"
                    />
                  </div>
                  <button
                    onClick={() => setFullscreenSrc(null)}
                    className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1.5 hover:bg-black/80 transition-colors"
                    aria-label="Close fullscreen view"
                  >
                    <span className="w-6 h-6 block">{ICONS.x}</span>
                  </button>
                </div>
            )}
        </div>
    );
};

export default NoteDetail;