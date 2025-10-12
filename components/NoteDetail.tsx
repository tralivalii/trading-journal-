import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Note } from '../types';
import { useAppContext } from '../services/appState';
import { supabase } from '../services/supabase';
import { ICONS } from '../constants';
import NoteEditorToolbar from './ui/NoteEditorToolbar';
import { saveImage } from '../services/imageDB';
import useImageBlobUrl from '../hooks/useImageBlobUrl';

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

const NoteImage: React.FC<{
    imageKey: string;
    protocol: string;
    altText: string;
    onClick: (src: string) => void;
}> = ({ imageKey, protocol, altText, onClick }) => {
    const { state } = useAppContext();
    const isLocal = protocol === 'idb';
    const blobUrl = useImageBlobUrl(isLocal ? imageKey : null);
    const [remoteUrl, setRemoteUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (!isLocal && state.syncStatus === 'online') {
            supabase.storage.from('screenshots').createSignedUrl(imageKey, 3600)
                .then(({ data }) => {
                    if (isMounted && data?.signedUrl) {
                        setRemoteUrl(data.signedUrl);
                    }
                })
                .catch(e => console.error("Failed to get signed URL for note image:", e));
        }
        return () => { isMounted = false; };
    }, [imageKey, isLocal, state.syncStatus]);

    const finalSrc = isLocal ? blobUrl : remoteUrl;

    if (finalSrc) {
        return (
            <img
                src={finalSrc}
                alt={altText}
                onClick={() => onClick(finalSrc)}
                className="my-4 rounded-lg w-full h-auto border border-gray-700 mx-auto block cursor-pointer"
            />
        );
    }

    return (
         <div className="text-center text-sm text-gray-500 my-2 p-4 bg-gray-900/50 rounded-md flex flex-col items-center justify-center min-h-[100px]">
            {isLocal && !blobUrl && <p>Loading local image...</p>}
            {!isLocal && state.syncStatus === 'offline' && <p>[Image unavailable offline: {altText}]</p>}
            {!isLocal && state.syncStatus === 'online' && !remoteUrl && <p className="animate-pulse">Loading cloud image...</p>}
        </div>
    );
};


type ParsedPart =
  | { type: 'text'; content: string }
  | { type: 'image'; alt: string; protocol: string; key: string };

type RenderedPart =
  | { type: 'text'; html: string; id: number }
  | { type: 'image'; alt: string; protocol: string; key: string; id: number };


// Main NoteDetail Component
const NoteDetail: React.FC<NoteDetailProps> = ({ note, isEditMode, onSetEditMode, onUpdate, onDelete, onTagClick }) => {
    const { state, dispatch } = useAppContext();
    const { currentUser, isGuest } = state;

    const [content, setContent] = useState(note.content);
    const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
    const [renderedParts, setRenderedParts] = useState<RenderedPart[]>([]);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const viewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setContent(note.content);
        if(isEditMode && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [note, isEditMode]);
    
    // This effect handles the async parsing of markdown and sets the state for rendering.
    useEffect(() => {
        const processContent = async () => {
            const imageRegex = /!\[(.*?)\]\((idb|storage):\/\/(.*?)\)/g;
            const tempParts: ParsedPart[] = [];
            let lastIndex = 0;
            let match;

            for (const m of note.content.matchAll(imageRegex)) {
                 if (m.index! > lastIndex) {
                    tempParts.push({ type: 'text', content: note.content.substring(lastIndex, m.index) });
                }
                tempParts.push({
                    type: 'image',
                    alt: m[1],
                    protocol: m[2],
                    key: m[3],
                });
                lastIndex = m.index! + m[0].length;
            }
            if (lastIndex < note.content.length) {
                tempParts.push({ type: 'text', content: note.content.substring(lastIndex) });
            }

            const finalRenderedParts = await Promise.all(
                tempParts.map(async (part, index): Promise<RenderedPart> => {
                    if (part.type === 'text') {
                        const withTags = part.content.replace(/#(\p{L}[\p{L}\p{N}_]*)/gu, '<a href="#" data-tag="$1" class="text-blue-400 no-underline hover:underline">#$1</a>');
                        const rawHtml = await marked.parse(withTags); // Correctly await the async function
                        const cleanHtml = DOMPurify.sanitize(rawHtml, {
                            ADD_TAGS: ['a', 'h1', 'h2', 'strong', 'ul', 'ol', 'li', 'p', 'br', 'em'],
                            ADD_ATTR: ['class', 'data-tag', 'href'],
                            ALLOWED_URI_REGEXP: /.*/
                        });
                        return { type: 'text', html: cleanHtml, id: index };
                    }
                    return { ...part, id: index };
                })
            );
            setRenderedParts(finalRenderedParts);
        };

        if (!isEditMode) {
             processContent();
        }
    }, [note.content, isEditMode]);


    useEffect(() => {
        const viewEl = viewRef.current;
        if (!viewEl || isEditMode) return;

        const handleTagClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'A' && target.dataset.tag) {
                e.preventDefault();
                onTagClick(target.dataset.tag);
            }
        };

        viewEl.addEventListener('click', handleTagClick);
        return () => viewEl.removeEventListener('click', handleTagClick);
    }, [renderedParts, isEditMode, onTagClick]);
    
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
                .prose-custom p { margin-bottom: 1em; line-height: 1.6; }
                .prose-custom strong { color: #F0F0F0; }
                .prose-custom ul { list-style-type: disc; margin-left: 1.5em; margin-bottom: 1em; }
                .prose-custom ol { list-style-type: decimal; margin-left: 1.5em; margin-bottom: 1em; }
                .prose-custom li { margin-bottom: 0.25em; }
             `}</style>
             <div ref={viewRef} className="text-[#F0F0F0] text-sm w-full flex-grow overflow-y-auto prose-custom">
                {renderedParts.length > 0 ? renderedParts.map((part) => {
                    if (part.type === 'image') {
                        return <NoteImage key={`${part.key}-${part.id}`} imageKey={part.key} protocol={part.protocol} altText={part.alt} onClick={setFullscreenSrc} />
                    }
                    if (part.type === 'text') {
                        return <div key={part.id} dangerouslySetInnerHTML={{ __html: part.html }} />;
                    }
                    return null;
                }) : <p className="text-gray-500">This note is empty.</p>}
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