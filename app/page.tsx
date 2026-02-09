'use client'

import { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { Loader2, X, RefreshCw, Check, Send, AlertCircle, Copy, Search, Menu, ArrowLeft, ArrowRight, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// --- Constants ---
const AGENT_ID = '69897afeebfd819b4b7010cd'
const AGENT_NAME = 'Image Generation Agent'
const MAX_CHARS = 500
const HISTORY_KEY = 'image-gen-history'

// --- TypeScript Interfaces ---
interface ImageGenData {
  enhanced_prompt?: string
  style_suggestion?: string
  size_recommendation?: string
  quality_notes?: string
  original_prompt?: string
}

interface HistoryItem {
  id: string
  prompt: string
  style: string
  size: string
  quality: string
  result: ImageGenData | null
  summary: string
  timestamp: number
}

interface GenerationParams {
  style: string
  size: string
  quality: string
}

// --- Sample Data ---
const SAMPLE_HISTORY: HistoryItem[] = [
  {
    id: 'sample-1',
    prompt: 'A futuristic cityscape at night with neon lights and flying cars',
    style: 'Cyberpunk',
    size: 'Landscape (16:9)',
    quality: 'HD',
    result: {
      enhanced_prompt: 'A sprawling futuristic cityscape at night, illuminated with vibrant neon lights in hues of blue, pink, and purple. Sleek skyscrapers with glowing holographic advertisements rise into the dark sky. Numerous flying cars, with glowing underlights and trails, zoom between the buildings. The streets below are wet, reflecting the colorful lights. The atmosphere is lively and technologically advanced, evoking a cyberpunk aesthetic.',
      style_suggestion: 'Cyberpunk digital art with high contrast and cinematic lighting',
      size_recommendation: '3840x2160 (4K UHD) for maximum detail and immersive quality',
      quality_notes: 'Use high-resolution settings to capture intricate city details, neon effects, and atmospheric depth. Apply moderate cinematic blur and volumetric lighting for realism and mood.',
      original_prompt: 'A futuristic cityscape at night with neon lights and flying cars',
    },
    summary: 'Enhanced prompt for a vibrant, futuristic nighttime cityscape with neon lights and flying vehicles.',
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'sample-2',
    prompt: 'A serene mountain lake at sunrise with mist',
    style: 'Realistic',
    size: 'Landscape (16:9)',
    quality: 'HD',
    result: {
      enhanced_prompt: 'A serene landscape featuring a crystal-clear mountain lake surrounded by pine trees, with snow-capped mountains in the background under a golden sunrise. Mist drifts over the water, and gentle ripples reflect the vibrant sky.',
      style_suggestion: 'Realistic digital painting',
      size_recommendation: '1920x1080 pixels (HD horizontal)',
      quality_notes: 'Use high resolution and fine details, prioritize realistic lighting and reflective surfaces for maximum visual impact.',
      original_prompt: 'A serene mountain lake at sunrise with mist',
    },
    summary: 'Sample enhanced prompt and image generation details',
    timestamp: Date.now() - 7200000,
  },
  {
    id: 'sample-3',
    prompt: 'An enchanted forest with glowing mushrooms and fairy lights',
    style: 'Fantasy',
    size: 'Portrait (9:16)',
    quality: 'HD',
    result: {
      enhanced_prompt: 'A mystical enchanted forest bathed in soft moonlight. Towering ancient trees form a natural cathedral, their twisted roots covered in luminescent moss. Clusters of bioluminescent mushrooms in shades of teal and violet dot the forest floor. Tiny fairy lights float through the air like living stars, casting warm golden glows that dance across the misty atmosphere.',
      style_suggestion: 'Fantasy digital illustration with ethereal, dreamlike quality',
      size_recommendation: '1080x1920 (Full HD Portrait) for immersive vertical composition',
      quality_notes: 'Emphasize volumetric lighting effects, bioluminescence, and particle effects. Use depth of field to create layers of visual interest from foreground mushrooms to distant tree canopy.',
      original_prompt: 'An enchanted forest with glowing mushrooms and fairy lights',
    },
    summary: 'Enhanced prompt for a magical, bioluminescent forest scene with fairy lights.',
    timestamp: Date.now() - 10800000,
  },
]

// --- Helper: extract data from agent response ---
function extractImageData(result: any): { data: ImageGenData; summary: string } {
  const summary = result?.summary ?? ''
  const nested = result?.data
  const data: ImageGenData = {
    enhanced_prompt: nested?.enhanced_prompt ?? result?.enhanced_prompt ?? '',
    style_suggestion: nested?.style_suggestion ?? result?.style_suggestion ?? '',
    size_recommendation: nested?.size_recommendation ?? result?.size_recommendation ?? '',
    quality_notes: nested?.quality_notes ?? result?.quality_notes ?? '',
    original_prompt: nested?.original_prompt ?? result?.original_prompt ?? '',
  }
  return { data, summary }
}

// --- Inline Components ---

function HistorySidebar({ isOpen, onToggle, history, onSelect, activeId }: { isOpen: boolean; onToggle: () => void; history: HistoryItem[]; onSelect: (item: HistoryItem) => void; activeId: string | null }) {
  return (
    <div className={`${isOpen ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 border-r border-border bg-card`}>
      <div className="w-72 h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Prompt History</h2>
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 w-7 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {history.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-4">No history yet. Generate your first prompt to see it here.</p>
            )}
            {Array.isArray(history) && history.map((item) => (
              <button key={item.id} onClick={() => onSelect(item)} className={`w-full text-left p-3 rounded-lg transition-colors text-sm hover:bg-secondary ${activeId === item.id ? 'bg-secondary border border-primary/30' : ''}`}>
                <p className="font-medium text-foreground truncate">{item.prompt}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.style}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function ParameterPanel({ isOpen, onToggle, params, onParamsChange }: { isOpen: boolean; onToggle: () => void; params: GenerationParams; onParamsChange: (p: GenerationParams) => void }) {
  return (
    <div className={`${isOpen ? 'w-64' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 border-l border-border bg-card`}>
      <div className="w-64 h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Parameters
          </h2>
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 w-7 p-0">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style</Label>
            <Select value={params.style} onValueChange={(value) => onParamsChange({ ...params, style: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Realistic">Realistic</SelectItem>
                <SelectItem value="Artistic">Artistic</SelectItem>
                <SelectItem value="Abstract">Abstract</SelectItem>
                <SelectItem value="Cyberpunk">Cyberpunk</SelectItem>
                <SelectItem value="Fantasy">Fantasy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</Label>
            <Select value={params.size} onValueChange={(value) => onParamsChange({ ...params, size: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Square (1:1)">Square (1:1)</SelectItem>
                <SelectItem value="Landscape (16:9)">Landscape (16:9)</SelectItem>
                <SelectItem value="Portrait (9:16)">Portrait (9:16)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quality</Label>
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
              <span className={`text-sm ${params.quality === 'Standard' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>Standard</span>
              <Switch checked={params.quality === 'HD'} onCheckedChange={(checked) => onParamsChange({ ...params, quality: checked ? 'HD' : 'Standard' })} />
              <span className={`text-sm ${params.quality === 'HD' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>HD</span>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Settings</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Style</span>
                <span className="font-medium">{params.style}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium">{params.size}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Quality</span>
                <span className="font-medium">{params.quality}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultDisplay({ data, summary, onCopy, onRegenerate, copied, loading }: { data: ImageGenData; summary: string; onCopy: () => void; onRegenerate: () => void; copied: boolean; loading: boolean }) {
  return (
    <div className="space-y-4">
      {summary && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-foreground font-medium">{summary}</p>
        </div>
      )}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Enhanced Prompt</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCopy} className="h-8 text-xs">
                {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading} className="h-8 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90 bg-secondary/30 rounded-lg p-4">{data?.enhanced_prompt || 'No enhanced prompt available.'}</p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              Style Suggestion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/80">{data?.style_suggestion || 'No suggestion available.'}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-accent flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent" />
              Size Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/80">{data?.size_recommendation || 'No recommendation available.'}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-muted-foreground" />
              Quality Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/80">{data?.quality_notes || 'No notes available.'}</p>
          </CardContent>
        </Card>
      </div>
      {data?.original_prompt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          <span className="font-medium">Original:</span>
          <span>{data.original_prompt}</span>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Search className="h-10 w-10 text-primary/60" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Create Your First Image Prompt</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">Describe the image you want to create and the AI will enhance your prompt with detailed descriptions, style suggestions, and quality recommendations.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Badge variant="secondary" className="text-xs">Prompt Enhancement</Badge>
        <Badge variant="secondary" className="text-xs">Style Suggestions</Badge>
        <Badge variant="secondary" className="text-xs">Size Recommendations</Badge>
        <Badge variant="secondary" className="text-xs">Quality Notes</Badge>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 bg-muted rounded w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2 bg-secondary/30 rounded-lg p-4">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-5/6" />
            <div className="h-3 bg-muted rounded w-4/6" />
            <div className="h-3 bg-muted rounded w-full" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AgentStatusCard({ activeAgentId, loading }: { activeAgentId: string | null; loading: boolean }) {
  const isActive = loading && activeAgentId === AGENT_ID
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
            <div>
              <p className="text-xs font-medium text-foreground">{AGENT_NAME}</p>
              <p className="text-[10px] text-muted-foreground">Prompt enhancement and image generation guidance</p>
            </div>
          </div>
          <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px]">
            {isActive ? 'Processing' : 'Ready'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Main Page Component ---
export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [params, setParams] = useState<GenerationParams>({ style: 'Realistic', size: 'Square (1:1)', quality: 'HD' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentResult, setCurrentResult] = useState<ImageGenData | null>(null)
  const [currentSummary, setCurrentSummary] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paramPanelOpen, setParamPanelOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showSampleData, setShowSampleData] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`)

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setHistory(parsed)
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  // Persist history to localStorage
  useEffect(() => {
    if (!showSampleData) {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      } catch {
        // Ignore storage errors
      }
    }
  }, [history, showSampleData])

  // Sample data toggle
  useEffect(() => {
    if (showSampleData) {
      setHistory(SAMPLE_HISTORY)
      const first = SAMPLE_HISTORY[0]
      if (first) {
        setPrompt(first.prompt)
        setParams({ style: first.style, size: first.size, quality: first.quality })
        setCurrentResult(first.result)
        setCurrentSummary(first.summary)
        setActiveHistoryId(first.id)
      }
    } else {
      try {
        const stored = localStorage.getItem(HISTORY_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            setHistory(parsed)
          } else {
            setHistory([])
          }
        } else {
          setHistory([])
        }
      } catch {
        setHistory([])
      }
      setPrompt('')
      setCurrentResult(null)
      setCurrentSummary('')
      setActiveHistoryId(null)
    }
  }, [showSampleData])

  // Collapse panels on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
        setParamPanelOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)
    setCopied(false)
    setActiveAgentId(AGENT_ID)

    const message = `Generate an enhanced image prompt for the following description. Style preference: ${params.style}. Size preference: ${params.size}. Quality: ${params.quality}. Prompt: ${prompt.trim()}`

    try {
      const result = await callAIAgent(message, AGENT_ID, { session_id: sessionId })
      if (result.success && result?.response?.status === 'success') {
        const agentResult = result?.response?.result
        const { data, summary } = extractImageData(agentResult)
        setCurrentResult(data)
        setCurrentSummary(summary)
        const newItem: HistoryItem = {
          id: `gen-${Date.now()}`,
          prompt: prompt.trim(),
          style: params.style,
          size: params.size,
          quality: params.quality,
          result: data,
          summary,
          timestamp: Date.now(),
        }
        setHistory((prev) => [newItem, ...prev.slice(0, 49)])
        setActiveHistoryId(newItem.id)
      } else {
        setError(result?.response?.message ?? result?.error ?? 'Failed to generate enhanced prompt. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [prompt, params, loading, sessionId])

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setPrompt(item.prompt)
    setParams({ style: item.style, size: item.size, quality: item.quality })
    setCurrentResult(item.result)
    setCurrentSummary(item.summary)
    setActiveHistoryId(item.id)
    setError(null)
    setCopied(false)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [])

  const handleCopy = useCallback(async () => {
    if (currentResult?.enhanced_prompt) {
      const success = await copyToClipboard(currentResult.enhanced_prompt)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }, [currentResult])

  const handleRegenerate = useCallback(() => {
    if (prompt.trim()) {
      handleGenerate()
    }
  }, [prompt, handleGenerate])

  const handleClear = useCallback(() => {
    setPrompt('')
    setCurrentResult(null)
    setCurrentSummary('')
    setActiveHistoryId(null)
    setError(null)
    setCopied(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleGenerate()
    }
  }, [handleGenerate])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 p-0 md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 p-0 hidden md:flex">
            {sidebarOpen ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">AI Image Generator</h1>
              <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">Enhance your image prompts with AI</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
            <Switch id="sample-toggle" checked={showSampleData} onCheckedChange={setShowSampleData} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setParamPanelOpen(!paramPanelOpen)} className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* History Sidebar */}
        <HistorySidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} history={history} onSelect={handleHistorySelect} activeId={activeHistoryId} />

        {/* Center Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
              {/* Prompt Input Card */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="relative">
                      <Textarea
                        placeholder="Describe the image you want to create..."
                        value={prompt}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val.length <= MAX_CHARS) {
                            setPrompt(val)
                          }
                        }}
                        onKeyDown={handleKeyDown}
                        className="min-h-[120px] resize-none pr-8 text-sm"
                        disabled={loading}
                      />
                      {prompt && (
                        <Button variant="ghost" size="sm" onClick={handleClear} className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground" disabled={loading}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${prompt.length >= MAX_CHARS ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {prompt.length}/{MAX_CHARS}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground hidden sm:inline">Ctrl+Enter to generate</span>
                        <Button onClick={handleGenerate} disabled={!prompt.trim() || loading} className="h-9 px-5">
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {/* Mobile parameter badges */}
                    <div className="flex flex-wrap gap-1.5 md:hidden">
                      <Badge variant="secondary" className="text-[10px]">{params.style}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{params.size}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{params.quality}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Generation Failed</p>
                    <p className="text-xs text-destructive/80 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && <LoadingSkeleton />}

              {/* Results */}
              {!loading && currentResult && (
                <ResultDisplay data={currentResult} summary={currentSummary} onCopy={handleCopy} onRegenerate={handleRegenerate} copied={copied} loading={loading} />
              )}

              {/* Empty State */}
              {!loading && !currentResult && !error && <EmptyState />}

              {/* Agent Status */}
              <AgentStatusCard activeAgentId={activeAgentId} loading={loading} />
            </div>
          </ScrollArea>
        </main>

        {/* Parameter Panel */}
        <ParameterPanel isOpen={paramPanelOpen} onToggle={() => setParamPanelOpen(false)} params={params} onParamsChange={setParams} />
      </div>
    </div>
  )
}
