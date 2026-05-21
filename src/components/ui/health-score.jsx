import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Progress } from "./progress"
import { Badge } from "./badge"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./tooltip"
import { Activity, BarChart2, Calendar, Sparkles, Info } from "lucide-react"

const gradeColors = {
  'A+': { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
  'A': { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
  'B+': { bg: 'bg-green-500', text: 'text-green-500', ring: 'ring-green-500/20' },
  'B': { bg: 'bg-lime-500', text: 'text-lime-500', ring: 'ring-lime-500/20' },
  'C+': { bg: 'bg-yellow-500', text: 'text-yellow-500', ring: 'ring-yellow-500/20' },
  'C': { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/20' },
  'D': { bg: 'bg-orange-500', text: 'text-orange-500', ring: 'ring-orange-500/20' },
  'F': { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/20' },
  '--': { bg: 'bg-slate-400', text: 'text-slate-400', ring: 'ring-slate-400/20' },
}

const ScoreRing = ({ grade, score, size = 140 }) => {
  const colors = gradeColors[grade] || gradeColors['--']
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn("transition-all duration-1000 ease-out", colors.bg.replace('bg-', 'stroke-'))}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-black", colors.text)}>{grade}</span>
        <span className="text-sm text-muted-foreground font-medium">{score}/100</span>
      </div>
    </div>
  )
}

const MetricBar = ({ icon: Icon, label, value, max, tooltip }) => {
  const percentage = Math.min((value / max) * 100, 100)

  const content = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-4 h-4" />
          <span className="font-medium">{label}</span>
        </div>
        <span className="font-bold text-foreground">{value}/{max}</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{content}</div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
}

const HealthScoreCard = ({ grade, score, breakdown, className }) => {
  const { erScore = 0, ratioScore = 0, consistencyScore = 0, profileScore = 0 } = breakdown || {}

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-5 h-5 text-primary" />
          Account Health Score
          <Badge variant="secondary" className="ml-auto font-semibold">
            {grade}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing grade={grade} score={score} />
          <div className="flex-1 w-full space-y-4">
            <MetricBar
              icon={BarChart2}
              label="Engagement"
              value={erScore}
              max={40}
              tooltip="Based on your engagement rate compared to accounts of similar size"
            />
            <MetricBar
              icon={Activity}
              label="Follower Ratio"
              value={ratioScore}
              max={20}
              tooltip="Healthy accounts typically have more followers than following"
            />
            <MetricBar
              icon={Calendar}
              label="Consistency"
              value={consistencyScore}
              max={20}
              tooltip="Regular posting improves algorithm visibility"
            />
            <MetricBar
              icon={Sparkles}
              label="Profile Quality"
              value={profileScore}
              max={20}
              tooltip="Complete profiles with bio, picture, and verification"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { HealthScoreCard, ScoreRing, MetricBar }
