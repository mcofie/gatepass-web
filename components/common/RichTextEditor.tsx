'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Strikethrough } from 'lucide-react'
import { useEffect } from 'react'

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    readOnly?: boolean
}

export function RichTextEditor({ value, onChange, placeholder, readOnly = false }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: placeholder || 'Start typing...',
            }),
        ],
        content: value,
        editable: !readOnly,
        editorProps: {
            attributes: {
                class: `prose prose-sm sm:prose-base dark:prose-invert focus:outline-none min-h-[150px] max-w-none px-4 py-3 ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`,
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        immediatelyRender: false,
    })

    // Update editable state if readOnly changes
    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly)
        }
    }, [readOnly, editor])

    // Sync external value changes if needed (e.g. form reset)
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            if (editor.getText() === '' && value === '') return
        }
    }, [value, editor])

    if (!editor) {
        return null
    }

    return (
        <div className={`border rounded-xl overflow-hidden transition-all text-gray-900 dark:text-white ${readOnly
            ? 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5'
            : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white focus-within:bg-white dark:focus-within:bg-black'
            }`}>
            {/* Toolbar */}
            {!readOnly && (
                <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-white/10 bg-gray-100/50 dark:bg-white/5">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 dark:bg-white/20 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        title="Bold"
                    >
                        <Bold className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 dark:bg-white/20 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        title="Italic"
                    >
                        <Italic className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors ${editor.isActive('strike') ? 'bg-gray-200 dark:bg-white/20 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        title="Strikethrough"
                    >
                        <Strikethrough className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-gray-300 dark:bg-white/20 mx-1" />
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-white/20 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        title="Bullet List"
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-white/20 text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                        title="Ordered List"
                    >
                        <ListOrdered className="w-4 h-4" />
                    </button>
                </div>
            )}

            <EditorContent editor={editor} />

            <style jsx global>{`
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #9ca3af;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
                .dark .ProseMirror p.is-editor-empty:first-child::before {
                    color: #4b5563;
                }
            `}</style>
        </div>
    )
}
