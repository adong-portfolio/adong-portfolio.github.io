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
