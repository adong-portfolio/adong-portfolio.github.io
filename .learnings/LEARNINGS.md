## [LRN-20260714-001] correction

**Logged**: 2026-07-14T07:50:20Z
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
Responsive icon containers and their SVG contents must both preserve a square aspect ratio during mobile viewport resizing.

### Details
Contact icons occasionally appeared compressed after the mobile browser chrome changed `visualViewport.height`. The layout recalculated a fractional icon size while several exported SVGs used `preserveAspectRatio="none"`, allowing their artwork to stretch during the resize and transition repaint.

### Suggested Action
Use `preserveAspectRatio="xMidYMid meet"` for icon SVGs, give circular containers explicit `aspect-ratio`, equal minimum dimensions and fixed flex basis, and transition only visual properties rather than `all`.

### Metadata
- Source: user_feedback
- Related Files: mobile/index.html, mobile/assets/contact/icon-*.svg
- Tags: svg, aspect-ratio, mobile-viewport, flexbox, icons
- Pattern-Key: frontend.mobile_icon_aspect_ratio_lock
- Recurrence-Count: 1
- First-Seen: 2026-07-14
- Last-Seen: 2026-07-14

### Resolution
- **Resolved**: 2026-07-14T07:50:20Z
- **Notes**: Locked icon, toggle and visual containers to square dimensions; removed size transitions; changed contact SVGs to centered proportional scaling; added cache-busting asset versions.

---

## [LRN-20260715-001] correction

**Logged**: 2026-07-15T16:37:25+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
Removing a simulated mobile status bar requires shifting independently positioned homepage decorations by the same design offset.

### Details
The homepage text flow moved upward when the 44px simulated status bar was hidden, but the absolutely positioned handwritten `Designer` arc kept its original Figma top coordinate. Its absolute coordinate was technically unchanged, yet it dropped from the title area to the subtitle area relative to the surrounding content.

### Suggested Action
When removing a fixed design spacer, audit absolute-positioned siblings separately; subtract the spacer from their base and responsive minimum coordinates while leaving browser-provided status-bar spacing untouched.

### Metadata
- Source: user_feedback
- Related Files: mobile/index.html
- Tags: mobile, absolute-position, status-bar, figma, responsive
- Pattern-Key: frontend.remove_spacer_adjust_absolute_siblings
- Recurrence-Count: 1
- First-Seen: 2026-07-15
- Last-Seen: 2026-07-15

### Resolution
- **Resolved**: 2026-07-15T16:37:25+08:00
- **Notes**: Shifted the homepage arc base coordinate from 102px to 58px and its short-screen minimum from 72px to 42px.

---

## [LRN-20260714-002] correction

**Logged**: 2026-07-14T17:05:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
In Quark, a black system status bar must not imply an immersive page layout underneath it.

### Details
`OPT:IMMERSIVE@1` successfully made the Quark status-bar region black, but it also placed the web page beneath the system time and icons. The requested behavior is a visible black status bar with the site header beginning below it. This adjustment must remain Quark-specific so WeChat and other browsers keep their existing spacing.

### Suggested Action
Use Quark's private black status-bar parameters with `OPT:IMMERSIVE@0`, and avoid global safe-area or padding changes when correcting a browser-specific container behavior.

### Metadata
- Source: user_feedback
- Related Files: index.html, mobile/index.html
- Tags: quark, status-bar, immersive, browser-specific, spacing
- Pattern-Key: frontend.browser_specific_status_bar_without_global_spacing
- Recurrence-Count: 1
- First-Seen: 2026-07-14
- Last-Seen: 2026-07-14

### Resolution
- **Resolved**: 2026-07-14T17:05:00+08:00
- **Notes**: Changed only the Quark container parameter from immersive to non-immersive while retaining the black status-bar color.

---
