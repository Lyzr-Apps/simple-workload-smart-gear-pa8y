'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent, extractText } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { cn, generateUUID } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  HiOutlinePaperAirplane,
  HiOutlinePlus,
  HiOutlineClipboardCopy,
  HiOutlineCheck,
  HiOutlineMenuAlt2,
  HiOutlineX,
  HiOutlineChatAlt2,
  HiOutlineRefresh,
} from 'react-icons/hi'
import { RiRobot2Line } from 'react-icons/ri'
import { BsCircleFill } from 'react-icons/bs'

// --- Constants ---
const AGENT_ID = '69999ae02a0c0e9d62090644'
const AGENT_NAME = 'WorkLoad Agent'

// --- Types ---
interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'error'
  content: string
  timestamp: string
  copied?: boolean
}

interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  sessionId: string
}

// --- Sample Data ---
const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: 'sample-1',
    title: 'จัดลำดับงานวันนี้',
    sessionId: 'sample-session-1',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    messages: [
      {
        id: 's1-m1',
        role: 'user',
        content: 'ช่วยจัดลำดับความสำคัญงานเหล่านี้ให้หน่อย:\n1. ตอบอีเมลลูกค้า\n2. ประชุมทีม 10:00\n3. เขียนรายงานสรุปยอดขาย\n4. แก้บัค login page\n5. อัพเดท documentation',
        timestamp: new Date(Date.now() - 3500000).toISOString(),
      },
      {
        id: 's1-m2',
        role: 'agent',
        content: '## จัดลำดับความสำคัญงานวันนี้\n\nจากรายการงานที่ให้มา ผมจัดลำดับความสำคัญดังนี้:\n\n### สำคัญเร่งด่วน (High Priority)\n1. **ประชุมทีม 10:00** - มีเวลากำหนดแน่นอน ต้องเตรียมตัวก่อน\n2. **แก้บัค login page** - กระทบผู้ใช้โดยตรง ควรแก้ไขเร็วที่สุด\n\n### สำคัญ (Medium Priority)\n3. **ตอบอีเมลลูกค้า** - รักษาความสัมพันธ์กับลูกค้า ไม่ควรปล่อยนาน\n4. **เขียนรายงานสรุปยอดขาย** - สำคัญแต่ไม่เร่งด่วนมาก\n\n### ปกติ (Low Priority)\n5. **อัพเดท documentation** - สามารถทำตอนมีเวลาว่างได้\n\n### สรุป\n- เริ่มต้นเช้าด้วยการเตรียมตัวประชุม แล้วแก้บัค\n- ช่วงบ่ายตอบอีเมลและเขียนรายงาน\n- ปิดท้ายวันด้วยการอัพเดท documentation',
        timestamp: new Date(Date.now() - 3400000).toISOString(),
      },
    ],
  },
  {
    id: 'sample-2',
    title: 'สรุปรายการประชุม',
    sessionId: 'sample-session-2',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    messages: [
      {
        id: 's2-m1',
        role: 'user',
        content: 'สรุปรายการประชุมสัปดาห์นี้:\n- จันทร์: Sprint Planning 09:00\n- อังคาร: Client Review 14:00\n- พุธ: Design Review 11:00\n- พฤหัส: 1-on-1 with Manager 15:00\n- ศุกร์: Retrospective 16:00',
        timestamp: new Date(Date.now() - 7100000).toISOString(),
      },
      {
        id: 's2-m2',
        role: 'agent',
        content: '## สรุปรายการประชุมสัปดาห์นี้\n\nคุณมีทั้งหมด **5 ประชุม** สัปดาห์นี้:\n\n### รายละเอียด\n- **จันทร์ 09:00** - Sprint Planning (วางแผนงาน Sprint ใหม่)\n- **อังคาร 14:00** - Client Review (นำเสนอผลงานให้ลูกค้า)\n- **พุธ 11:00** - Design Review (ทบทวนงานออกแบบ)\n- **พฤหัสบดี 15:00** - 1-on-1 with Manager (ประเมินผลงาน)\n- **ศุกร์ 16:00** - Retrospective (สรุปบทเรียน Sprint)\n\n### ข้อสังเกต\n- ประชุมกระจายทั่วสัปดาห์ ไม่มีวันที่แน่นเกินไป\n- วันอังคารควรเตรียม demo ให้พร้อมก่อนประชุมลูกค้า\n- ช่วงเช้าวันพุธ-พฤหัสเป็นเวลาที่ดีสำหรับทำงาน focus',
        timestamp: new Date(Date.now() - 7000000).toISOString(),
      },
    ],
  },
]

const PROMPT_SUGGESTIONS = [
  'จัดลำดับความสำคัญของงานที่ต้องทำวันนี้',
  'สรุปรายการประชุมสัปดาห์นี้',
  'ช่วยจัดหมวดหมู่งานที่ค้างอยู่',
]

// --- Markdown Renderer ---
function formatInline(text: string): React.ReactNode {
  // Handle **bold**, `code`, and links
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/)
    // Code
    const codeMatch = remaining.match(/`(.*?)`/)
    // Link
    const linkMatch = remaining.match(/\[(.*?)\]\((.*?)\)/)

    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index ?? Infinity } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index ?? Infinity } : null,
      linkMatch ? { type: 'link', match: linkMatch, index: linkMatch.index ?? Infinity } : null,
    ].filter(Boolean).sort((a, b) => (a?.index ?? Infinity) - (b?.index ?? Infinity))

    const first = matches[0]

    if (!first || first.index === Infinity) {
      parts.push(remaining)
      break
    }

    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index))
    }

    if (first.type === 'bold' && first.match) {
      parts.push(<strong key={keyIdx++} className="font-semibold">{first.match[1]}</strong>)
      remaining = remaining.slice(first.index + first.match[0].length)
    } else if (first.type === 'code' && first.match) {
      parts.push(<code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">{first.match[1]}</code>)
      remaining = remaining.slice(first.index + first.match[0].length)
    } else if (first.type === 'link' && first.match) {
      parts.push(<a key={keyIdx++} href={first.match[2]} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:opacity-70">{first.match[1]}</a>)
      remaining = remaining.slice(first.index + first.match[0].length)
    } else {
      parts.push(remaining)
      break
    }
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1 text-foreground">{formatInline(line.slice(4))}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1 text-foreground">{formatInline(line.slice(3))}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2 text-foreground">{formatInline(line.slice(2))}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm text-foreground/90">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm text-foreground/90">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm text-foreground/90">{formatInline(line)}</p>
      })}
    </div>
  )
}

// --- Typing Indicator ---
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <RiRobot2Line className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/60 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-muted-foreground/60 typing-dot" />
          <div className="w-2 h-2 rounded-full bg-muted-foreground/60 typing-dot" />
        </div>
      </div>
    </div>
  )
}

// --- Message Bubble ---
function MessageBubble({
  message,
  onCopy,
}: {
  message: ChatMessage
  onCopy: (id: string, content: string) => void
}) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'

  const formattedTime = React.useMemo(() => {
    try {
      const d = new Date(message.timestamp)
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }, [message.timestamp])

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 text-right">{formattedTime}</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
          <RiRobot2Line className="w-4 h-4 text-destructive" />
        </div>
        <div className="max-w-[75%]">
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-destructive">{message.content}</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{formattedTime}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 mb-4 group">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <RiRobot2Line className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="max-w-[75%]">
        <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm relative">
          {renderMarkdown(message.content)}
          <button
            onClick={() => onCopy(message.id, message.content)}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/60 hover:bg-background/90 text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
            aria-label="Copy message"
          >
            {message.copied ? (
              <HiOutlineCheck className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <HiOutlineClipboardCopy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{formattedTime}</p>
      </div>
    </div>
  )
}

// --- Empty State ---
function EmptyState({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <RiRobot2Line className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2 text-center">WorkLoad Manager</h2>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm leading-relaxed">
        พิมพ์รายการงานของคุณ แล้วผมจะช่วยจัดการให้ครับ
      </p>
      <div className="grid gap-3 w-full max-w-md">
        {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => onSuggestionClick(suggestion)}
            className="glass rounded-xl px-4 py-3 text-left text-sm text-foreground/80 hover:text-foreground hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <HiOutlineChatAlt2 className="w-4 h-4 text-muted-foreground shrink-0" />
              {suggestion}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Sidebar Conversation Item ---
function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}) {
  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(conversation.createdAt)
      return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    } catch {
      return ''
    }
  }, [conversation.createdAt])

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 group',
        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground/70 hover:text-foreground'
      )}
    >
      <div className="flex items-center gap-2.5">
        <HiOutlineChatAlt2 className="w-4 h-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{conversation.title}</p>
          <p className="text-[11px] text-muted-foreground">{formattedDate}</p>
        </div>
      </div>
    </button>
  )
}

// --- Agent Status ---
function AgentStatus({ isActive }: { isActive: boolean }) {
  return (
    <div className="px-3 py-3">
      <div className="glass rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
            <RiRobot2Line className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{AGENT_NAME}</p>
            <p className="text-[10px] text-muted-foreground">Task Manager</p>
          </div>
          <BsCircleFill className={cn('w-2 h-2', isActive ? 'text-green-500 animate-pulse' : 'text-muted-foreground/40')} />
        </div>
      </div>
    </div>
  )
}

// --- ErrorBoundary ---
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Main Page ---
export default function Page() {
  // State
  const [userId] = useState(() => generateUUID())
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSampleData, setShowSampleData] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Derived
  const displayConversations = showSampleData && conversations.length === 0 ? SAMPLE_CONVERSATIONS : conversations
  const activeConversation = displayConversations.find((c) => c.id === activeConvId) ?? null

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages?.length, loading])

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [])

  // Create new conversation
  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: generateUUID(),
      title: 'สนทนาใหม่',
      messages: [],
      createdAt: new Date().toISOString(),
      sessionId: generateUUID(),
    }
    setConversations((prev) => [newConv, ...prev])
    setActiveConvId(newConv.id)
    setSidebarOpen(false)
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [])

  // Copy handler
  const handleCopy = useCallback(async (messageId: string, content: string) => {
    const success = await copyToClipboard(content)
    if (success) {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          messages: Array.isArray(c.messages)
            ? c.messages.map((m) => (m.id === messageId ? { ...m, copied: true } : m))
            : [],
        }))
      )
      setTimeout(() => {
        setConversations((prev) =>
          prev.map((c) => ({
            ...c,
            messages: Array.isArray(c.messages)
              ? c.messages.map((m) => (m.id === messageId ? { ...m, copied: false } : m))
              : [],
          }))
        )
      }, 2000)
    }
  }, [])

  // Send message
  const sendMessage = useCallback(
    async (text?: string) => {
      const message = (text ?? inputValue).trim()
      if (!message || loading) return

      let currentConvId = activeConvId

      // Create conversation if none active or if using sample data view
      if (!currentConvId || (showSampleData && conversations.length === 0)) {
        const newConv: Conversation = {
          id: generateUUID(),
          title: message.slice(0, 40) + (message.length > 40 ? '...' : ''),
          messages: [],
          createdAt: new Date().toISOString(),
          sessionId: generateUUID(),
        }
        setConversations((prev) => [newConv, ...prev])
        currentConvId = newConv.id
        setActiveConvId(newConv.id)
      }

      const userMsg: ChatMessage = {
        id: generateUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }

      // Update title from first message
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== currentConvId) return c
          const isFirstMessage = !Array.isArray(c.messages) || c.messages.length === 0
          return {
            ...c,
            title: isFirstMessage ? message.slice(0, 40) + (message.length > 40 ? '...' : '') : c.title,
            messages: [...(Array.isArray(c.messages) ? c.messages : []), userMsg],
          }
        })
      )

      setInputValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      setLoading(true)
      setActiveAgentId(AGENT_ID)
      setSidebarOpen(false)

      try {
        const conv = conversations.find((c) => c.id === currentConvId)
        const sessionId = conv?.sessionId ?? generateUUID()

        const result = await callAIAgent(message, AGENT_ID, {
          user_id: userId,
          session_id: sessionId,
        })

        let agentText = ''
        if (result.success) {
          agentText = result?.response?.result?.response || extractText(result.response) || 'ได้รับคำตอบแต่ไม่มีเนื้อหา'
        } else {
          const errorMsg: ChatMessage = {
            id: generateUUID(),
            role: 'error',
            content: result?.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองอีกครั้ง',
            timestamp: new Date().toISOString(),
          }
          setConversations((prev) =>
            prev.map((c) =>
              c.id === currentConvId
                ? { ...c, messages: [...(Array.isArray(c.messages) ? c.messages : []), errorMsg] }
                : c
            )
          )
          setLoading(false)
          setActiveAgentId(null)
          return
        }

        const agentMsg: ChatMessage = {
          id: generateUUID(),
          role: 'agent',
          content: agentText,
          timestamp: new Date().toISOString(),
        }

        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? { ...c, messages: [...(Array.isArray(c.messages) ? c.messages : []), agentMsg] }
              : c
          )
        )
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: generateUUID(),
          role: 'error',
          content: 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองอีกครั้ง',
          timestamp: new Date().toISOString(),
        }
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? { ...c, messages: [...(Array.isArray(c.messages) ? c.messages : []), errorMsg] }
              : c
          )
        )
      } finally {
        setLoading(false)
        setActiveAgentId(null)
      }
    },
    [activeConvId, inputValue, loading, userId, conversations, showSampleData]
  )

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  // Retry on error
  const handleRetry = useCallback(
    (errorContent: string) => {
      if (!activeConversation) return
      const messages = Array.isArray(activeConversation.messages) ? activeConversation.messages : []
      // Find the last user message before this error
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
      if (lastUserMsg) {
        // Remove the error message
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvId
              ? { ...c, messages: (Array.isArray(c.messages) ? c.messages : []).filter((m) => m.role !== 'error' || m.content !== errorContent) }
              : c
          )
        )
        sendMessage(lastUserMsg.content)
      }
    },
    [activeConversation, activeConvId, sendMessage]
  )

  const messages = Array.isArray(activeConversation?.messages) ? activeConversation.messages : []

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <div className="h-screen flex overflow-hidden bg-background text-foreground">
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={cn(
              'fixed md:relative z-40 h-full w-72 md:w-64 lg:w-72 flex flex-col border-r border-border bg-background/95 backdrop-blur-xl transition-transform duration-200 md:translate-x-0',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            {/* Sidebar Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
                  <RiRobot2Line className="w-4 h-4 text-primary-foreground" />
                </div>
                <h1 className="text-sm font-semibold tracking-tight">WorkLoad Manager</h1>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-accent md:hidden transition-colors"
                aria-label="Close sidebar"
              >
                <HiOutlineX className="w-4 h-4" />
              </button>
            </div>

            {/* New Conversation Button */}
            <div className="px-3 mb-2">
              <Button
                onClick={createNewConversation}
                variant="outline"
                className="w-full justify-start gap-2 text-sm font-medium"
              >
                <HiOutlinePlus className="w-4 h-4" />
                สนทนาใหม่
              </Button>
            </div>

            <Separator />

            {/* Conversation List */}
            <ScrollArea className="flex-1 px-2 py-2">
              <div className="space-y-0.5">
                {displayConversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 px-4">
                    ยังไม่มีสนทนา
                  </p>
                ) : (
                  displayConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={conv.id === activeConvId}
                      onClick={() => {
                        setActiveConvId(conv.id)
                        setSidebarOpen(false)
                      }}
                    />
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Sample Data Toggle */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sample Data</span>
                <Switch
                  checked={showSampleData}
                  onCheckedChange={(checked) => {
                    setShowSampleData(checked)
                    if (checked && conversations.length === 0) {
                      setActiveConvId(SAMPLE_CONVERSATIONS[0]?.id ?? null)
                    }
                    if (!checked) {
                      setActiveConvId(conversations[0]?.id ?? null)
                    }
                  }}
                />
              </div>
            </div>

            {/* Agent Status */}
            <AgentStatus isActive={activeAgentId !== null} />
          </aside>

          {/* Main Chat Area */}
          <main className="flex-1 flex flex-col min-w-0 h-full">
            {/* Chat Header */}
            <header className="h-14 flex items-center px-4 border-b border-border bg-background/80 backdrop-blur-lg shrink-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-accent mr-2 md:hidden transition-colors"
                aria-label="Open sidebar"
              >
                <HiOutlineMenuAlt2 className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5 min-w-0">
                <HiOutlineChatAlt2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <h2 className="text-sm font-medium truncate">
                  {activeConversation?.title ?? 'สนทนาใหม่'}
                </h2>
              </div>
              {loading && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-2 py-0.5 shrink-0">
                  กำลังประมวลผล...
                </Badge>
              )}
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 && !loading ? (
                <div className="h-full flex items-center justify-center">
                  <EmptyState onSuggestionClick={(text) => sendMessage(text)} />
                </div>
              ) : (
                <div className="max-w-3xl mx-auto px-4 py-6">
                  {messages.map((msg) => (
                    <React.Fragment key={msg.id}>
                      <MessageBubble message={msg} onCopy={handleCopy} />
                      {msg.role === 'error' && (
                        <div className="flex items-center gap-2 mb-4 ml-11">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetry(msg.content)}
                            className="text-xs gap-1.5"
                          >
                            <HiOutlineRefresh className="w-3 h-3" />
                            ลองอีกครั้ง
                          </Button>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  {loading && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="border-t border-border bg-background/80 backdrop-blur-lg p-4 shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2 glass rounded-2xl px-4 py-2.5 shadow-sm focus-within:shadow-md transition-shadow">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="พิมพ์รายการงาน หรือวางเอกสารที่นี่..."
                    disabled={loading}
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-1.5 max-h-40 leading-relaxed"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => sendMessage()}
                        disabled={loading || !inputValue.trim()}
                        size="sm"
                        className="rounded-xl h-9 w-9 p-0 shrink-0"
                      >
                        <HiOutlinePaperAirplane className="w-4 h-4 rotate-90" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>ส่ง (Enter)</TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  กด Enter เพื่อส่ง, Shift+Enter เพื่อขึ้นบรรทัดใหม่
                </p>
              </div>
            </div>
          </main>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
