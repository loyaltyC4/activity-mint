/**
 * Rewards — gamification: streak counter, XP bar, badge collection.
 * Placeholder Phase 2 scaffold; Phase 5 wires real activity tracking.
 */

'use strict'

import React from 'react'
import { Trophy, Flame, Award, Star, Heart, Camera, Crown } from 'lucide-react'

function PaneHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.6rem] font-extrabold tracking-tight">{title}</h1>
      <div className="mt-0.5 text-sm text-[#64756f]">{subtitle}</div>
    </div>
  )
}

const BADGES = [
  { Icon: Flame,  name: '12-day streak',     earned: true  },
  { Icon: Star,   name: 'First insight',     earned: true  },
  { Icon: Heart,  name: '100 saves',         earned: true  },
  { Icon: Award,  name: 'Best post',         earned: false },
  { Icon: Camera, name: '30 posts',          earned: false },
  { Icon: Crown,  name: 'Niche authority',   earned: false },
]

export default function RewardsPane() {
  const earned = BADGES.filter((b) => b.earned).length
  return (
    <>
      <PaneHeader title="Rewards" subtitle="Streak, XP and badges you've earned" />

      <div className="space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-lg">
              <Flame className="h-8 w-8" />
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight">12-day streak</div>
              <div className="text-sm text-[#64756f]">Don't lose it — log in tomorrow.</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-base font-bold">Level 3 · Creator</div>
              <div className="text-xs text-[#64756f]">320 / 500 XP to Level 4</div>
            </div>
            <Trophy className="h-5 w-5 text-amber-500" />
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#f0f4f3] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500" style={{ width: '64%' }} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-base font-bold">Badges</div>
              <div className="text-xs text-[#64756f]">{earned} of {BADGES.length} earned</div>
            </div>
            <Award className="h-5 w-5 text-amber-500" />
          </div>
          <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
            {BADGES.map((b, i) => {
              const Icon = b.Icon
              return (
                <div key={i} className="text-center">
                  <div
                    className={
                      b.earned
                        ? 'mx-auto grid h-[60px] w-[60px] place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-[0_10px_24px_-10px_rgba(244,63,94,0.35)]'
                        : 'mx-auto grid h-[60px] w-[60px] place-items-center rounded-2xl bg-[#f0f4f3] text-[#64756f] opacity-40 grayscale'
                    }
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-1.5 block text-[10px] text-[#64756f]">{b.name}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
