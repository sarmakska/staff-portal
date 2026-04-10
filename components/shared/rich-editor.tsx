"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import Highlight from "@tiptap/extension-highlight"
import FontFamily from "@tiptap/extension-font-family"
import Link from "@tiptap/extension-link"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import Placeholder from "@tiptap/extension-placeholder"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Undo, Redo,
  Table as TableIcon, Printer, Link as LinkIcon,
  Highlighter, Minus, ChevronDown, Type,
} from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────
interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  /** Show the print button in the toolbar */
  printable?: boolean
  /** Document title shown in print header */
  printTitle?: string
}

// ── Constants ────────────────────────────────────────────────────────
const FONT_FAMILIES = [
  { label: "Default",   value: "" },
  { label: "Arial",     value: "Arial, sans-serif" },
  { label: "Georgia",   value: "Georgia, serif" },
  { label: "Courier",   value: "'Courier New', monospace" },
  { label: "Trebuchet", value: "'Trebuchet MS', sans-serif" },
  { label: "Verdana",   value: "Verdana, sans-serif" },
]

const FONT_SIZES = ["10", "11", "12", "14", "16", "18", "20", "24", "28", "36", "48"]

const TEXT_COLORS = [
  { label: "Black",      value: "#000000" },
  { label: "Dark grey",  value: "#434343" },
  { label: "Grey",       value: "#666666" },
  { label: "Red",        value: "#cc0000" },
  { label: "Orange",     value: "#e69138" },
  { label: "Yellow",     value: "#f1c232" },
  { label: "Green",      value: "#38761d" },
  { label: "Teal",       value: "#134f5c" },
  { label: "Blue",       value: "#1155cc" },
  { label: "Purple",     value: "#674ea7" },
  { label: "Pink",       value: "#a64d79" },
  { label: "White",      value: "#ffffff" },
]

const HIGHLIGHT_COLORS = [
  { label: "Yellow",  value: "#fff176" },
  { label: "Green",   value: "#b9f6ca" },
  { label: "Blue",    value: "#b3e5fc" },
  { label: "Pink",    value: "#f8bbd0" },
  { label: "Orange",  value: "#ffe0b2" },
  { label: "None",    value: "" },
]

// ── Small sub-components ─────────────────────────────────────────────
function Sep() {
  return <div className="w-px h-5 bg-border mx-1 self-center shrink-0" />
}

function Btn({
  onClick, active, title, disabled, children,
}: {
  onClick: () => void; active?: boolean; title?: string; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center h-7 w-7 rounded transition-colors shrink-0",
        "hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed",
        active && "bg-accent text-accent-foreground font-semibold",
      )}
    >
      {children}
    </button>
  )
}

// Dropdown that closes on outside click
function Dropdown({ trigger, children, className }: {
  trigger: React.ReactNode; children: React.ReactNode; className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen(o => !o) }}
        className="flex items-center gap-0.5 h-7 px-1.5 rounded hover:bg-accent transition-colors text-xs shrink-0"
      >
        {trigger}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[130px]",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────
export function RichEditor({
  value, onChange, placeholder, className, printable = true, printTitle,
}: RichEditorProps) {
  const [fontSize, setFontSize] = useState("12")
  const printRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[420px] leading-relaxed",
      },
    },
    immediatelyRender: false,
  })

  // Sync if value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyFontSize = (size: string) => {
    setFontSize(size)
    editor?.chain().focus().setMark("textStyle", { fontSize: size + "pt" }).run()
  }

  const addLink = () => {
    const url = window.prompt("Enter URL:")
    if (!url) return
    const href = url.startsWith("http") ? url : "https://" + url
    editor?.chain().focus().setLink({ href }).run()
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const title = printTitle ?? "Diary Entry"
    const win = window.open("", "_blank", "width=800,height=600")
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; font-size: 12pt; color: #000; background: #fff; padding: 72px; max-width: 800px; margin: 0 auto; line-height: 1.7; }
    h1 { font-size: 24pt; margin-bottom: 12pt; border-bottom: 1px solid #ccc; padding-bottom: 6pt; }
    h2 { font-size: 18pt; margin: 16pt 0 8pt; }
    h3 { font-size: 14pt; margin: 12pt 0 6pt; }
    p { margin-bottom: 8pt; }
    ul, ol { margin: 8pt 0 8pt 24pt; }
    li { margin-bottom: 4pt; }
    blockquote { border-left: 3px solid #ccc; margin: 12pt 0; padding-left: 16pt; color: #555; font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
    td, th { border: 1px solid #999; padding: 6pt 10pt; }
    th { background: #f0f0f0; font-weight: bold; }
    hr { border: none; border-top: 1px solid #ccc; margin: 16pt 0; }
    mark { background: #fff176; padding: 0 2pt; }
    a { color: #1155cc; }
    .print-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 32pt; border-bottom: 2px solid #000; padding-bottom: 8pt; }
    .print-header .doc-title { font-size: 20pt; font-weight: bold; }
    .print-header .doc-date { font-size: 10pt; color: #666; }
    @media print { @page { margin: 0.75in; } }
  </style>
</head>
<body>
  <div class="print-header">
    <span class="doc-title">${title}</span>
    <span class="doc-date">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
  </div>
  ${content}
</body>
</html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  if (!editor) return null

  const currentFont = FONT_FAMILIES.find(f => f.value && editor.isActive("textStyle", { fontFamily: f.value }))?.label ?? "Font"

  return (
    <div className={cn("rounded-xl border border-input bg-background overflow-hidden shadow-sm", className)}>

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 select-none">

        {/* Font family */}
        <Dropdown trigger={<span className="min-w-[52px] text-left">{currentFont}</span>}>
          {FONT_FAMILIES.map(f => (
            <button
              key={f.label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); f.value ? editor.chain().focus().setFontFamily(f.value).run() : editor.chain().focus().unsetFontFamily().run() }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              style={{ fontFamily: f.value || undefined }}
            >
              {f.label}
            </button>
          ))}
        </Dropdown>

        {/* Font size */}
        <Dropdown trigger={<span className="w-7 text-center">{fontSize}</span>} className="min-w-[60px]">
          {FONT_SIZES.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); applyFontSize(s) }}
              className={cn("w-full text-left px-3 py-1 text-sm hover:bg-accent transition-colors", fontSize === s && "font-semibold")}
            >
              {s}
            </button>
          ))}
        </Dropdown>

        <Sep />

        {/* Heading shortcuts */}
        <Dropdown trigger={<span className="flex items-center gap-1"><Type className="h-3.5 w-3.5" /><span>Style</span></span>} className="min-w-[120px]">
          {[
            { label: "Normal",    cmd: () => editor.chain().focus().setParagraph().run() },
            { label: "Heading 1", cmd: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
            { label: "Heading 2", cmd: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
            { label: "Heading 3", cmd: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
          ].map(item => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); item.cmd() }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              {item.label}
            </button>
          ))}
        </Dropdown>

        <Sep />

        {/* Text formatting */}
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Text colour */}
        <Dropdown
          trigger={
            <span className="flex items-center gap-1" title="Text colour">
              <span className="font-bold text-sm leading-none" style={{ color: editor.getAttributes("textStyle").color ?? "#000" }}>A</span>
            </span>
          }
          className="min-w-[140px]"
        >
          <div className="grid grid-cols-4 gap-1.5 p-2">
            {TEXT_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c.value).run() }}
                className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform mx-auto"
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run() }}
            className="w-full text-center text-xs py-1.5 hover:bg-accent border-t border-border"
          >
            Reset colour
          </button>
        </Dropdown>

        {/* Highlight colour */}
        <Dropdown
          trigger={
            <span title="Highlight colour">
              <Highlighter className="h-3.5 w-3.5" />
            </span>
          }
          className="min-w-[120px]"
        >
          <div className="grid grid-cols-3 gap-1.5 p-2">
            {HIGHLIGHT_COLORS.filter(c => c.value).map(c => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHighlight({ color: c.value }).run() }}
                className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform mx-auto"
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run() }}
            className="w-full text-center text-xs py-1.5 hover:bg-accent border-t border-border"
          >
            Remove highlight
          </button>
        </Dropdown>

        <Sep />

        {/* Alignment */}
        <Btn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          <AlignLeft className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centre">
          <AlignCenter className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          <AlignRight className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify">
          <AlignJustify className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Lists */}
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Table */}
        <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
          <TableIcon className="h-3.5 w-3.5" />
        </Btn>

        {/* Link */}
        <Btn onClick={addLink} active={editor.isActive("link")} title="Insert link">
          <LinkIcon className="h-3.5 w-3.5" />
        </Btn>

        <Sep />

        {/* Undo / Redo */}
        <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <Undo className="h-3.5 w-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <Redo className="h-3.5 w-3.5" />
        </Btn>

        {/* Print */}
        {printable && (
          <>
            <Sep />
            <Btn onClick={handlePrint} title="Print / Save as PDF">
              <Printer className="h-3.5 w-3.5" />
            </Btn>
          </>
        )}
      </div>

      {/* ── Document body ────────────────────────────────── */}
      <div className="bg-muted/20 p-4 md:p-8 min-h-[480px]">
        {/* Paper sheet */}
        <div
          ref={printRef}
          className="bg-white dark:bg-card border border-border/50 shadow-md rounded-lg mx-auto max-w-3xl px-10 py-10 min-h-[420px]"
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ── Table context bar ─────────────────────────────── */}
      {editor.isActive("table") && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-border bg-muted/30 text-xs">
          <span className="text-muted-foreground font-medium mr-1">Table:</span>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnBefore().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent">+ Col before</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnAfter().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent">+ Col after</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowBefore().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent">+ Row before</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowAfter().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent">+ Row after</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteColumn().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent text-destructive">- Col</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteRow().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent text-destructive">- Row</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().mergeCells().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent">Merge</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().splitCell().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent">Split</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteTable().run() }} className="px-2 py-0.5 rounded border border-border hover:bg-accent text-destructive font-medium">Delete table</button>
        </div>
      )}
    </div>
  )
}
