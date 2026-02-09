'use client'

import { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import {
  Loader2, X, RefreshCw, Check, AlertCircle, Copy, Menu,
  ArrowLeft, ArrowRight, Settings, Download, ImageIcon, Wand2,
  Clock, Trash2, Maximize2, Minimize2, Sparkles
} from 'lucide-react'
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
const HISTORY_KEY = 'image-gen-history-v2'

// --- TypeScript Interfaces ---
interface ImageGenResult {
  image_url: string
  enhanced_prompt: string
  original_prompt: string
  style: string
  generation_metadata: string
}

interface HistoryItem {
  id: string
  prompt: string
  style: string
  size: string
  quality: string
  result: ImageGenResult | null
  timestamp: number
}

interface GenerationParams {
  style: string
  size: string
  quality: string
}

// --- Helper: Parse key-value text response from agent ---
function parseAgentTextResponse(text: string): ImageGenResult {
  const result: ImageGenResult = {
    image_url: '',
    enhanced_prompt: '',
    original_prompt: '',
    style: '',
    generation_metadata: '',
  }

  if (!text || typeof text !== 'string') return result

  const lines = text.split('\n')
  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_')
    const value = line.substring(colonIdx + 1).trim()
    if (key === 'image_url') result.image_url = value
    else if (key === 'enhanced_prompt') result.enhanced_prompt = value
    else if (key === 'original_prompt') result.original_prompt = value
    else if (key === 'style') result.style = value
    else if (key === 'generation_metadata') result.generation_metadata = value
  }

  return result
}

// --- Helper: Extract image data from various response shapes ---
function extractImageResult(agentResult: any): ImageGenResult {
  // Case 1: result is a text string with key-value pairs
  if (agentResult?.text && typeof agentResult.text === 'string') {
    return parseAgentTextResponse(agentResult.text)
  }

  // Case 2: result has message as text
  if (agentResult?.message && typeof agentResult.message === 'string') {
    const parsed = parseAgentTextResponse(agentResult.message)
    if (parsed.image_url) return parsed
  }

  // Case 3: result directly has data fields
  if (agentResult?.data) {
    return {
      image_url: agentResult.data.image_url || '',
      enhanced_prompt: agentResult.data.enhanced_prompt || '',
      original_prompt: agentResult.data.original_prompt || '',
      style: agentResult.data.style || '',
      generation_metadata: agentResult.data.generation_metadata || '',
    }
  }

  // Case 4: result has fields directly
  if (agentResult?.image_url) {
    return {
      image_url: agentResult.image_url || '',
      enhanced_prompt: agentResult.enhanced_prompt || '',
      original_prompt: agentResult.original_prompt || '',
      style: agentResult.style || '',
      generation_metadata: agentResult.generation_metadata || '',
    }
  }

  // Case 5: Try parsing the entire result as text
  if (typeof agentResult === 'string') {
    return parseAgentTextResponse(agentResult)
  }

  // Fallback: try to find image_url anywhere in the response
  const str = JSON.stringify(agentResult || {})
  const urlMatch = str.match(/https?:\/\/[^\s"',}]+\.(?:png|jpg|jpeg|gif|webp)/i)
  if (urlMatch) {
    return {
      image_url: urlMatch[0],
      enhanced_prompt: agentResult?.enhanced_prompt || agentResult?.summary || '',
      original_prompt: agentResult?.original_prompt || '',
      style: agentResult?.style || '',
      generation_metadata: '',
    }
  }

  return {
    image_url: '',
    enhanced_prompt: '',
    original_prompt: '',
    style: '',
    generation_metadata: '',
  }
}

// --- Sample Data ---
const SAMPLE_HISTORY: HistoryItem[] = [
  {
    id: 'sample-1',
    prompt: 'A cute cat sitting on a windowsill watching rain',
    style: 'Realistic',
    size: 'Square (1024x1024)',
    quality: 'HD',
    result: {
      image_url: 'https://oaidalleapiprodscus.blob.core.windows.net/private/org-xwOg6cOaVRpTtrLcPKzvJpMI/user-mem_cmio6ucfv070k0srh69fm65cy/img-8e9avs2NIeWaIvTmKKJTtoJw.png',
      enhanced_prompt: 'A cute cat with soft fur, sitting on a cozy windowsill, gazing outside at raindrops gently falling against the window, warm indoor lighting, peaceful and heartwarming mood',
      original_prompt: 'A cute cat sitting on a windowsill watching rain',
      style: 'Cozy, heartwarming, realistic with soft lighting',
      generation_metadata: 'DALL-E, enhanced for cuteness and mood',
    },
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'sample-2',
    prompt: 'A futuristic city with neon lights at night',
    style: 'Cyberpunk',
    size: 'Landscape (1792x1024)',
    quality: 'HD',
    result: {
      image_url: '',
      enhanced_prompt: 'A sprawling futuristic cityscape at night, illuminated with vibrant neon lights in hues of blue, pink, and purple, flying cars with glowing underlights',
      original_prompt: 'A futuristic city with neon lights at night',
      style: 'Cyberpunk digital art with high contrast',
      generation_metadata: 'DALL-E, cyberpunk aesthetic',
    },
    timestamp: Date.now() - 7200000,
  },
]

// --- Inline Components ---

function HistorySidebar({
  isOpen, onToggle, history, onSelect, activeId, onClear,
}: {
  isOpen: boolean
  onToggle: () => void
  history: HistoryItem[]
  onSelect: (item: HistoryItem) => void
  activeId: string | null
  onClear: () => void
}) {
  return (
    <div className={`${isOpen ? 'w-72' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 border-r border-border bg-card`}>
      <div className="w-72 h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            History
          </h2>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 w-7 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {history.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-xs text-muted-foreground">No images generated yet. Start creating!</p>
              </div>
            )}
            {Array.isArray(history) && history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={`w-full text-left p-3 rounded-lg transition-colors text-sm hover:bg-secondary group ${activeId === item.id ? 'bg-secondary border border-primary/30' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {item.result?.image_url ? (
                    <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                      <img
                        src={item.result.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate text-xs">{item.prompt}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.style}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function ParameterPanel({
  isOpen, onToggle, params, onParamsChange,
}: {
  isOpen: boolean
  onToggle: () => void
  params: GenerationParams
  onParamsChange: (p: GenerationParams) => void
}) {
  return (
    <div className={`${isOpen ? 'w-64' : 'w-0'} transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 border-l border-border bg-card`}>
      <div className="w-64 h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
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
                <SelectItem value="Watercolor">Watercolor</SelectItem>
                <SelectItem value="Oil Painting">Oil Painting</SelectItem>
                <SelectItem value="3D Render">3D Render</SelectItem>
                <SelectItem value="Anime">Anime</SelectItem>
                <SelectItem value="Minimalist">Minimalist</SelectItem>
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
                <SelectItem value="Square (1024x1024)">Square (1024x1024)</SelectItem>
                <SelectItem value="Landscape (1792x1024)">Landscape (1792x1024)</SelectItem>
                <SelectItem value="Portrait (1024x1792)">Portrait (1024x1792)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quality</Label>
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
              <span className={`text-sm ${params.quality === 'Standard' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>Standard</span>
              <Switch
                checked={params.quality === 'HD'}
                onCheckedChange={(checked) => onParamsChange({ ...params, quality: checked ? 'HD' : 'Standard' })}
              />
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
          <Separator />
          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Images are generated using DALL-E. Parameters are passed as part of the prompt to guide the generation style and output.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageResultDisplay({
  result,
  onCopy,
  onDownload,
  onRegenerate,
  copied,
  loading,
  expanded,
  onToggleExpand,
}: {
  result: ImageGenResult
  onCopy: () => void
  onDownload: () => void
  onRegenerate: () => void
  copied: boolean
  loading: boolean
  expanded: boolean
  onToggleExpand: () => void
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
  }, [result.image_url])

  return (
    <div className="space-y-4">
      {/* Generated Image */}
      <Card className="border-primary/20 shadow-md overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Generated Image
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={onToggleExpand} className="h-8 w-8 p-0">
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="outline" size="sm" onClick={onDownload} className="h-8 text-xs" disabled={!result.image_url}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading} className="h-8 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {result.image_url ? (
            <div className={`relative bg-muted/30 flex items-center justify-center ${expanded ? 'min-h-[600px]' : 'min-h-[400px]'}`}>
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
                    <p className="text-sm text-muted-foreground">Loading image...</p>
                  </div>
                </div>
              )}
              {imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-center px-4">
                    <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Image could not be loaded. The URL may have expired.</p>
                    <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Generate Again
                    </Button>
                  </div>
                </div>
              )}
              <img
                src={result.image_url}
                alt={result.enhanced_prompt || 'Generated image'}
                className={`w-full h-auto object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'} ${expanded ? 'max-h-[700px]' : 'max-h-[500px]'}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageError(true)
                  setImageLoaded(false)
                }}
              />
            </div>
          ) : (
            <div className="min-h-[300px] flex items-center justify-center bg-muted/20">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No image URL was returned by the agent.</p>
                <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Enhanced Prompt */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-primary flex items-center gap-2">
                <Wand2 className="h-3.5 w-3.5" />
                Enhanced Prompt
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={onCopy} className="h-7 text-xs px-2">
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/80 leading-relaxed">{result.enhanced_prompt || 'N/A'}</p>
          </CardContent>
        </Card>

        {/* Generation Info */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-accent flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" />
              Generation Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {result.style && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Style</p>
                  <p className="text-sm text-foreground/80">{result.style}</p>
                </div>
              )}
              {result.generation_metadata && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Model</p>
                  <p className="text-sm text-foreground/80">{result.generation_metadata}</p>
                </div>
              )}
              {result.original_prompt && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Original Prompt</p>
                  <p className="text-sm text-foreground/80">{result.original_prompt}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <ImageIcon className="h-12 w-12 text-primary/50" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">Generate Your First Image</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-8">
        Describe any image and the AI will generate it for you using DALL-E. Try describing a scene, character, landscape, or anything you can imagine.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Wand2 className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">AI-enhanced prompts</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <ImageIcon className="h-5 w-5 text-accent mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">DALL-E powered</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Download className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Download results</p>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Image skeleton */}
      <Card className="border-primary/20 shadow-md overflow-hidden">
        <CardHeader className="pb-3">
          <div className="h-5 bg-muted rounded w-40 animate-pulse" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="min-h-[400px] bg-muted/30 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary/40 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">Generating your image...</p>
                <p className="text-xs text-muted-foreground">This may take 10-20 seconds</p>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Detail skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i} className="shadow-sm animate-pulse">
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

function AgentStatusCard({ loading }: { loading: boolean }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${loading ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
            <div>
              <p className="text-xs font-medium text-foreground">{AGENT_NAME}</p>
              <p className="text-[10px] text-muted-foreground">DALL-E image generation</p>
            </div>
          </div>
          <Badge variant={loading ? 'default' : 'secondary'} className="text-[10px]">
            {loading ? 'Generating' : 'Ready'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Main Page Component ---
export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [params, setParams] = useState<GenerationParams>({ style: 'Realistic', size: 'Square (1024x1024)', quality: 'HD' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentResult, setCurrentResult] = useState<ImageGenResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [paramPanelOpen, setParamPanelOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showSampleData, setShowSampleData] = useState(false)
  const [expanded, setExpanded] = useState(false)
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
    setCurrentResult(null)

    const message = `Generate an image with the following description. Style: ${params.style}. Size: ${params.size}. Quality: ${params.quality}. Description: ${prompt.trim()}`

    try {
      const result = await callAIAgent(message, AGENT_ID, { session_id: sessionId })

      if (result.success && result?.response?.status === 'success') {
        const agentResult = result?.response?.result
        const imageData = extractImageResult(agentResult)

        // Also check in response.message if text response
        if (!imageData.image_url && result?.response?.message) {
          const fromMessage = parseAgentTextResponse(result.response.message)
          if (fromMessage.image_url) {
            imageData.image_url = fromMessage.image_url
            if (!imageData.enhanced_prompt) imageData.enhanced_prompt = fromMessage.enhanced_prompt
            if (!imageData.style) imageData.style = fromMessage.style
          }
        }

        // Check raw_response as final fallback
        if (!imageData.image_url && result?.raw_response) {
          const fromRaw = parseAgentTextResponse(result.raw_response)
          if (fromRaw.image_url) {
            imageData.image_url = fromRaw.image_url
            if (!imageData.enhanced_prompt) imageData.enhanced_prompt = fromRaw.enhanced_prompt
            if (!imageData.style) imageData.style = fromRaw.style
          }
        }

        if (!imageData.original_prompt) {
          imageData.original_prompt = prompt.trim()
        }

        setCurrentResult(imageData)

        const newItem: HistoryItem = {
          id: `gen-${Date.now()}`,
          prompt: prompt.trim(),
          style: params.style,
          size: params.size,
          quality: params.quality,
          result: imageData,
          timestamp: Date.now(),
        }
        setHistory((prev) => [newItem, ...prev.slice(0, 49)])
        setActiveHistoryId(newItem.id)
      } else {
        setError(result?.response?.message ?? result?.error ?? 'Failed to generate image. Please try again.')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [prompt, params, loading, sessionId])

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setPrompt(item.prompt)
    setParams({ style: item.style, size: item.size, quality: item.quality })
    setCurrentResult(item.result)
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

  const handleDownload = useCallback(async () => {
    if (!currentResult?.image_url) return
    try {
      const link = document.createElement('a')
      link.href = currentResult.image_url
      link.download = `generated-image-${Date.now()}.png`
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      // Fallback: open in new tab
      window.open(currentResult.image_url, '_blank', 'noopener,noreferrer')
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
    setActiveHistoryId(null)
    setError(null)
    setCopied(false)
  }, [])

  const handleClearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(HISTORY_KEY)
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
              <ImageIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">AI Image Generator</h1>
              <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">Powered by DALL-E</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Demo</Label>
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
        <HistorySidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(false)}
          history={history}
          onSelect={handleHistorySelect}
          activeId={activeHistoryId}
          onClear={handleClearHistory}
        />

        {/* Center Content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
              {/* Prompt Input Card */}
              <Card className="shadow-sm border-primary/10">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="relative">
                      <Textarea
                        placeholder="Describe the image you want to generate..."
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClear}
                          className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          disabled={loading}
                        >
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
                              <Wand2 className="h-4 w-4 mr-2" />
                              Generate Image
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
                <ImageResultDisplay
                  result={currentResult}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                  onRegenerate={handleRegenerate}
                  copied={copied}
                  loading={loading}
                  expanded={expanded}
                  onToggleExpand={() => setExpanded(!expanded)}
                />
              )}

              {/* Empty State */}
              {!loading && !currentResult && !error && <EmptyState />}

              {/* Agent Status */}
              <AgentStatusCard loading={loading} />
            </div>
          </ScrollArea>
        </main>

        {/* Parameter Panel */}
        <ParameterPanel
          isOpen={paramPanelOpen}
          onToggle={() => setParamPanelOpen(false)}
          params={params}
          onParamsChange={setParams}
        />
      </div>
    </div>
  )
}
