/**
 * D365 CCaaS Dialer Helper - Content Script v3.3.6
 * 
 * WORLD-CLASS FIX:
 * 1. Shadow DOM piercing
 * 2. MutationObserver for dynamic elements
 * 3. Page context injection (bypasses content script isolation)
 * 4. Recursive iframe enumeration
 * 5. Comprehensive diagnostic logging (controlled by debug toggle)
 */

(function() {
  "use strict";
  
  const VERSION = '3.3.5';
  const url = window.location.href;
  const isTopFrame = window === window.top;
  
  // Debug mode - will be loaded from storage
  let DEBUG = false;
  
  // Helper for conditional logging
  function debugLog(...args) {
    if (DEBUG) console.log(...args);
  }
  
  // Load debug setting from storage
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get({ debug: false }, (settings) => {
      DEBUG = settings.debug;
      if (DEBUG) {
        console.log('📞 Debug mode enabled via settings');
      }
    });
  }
  
  // Log with frame context (always show version load)
  const frameInfo = isTopFrame ? 'TOP' : 'IFRAME';
  const urlShort = url.length > 80 ? url.substring(0, 80) + '...' : url;
  
  console.log(
    '%c📞 D365 Dialer Helper v' + VERSION + ' loaded [' + frameInfo + ']',
    'background: #0078d4; color: white; padding: 2px 6px; border-radius: 3px;',
    '\n   URL:', urlShort
  );
  
  // Check if this looks like the D365 dialer frame
  const isChatControl = url.includes('chatcontrol') || url.includes('msdyn_');
  const isDynamics = url.includes('dynamics.com');
  const isAzureCDN = url.includes('azureedge.net');
  const isRelevantFrame = isDynamics || isAzureCDN || isChatControl;
  
  if (isChatControl) {
    console.log('%c📞 TARGET FRAME DETECTED (chatcontrol)', 'background: #107c10; color: white; padding: 2px 6px; border-radius: 3px;');
  }
  
  if (isDynamics || isAzureCDN) {
    console.log('📞 D365/Azure frame - extension active');
  }
  
  // ===========================================
  // PAGE CONTEXT INJECTION - Bypasses content script isolation
  // This runs in the actual page context with full DOM access
  // Only runs when DEBUG is enabled
  // ===========================================
  function injectPageScript() {
    if (!DEBUG) return; // Skip if debug disabled
    
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        const VERSION = '3.3.5-injected';
        
        // Comprehensive diagnostic - find ALL inputs everywhere
        function deepScanForInputs() {
          const results = {
            normalInputs: [],
            shadowInputs: [],
            iframeCount: 0,
            accessibleIframes: 0
          };
          
          // Scan normal DOM
          document.querySelectorAll('input').forEach(inp => {
            results.normalInputs.push({
              id: inp.id || '',
              placeholder: inp.placeholder || '',
              type: inp.type,
              'aria-label': inp.getAttribute('aria-label') || ''
            });
          });
          
          // Scan shadow DOM
          function scanShadowRoots(root) {
            root.querySelectorAll('*').forEach(el => {
              if (el.shadowRoot) {
                el.shadowRoot.querySelectorAll('input').forEach(inp => {
                  results.shadowInputs.push({
                    id: inp.id || '',
                    placeholder: inp.placeholder || '',
                    type: inp.type,
                    host: el.tagName
                  });
                });
                scanShadowRoots(el.shadowRoot);
              }
            });
          }
          scanShadowRoots(document);
          
          // Count iframes and try to access them
          document.querySelectorAll('iframe').forEach(iframe => {
            results.iframeCount++;
            try {
              if (iframe.contentDocument) {
                results.accessibleIframes++;
              }
            } catch(e) {}
          });
          
          return results;
        }
        
        // Run diagnostic and log results
        setTimeout(() => {
          const scan = deepScanForInputs();
          console.log('%c📞 [PAGE CONTEXT] Deep scan results:', 'background: #5c2d91; color: white; padding: 2px 6px;');
          console.log('   Normal inputs:', scan.normalInputs.length);
          console.log('   Shadow inputs:', scan.shadowInputs.length);
          console.log('   Iframes:', scan.iframeCount, '(accessible:', scan.accessibleIframes + ')');
          
          if (scan.normalInputs.length > 0) {
            console.log('   First 5 normal inputs:');
            scan.normalInputs.slice(0, 5).forEach((inp, i) => {
              console.log('     [' + i + '] id:', inp.id || '(none)', 'placeholder:', inp.placeholder || '(none)');
            });
          }
          
          if (scan.shadowInputs.length > 0) {
            console.log('   Shadow inputs:');
            scan.shadowInputs.forEach((inp, i) => {
              console.log('     [SHADOW ' + i + '] id:', inp.id || '(none)', 'placeholder:', inp.placeholder || '(none)', 'host:', inp.host);
            });
          }
          
          // Look specifically for our target elements
          const countryById = document.getElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id');
          const countryByPlaceholder = document.querySelector('input[placeholder*="Country" i]');
          const phoneByPlaceholder = document.querySelector('input[placeholder*="number" i]');
          
          if (countryById || countryByPlaceholder || phoneByPlaceholder) {
            console.log('%c📞 [PAGE CONTEXT] TARGET ELEMENTS FOUND!', 'background: #107c10; color: white; padding: 2px 6px;');
            if (countryById) console.log('   Country (by ID):', countryById.id);
            if (countryByPlaceholder) console.log('   Country (by placeholder):', countryByPlaceholder.placeholder);
            if (phoneByPlaceholder) console.log('   Phone (by placeholder):', phoneByPlaceholder.placeholder);
          }
        }, 2000);
        
        // Also watch for dynamic changes
        const observer = new MutationObserver(() => {
          const country = document.getElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id') ||
                         document.querySelector('input[placeholder*="Country" i]');
          if (country && !window.__d365DialerFound) {
            window.__d365DialerFound = true;
            console.log('%c📞 [PAGE CONTEXT] Dialer appeared dynamically!', 'background: #107c10; color: white; padding: 2px 6px;');
            console.log('   Element:', country.id || country.placeholder);
          }
        });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
        
        // Stop after 60 seconds
        setTimeout(() => observer.disconnect(), 60000);
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    console.log('📞 Page context script injected');
  }
  
  // ===========================================
  // SHADOW DOM PIERCING - Search through shadow roots
  // ===========================================
  function deepQuerySelector(selector, root = document) {
    let element = root.querySelector(selector);
    if (element) return element;
    
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        element = deepQuerySelector(selector, el.shadowRoot);
        if (element) return element;
      }
    }
    return null;
  }
  
  function deepQuerySelectorAll(selector, root = document, results = []) {
    const found = root.querySelectorAll(selector);
    results.push(...found);
    
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        deepQuerySelectorAll(selector, el.shadowRoot, results);
      }
    }
    return results;
  }
  
  function deepGetElementById(id, root = document) {
    if (root === document) {
      const element = document.getElementById(id);
      if (element) return element;
    } else {
      try {
        const element = root.querySelector('#' + CSS.escape(id));
        if (element) return element;
      } catch (e) {}
    }
    
    const allElements = root.querySelectorAll('*');
    for (const el of allElements) {
      if (el.shadowRoot) {
        const found = deepGetElementById(id, el.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }
  
  // ===========================================
  // RECURSIVE IFRAME SCANNER - Try to access nested iframes (DEBUG only)
  // ===========================================
  function scanAllIframes(win = window, depth = 0) {
    if (!DEBUG) return; // Skip if debug disabled
    if (depth > 5) return; // Prevent infinite recursion
    
    const prefix = '  '.repeat(depth);
    
    try {
      const iframes = win.document.querySelectorAll('iframe');
      iframes.forEach((iframe, i) => {
        const src = iframe.src || iframe.getAttribute('src') || 'about:blank';
        const srcShort = src.length > 60 ? src.substring(0, 60) + '...' : src;
        
        try {
          if (iframe.contentDocument) {
            const inputs = iframe.contentDocument.querySelectorAll('input');
            debugLog(prefix + '📞 [iframe ' + i + '] ' + srcShort + ' - ' + inputs.length + ' inputs (ACCESSIBLE)');
            
            inputs.forEach((inp, j) => {
              if (j < 3) {
                debugLog(prefix + '   [' + j + '] id:', inp.id || '(none)', 'placeholder:', inp.placeholder || '(none)');
              }
            });
            
            // Recurse into this iframe
            if (iframe.contentWindow) {
              scanAllIframes(iframe.contentWindow, depth + 1);
            }
          } else {
            debugLog(prefix + '📞 [iframe ' + i + '] ' + srcShort + ' - CROSS-ORIGIN (no access)');
          }
        } catch (e) {
          debugLog(prefix + '📞 [iframe ' + i + '] ' + srcShort + ' - BLOCKED: ' + e.message);
        }
      });
    } catch (e) {
      debugLog(prefix + '📞 Frame scan error:', e.message);
    }
  }

  // ===========================================
  // ELEMENT DETECTION - Uses multiple strategies
  // ===========================================
  function findDialerElements() {
    // Strategy 1: Direct ID lookup
    let countryInput = document.getElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id');
    let phoneInput = document.getElementById('CRM-Omnichannel-Control-Dialer-nationalNumberInput-data-automation-id');
    
    // Strategy 2: Placeholder matching
    if (!countryInput) {
      countryInput = document.querySelector('input[placeholder="Country/region"]') ||
                     document.querySelector('input[placeholder*="Country" i]');
    }
    
    if (!phoneInput) {
      phoneInput = document.querySelector('input[placeholder="Type name/number"]') ||
                   document.querySelector('input[placeholder*="name/number" i]') ||
                   document.querySelector('input[placeholder*="Type number" i]');
    }
    
    // Strategy 3: ARIA attributes
    if (!countryInput) {
      const comboInputs = document.querySelectorAll('[role="combobox"] input, input[aria-expanded]');
      for (const inp of comboInputs) {
        const label = inp.getAttribute('aria-label') || inp.placeholder || '';
        if (label.toLowerCase().includes('country') || label.toLowerCase().includes('region')) {
          countryInput = inp;
          break;
        }
      }
    }
    
    // Strategy 4: Shadow DOM search
    if (!countryInput) {
      countryInput = deepGetElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id') ||
                     deepQuerySelector('input[placeholder="Country/region"]') ||
                     deepQuerySelector('input[placeholder*="Country" i]');
      if (countryInput) {
        console.log('📞 Found country input via SHADOW DOM!');
      }
    }
    
    if (!phoneInput) {
      phoneInput = deepGetElementById('CRM-Omnichannel-Control-Dialer-nationalNumberInput-data-automation-id') ||
                   deepQuerySelector('input[placeholder="Type name/number"]') ||
                   deepQuerySelector('input[placeholder*="name/number" i]');
      if (phoneInput) {
        console.log('📞 Found phone input via SHADOW DOM!');
      }
    }
    
    return { countryInput, phoneInput };
  }
  
  // ===========================================
  // MUTATION OBSERVER - Watch for dynamically added elements
  // ===========================================
  let observerActive = false;
  let elementsFound = false;
  
  function startMutationObserver() {
    if (observerActive || elementsFound) return;
    observerActive = true;
    
    const observer = new MutationObserver((mutations) => {
      if (elementsFound) {
        observer.disconnect();
        return;
      }
      
      const { countryInput, phoneInput } = findDialerElements();
      
      if (countryInput || phoneInput) {
        elementsFound = true;
        observer.disconnect();
        console.log('%c📞 DIALER ELEMENTS FOUND (via MutationObserver)!', 'background: #107c10; color: white; padding: 2px 6px;');
        console.log('   Frame URL:', urlShort);
        if (countryInput) console.log('   Country input ID:', countryInput.id);
        if (countryInput) console.log('   Country input placeholder:', countryInput.placeholder);
        if (phoneInput) console.log('   Phone input ID:', phoneInput.id);
        if (phoneInput) console.log('   Phone input placeholder:', phoneInput.placeholder);
      }
    });
    
    observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true 
    });
    
    setTimeout(() => {
      if (!elementsFound) {
        observer.disconnect();
        observerActive = false;
        debugLog('📞 MutationObserver timeout - no dialer elements detected in this frame');
      }
    }, 60000);
    
    debugLog('📞 MutationObserver started');
  }
  
  // ===========================================
  // PERIODIC CHECK + COMPREHENSIVE LOGGING
  // ===========================================
  let checkCount = 0;
  const checkInterval = setInterval(() => {
    checkCount++;
    
    const { countryInput, phoneInput } = findDialerElements();
    
    // Comprehensive logging at key intervals (DEBUG only for verbose logs)
    if (isRelevantFrame && DEBUG && (checkCount === 1 || checkCount === 3 || checkCount === 10 || checkCount === 30)) {
      const normalInputs = document.querySelectorAll('input');
      const allInputs = deepQuerySelectorAll('input');
      const shadowInputs = allInputs.length - normalInputs.length;
      const iframeCount = document.querySelectorAll('iframe').length;
      
      debugLog('📞 Frame scan #' + checkCount + ' [' + urlShort.substring(0, 40) + ']');
      debugLog('   Inputs:', normalInputs.length, 'normal +', shadowInputs, 'shadow | Iframes:', iframeCount);
      
      if (allInputs.length > 0) {
        allInputs.slice(0, 5).forEach((inp, i) => {
          const inShadow = !document.contains(inp) ? ' [SHADOW]' : '';
          debugLog('   [' + i + ']' + inShadow, 'id:', inp.id ? inp.id.substring(0, 40) : '(none)', 'ph:', inp.placeholder || '(none)');
        });
      }
      
      // On first scan, also enumerate iframes (DEBUG only)
      if (checkCount === 1 && iframeCount > 0) {
        debugLog('📞 Scanning nested iframes...');
        scanAllIframes();
      }
    }
    
    if (countryInput || phoneInput) {
      elementsFound = true;
      console.log('%c📞 DIALER ELEMENTS FOUND!', 'background: #107c10; color: white; padding: 2px 6px;');
      console.log('   Frame URL:', urlShort);
      if (countryInput) console.log('   Country:', countryInput.id || countryInput.placeholder);
      if (phoneInput) console.log('   Phone:', phoneInput.id || phoneInput.placeholder);
      clearInterval(checkInterval);
    }
    
    if (checkCount >= 60) {
      clearInterval(checkInterval);
      debugLog('📞 Scan complete - no dialer elements in this frame');
    }
  }, 1000);
  
  // ===========================================
  // INITIALIZE ALL DETECTION METHODS
  // ===========================================
  if (isRelevantFrame) {
    startMutationObserver();
    // Inject page context script for deepest access (DEBUG only)
    setTimeout(() => injectPageScript(), 500);
  }
})();
