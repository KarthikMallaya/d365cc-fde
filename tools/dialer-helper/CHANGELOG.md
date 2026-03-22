# Changelog

All notable changes to D365 CCaaS Dialer Helper will be documented in this file.

## [3.3.6] - 2026-01-29

### Fixed
- **CRITICAL FIX**: Added missing ServiceNow domain checks in `isDialerFrame`
  - Was missing: `servicenow.com` and `service-now.com` checks
  - This caused early exit without retry when frame URL contained servicenow
  - Root cause: `isDialerFrame` checks were out of sync with `BUILT_IN_PATTERNS`
  - Added comments to remind keeping these in sync

## [3.3.5] - 2025-01-29

### Fixed
- **Popup URL List**: Synced `DEFAULT_URLS` in popup.js with `BUILT_IN_PATTERNS` in background.js
  - Added missing: `*.publix.io/*`, `*.service-now.com/*`, `*.servicenow.com/*`
  - Popup now correctly shows all 7 built-in URL patterns
  - Added comment reminding to keep these in sync

## [3.3.4] - 2025-01-29

### Fixed
- **Manual Fill for Transfer/Consult**: Expanded frame detection for Publix environment
  - Old: Only retried in frames with `chatcontrol` or `msdyn_` in URL
  - New: Also retries in frames with `azureedge.net`, `publix.`, `dynamics.com`, `dialer`
  - This was causing manual fill to skip Publix frames without retrying
  
### Changed
- Renamed `isChatControlFrame` → `isDialerFrame` for clarity
- Frame detection now matches the actual D365 CCaaS embed URLs

## [3.3.3] - 2025-01-29

### Fixed
- **Outbound Dialer Polling**: Fixed URL pattern matching in `pollForDialer()`
  - Pattern regex was not properly escaping special characters (dots)
  - `https://*.publix.io/*` now correctly matches ServiceNow URLs
  
### Improved
- Better debug logging in polling function with `debugMode` flag
- Logs matched pattern when URL is recognized
- Shows when dialer is found but already has a value

### Technical
- Fixed: `pattern.replace(/\*/g, '.*')` → proper regex escaping before glob conversion
- Poll now uses same `urlMatchesPattern()` logic as tab injection

## [3.3.2] - 2025-01-28

### Added
- **Publix.io Domain Support**: Added `*.publix.io/*` to manifest permissions
  - Covers CTI driver URLs like `cloudservices-stg.publix.io`
  - Ensures extension can access all Publix-related domains

### Fixed
- Added missing domain for Publix CTI driver integration
- Updated BUILT_IN_PATTERNS in background.js to include publix.io

### Technical
- Based on HTML analysis of actual Publix ServiceNow environment
- Confirmed iframe structure: ServiceNow → Shadow DOM → CCaaS iframe
- Extension should now inject into all required frames

## [3.3.1] - 2025-01-27

### Changed
- **Debug Toggle Integration**: Verbose diagnostics now controlled by popup debug setting
- Added `debugLog()` helper that checks DEBUG flag before logging
- Page context injection only runs when DEBUG is enabled
- Recursive iframe scanning only runs when DEBUG is enabled
- Normal operation logs minimal info; enable DEBUG for full diagnostics

## [3.3.0] - 2025-01-27

### Added
- **Page Context Injection**: Injects script that runs in actual page JS context
  - Bypasses content script isolation completely
  - Can access any DOM elements the page can access
- **Recursive Iframe Scanner**: Enumerates all iframes up to 5 levels deep
  - Reports accessible vs cross-origin iframes
  - Shows input elements in each accessible iframe
- Comprehensive diagnostic logging at intervals (checks 1, 3, 10, 30)

### Changed
- Enhanced detection with 4 strategies: ID, placeholder, ARIA, Shadow DOM
- Extended MutationObserver timeout to 60 seconds
- Better frame identification logging

## [3.2.2] - 2025-01-27

### Fixed
- **ServiceNow Domain Support**: Added `*.service-now.com` and `*.servicenow.com`
  - Critical fix for D365 embedded in ServiceNow (Publix use case)
  - Added to both `host_permissions` and `content_scripts.matches`

## [3.2.0] - 2025-01-26

### Added
- **Shadow DOM Piercing**: `deepQuerySelector`, `deepQuerySelectorAll`, `deepGetElementById`
  - Recursively searches through shadow roots
  - Finds elements hidden in web component shadow DOMs
- **MutationObserver**: Watches for dynamically added elements
  - Monitors document for 60 seconds after page load
  - Detects dialer elements that appear after initial render

## [3.0.0] - 2026-01-22

### Changed - MAJOR ARCHITECTURE REWRITE
- **Event-driven "Triggered Manual Fill" architecture**
  - Content script now ONLY detects user clicks (Transfer/Consult/Dialer buttons)
  - Background script does ALL the actual filling via `executeScript`
  - Uses the same proven mechanism as "Fill Now" button (which works perfectly)
  
### Why This Works
- `chrome.scripting.executeScript` with `allFrames: true` searches ALL frames
- This solves React/iframe/portal issues that plagued MutationObserver
- Zero polling overhead - only runs when user clicks a dialer button
- Content script is now ~250 lines (was 1200+)

### Technical Details
- Click detection uses event delegation on document
- 500ms delay after click to let dialog render
- Background handles retry logic inside injected function
- Same fill logic as manual fill (proven to work)

## [2.7.2] - 2026-01-22

### Fixed
- **Improved Fluent UI dropdown handling**: Better event sequence (mousedown → mouseup → click) to trigger country dropdown
- Added expand button detection for Fluent UI comboboxes
- Added keyboard navigation (ArrowDown) fallback for opening dropdowns
- Improved listbox selectors to support Fluent UI patterns (`.fui-Listbox`, `[class*="Listbox"]`)
- Added shadow DOM check for portal-based dropdowns
- Increased retry delays for slower Fluent UI rendering
- Better retry logic with keyboard navigation as last resort

## [2.7.1] - 2026-01-22

### Added
- **Custom URL Support**: Configure additional URLs where the extension should work
  - New "Allowed URLs" section in popup to manage custom URLs
  - Add/remove custom URL patterns (e.g., `https://*.azureedge.net/*`)
  - Built-in URL (`https://*.dynamics.com/*`) always enabled
  - Supports embedded widgets like `https://ccaas-embed-prod.azureedge.net/widget/...`
- Programmatic script injection for custom URLs via background script
- Optional host permissions for flexible URL support

### Changed
- Improved popup UI with wider layout (420-460px)
- Premium-styled "Add URL" button matching existing UI design
- Better error handling for Chrome storage API on custom URLs
- Reduced console logging noise for settings updates

### Fixed
- Chrome storage API safety checks for programmatically injected scripts
- Settings listener no longer triggers for irrelevant changes (customUrls)

## [2.6.0] - Previous Release

### Features
- Auto-populate country/region in D365 CCaaS external transfer dialer
- Support for Transfer/Consult and Outbound Dialer modes
- Configurable country and dial code settings
- Toast notifications for successful fills
- Field scanning and custom selector configuration
- Debug mode for troubleshooting

---

## Installation

### From GitHub (Manual)
1. Download the desired version from [Releases](../../releases)
2. Unzip the downloaded file
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the unzipped folder

### Updating
To update, download the new version and replace the existing folder, then refresh the extension.
