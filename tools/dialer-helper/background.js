/**
 * D365 CCaaS Dialer Helper - Background Script
 * 
 * A Chrome extension that auto-fills the Country/Region field in the 
 * D365 Contact Center dialer during external transfers and outbound calls.
 * 
 * ARCHITECTURE: Background-driven polling
 * - Manual fill: Works via executeScript (always worked)
 * - Auto fill: Same executeScript, but triggered by polling
 * 
 * Why this works: executeScript can access ALL frames including
 * cross-origin iframes that content scripts cannot reach.
 * 
 * GitHub: https://github.com/microsoft/d365cc-fde
 * License: MIT
 */

const VERSION = "4.0.0";

// Default built-in URL patterns for D365 Contact Center
// Users can add custom URLs via the extension settings
const BUILT_IN_PATTERNS = [
  'https://*.dynamics.com/*',
  'https://ccaas-embed-prod.azureedge.net/*',
  'https://ccaas-embed-internal-prod.azureedge.net/*'
  // Add custom URLs via extension settings for customer-specific domains
];

// Track tabs where we've injected scripts for custom URLs
const injectedTabs = new Set();

// ===========================================
// AUTO-FILL POLLING STATE
// ===========================================
let pollingInterval = null;
let lastFillTime = 0;
const POLL_INTERVAL_MS = 2000;  // Check every 2 seconds
const FILL_COOLDOWN_MS = 5000;  // Don't re-fill within 5 seconds

// ===========================================
// FILL FUNCTION (injected into target frame)
// Now fills BOTH country AND phone number
// Handles Fluent UI v9 Combobox properly
// Uses custom field config if available
// isManual = true when triggered by "Fill Now" button
// ===========================================
function autoFillCountryAndPhone(countryName, dialCode, showToast, fieldConfig, isManual) {
  // Log prefix based on manual vs auto
  const LOG_PREFIX = isManual ? '📞 MANUAL FILL:' : '📞 AUTO-FILL:';
  const frameUrl = window.location.href;
  const frameUrlShort = frameUrl.length > 80 ? frameUrl.substring(0, 80) + '...' : frameUrl;
  
  console.log(LOG_PREFIX, 'Frame URL:', frameUrlShort);
  
  // Check if we're in a frame that might contain the dialer
  // Uses substring checks (not glob patterns) for frame URL detection
  const isDialerFrame = frameUrl.includes('chatcontrol') || 
                        frameUrl.includes('msdyn_') ||
                        frameUrl.includes('azureedge.net') ||
                        frameUrl.includes('dynamics.com') ||
                        frameUrl.includes('Dialer') ||
                        frameUrl.includes('dialer');
  
  console.log(LOG_PREFIX, 'isDialerFrame:', isDialerFrame);
  
  // Immediately check if element exists - SPECIFIC selectors only
  const quickCheck = fieldConfig && fieldConfig.countrySelector 
    ? document.getElementById(fieldConfig.countrySelector)
    : document.getElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id') ||
      document.querySelector('input[placeholder="Country/region"]');
  
  // DON'T use broad selectors - they match queue selection and other wrong fields
  
  console.log(LOG_PREFIX, 'Quick check found element:', !!quickCheck);
  
  // If not in dialer frame AND element not found, exit immediately (no retry)
  if (!isDialerFrame && !quickCheck) {
    return { found: false, frame: 'wrong-frame', url: frameUrlShort };
  }
  
  console.log(LOG_PREFIX, 'Starting for', countryName, dialCode);
  if (fieldConfig) {
    console.log(LOG_PREFIX, 'Using custom field config:', fieldConfig);
  }
  
  // Wait for element with retry (retry more in dialer frames)
  let attempts = 0;
  const maxAttempts = isDialerFrame ? 15 : 2;  // Only retry many times in dialer frame
  
  function tryFill() {
    attempts++;
    if (isDialerFrame && attempts <= 3) {
      console.log(LOG_PREFIX, 'Attempt', attempts);
    }
    
    // PRIORITY 1: Use custom config if available
    let countryInput = null;
    if (fieldConfig && fieldConfig.countrySelector) {
      countryInput = document.getElementById(fieldConfig.countrySelector);
      if (countryInput) {
        console.log(LOG_PREFIX, 'Found country via CUSTOM CONFIG:', fieldConfig.countrySelector);
      }
    }
    
    // PRIORITY 2: Fall back to auto-detection
    if (!countryInput) {
      // Try exact ID first
      countryInput = document.getElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id');
      
      // Try exact placeholder matches
      if (!countryInput) {
        countryInput = document.querySelector('input[placeholder="Country/region"]') ||
                      document.querySelector('input[placeholder="Country/region code"]');
      }
      
      // Fallback: Look for Country input that's NOT in a queue context
      if (!countryInput) {
        const candidates = document.querySelectorAll('input[placeholder*="Country" i]');
        for (const candidate of candidates) {
          // Skip if it's inside a queue selector context
          const parent = candidate.closest('[class*="queue" i], [id*="queue" i]');
          if (!parent) {
            countryInput = candidate;
            console.log(LOG_PREFIX, 'Found via fallback selector:', candidate.placeholder);
            break;
          }
        }
      }
      
      // Last resort: Any combobox with Country/region aria-label (but not queue)
      if (!countryInput) {
        const ariaInputs = document.querySelectorAll('[aria-label*="Country" i], [aria-label*="region" i]');
        for (const candidate of ariaInputs) {
          const isQueue = candidate.closest('[class*="queue" i], [id*="queue" i]') ||
                         (candidate.getAttribute('aria-label') || '').toLowerCase().includes('queue');
          if (!isQueue && candidate.tagName === 'INPUT') {
            countryInput = candidate;
            console.log(LOG_PREFIX, 'Found via aria-label fallback');
            break;
          }
        }
      }
    }
    
    if (!countryInput) {
      if (attempts < maxAttempts) {
        if (isDialerFrame) {
          console.log(LOG_PREFIX, 'Country element not found, retrying...');
        }
        setTimeout(tryFill, 300);
        return { found: false };
      }
      if (isDialerFrame) {
        console.log(LOG_PREFIX, 'Country element not found after', maxAttempts, 'attempts');
      }
      return { found: false };
    }
    
    console.log(LOG_PREFIX, 'Found country element!', countryInput);
    
    // Get the native value setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    
    // === SILENT APPROACH: Try to set value via React internals first ===
    // This avoids opening the dropdown visually
    
    let silentSuccess = false;
    
    // Method 1: Find the Combobox container and trigger onOptionSelect directly
    const comboboxContainer = countryInput.closest('[class*="Combobox"]') || 
                              countryInput.closest('[role="combobox"]') ||
                              countryInput.parentElement?.parentElement;
    
    if (comboboxContainer) {
      // Look for React fiber/props on container
      const fiberKey = Object.keys(comboboxContainer).find(k => k.startsWith('__reactFiber$'));
      const propsKey = Object.keys(comboboxContainer).find(k => k.startsWith('__reactProps$'));
      
      if (propsKey) {
        const props = comboboxContainer[propsKey];
        console.log(LOG_PREFIX, 'Found React props on combobox container');
        
        // Try onOptionSelect (Fluent UI v9 Combobox)
        if (props.onOptionSelect) {
          console.log(LOG_PREFIX, 'Calling onOptionSelect silently');
          try {
            props.onOptionSelect(null, { optionText: countryName, optionValue: countryName });
            silentSuccess = true;
          } catch (e) {
            console.log(LOG_PREFIX, 'onOptionSelect failed:', e.message);
          }
        }
        
        // Try onChange
        if (!silentSuccess && props.onChange) {
          console.log(LOG_PREFIX, 'Calling onChange silently');
          try {
            props.onChange(null, { value: countryName });
            silentSuccess = true;
          } catch (e) {
            console.log(LOG_PREFIX, 'onChange failed:', e.message);
          }
        }
      }
    }
    
    // Method 2: Try setting via input's React props
    if (!silentSuccess) {
      const inputPropsKey = Object.keys(countryInput).find(k => k.startsWith('__reactProps$'));
      if (inputPropsKey) {
        const inputProps = countryInput[inputPropsKey];
        if (inputProps?.onChange) {
          console.log(LOG_PREFIX, 'Calling input onChange silently');
          try {
            // Set value first
            nativeInputValueSetter.call(countryInput, countryName);
            // Then trigger onChange
            inputProps.onChange({ target: countryInput, currentTarget: countryInput });
            silentSuccess = true;
          } catch (e) {
            console.log(LOG_PREFIX, 'input onChange failed:', e.message);
          }
        }
      }
    }
    
    // Method 3: Direct value set + blur (simplest silent approach)
    if (!silentSuccess) {
      console.log(LOG_PREFIX, 'Trying direct value set (silent)');
      nativeInputValueSetter.call(countryInput, countryName);
      countryInput.dispatchEvent(new Event('input', { bubbles: true }));
      countryInput.dispatchEvent(new Event('change', { bubbles: true }));
      countryInput.blur();
      
      // Check if value stuck
      setTimeout(() => {
        if (countryInput.value === countryName) {
          console.log(LOG_PREFIX, '✅ Silent fill succeeded!');
          silentSuccess = true;
          fillPhoneNumber(dialCode, nativeInputValueSetter);
          if (showToast) {
            showSuccessToast(countryName, dialCode);
          }
        }
      }, 100);
    }
    
    // If silent approach worked, we're done
    if (silentSuccess) {
      console.log(LOG_PREFIX, '✅ Silent fill completed');
      setTimeout(() => {
        fillPhoneNumber(dialCode, nativeInputValueSetter);
        if (showToast) {
          showSuccessToast(countryName, dialCode);
        }
      }, 200);
      return { found: true, method: 'silent' };
    }
    
    // === FALLBACK: Open dropdown and select (visual approach) ===
    console.log(LOG_PREFIX, 'Silent approach failed, falling back to dropdown');
    
    // Step 1: Focus and click the input to open dropdown
    countryInput.focus();
    countryInput.click();
    
    // Step 2: Type the country name to filter
    nativeInputValueSetter.call(countryInput, countryName);
    countryInput.dispatchEvent(new InputEvent('input', {
      data: countryName,
      inputType: 'insertText',
      bubbles: true,
      composed: true
    }));
    
    // Also try React handler
    triggerReactInput(countryInput, countryName);
    
    console.log(LOG_PREFIX, 'Typed country name, waiting for dropdown...');
    
    // Step 3: Wait for dropdown and click option
    let dropdownAttempts = 0;
    const maxDropdownAttempts = 10;
    
    function selectFromDropdown() {
      dropdownAttempts++;
      
      // Look for listbox/dropdown
      const listbox = document.querySelector('[role="listbox"]') ||
                      document.querySelector('.fui-Listbox') ||
                      document.querySelector('[class*="Listbox"]');
      
      if (listbox) {
        console.log(LOG_PREFIX, 'Found dropdown listbox');
        
        const options = listbox.querySelectorAll('[role="option"], .fui-Option, [class*="Option"]');
        console.log(LOG_PREFIX, 'Found', options.length, 'options');
        
        // Find best matching option - prefer exact match
        let bestMatch = null;
        const searchName = countryName.toLowerCase().trim();
        
        for (const option of options) {
          const text = (option.textContent || '').toLowerCase().trim();
          
          // Exact match - highest priority
          if (text === searchName) {
            bestMatch = option;
            console.log(LOG_PREFIX, 'Found EXACT match:', option.textContent);
            break;
          }
          
          // Starts with full search term (e.g., "united states" starts with "united states")
          if (!bestMatch && text.startsWith(searchName)) {
            bestMatch = option;
            console.log(LOG_PREFIX, 'Found starts-with match:', option.textContent);
          }
        }
        
        if (bestMatch) {
          console.log(LOG_PREFIX, 'Clicking option:', bestMatch.textContent);
          bestMatch.click();
            
          // Also try mousedown/mouseup for React
          bestMatch.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          bestMatch.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            
          setTimeout(() => {
            countryInput.blur();
            console.log(LOG_PREFIX, '✅ Country selected!');
              
            // Now fill the phone number
            setTimeout(() => {
              fillPhoneNumber(dialCode, nativeInputValueSetter);
            }, 300);
              
            if (showToast) {
              showSuccessToast(countryName, dialCode);
            }
          }, 100);
          return;
        }
        
        console.log(LOG_PREFIX, 'No matching option found in dropdown');
      }
      
      if (dropdownAttempts < maxDropdownAttempts) {
        setTimeout(selectFromDropdown, 200);
      } else {
        console.log(LOG_PREFIX, 'Dropdown not found after', maxDropdownAttempts, 'attempts');
        // Try direct approach anyway
        countryInput.blur();
        fillPhoneNumber(dialCode, nativeInputValueSetter);
        if (showToast) {
          showSuccessToast(countryName, dialCode);
        }
      }
    }
    
    // Give dropdown time to appear
    setTimeout(selectFromDropdown, 300);
  }
  
  // Trigger React input handler
  function triggerReactInput(element, value) {
    // Check element and its ancestors for React props
    const targets = [element, element.parentElement, element.parentElement?.parentElement];
    
    for (const target of targets) {
      if (!target) continue;
      
      const reactPropsKey = Object.keys(target).find(key => key.startsWith('__reactProps$'));
      if (reactPropsKey) {
        const props = target[reactPropsKey];
        if (props?.onChange) {
          console.log(LOG_PREFIX, 'Triggering React onChange on', target.tagName);
          props.onChange({ target: { value }, currentTarget: { value } });
        }
        if (props?.onInput) {
          console.log(LOG_PREFIX, 'Triggering React onInput on', target.tagName);
          props.onInput({ target: { value }, currentTarget: { value } });
        }
      }
    }
  }
  
  // Function to fill phone number
  function fillPhoneNumber(dialCode, nativeSetter) {
    if (!dialCode) return;
    
    console.log(LOG_PREFIX, 'Looking for phone input...');
    
    // PRIORITY 1: Use custom config if available
    let phoneInput = null;
    if (fieldConfig && fieldConfig.phoneSelector) {
      phoneInput = document.getElementById(fieldConfig.phoneSelector);
      if (phoneInput) {
        console.log(LOG_PREFIX, 'Found phone via CUSTOM CONFIG:', fieldConfig.phoneSelector);
      }
    }
    
    // PRIORITY 2: Fall back to auto-detection
    if (!phoneInput) {
      phoneInput = document.getElementById('CRM-Omnichannel-Control-Dialer-nationalNumberInput-data-automation-id') ||
                   document.querySelector('input[placeholder="Type name/number"]') ||
                   document.querySelector('input[placeholder*="number"]') ||
                   document.querySelector('.fui-Input__input');
    }
    
    if (!phoneInput) {
      console.log(LOG_PREFIX, 'Phone input not found');
      return;
    }
    
    // Only fill if empty
    if (phoneInput.value && phoneInput.value.trim() !== '') {
      console.log(LOG_PREFIX, 'Phone input already has value, skipping');
      return;
    }
    
    console.log(LOG_PREFIX, 'Found phone input, filling with', dialCode);
    
    try {
      // Focus first
      phoneInput.focus();
      phoneInput.click();
      
      // Set value using native setter
      if (nativeSetter) {
        nativeSetter.call(phoneInput, dialCode);
      } else {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(phoneInput, dialCode);
      }
      
      // Dispatch input event
      phoneInput.dispatchEvent(new InputEvent('input', {
        data: dialCode,
        inputType: 'insertText',
        bubbles: true,
        composed: true
      }));
      
      // Try React handler on input and parents
      triggerReactInput(phoneInput, dialCode);
      
      phoneInput.blur();
      
      console.log(LOG_PREFIX, '✅ Phone number filled with', dialCode);
      
    } catch (e) {
      console.log(LOG_PREFIX, 'Phone fill error:', e.message);
    }
  }
  
  // Show success toast
  function showSuccessToast(country, dialCode) {
    try {
      const targetDoc = window.top.document;
      const existing = targetDoc.getElementById('d365-toast');
      if (existing) existing.remove();
      
      const toast = targetDoc.createElement('div');
      toast.id = 'd365-toast';
      toast.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999999;display:flex;align-items:stretch;min-width:320px;background:#323130;border-radius:4px;box-shadow:0 6px 14px rgba(0,0,0,.13);font-family:Segoe UI,sans-serif;overflow:hidden;animation:toastIn .3s ease';
      toast.innerHTML = '<div style="width:4px;background:#0078d4"></div><div style="display:flex;align-items:center;gap:12px;padding:12px 16px"><div style="width:20px;height:20px"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0078d4"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg></div><div><div style="font-size:14px;font-weight:600;color:#fff">Country/Region Selected</div><div style="font-size:12px;color:#d2d0ce">' + country + ' (' + dialCode + ')</div></div></div>';
      
      const style = targetDoc.createElement('style');
      style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:translateX(0)}}';
      targetDoc.head.appendChild(style);
      targetDoc.body.appendChild(toast);
      
      setTimeout(() => { toast.remove(); style.remove(); }, 2500);
    } catch(e) { console.log('📞 Toast error:', e); }
  }
  
  tryFill();
}

// ===========================================
// LISTEN FOR MESSAGES FROM POPUP AND CONTENT SCRIPT
// ===========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Manual fill from popup "Fill Now" button
  if (message.action === 'FILL_COUNTRY') {
    // For manual fill, use the country from message (popup passes it)
    fillCountryInAllFrames(message.countryName).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  // Automatic fill triggered by content script click detection
  // Background reads ALL settings from storage - content script just triggers
  if (message.action === 'AUTO_FILL') {
    console.log('📞 Auto-fill triggered via:', message.source);
    
    // Read settings fresh from storage
    chrome.storage.sync.get({
      countryName: 'United States',
      dialCode: '+1',
      enabled: true,
      enableTransfer: true,
      enableOutboundDialer: true,
      showToast: true,
      fieldConfig: null
    }).then(settings => {
      console.log('📞 Settings from storage:', settings.countryName, settings.dialCode);
      
      // Check master switch
      if (!settings.enabled) {
        console.log('📞 Auto-fill disabled (master switch off)');
        sendResponse({ found: false, disabled: true });
        return;
      }
      
      // Check if both Transfer AND Outbound are disabled
      if (!settings.enableTransfer && !settings.enableOutboundDialer) {
        console.log('📞 Auto-fill disabled (both Transfer and Outbound off)');
        sendResponse({ found: false, disabled: true });
        return;
      }
      
      fillCountryInAllFrames(settings.countryName).then(result => {
        console.log('📞 Auto-fill result:', result);
        sendResponse(result);
      });
    });
    return true;
  }
  
  if (message.action === 'URLS_UPDATED') {
    console.log('📞 Custom URLs updated:', message.customUrls);
    // Re-inject into current tab if needed
    injectIntoActiveTab();
    sendResponse({ success: true });
    return true;
  }
});

// ===========================================
// PROGRAMMATIC SCRIPT INJECTION FOR CUSTOM URLS
// ===========================================

// Check if URL matches any of our patterns (built-in or custom)
function urlMatchesPattern(url, patterns) {
  for (const pattern of patterns) {
    try {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
        .replace(/\*/g, '.*'); // Convert * to .*
      const regex = new RegExp('^' + regexPattern + '$', 'i');
      if (regex.test(url)) {
        return true;
      }
    } catch (e) {
      console.warn('Invalid pattern:', pattern, e);
    }
  }
  return false;
}

// Inject content script into a tab
async function injectContentScript(tabId) {
  try {
    // Check if already injected
    if (injectedTabs.has(tabId)) {
      return;
    }
    
    // Try to inject
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content/content.js']
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      files: ['content/content.css']
    });
    
    injectedTabs.add(tabId);
    console.log('📞 Injected content script into tab:', tabId);
  } catch (error) {
    // Might fail for chrome:// pages or pages without permission
    console.log('📞 Could not inject into tab:', tabId, error.message);
  }
}

// Inject into current active tab
async function injectIntoActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await injectContentScript(tab.id);
    }
  } catch (error) {
    console.log('📞 Error injecting into active tab:', error);
  }
}

// Listen for tab updates to inject scripts on custom URLs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }
  
  // Get custom URLs from storage
  const settings = await chrome.storage.sync.get({ customUrls: [] });
  const allPatterns = [...BUILT_IN_PATTERNS, ...settings.customUrls];
  
  // Check if this URL matches any pattern
  if (urlMatchesPattern(tab.url, allPatterns)) {
    // Inject our content script
    await injectContentScript(tabId);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

async function fillCountryInAllFrames(countryName, isManual = true) {
  console.log('📞 fillCountryInAllFrames called:', countryName, 'isManual:', isManual);
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('📞 Active tab:', tab?.id, tab?.url?.substring(0, 80));
    console.log('📞 Full tab URL:', tab?.url);  // Log full URL for debugging
    
    if (!tab) {
      console.log('📞 No active tab found');
      return { success: false, error: 'No active tab' };
    }
    
    // Read ALL relevant settings fresh from storage
    const settings = await chrome.storage.sync.get({ 
      dialCode: '+1', 
      showToast: true,
      fieldConfig: null 
    });
    console.log('📞 Settings loaded:', settings.dialCode, 'showToast:', settings.showToast);

    console.log('📞 Executing script in tab', tab.id, 'with allFrames: true');
    let results;
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: autoFillCountryAndPhone,
        args: [countryName, settings.dialCode, settings.showToast, settings.fieldConfig, isManual]
      });
    } catch (scriptError) {
      console.error('📞 executeScript FAILED:', scriptError.message);
      console.error('📞 This usually means missing host_permissions for the page or its iframes');
      return { success: false, error: scriptError.message };
    }
    
    console.log('📞 executeScript returned', results?.length, 'frame results');
    if (results) {
      results.forEach((r, i) => {
        console.log('📞 Frame', i, ':', r.result);
      });
    }

    const foundResult = results.find(r => r.result && r.result.found);
    console.log('📞 Found result:', !!foundResult);
    return { success: true, found: !!foundResult };

  } catch (error) {
    console.error('📞 Background error:', error);
    console.error('📞 Error stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// ===========================================
// AUTO-FILL POLLING - The bulletproof approach
// Uses same executeScript as manual fill
// ===========================================

// Check function that runs in page context (includes Shadow DOM piercing)
function checkDialerOpen() {
  const frameUrl = window.location.href;
  const frameUrlShort = frameUrl.substring(0, 80);
  
  // Shadow DOM helper functions
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
  
  // DEBUG: Log all inputs in this frame (normal + shadow)
  const normalInputs = document.querySelectorAll('input');
  const allInputs = deepQuerySelectorAll('input');
  const inputInfo = allInputs.slice(0, 10).map(i => ({
    id: i.id ? i.id.substring(0, 40) : '',
    placeholder: i.placeholder || '',
    type: i.type,
    inShadow: !document.contains(i)
  }));
  
  // Look for country/region input - prioritize specific selectors
  let countryInput = 
    document.getElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id') ||
    document.querySelector('input[placeholder="Country/region"]') ||
    document.querySelector('input[placeholder="Country/region code"]');
  
  // Fallback: Look for Country input that's NOT in a queue context  
  if (!countryInput) {
    const candidates = document.querySelectorAll('input[placeholder*="Country" i]');
    for (const candidate of candidates) {
      const parent = candidate.closest('[class*="queue" i], [id*="queue" i]');
      if (!parent) {
        countryInput = candidate;
        break;
      }
    }
  }
  
  // Fallback: Look for combobox role with Country in label
  if (!countryInput) {
    const comboboxes = document.querySelectorAll('[role="combobox"] input, input[role="combobox"]');
    for (const cb of comboboxes) {
      const label = cb.getAttribute('aria-label') || cb.placeholder || '';
      if (label.toLowerCase().includes('country') || label.toLowerCase().includes('region')) {
        countryInput = cb;
        break;
      }
    }
  }
  
  // Try Shadow DOM search if not found
  let foundViaShadow = false;
  if (!countryInput) {
    countryInput = deepGetElementById('CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id') ||
                   deepQuerySelector('input[placeholder="Country/region"]') ||
                   deepQuerySelector('input[placeholder*="Country" i]');
    if (countryInput) foundViaShadow = true;
  }
  
  if (!countryInput) {
    return { found: false, url: frameUrlShort, inputCount: normalInputs.length, shadowInputCount: allInputs.length - normalInputs.length, inputs: inputInfo };
  }
  
  // Check if already filled (has a value)
  const currentValue = countryInput.value || '';
  const isEmpty = currentValue.trim() === '';
  
  return { 
    found: true, 
    isEmpty: isEmpty,
    currentValue: currentValue,
    elementId: countryInput.id || countryInput.placeholder || 'unknown',
    url: frameUrlShort,
    inputCount: normalInputs.length,
    shadowInputCount: allInputs.length - normalInputs.length,
    foundViaShadow: foundViaShadow
  };
}

async function pollForDialer() {
  try {
    // Check if auto-fill is enabled
    const settings = await chrome.storage.sync.get({
      enabled: true,
      enableOutboundDialer: true,
      countryName: 'United States',
      debugMode: false
    });
    
    if (!settings.enabled || !settings.enableOutboundDialer) {
      return;
    }
    
    // Check cooldown
    const now = Date.now();
    if (now - lastFillTime < FILL_COOLDOWN_MS) {
      return;
    }
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      return;
    }
    
    // Only check on dynamics.com or custom URLs
    const customUrls = (await chrome.storage.sync.get({ customUrls: [] })).customUrls || [];
    const allPatterns = [...BUILT_IN_PATTERNS, ...customUrls];
    
    let matches = false;
    let matchedPattern = '';
    for (const pattern of allPatterns) {
      try {
        // Properly convert glob pattern to regex
        const regexPattern = pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
          .replace(/\*/g, '.*'); // Convert glob * to regex .*
        const regex = new RegExp('^' + regexPattern + '$', 'i');
        if (regex.test(tab.url)) {
          matches = true;
          matchedPattern = pattern;
          break;
        }
      } catch (e) {
        if (settings.debugMode) console.log('📞 Poll: Invalid pattern:', pattern);
      }
    }
    
    if (!matches) {
      // Log occasionally for debugging (every 30 seconds)
      if (settings.debugMode && now % 30000 < POLL_INTERVAL_MS) {
        console.log('📞 Poll: URL not matched:', tab.url.substring(0, 60));
      }
      return;
    }
    
    if (settings.debugMode) {
      console.log('📞 Poll: URL matched pattern:', matchedPattern);
    }
    
    // Check if dialer is open using executeScript
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: checkDialerOpen
    });
    
    // Log all frame results for debugging
    const frameResults = results.map(r => r.result).filter(r => r);
    const framesWithInputs = frameResults.filter(r => r.inputCount > 0);
    const framesWithDialer = frameResults.filter(r => r.found);
    
    if (settings.debugMode && framesWithInputs.length > 0) {
      console.log('📞 Poll: Frames with inputs:', framesWithInputs.length, 'Frames with dialer:', framesWithDialer.length);
      framesWithInputs.forEach(f => {
        console.log('   Frame:', f.url, 'inputs:', f.inputCount, 'found:', f.found, f.found ? ('empty:' + f.isEmpty + ' value:"' + f.currentValue + '"') : '');
      });
    }
    
    // Find a frame where dialer is open and empty
    const dialerFrame = results.find(r => r.result && r.result.found && r.result.isEmpty);
    
    if (dialerFrame) {
      console.log('📞 Poll: Dialer detected and empty, auto-filling...');
      lastFillTime = now;
      
      // Use the same fill function as manual
      await fillCountryInAllFrames(settings.countryName, false);
      console.log('📞 Poll: Auto-fill complete');
    } else if (settings.debugMode && framesWithDialer.length > 0) {
      // Dialer found but not empty - log this
      const filledDialer = framesWithDialer[0];
      console.log('📞 Poll: Dialer found but already has value:', filledDialer.currentValue);
    }
    
  } catch (error) {
    // Silently ignore errors (tab might have navigated, etc.)
  }
}

// Start polling when extension loads
function startPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  pollingInterval = setInterval(pollForDialer, POLL_INTERVAL_MS);
  console.log('📞 D365 Dialer Helper v' + VERSION + ' - Auto-fill polling started');
}

// Stop polling
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Listen for enable/disable changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.enabled) {
      if (changes.enabled.newValue) {
        startPolling();
      } else {
        stopPolling();
      }
    }
  }
});

// Start on load
chrome.storage.sync.get({ enabled: true }, (settings) => {
  if (settings.enabled) {
    startPolling();
  }
});
