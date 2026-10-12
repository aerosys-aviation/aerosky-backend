'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import {
    Bot,
    ChevronDown,
    Database,
    Loader2,
    Maximize2,
    Minimize2,
    Send,
    Sparkles,
    Check,
    Copy,
    X,
} from 'lucide-react'

interface ExecutedQuery {
    query: string;
    rowCount?: number;
    explanation?: string;
}

interface Message {
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    queries?: ExecutedQuery[]
}

const SUGGESTED_PROMPTS = [
    'Show out-of-stock and low components',
    'Orders by manufacturing stage',
    'Show fleet drones & DGCA status',
    'Expense breakdown by category',
    'Recent flight logs and pilots',
    'Active leads needing follow-up',
    'Show team directory and positions',
    'Summarize current business status',
]

/**
 * Format inline markdown: bold, inline code, links
 */
function formatInlineText(text: string) {
    // Split by inline code `code`
    const codeParts = text.split(/`([^`]+)`/g)
    if (codeParts.length > 1) {
        return codeParts.map((part, i) => {
            if (i % 2 === 1) {
                return (
                    <code key={i} className="bg-slate-100 text-orange-600 px-1 py-0.5 rounded font-mono text-xs">
                        {part}
                    </code>
                )
            }
            return <span key={i}>{formatBold(part)}</span>
        })
    }
    return formatBold(text)
}

function formatBold(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g)
    return parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-bold text-slate-900">{part}</strong> : part
    )
}

/**
 * Helper to render markdown table from lines
 */
function MarkdownTable({ tableLines }: { tableLines: string[] }) {
    if (tableLines.length < 2) return null

    // Extract headers
    const headerLine = tableLines[0]
    const headers = headerLine.split('|').map(s => s.trim()).filter(Boolean)

    // Filter out separator line (e.g. |---|---|)
    const rowLines = tableLines.slice(1).filter(line => !line.match(/^\|?\s*[-:]+[-| :]*$/))

    const rows = rowLines.map(line =>
        line.split('|').map(s => s.trim()).filter((cell, idx, arr) => {
            // handle leading/trailing empty cells from starting/ending pipe
            if (idx === 0 && line.startsWith('|') && cell === '') return false
            if (idx === arr.length - 1 && line.endsWith('|') && cell === '') return false
            return true
        })
    )

    return (
        <div className="my-2.5 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 font-bold text-slate-700 whitespace-nowrap">
                                {formatInlineText(h)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-orange-50/40 transition-colors">
                            {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-2 text-slate-600 whitespace-nowrap">
                                    {formatInlineText(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/**
 * Enhanced Markdown text parser supporting headings, lists, tables, code blocks, bold, and inline code
 */
function MarkdownText({ text }: { text: string }) {
    const rawLines = text.split('\n')
    const elements: React.ReactNode[] = []

    let inCodeBlock = false
    let codeLanguage = ''
    let codeBuffer: string[] = []

    let inTable = false
    let tableBuffer: string[] = []

    const flushTable = (key: string) => {
        if (tableBuffer.length > 0) {
            elements.push(<MarkdownTable key={key} tableLines={[...tableBuffer]} />)
            tableBuffer = []
            inTable = false
        }
    }

    const flushCode = (key: string) => {
        if (codeBuffer.length > 0) {
            elements.push(
                <div key={key} className="my-2 rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-xs overflow-x-auto shadow-inner">
                    {codeLanguage && (
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-sans font-bold">
                            {codeLanguage}
                        </div>
                    )}
                    <pre className="whitespace-pre-wrap">{codeBuffer.join('\n')}</pre>
                </div>
            )
            codeBuffer = []
            inCodeBlock = false
            codeLanguage = ''
        }
    }

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i]
        const trimmed = line.trim()

        // Handle Code Blocks (```)
        if (trimmed.startsWith('```')) {
            if (inTable) flushTable(`table-${i}`)
            if (inCodeBlock) {
                flushCode(`code-${i}`)
            } else {
                inCodeBlock = true
                codeLanguage = trimmed.replace('```', '').trim()
            }
            continue
        }

        if (inCodeBlock) {
            codeBuffer.push(line)
            continue
        }

        // Handle Table Lines (lines starting with | or containing multiple |)
        const isTableLine = (trimmed.startsWith('|') && trimmed.endsWith('|')) ||
            (trimmed.includes('|') && (trimmed.includes('---') || tableBuffer.length > 0))

        if (isTableLine) {
            inTable = true
            tableBuffer.push(trimmed)
            continue
        } else if (inTable) {
            flushTable(`table-${i}`)
        }

        // Handle Headings
        if (line.startsWith('### ')) {
            elements.push(
                <p key={i} className="font-bold text-sm text-slate-900 mt-2.5 mb-1">
                    {formatInlineText(line.replace('### ', ''))}
                </p>
            )
            continue
        }
        if (line.startsWith('## ')) {
            elements.push(
                <p key={i} className="font-black text-sm text-slate-900 mt-3 mb-1">
                    {formatInlineText(line.replace('## ', ''))}
                </p>
            )
            continue
        }
        if (line.startsWith('# ')) {
            elements.push(
                <p key={i} className="font-black text-base text-slate-900 mt-3 mb-1">
                    {formatInlineText(line.replace('# ', ''))}
                </p>
            )
            continue
        }

        // Handle Bullet Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
            elements.push(
                <div key={i} className="flex items-start gap-2 my-0.5">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                    <span className="text-sm leading-relaxed text-slate-700">
                        {formatInlineText(line.slice(2))}
                    </span>
                </div>
            )
            continue
        }

        // Handle Numbered Lists (1. , 2. )
        const numMatch = line.match(/^(\d+)\.\s+(.*)$/)
        if (numMatch) {
            elements.push(
                <div key={i} className="flex items-start gap-2 my-0.5">
                    <span className="font-bold text-xs text-orange-600 min-w-[16px]">{numMatch[1]}.</span>
                    <span className="text-sm leading-relaxed text-slate-700">
                        {formatInlineText(numMatch[2])}
                    </span>
                </div>
            )
            continue
        }

        // Empty line
        if (trimmed === '') {
            elements.push(<div key={i} className="h-1.5" />)
            continue
        }

        // Normal paragraph
        elements.push(
            <p key={i} className="text-sm leading-relaxed text-slate-700">
                {formatInlineText(line)}
            </p>
        )
    }

    if (inTable) flushTable('table-end')
    if (inCodeBlock) flushCode('code-end')

    return <div className="space-y-1">{elements}</div>
}

export default function AeroAssistant() {
    const { data: session } = useSession()
    const [isOpen, setIsOpen] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isVisible, setIsVisible] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(true)
    const [showPopup, setShowPopup] = useState(false)
    const [expandedQueries, setExpandedQueries] = useState<Record<number, boolean>>({})
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Animate in after mount
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 800)
        return () => clearTimeout(timer)
    }, [])

    // Show popup after button appears, auto-dismiss after 10 seconds or when user opens chat
    useEffect(() => {
        if (isVisible && !isOpen) {
            const popupTimer = setTimeout(() => setShowPopup(true), 2500)
            const dismissTimer = setTimeout(() => setShowPopup(false), 12500)
            return () => {
                clearTimeout(popupTimer)
                clearTimeout(dismissTimer)
            }
        } else {
            setShowPopup(false)
        }
    }, [isVisible, isOpen])

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages])

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300)
        }
    }, [isOpen])

    // Show welcome message when first opened
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const welcomeMsg: Message = {
                role: 'assistant',
                content: `Hello ${session?.user?.name?.split(' ')[0] || 'there'}! ✈️ I'm **Aero**, your AeroSky Operations & Data Intelligence Assistant.\n\nI have direct access to our live Supabase database — drones, orders, flight logs, inventory components, expenses, and CRM leads. Ask me to query any data, calculate metrics, or suggest operational improvements!`,
                timestamp: new Date(),
            }
            setMessages([welcomeMsg])
        }
    }, [isOpen, session?.user?.name])

    const sendMessage = async (text?: string) => {
        const messageText = text || inputValue.trim()
        if (!messageText || isLoading) return

        setInputValue('')
        setShowSuggestions(false)

        const userMsg: Message = {
            role: 'user',
            content: messageText,
            timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMsg])
        setIsLoading(true)

        try {
            const res = await fetch('/api/assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageText,
                    history: messages.map((m) => ({ role: m.role, content: m.content })),
                }),
            })

            const data = await res.json()
            const assistantMsg: Message = {
                role: 'assistant',
                content: data.reply || 'Something went wrong. Please try again.',
                timestamp: new Date(),
                queries: data.queries || [],
            }
            setMessages((prev) => [...prev, assistantMsg])
        } catch {
            const errMsg: Message = {
                role: 'assistant',
                content: 'I\'m experiencing turbulence reaching the server. Please try again in a moment.',
                timestamp: new Date(),
            }
            setMessages((prev) => [...prev, errMsg])
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const clearChat = () => {
        setMessages([])
        setShowSuggestions(true)
        setExpandedQueries({})
    }

    const toggleQueryExpansion = (idx: number) => {
        setExpandedQueries(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }))
    }

    const copySql = (text: string, idx: number) => {
        navigator.clipboard.writeText(text)
        setCopiedIndex(idx)
        setTimeout(() => setCopiedIndex(null), 2000)
    }

    if (!session) return null

    return (
        <>
            {/* Help Popup */}
            <div
                className={`fixed bottom-24 right-6 z-[201] transition-all duration-500 ${
                    showPopup ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
                }`}
                style={{ transformOrigin: 'bottom right' }}
            >
                <div className="flex items-end gap-3">
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl px-4 py-3 shadow-lg shadow-orange-500/30 max-w-xs">
                        <div className="flex items-center gap-2 mb-1">
                            <Bot className="w-4 h-4" />
                            <p className="font-bold text-sm">Aero Assistant</p>
                        </div>
                        <p className="text-sm font-medium leading-tight">May I query any data for you?</p>
                        <div className="absolute bottom-0 right-2 translate-y-full">
                            <div className="border-8 border-transparent border-t-orange-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Trigger Button */}
            <div
                className={`fixed bottom-6 right-6 z-[200] transition-all duration-500 ${
                    isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
            >
                <button
                    onClick={() => {
                        setIsOpen((prev) => !prev)
                        setShowPopup(false)
                    }}
                    id="aero-assistant-trigger"
                    aria-label="Open Aero AI Assistant"
                    className={`
                        relative group flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300
                        ${isOpen
                            ? 'bg-slate-900 text-white shadow-slate-900/40 scale-95'
                            : 'bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 text-white shadow-orange-500/40 hover:shadow-orange-500/60 hover:scale-105 active:scale-95'
                        }
                    `}
                >
                    <div className="relative">
                        <Bot className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
                    </div>

                    <div className="text-left hidden sm:block">
                        <p className="text-xs font-black tracking-wider uppercase leading-none">Aero</p>
                        <p className="text-[10px] text-orange-100 font-medium leading-tight opacity-90">Data & Ops AI</p>
                    </div>

                    <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-spin-slow opacity-80" />
                </button>
            </div>

            {/* Chat Panel */}
            <div
                className={`
                    fixed z-[202] transition-all duration-500 ease-out flex flex-col bg-white shadow-2xl border border-slate-200/80
                    ${isOpen
                        ? 'opacity-100 scale-100 pointer-events-auto'
                        : 'opacity-0 scale-95 pointer-events-none'
                    }
                    ${isExpanded
                        ? 'bottom-4 right-4 left-4 top-4 sm:left-auto sm:right-6 sm:bottom-6 sm:top-6 sm:w-[680px] rounded-3xl'
                        : 'bottom-20 right-6 w-[calc(100vw-3rem)] sm:w-[440px] h-[580px] rounded-3xl'
                    }
                `}
                style={{ transformOrigin: 'bottom right' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 rounded-t-3xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                            <Bot className="w-4 h-4 text-white" />
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900" />
                        </div>
                        <div>
                            <p className="text-white font-black text-sm tracking-tight flex items-center gap-1.5">
                                Aero Assistant
                                <span className="text-[9px] font-mono bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30">SQL Live</span>
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                                {isLoading ? 'Querying database...' : 'Online · Connected to Supabase'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={clearChat}
                            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all text-[10px] font-bold tracking-wider uppercase"
                            title="Clear chat"
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => setIsExpanded((p) => !p)}
                            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                            title={isExpanded ? 'Minimize' : 'Expand'}
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth bg-slate-50/50"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}
                >
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex gap-3 animate-slide-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            {/* Avatar */}
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm shadow-orange-500/30">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                            )}

                            {/* Bubble */}
                            <div
                                className={`
                                    max-w-[88%] rounded-2xl px-4 py-3 shadow-sm
                                    ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-tr-sm ml-auto'
                                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                                    }
                                `}
                            >
                                {msg.role === 'user' ? (
                                    <p className="text-sm leading-relaxed">{msg.content}</p>
                                ) : (
                                    <>
                                        <MarkdownText text={msg.content} />

                                        {/* Executed SQL Queries details badge */}
                                        {msg.queries && msg.queries.length > 0 && (
                                            <div className="mt-2.5 pt-2 border-t border-slate-100">
                                                <button
                                                    onClick={() => toggleQueryExpansion(i)}
                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 px-2 py-1 rounded-md border border-slate-200 transition-colors"
                                                >
                                                    <Database className="w-3 h-3 text-orange-500" />
                                                    <span>
                                                        {msg.queries.length === 1
                                                            ? `1 SQL Query Executed (${msg.queries[0].rowCount ?? 0} rows)`
                                                            : `${msg.queries.length} SQL Queries Executed`
                                                        }
                                                    </span>
                                                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedQueries[i] ? 'rotate-180' : ''}`} />
                                                </button>

                                                {expandedQueries[i] && (
                                                    <div className="mt-2 space-y-2">
                                                        {msg.queries.map((q, qIdx) => (
                                                            <div key={qIdx} className="bg-slate-900 rounded-xl p-2.5 text-[11px] font-mono text-emerald-400 border border-slate-800">
                                                                <div className="flex justify-between items-center mb-1.5 text-[10px] text-slate-400 font-sans">
                                                                    <span className="font-semibold text-slate-300">{q.explanation || 'SQL Query'}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        {q.rowCount !== undefined && (
                                                                            <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[9px]">
                                                                                {q.rowCount} rows
                                                                            </span>
                                                                        )}
                                                                        <button
                                                                            onClick={() => copySql(q.query, qIdx)}
                                                                            className="text-slate-400 hover:text-white transition-colors"
                                                                            title="Copy SQL"
                                                                        >
                                                                            {copiedIndex === qIdx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-slate-200 text-[10.5px]">
                                                                    {q.query}
                                                                </pre>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                                <p className={`text-[9px] mt-2 font-bold tracking-wider ${msg.role === 'user' ? 'text-orange-200 text-right' : 'text-slate-400'}`}>
                                    {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}

                    {/* Loading indicator */}
                    {isLoading && (
                        <div className="flex gap-3 animate-slide-up">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Database className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
                                    <span className="text-xs text-slate-500 font-medium">Fetching live database records...</span>
                                    <div className="flex items-center gap-1 ml-1">
                                        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestions */}
                {showSuggestions && messages.length <= 1 && !isLoading && (
                    <div className="px-4 py-2 border-t border-slate-100 bg-white flex-shrink-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quick data queries</p>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {SUGGESTED_PROMPTS.slice(0, 5).map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(prompt)}
                                    className="text-[10px] font-bold px-2.5 py-1 bg-slate-50 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 hover:border-orange-200 rounded-lg transition-all duration-200 text-slate-600 whitespace-nowrap"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-slate-100 rounded-b-3xl flex-shrink-0">
                    <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                        <textarea
                            ref={inputRef}
                            id="aero-assistant-input"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask Aero to query data (or run /sql SELECT...)"
                            rows={1}
                            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none outline-none max-h-24 leading-relaxed"
                            style={{ minHeight: '24px' }}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!inputValue.trim() || isLoading}
                            className={`
                                p-2 rounded-xl transition-all duration-200 flex-shrink-0
                                ${inputValue.trim() && !isLoading
                                    ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/30 hover:scale-105 active:scale-95'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }
                            `}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="flex items-center justify-between px-1 mt-1.5">
                        <p className="text-[9px] text-slate-400 font-medium">
                            Live SQL queries on Supabase • Enter to send
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">
                            /sql &lt;query&gt;
                        </p>
                    </div>
                </div>
            </div>
        </>
    )
}
