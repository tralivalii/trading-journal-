import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Note } from '../types';
import { ICONS } from '../constants';
import Modal from './ui/Modal';
import * as imageDB from '../services/imageDB';
import useImageBlobUrl from '../hooks/useImageBlobUrl';
import { useAppContext } from '../services/appState';

declare var DOMPurify: any;

const MAX_CONTENT_LENGTH = 20000;
const TRUNCATE_LENGTH = 280;
const MAX_ATTACHMENTS = 10;

// --- SUB-COMPONENTS ---

const NoteEditor: React.FC<{
    noteToEdit?: Note | null;
    onSave: (data: { content: string; attachments: NonNullable<Note['attachments']>; tags: string[] }) => void;
    onCancel?: () => void;
    buttonText: string;
    currentUserEmail: string;
}> = ({ noteToEdit, onSave, onCancel, buttonText, currentUserEmail }) => {
    const [attachments, setAttachments] = useState<NonNullable<Note['attachments']>>([]);
    const editorRef = useRef<HTMLDivElement>(null);
    const [charCount, setCharCount] = useState(0);
    const [isSaveDisabled, setIsSaveDisabled] = useState(true);
    const [activeBlobUrls, setActiveBlobUrls] = useState<string[]>([]);

    // This effect's only job is to clean up URLs when the component unmounts
    // or when the set of active URLs changes.
    useEffect(() => {
        return () => {
            activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [activeBlobUrls]);

    const handleEditorInput = () => {
        const editor = editorRef.current;
        if (editor) {
            const textLength = editor.innerText.length;
            const hasContent = textLength > 0 || editor.getElementsByTagName('img').length > 0;
            setCharCount(textLength);
            setIsSaveDisabled(!hasContent);
        }
    };
    
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        // Reset attachments state and clear the editor
        const initialAttachments = noteToEdit?.attachments || [];
        setAttachments(initialAttachments);
        editor.innerHTML = '';
        
        // If we are not editing, there's nothing more to do.
        if (!noteToEdit) {
            setActiveBlobUrls([]); // Ensure old URLs are cleaned up
            handleEditorInput();
            return;
        }
        
        // We are editing a note, so load its content and images.
        const content = noteToEdit.content;
        let isMounted = true; // Flag to prevent state updates on unmounted component

        const urlPromises = initialAttachments.map(attachment =>
            imageDB.getImage(attachment.data).then(blob => blob ? URL.createObjectURL(blob) : null)
        );

        Promise.all(urlPromises).then(urls => {
            if (!isMounted) {
                // If component unmounted while fetching, just revoke the URLs we created.
                urls.forEach(url => url && URL.revokeObjectURL(url));
                return;
            }

            const validUrls = urls.filter((url): url is string => url !== null);
            setActiveBlobUrls(validUrls); // Store URLs in state to manage their lifecycle

            const urlMap = new Map<string, string>();
            initialAttachments.forEach((attachment, index) => {
                if (urls[index]) {
                    urlMap.set(attachment.data, urls[index]!);
                }
            });

            const parts = content.split(/(!\[image-\d+\])/g).filter(Boolean);
            const fragment = document.createDocumentFragment();

            parts.forEach(part => {
                const imageMatch = part.match(/!\[image-(\d+)\]/);
                if (imageMatch) {
                    const imageIndex = parseInt(imageMatch[1], 10);
                    const attachment = initialAttachments[imageIndex];
                    const imageUrl = attachment ? urlMap.get(attachment.data) : null;
                    
                    if (imageUrl) {
                        const img = document.createElement('img');
                        img.src = imageUrl;
                        img.alt = attachment.name;
                        img.dataset.attachmentKey = attachment.data;
                        img.style.maxWidth = 'min(100%, 300px)';
                        img.style.maxHeight = '200px';
                        img.style.borderRadius = '8px';
                        img.style.margin = '0.5rem 0.25rem';
                        img.style.display = 'block';
                        fragment.appendChild(img);
                    } else {
                        const placeholder = document.createElement('span');
                        placeholder.textContent = `[Image not found]`;
                        placeholder.style.color = 'red';
                        fragment.appendChild(placeholder);
                    }
                } else {
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            
            if (editor) {
                editor.appendChild(fragment);
                handleEditorInput();
            }
        });

        return () => {
            isMounted = false;
        };
    }, [noteToEdit]);

    const insertNodeAtCursor = (node: Node) => {
        const editor = editorRef.current;
        if (!editor) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            editor.appendChild(node);
            return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const isFragment = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
        const lastNode = isFragment ? node.lastChild : node;

        range.insertNode(node);

        if (lastNode) {
            const newRange = document.createRange();
            newRange.setStartAfter(lastNode);
            newRange.collapse(true);

            selection.removeAllRanges();
            selection.addRange(newRange);
        }
        
        editor.focus();
    };
    
    const addAttachment = async (file: File) => {
        const currentAttachmentCount = attachments.length;
        if (currentAttachmentCount >= MAX_ATTACHMENTS) {
            alert(`You can only upload a maximum of ${MAX_ATTACHMENTS} files.`);
            return;
        }
        try {
            const imageKey = await imageDB.saveImage(currentUserEmail, file);
            const newAttachment = { name: file.name, type: file.type, data: imageKey };
            
            setAttachments(prev => [...prev, newAttachment]);

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file); // Use temporary URL for immediate preview
            img.alt = file.name;
            img.dataset.attachmentKey = imageKey;
            img.style.maxWidth = 'min(100%, 300px)';
            img.style.maxHeight = '200px';
            img.style.borderRadius = '8px';
            img.style.margin = '0.5rem 0.25rem';
            img.style.display = 'block';

            insertNodeAtCursor(img);
            setTimeout(() => {
                handleEditorInput();
            }, 0);

        } catch (error) {
            console.error("Error saving file to DB:", error);
            alert("Could not process file.");
        }
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const clipboardData = e.clipboardData;
        let imageFound = false;

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                imageFound = true;
                const file = items[i].getAsFile();
                if (file) await addAttachment(file);
                break;
            }
        }
    
        if (!imageFound) {
            const pastedHtml = clipboardData.getData('text/html');
            const pastedText = clipboardData.getData('text/plain');

            let contentToInsert: Node;

            if (pastedHtml && typeof DOMPurify !== 'undefined') {
                const sanitized = DOMPurify.sanitize(pastedHtml, { ALLOWED_TAGS: ['br', 'p', 'div'] });
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = sanitized;
                const fragment = document.createDocumentFragment();
                while(tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }
                contentToInsert = fragment;
            } else {
                contentToInsert = document.createTextNode(pastedText);
            }
            
            insertNodeAtCursor(contentToInsert);
            setTimeout(() => {
                handleEditorInput();
            }, 0);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            for (let i = 0; i < files.length; i++) {
                await addAttachment(files[i]);
            }
        }
        e.target.value = '';
    };

    const handleSave = () => {
        const editor = editorRef.current;
        if (!editor || (!editor.innerText.trim() && editor.getElementsByTagName('img').length === 0)) {
            return;
        }

        const finalAttachments: NonNullable<Note['attachments']> = [];
        const editorClone = editor.cloneNode(true) as HTMLDivElement;

        Array.from(editorClone.querySelectorAll('img[data-attachment-key]')).forEach(imgNode => {
            const img = imgNode as HTMLImageElement;
            const imageKey = img.dataset.attachmentKey;
            if (imageKey) {
                const originalAttachment = attachments.find(a => a.data === imageKey) || noteToEdit?.attachments?.find(a => a.data === imageKey);
                if (originalAttachment) {
                    finalAttachments.push(originalAttachment);
                    const newIndex = finalAttachments.length - 1;
                    img.replaceWith(document.createTextNode(`\n![image-${newIndex}]\n`));
                } else {
                    img.remove();
                }
            }
        });
        
        const finalContent = editorClone.innerText.trim();
        
        if (!finalContent && finalAttachments.length === 0) return;

        const uniqueTags = [...new Set((finalContent.match(/#(\w+)/g) || []).map(t => t.substring(1)))];
        
        onSave({
            content: finalContent,
            attachments: finalAttachments.length > 0 ? finalAttachments : [],
            tags: uniqueTags,
        });

        if (!noteToEdit) {
            setAttachments([]);
            if (editorRef.current) editorRef.current.innerHTML = '';
            handleEditorInput();
        }
    };
    
    return (
        <div className="bg-[#232733] rounded-lg border border-gray-700/50 p-4 space-y-4">
            <div 
                ref={editorRef}
                contentEditable={true}
                onInput={handleEditorInput}
                onPaste={handlePaste}
                data-placeholder="What's on your mind? Use # to add tags. Paste images directly."
                className="relative w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] text-white resize-y min-h-[12rem] [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400 [&:empty]:before:absolute"
            />
            <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                <div className="flex items-center gap-4">
                    <label htmlFor="note-attachment" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                        <span>Add Image</span>
                        <input 
                            id="note-attachment"
                            type="file" 
                            multiple
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>
                     <span className="text-xs text-[#8A91A8]">
                        {charCount} / {MAX_CONTENT_LENGTH}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {onCancel && (
                        <button 
                            onClick={onCancel}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                    )}
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-blue-500 transition-colors text-sm font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
                        disabled={isSaveDisabled}
                    >
                        {buttonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ImageFromDB: React.FC<{ imageId: string; alt: string; onClick: () => void }> = ({ imageId, alt, onClick }) => {
    const imageUrl = useImageBlobUrl(imageId);
    if (!imageUrl) return <div className="my-2 h-24 bg-gray-700 rounded-lg animate-pulse"></div>;
    return (
        <img 
            src={imageUrl} 
            alt={alt} 
            className="my-2 max-w-full rounded-lg border border-gray-600 cursor-pointer hover:opacity-90 transition-opacity" 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
        />
    );
};

const NoteCard: React.FC<{ 
    note: Note, 
    onToggleFavorite: (id: string) => void,
    onDelete: (id: string) => void,
    onTagClick: (tag: string) => void,
    onEdit: (note: Note) => void,
}> = ({ note, onToggleFavorite, onDelete, onTagClick, onEdit }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    
    const textContentOnly = useMemo(() => note.content.replace(/(!\[image-\d+\])/g, ''), [note.content]);
    const isLong = textContentOnly.length > TRUNCATE_LENGTH;

    const FavoriteIcon: React.FC<{ isFavorite?: boolean }> = ({ isFavorite }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" 
                className={isFavorite ? 'text-yellow-400' : 'text-gray-600'}/>
        </svg>
    );
    
    const renderContentWithClickableTags = (text: string, tags?: string[]) => {
        const parts = text.split(/(#\w+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('#') && tags?.includes(part.substring(1))) {
                const tag = part.substring(1);
                return (
                    <span
                        key={index}
                        className="text-blue-400 font-semibold cursor-pointer hover:underline"
                        onClick={(e) => {
                            e.stopPropagation();
                            onTagClick(tag);
                        }}
                    >
                        {part}
                    </span>
                );
            }
            return <React.Fragment key={index}>{part}</React.Fragment>;
        });
    };
    
    const renderContentWithImagesAndTags = (text: string, note: Note) => {
        if (!note.attachments || note.attachments.length === 0) {
            return renderContentWithClickableTags(text, note.tags);
        }
        
        const parts = text.split(/(!\[image-\d+\])/g).filter(Boolean);

        return parts.map((part, index) => {
            const imageMatch = part.match(/!\[image-(\d+)\]/);
            if (imageMatch) {
                const imageIndex = parseInt(imageMatch[1], 10);
                const attachment = note.attachments![imageIndex];
                if (attachment) {
                    return (
                       <ImageFromDB 
                            key={`img-${index}`} 
                            imageId={attachment.data} 
                            alt={attachment.name}
                            onClick={() => {
                                // We need to fetch the blob URL for the fullscreen view
                                imageDB.getImage(attachment.data).then(blob => {
                                    if(blob) setFullscreenImage(URL.createObjectURL(blob));
                                });
                            }}
                        />
                    );
                }
                return null;
            } else {
                return renderContentWithClickableTags(part, note.tags);
            }
        });
    };

    const renderTruncatedContent = (note: Note) => {
        let currentLength = 0;
        const elements: React.ReactNode[] = [];
        const parts = note.content.split(/(!\[image-\d+\])/g).filter(Boolean);
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const imageMatch = part.match(/!\[image-(\d+)\]/);

            if (imageMatch) {
                 const imageIndex = parseInt(imageMatch[1], 10);
                 const attachment = note.attachments![imageIndex];
                 if (attachment) {
                    elements.push(<ImageFromDB 
                        key={`img-${i}`} 
                        imageId={attachment.data} 
                        alt={attachment.name} 
                        onClick={() => {
                             imageDB.getImage(attachment.data).then(blob => {
                                if(blob) setFullscreenImage(URL.createObjectURL(blob));
                            });
                        }}
                    />);
                 }
            } else {
                if (currentLength + part.length > TRUNCATE_LENGTH) {
                    const remainingLength = TRUNCATE_LENGTH - currentLength;
                    const finalPart = part.substring(0, remainingLength);
                    elements.push(renderContentWithClickableTags(finalPart, note.tags));
                    elements.push(
                        <span key="show-more-wrapper" className="whitespace-nowrap">
                            {'... '}
                            <button onClick={() => setIsExpanded(true)} className="text-sm text-blue-400 hover:underline inline">
                                Show more
                            </button>
                        </span>
                    );
                    return elements;
                } else {
                    elements.push(renderContentWithClickableTags(part, note.tags));
                    currentLength += part.length;
                }
            }
        }
        return elements;
    }

    return (
        <div id={`note-${note.id}`} className="bg-[#232733] p-4 rounded-lg border border-gray-700/50 flex flex-col transition-all duration-500">
            <div className="flex justify-between items-start">
                <span className="text-xs text-[#8A91A8]">{new Date(note.date).toLocaleString()}</span>
                <div className="flex items-center gap-3">
                    <button onClick={() => onToggleFavorite(note.id)} className="text-gray-500 hover:text-yellow-400 transition-colors" aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                        <FavoriteIcon isFavorite={note.isFavorite} />
                    </button>
                    <button onClick={() => onEdit(note)} className="text-gray-500 hover:text-blue-400 transition-colors" aria-label="Edit note">
                         <span className="w-5 h-5">{ICONS.pencil}</span>
                    </button>
                    <button onClick={() => onDelete(note.id)} className="text-gray-500 hover:text-red-500 transition-colors" aria-label="Delete note">
                        <span className="w-5 h-5">{ICONS.trash}</span>
                    </button>
                </div>
            </div>
            <div className="text-[#F0F0F0] whitespace-pre-wrap text-sm my-3 w-full break-words">
                {isLong && !isExpanded
                    ? renderTruncatedContent(note)
                    : renderContentWithImagesAndTags(note.content, note)
                }
            </div>
             {isLong && isExpanded && (
                <button onClick={() => setIsExpanded(false)} className="text-sm text-blue-400 hover:underline self-start mt-2">
                    Show less
                </button>
            )}

            {fullscreenImage && (
                <div 
                  className="fixed inset-0 bg-black/80 z-[60] flex justify-center items-center p-4 cursor-pointer" 
                  onClick={() => {
                    URL.revokeObjectURL(fullscreenImage);
                    setFullscreenImage(null);
                  }}
                >
                  <img 
                    src={fullscreenImage} 
                    alt="Fullscreen view" 
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
            )}
        </div>
    );
};


// --- MAIN COMPONENT ---

interface NotesViewProps {
    showToast: (message: string) => void;
}

const NotesView: React.FC<NotesViewProps> = ({ showToast }) => {
    const { state, dispatch } = useAppContext();
    const { notes } = state.userData!;
    const { currentUser } = state;
    
    const [activeFilter, setActiveFilter] = useState('all');
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [tagSearch, setTagSearch] = useState('');
    const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null);
    const [newNoteEditorKey, setNewNoteEditorKey] = useState(0);

    const favoriteNotes = useMemo(() => 
        notes
            .filter(n => n.isFavorite)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [notes]);

    const filteredNotes = useMemo(() => {
        let filtered = notes.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (activeFilter === 'favorites') {
            filtered = filtered.filter(n => n.isFavorite);
        } else if (activeFilter !== 'all') {
            filtered = filtered.filter(n => n.tags?.includes(activeFilter));
        }

        if (tagSearch) {
            filtered = filtered.filter(n => 
                n.content.toLowerCase().includes(tagSearch.toLowerCase()) || 
                n.tags?.some(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
            );
        }

        return filtered;
    }, [notes, activeFilter, tagSearch]);
    
    const setNotes = (newNotes: Note[] | ((prev: Note[]) => Note[])) => {
        const payload = typeof newNotes === 'function' ? newNotes(notes) : newNotes;
        dispatch({ type: 'SET_NOTES', payload });
    };

    const handleSaveNote = (data: { content: string; attachments: NonNullable<Note['attachments']>; tags: string[] }) => {
        if (editingNote) {
            // Edit existing note
            const updatedNote: Note = {
                ...editingNote,
                ...data,
                date: new Date().toISOString(),
            };
            setNotes(prev => prev.map(n => n.id === editingNote.id ? updatedNote : n));
            showToast('Note updated successfully.');
            setEditingNote(null);
        } else {
            // Add new note
            const newNote: Note = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                ...data,
                isFavorite: false,
            };
            setNotes(prev => [newNote, ...prev]);
            showToast('Note added successfully.');
            // Reset the editor by changing its key
            setNewNoteEditorKey(prev => prev + 1);
        }
    };

    const handleDeleteNote = (id: string) => {
        setNoteIdToDelete(id);
    };

    const confirmDeleteNote = async () => {
        if (noteIdToDelete) {
            const noteToDelete = notes.find(n => n.id === noteIdToDelete);
            if (noteToDelete?.attachments) {
                try {
                    await Promise.all(noteToDelete.attachments.map(att => imageDB.deleteImage(att.data)));
                } catch (error) {
                    console.error("Failed to delete one or more note attachments from IndexedDB:", error);
                }
            }
            setNotes(prev => prev.filter(n => n.id !== noteIdToDelete));
            showToast('Note deleted.');
            setNoteIdToDelete(null);
            if (editingNote?.id === noteIdToDelete) {
                setEditingNote(null);
            }
        }
    };
    
    const handleToggleFavorite = (id: string) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, isFavorite: !n.isFavorite } : n));
    };

    const handleEditNote = (note: Note) => {
        setEditingNote(note);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleTagClick = (tag: string) => {
        setActiveFilter(tag);
        setTagSearch('');
    };
    
    const handleFavoriteClick = (noteId: string) => {
        if (activeFilter !== 'all') {
            setActiveFilter('all');
        }
        
        setTimeout(() => {
            const element = document.getElementById(`note-${noteId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('highlight-note');
                setTimeout(() => element.classList.remove('highlight-note'), 2000);
            }
        }, 100); 
    };

    const createNotePreview = (content: string, length: number = 140) => {
        const textOnly = content.replace(/(!\[image-\d+\])/g, ' ').replace(/\s\s+/g, ' ').trim();
        if (textOnly.length === 0) return 'Note with attachments';
        if (textOnly.length > length) {
            return textOnly.substring(0, length) + '...';
        }
        return textOnly;
    };
    
    const SidebarButton: React.FC<{ filter: string, label: string }> = ({ filter, label }) => (
        <button
            onClick={() => setActiveFilter(filter)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeFilter === filter ? 'bg-[#3B82F6] text-white' : 'hover:bg-gray-700 text-[#8A91A8] hover:text-white'}`}
        >
            {label}
        </button>
    );

    return (
        <div>
            <style>{`
                @keyframes highlight {
                    0% { background-color: rgba(59, 130, 246, 0); }
                    25% { background-color: rgba(59, 130, 246, 0.15); }
                    75% { background-color: rgba(59, 130, 246, 0.15); }
                    100% { background-color: rgba(59, 130, 246, 0); }
                }
                .highlight-note {
                    animation: highlight 2s ease-in-out;
                }
            `}</style>

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white">Notes</h1>
                <p className="text-[#8A91A8] mt-1">Your personal space for market analysis, psychological check-ins, and trade ideas.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8">
                {/* --- LEFT SIDEBAR --- */}
                <aside className="md:sticky top-8 self-start">
                    <div className="bg-[#232733] p-4 rounded-lg border border-gray-700/50 space-y-4">
                        <div className="space-y-2">
                            <SidebarButton filter="all" label="All Notes" />

                            <div className="pt-2">
                                <h3 className="px-2 pb-1 text-sm font-semibold text-gray-400">
                                    Favorites
                                </h3>
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {favoriteNotes.length > 0 ? (
                                        favoriteNotes.map(note => (
                                            <button
                                                key={note.id}
                                                onClick={() => handleFavoriteClick(note.id)}
                                                className="w-full text-left p-2 rounded-md transition-colors text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:bg-gray-700"
                                                title={createNotePreview(note.content, 500)}
                                            >
                                                <p className="text-sm text-gray-300 truncate">{createNotePreview(note.content)}</p>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="px-2 py-1 text-xs text-gray-500">No favorite notes.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <input 
                                type="text"
                                placeholder="Search notes..."
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                        </div>
                    </div>
                </aside>

                {/* --- RIGHT CONTENT AREA --- */}
                <main className="space-y-8">
                    {editingNote ? (
                         <div>
                            <h2 className="text-xl font-semibold text-white mb-3">Editing Note</h2>
                            <NoteEditor 
                                noteToEdit={editingNote}
                                onSave={handleSaveNote}
                                onCancel={() => setEditingNote(null)}
                                buttonText="Save Changes"
                                currentUserEmail={currentUser!.email}
                            />
                        </div>
                    ) : (
                        <div>
                            <NoteEditor 
                                key={newNoteEditorKey}
                                onSave={handleSaveNote} 
                                buttonText="Add Note"
                                currentUserEmail={currentUser!.email}
                            />
                        </div>
                    )}

                    <div className="space-y-6">
                        {filteredNotes.length > 0 ? (
                            filteredNotes.map(note => (
                                <NoteCard 
                                    key={note.id} 
                                    note={note}
                                    onToggleFavorite={handleToggleFavorite}
                                    onDelete={handleDeleteNote}
                                    onTagClick={handleTagClick}
                                    onEdit={handleEditNote}
                                />
                            ))
                        ) : (
                            <div className="col-span-full text-center py-16 bg-[#232733] rounded-lg border border-gray-700/50">
                                 <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="mt-4 text-gray-500">
                                    No notes found.
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <Modal isOpen={!!noteIdToDelete} onClose={() => setNoteIdToDelete(null)} title="Confirm Note Deletion">
                <div className="text-center">
                    <p className="text-gray-300 mb-6">Are you sure you want to permanently delete this note? This action cannot be undone.</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setNoteIdToDelete(null)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                        <button onClick={confirmDeleteNote} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes, Delete Note</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default NotesView;