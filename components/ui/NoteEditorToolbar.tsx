import React from 'react';

const ICONS = {
    h1: <span className="font-bold text-base">H1</span>,
    h2: <span className="font-semibold text-sm">H2</span>,
    bold: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>,
    ul: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
    ol: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 6h11M10 12h11M10 18h11M4.5 6H6M6 6L4 8M4 12h2M4 18h2l-2-2h2"></path></svg>,
};

const ToolbarButton: React.FC<{ onClick: () => void; children: React.ReactNode; title: string }> = ({ onClick, children, title }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors flex items-center justify-center h-8 w-8"
    >
        {children}
    </button>
);

interface NoteEditorToolbarProps {
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    content: string;
    setContent: (content: string) => void;
}

const NoteEditorToolbar: React.FC<NoteEditorToolbarProps> = ({ textareaRef, content, setContent }) => {

    const handleFormat = (type: 'h1' | 'h2' | 'bold' | 'ul' | 'ol') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = content.substring(start, end);
        const before = content.substring(0, start);
        const after = content.substring(end);
        
        let newContent = '';
        let newStart = start;
        let newEnd = end;

        const applyLinePrefix = (prefix: string) => {
            const startOfLine = before.lastIndexOf('\n') + 1;
            const currentLine = content.substring(startOfLine, end);
            const lineContent = before.substring(startOfLine) + selectedText;

            if (lineContent.startsWith(prefix)) {
                 newContent = before.substring(0, startOfLine) + lineContent.substring(prefix.length) + after;
                 newStart = Math.max(startOfLine, start - prefix.length);
                 newEnd = end - prefix.length;
            } else {
                 newContent = before.substring(0, startOfLine) + prefix + lineContent + after;
                 newStart = start + prefix.length;
                 newEnd = end + prefix.length;
            }
        };

        switch(type) {
            case 'h1': applyLinePrefix('# '); break;
            case 'h2': applyLinePrefix('## '); break;
            case 'bold':
                newContent = `${before}**${selectedText}**${after}`;
                newStart = start + 2;
                newEnd = end + 2;
                break;
            case 'ul':
                const ulLines = selectedText.split('\n').map(line => line ? `- ${line}` : '- ').join('\n');
                newContent = before + ulLines + after;
                newStart = start;
                newEnd = start + ulLines.length;
                break;
            case 'ol':
                const olLines = selectedText.split('\n').map((line, i) => line ? `${i + 1}. ${line}` : `${i + 1}. `).join('\n');
                newContent = before + olLines + after;
                newStart = start;
                newEnd = start + olLines.length;
                break;
        }

        setContent(newContent);
        setTimeout(() => {
            textarea.focus();
            if (selectedText.length > 0) {
                 textarea.setSelectionRange(newStart, newEnd);
            } else {
                 textarea.setSelectionRange(newStart, newStart);
            }
        }, 0);
    };

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-900/70 border border-gray-700 rounded-t-md mb-[-1px] relative z-10">
            <ToolbarButton onClick={() => handleFormat('h1')} title="Heading 1">{ICONS.h1}</ToolbarButton>
            <ToolbarButton onClick={() => handleFormat('h2')} title="Heading 2">{ICONS.h2}</ToolbarButton>
            <div className="w-px h-5 bg-gray-600 mx-1"></div>
            <ToolbarButton onClick={() => handleFormat('bold')} title="Bold">{ICONS.bold}</ToolbarButton>
            <div className="w-px h-5 bg-gray-600 mx-1"></div>
            <ToolbarButton onClick={() => handleFormat('ul')} title="Bullet List">{ICONS.ul}</ToolbarButton>
            <ToolbarButton onClick={() => handleFormat('ol')} title="Numbered List">{ICONS.ol}</ToolbarButton>
        </div>
    );
};

export default NoteEditorToolbar;