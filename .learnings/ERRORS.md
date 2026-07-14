## [ERR-20260713-001] control-in-app-browser

**Logged**: 2026-07-13T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
The in-app browser refused DOM inspection of the local `file://` mobile page.

### Error
```
Browser Use rejected this action because the local file URL is blocked by browser URL policy.
```

### Context
- Attempted to claim the already-open local mobile page and measure every screen's client and scroll heights.
- Target: `rebuild/mobile/index.html`.

### Suggested Fix
Serve the workspace from an approved local HTTP origin before browser-driven visual QA; otherwise use static layout inspection and non-browser checks.

### Metadata
- Reproducible: yes
- Related Files: mobile/index.html

---

## [ERR-20260714-003] web-live-site-open

**Logged**: 2026-07-14T16:30:00+08:00
**Priority**: low
**Status**: pending
**Area**: tests

### Summary
The web inspection tool refused to open the inferred GitHub Pages URL directly.

### Error
```
URL https://adong-portfolio.github.io/ is not safe to open.
```

### Context
- Attempted to verify the deployed theme-color markup after a mobile status-bar report.
- Local source and Git remote state remained available for inspection.

### Suggested Fix
Use an explicitly supplied deployment URL or verify the deployed response through an approved network command.

### Metadata
- Reproducible: unknown
- Related Files: index.html, mobile/index.html, manifest.webmanifest

---

## [ERR-20260714-002] git-push-network

**Logged**: 2026-07-14T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
The initial GitHub push failed because the sandbox could not resolve `github.com`.

### Error
```
fatal: unable to access repository: Could not resolve host: github.com
```

### Context
- Operation: `git push origin main`.
- The local commit completed successfully before the network failure.

### Suggested Fix
Retry the push with approved external network access.

### Metadata
- Reproducible: unknown
- Related Files: .learnings/ERRORS.md

---
