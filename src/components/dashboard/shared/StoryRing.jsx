/**
 * Story ring used in the Pulse pane's Active Stories carousel.
 * Conic-gradient ring around a circular thumbnail. Greyed when seen.
 */

'use strict'

import React from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function StoryRing({ thumb, label, seen, addNew, onClick }) {
  if (addNew) {
    return (
      <div className="text-center opacity-50">
        <button
          type="button"
          onClick={onClick}
          className="grid h-[54px] w-[54px] cursor-pointer place-items-center rounded-full border-2 border-dashed border-[#e0eae7] text-xl"
        >
          <Plus className="h-5 w-5 text-[#64756f]" />
        </button>
        {label && <div className="mt-1 text-[10px] text-[#64756f]">{label}</div>}
      </div>
    )
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'block h-[54px] w-[54px] shrink-0 cursor-pointer rounded-full p-[3px]',
          seen
            ? 'bg-[#f0f4f3]'
            : '[background:conic-gradient(theme(colors.teal.500),theme(colors.violet.600),theme(colors.rose.500),theme(colors.teal.500))]'
        )}
      >
        <div className="grid h-full w-full place-items-center rounded-full border-2 border-white bg-white text-xl">
          {typeof thumb === 'string' ? thumb : thumb}
        </div>
      </button>
      {label && <div className="mt-1 text-[10px] text-[#64756f]">{label}</div>}
    </div>
  )
}
