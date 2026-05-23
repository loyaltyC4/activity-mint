/**
 * NavigationContext lets dashboard panes navigate the parent App's
 * top-level tab router. ToolsPane uses it to redirect to the existing
 * live tool pages (StoryViewerView, PostViewerView, etc.) when a user
 * clicks a tool tile.
 */

'use strict'

import React, { createContext, useContext } from 'react'

export const NavigationContext = createContext({
  setActiveTab: () => {},
})

export const useNavigation = () => useContext(NavigationContext)
