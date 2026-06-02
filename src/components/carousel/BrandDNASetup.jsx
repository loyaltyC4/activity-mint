/**
 * BrandDNASetup — 5-step brand DNA onboarding wizard.
 *
 * Shown when the user has no brand_dna record yet. Collects the minimum
 * context needed, then calls POST /api/brand-dna (which hits the Hetzner
 * cluster to scrape posts + profile + comments, then uses Claude to extract
 * tone, hooks, and audience pain points).
 *
 * Steps:
 *   1  Handle picker       — choose from tracked accounts or type a new one
 *   2  Niche picker        — 8 single-click cards
 *   3  Goal picker         — 4 single-click cards
 *   4  Customer (optional) — free text + 3 smart default chips
 *   5  Extracting          — animated progress bar, stage messages, success
 *
 * Uses shadcn: Card, CardHeader, CardTitle, CardDescription, CardContent,
 *              CardFooter, Button, Progress, Badge, Input
 */

'use strict'

import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Loader2, AtSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useTrackedAccount } from '../../context/TrackedAccountContext'
import { supabase } from '../../lib/supabase'

// ─── Static option data ──────────────────────────────────────────────────────

const NICHES = [
  { value: 'Beauty/Skincare',       emoji: '💄' },
  { value: 'Fashion/Style',          emoji: '👗' },
  { value: 'Food & Drink',           emoji: '🍽️' },
  { value: 'Fitness/Health',         emoji: '💪' },
  { value: 'Business/Finance',       emoji: '📈' },
  { value: 'E-commerce/Products',    emoji: '🛍️' },
  { value: 'Lifestyle',              emoji: '✨' },
  { value: 'Other',                  emoji: '🎯' },
]

const GOALS = [
  { value: 'Grow followers',    desc: 'Build a larger, engaged audience',     emoji: '👥' },
  { value: 'Drive product sales', desc: 'Convert followers into customers',    emoji: '💰' },
  { value: 'Build authority',   desc: 'Become the go-to expert in your niche', emoji: '🏆' },
  { value: 'Get leads',         desc: 'Fill your pipeline with qualified leads', emoji: '📧' },
]

const CUSTOMER_CHIPS = [
  'a creator aged 18–30',
  'a business owner',
  'a Shopify merchant',
]

const STAGE_MESSAGES = [
  'Analyzing your last 30 posts…',
  'Extracting your brand voice…',
  'Finding what makes your audience tick…',
  'Compiling your brand DNA…',
  'Almost there…',
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function BrandDNASetup({ onComplete }) {
  const { accounts, addAccount } = useTrackedAccount()

  const [step, setStep]                   = useState(1)
  const [handle, setHandle]               = useState('')
  const [customHandle, setCustomHandle]   = useState('')
  const [niche, setNiche]                 = useState('')
  const [goal, setGoal]                   = useState('')
  const [customerDesc, setCustomerDesc]   = useState('')
  const [progress, setProgress]           = useState(0)
  const [stageIdx, setStageIdx]           = useState(0)
  const [error, setError]                 = useState(null)
  const [done, setDone]                   = useState(false)

  const progressRef = useRef(null)
  const stageRef    = useRef(null)

  // Pre-select the current handle if there is one
  useEffect(() => {
    if (accounts.length > 0 && !handle) setHandle(accounts[0].username)
  }, [accounts])

  // Animated fake progress during extraction
  useEffect(() => {
    if (step !== 5) return
    // Progress inches toward 95, never quite getting there until the API responds
    progressRef.current = setInterval(() => {
      setProgress(p => p >= 95 ? p : p + (95 - p) * 0.06)
    }, 600)
    // Rotate stage messages every 7 seconds
    stageRef.current = setInterval(() => {
      setStageIdx(i => (i + 1) % STAGE_MESSAGES.length)
    }, 7000)
    return () => {
      clearInterval(progressRef.current)
      clearInterval(stageRef.current)
    }
  }, [step])

  function stopProgress() {
    clearInterval(progressRef.current)
    clearInterval(stageRef.current)
  }

  // ── Step navigation ────────────────────────────────────────────────────────

  function prev() { if (step > 1) setStep(s => s - 1) }

  function next() {
    if (step === 1 && !resolvedHandle()) return
    if (step === 2 && !niche) return
    if (step === 3 && !goal) return
    if (step < 5) setStep(s => s + 1)
    if (step === 4) startExtraction()
  }

  function resolvedHandle() {
    return handle === '__custom__' ? customHandle.replace('@', '').trim() : handle.trim()
  }

  // ── API call ───────────────────────────────────────────────────────────────

  async function startExtraction() {
    setStep(5)
    setError(null)
    setProgress(3)

    const cleanHandle = resolvedHandle()
    if (!cleanHandle) { setError('No handle selected'); setStep(4); return }

    // Ensure the handle is in the tracked accounts
    await addAccount(cleanHandle)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/brand-dna', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          handle:      cleanHandle,
          niche,
          goal,
          customerDesc: customerDesc.trim() || undefined,
        }),
      })

      stopProgress()

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Server error (HTTP ${res.status})`)
      }

      const { brandDNA } = await res.json()
      setProgress(100)
      setStageIdx(STAGE_MESSAGES.length - 1) // "Almost there" → done
      setDone(true)

      // Short pause so the user sees 100% before being forwarded
      setTimeout(() => onComplete(brandDNA), 1200)
    } catch (err) {
      stopProgress()
      setError(err.message)
      setStep(4)
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  const totalSteps = 5

  return (
    <div className="max-w-xl mx-auto py-8">

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1,2,3,4,5].map(n => (
          <div
            key={n}
            className={cn(
              'h-1.5 rounded-full transition-all',
              n < step  ? 'w-6 bg-primary'  :
              n === step ? 'w-8 bg-primary'  :
                           'w-4 bg-muted'
            )}
          />
        ))}
      </div>

      {/* ── Step 1: Handle ── */}
      {step === 1 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
                <AtSign className="size-4 text-primary" />
              </div>
              <Badge variant="outline" className="text-xs font-mono">Step 1 of 4</Badge>
            </div>
            <CardTitle className="text-xl">Which account should we analyze?</CardTitle>
            <CardDescription>
              We'll scrape the last 30 posts, comments, and profile to extract your brand DNA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Tracked accounts */}
            {accounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your accounts</p>
                {accounts.map(acc => (
                  <button
                    key={acc.username}
                    onClick={() => { setHandle(acc.username); setCustomHandle('') }}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                      handle === acc.username
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40 hover:bg-accent/50'
                    )}
                  >
                    <div className="size-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 grid place-items-center text-sm font-bold text-primary flex-shrink-0">
                      {acc.username[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">@{acc.username}</div>
                      {handle === acc.username && (
                        <div className="text-xs text-primary font-medium">Selected ✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Custom handle input */}
            <div className="space-y-1.5">
              {accounts.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Or analyze a different handle</p>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input
                    className="pl-7"
                    placeholder="handle"
                    value={customHandle}
                    onChange={e => {
                      const v = e.target.value.replace('@', '')
                      setCustomHandle(v)
                      if (v) setHandle('__custom__')
                      else if (accounts.length) setHandle(accounts[0].username)
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={next} disabled={!resolvedHandle()}>
              Continue <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Step 2: Niche ── */}
      {step === 2 && (
        <Card>
          <CardHeader className="pb-3">
            <Badge variant="outline" className="text-xs font-mono self-start mb-1">Step 2 of 4</Badge>
            <CardTitle className="text-xl">What's your niche?</CardTitle>
            <CardDescription>This shapes which trend signals and competitor patterns Claude uses.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5">
              {NICHES.map(n => (
                <button
                  key={n.value}
                  onClick={() => setNiche(n.value)}
                  className={cn(
                    'flex items-center gap-2.5 p-3.5 rounded-lg border text-left transition-all',
                    niche === n.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40 hover:bg-accent/50'
                  )}
                >
                  <span className="text-xl">{n.emoji}</span>
                  <span className="text-sm font-semibold leading-tight">{n.value}</span>
                </button>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" size="sm" onClick={prev}><ArrowLeft className="size-4 mr-1" /> Back</Button>
            <Button onClick={next} disabled={!niche}>
              Continue <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Step 3: Goal ── */}
      {step === 3 && (
        <Card>
          <CardHeader className="pb-3">
            <Badge variant="outline" className="text-xs font-mono self-start mb-1">Step 3 of 4</Badge>
            <CardTitle className="text-xl">What's your main goal?</CardTitle>
            <CardDescription>Claude tailors every carousel brief to drive this outcome.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {GOALS.map(g => (
              <button
                key={g.value}
                onClick={() => setGoal(g.value)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-all',
                  goal === g.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/40 hover:bg-accent/50'
                )}
              >
                <span className="text-2xl">{g.emoji}</span>
                <div>
                  <div className="text-sm font-semibold">{g.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{g.desc}</div>
                </div>
                {goal === g.value && (
                  <CheckCircle2 className="size-5 text-primary ml-auto flex-shrink-0" />
                )}
              </button>
            ))}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" size="sm" onClick={prev}><ArrowLeft className="size-4 mr-1" /> Back</Button>
            <Button onClick={next} disabled={!goal}>
              Continue <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── Step 4: Customer (optional) ── */}
      {step === 4 && (
        <Card>
          <CardHeader className="pb-3">
            <Badge variant="outline" className="text-xs font-mono self-start mb-1">Step 4 of 4 · Optional</Badge>
            <CardTitle className="text-xl">Who is your ideal customer?</CardTitle>
            <CardDescription>
              Helps Claude write copy that speaks directly to your audience. Skip if you're not sure yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-3 text-sm text-muted-foreground">My ideal customer is</span>
              <textarea
                value={customerDesc}
                onChange={e => setCustomerDesc(e.target.value)}
                placeholder="a solo founder who wants to grow their personal brand online…"
                rows={3}
                className="w-full pl-44 pt-3 pr-3 pb-3 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CUSTOMER_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => setCustomerDesc(chip)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border transition-all',
                    customerDesc === chip
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" size="sm" onClick={prev}><ArrowLeft className="size-4 mr-1" /> Back</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setCustomerDesc(''); next() }}>
                Skip
              </Button>
              <Button onClick={next}>
                Analyze @{resolvedHandle()} <Sparkles className="size-4 ml-1.5" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* ── Step 5: Extracting ── */}
      {step === 5 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              {done
                ? <><CheckCircle2 className="size-5 text-primary" /> Brand DNA ready!</>
                : <><Loader2 className="size-5 animate-spin text-primary" /> Analyzing @{resolvedHandle()}</>
              }
            </CardTitle>
            <CardDescription>
              {done
                ? 'Your brand voice, top hooks, and audience pain points have been extracted. Opening carousel studio…'
                : STAGE_MESSAGES[stageIdx]
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <Progress
              value={progress}
              className="h-2"
              indicatorClassName={done ? 'bg-primary' : 'bg-primary'}
            />
            <div className="space-y-2">
              {[
                { label: 'Posts scraped',         done: progress > 25 },
                { label: 'Brand voice extracted', done: progress > 55 },
                { label: 'Hook patterns found',   done: progress > 75 },
                { label: 'Audience pains mapped', done: progress > 90 },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2.5 text-sm">
                  {item.done
                    ? <CheckCircle2 className="size-4 text-primary flex-shrink-0" />
                    : <div className="size-4 rounded-full border-2 border-muted flex-shrink-0" />
                  }
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
