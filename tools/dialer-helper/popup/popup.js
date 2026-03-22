/**
 * D365 CCaaS Dialer Helper - Popup Script v3.3.4
 */

// Default built-in URLs that are always enabled
// MUST stay in sync with BUILT_IN_PATTERNS in background.js
const DEFAULT_URLS = [
  { pattern: 'https://*.dynamics.com/*', builtin: true, enabled: true },
  { pattern: 'https://ccaas-embed-prod.azureedge.net/*', builtin: true, enabled: true },
  { pattern: 'https://ccaas-embed-internal-prod.azureedge.net/*', builtin: true, enabled: true },
  { pattern: 'https://*.publix.com/*', builtin: true, enabled: true },
  { pattern: 'https://*.publix.io/*', builtin: true, enabled: true },
  { pattern: 'https://*.service-now.com/*', builtin: true, enabled: true },
  { pattern: 'https://*.servicenow.com/*', builtin: true, enabled: true }
];

document.addEventListener("DOMContentLoaded", () => {
  const enabledToggle = document.getElementById("enabledToggle");
  // Transfer/Consult toggles
  const enableTransferToggle = document.getElementById("enableTransferToggle");
  const transferFillCountryToggle = document.getElementById("transferFillCountryToggle");
  const transferFillDialCodeToggle = document.getElementById("transferFillDialCodeToggle");
  // Outbound Dialer toggles
  const enableOutboundDialerToggle = document.getElementById("enableOutboundDialerToggle");
  const outboundFillCountryToggle = document.getElementById("outboundFillCountryToggle");
  const outboundFillDialCodeToggle = document.getElementById("outboundFillDialCodeToggle");
  // Other toggles
  const toastToggle = document.getElementById("toastToggle");
  const debugToggle = document.getElementById("debugToggle");
  const countrySelect = document.getElementById("countrySelect");
  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("statusText");
  const versionEl = document.getElementById("version");
  const fillNowBtn = document.getElementById("fillNowBtn");
  const scanBtn = document.getElementById("scanBtn");
  const scanResults = document.getElementById("scanResults");
  const scanResultsContent = document.getElementById("scanResultsContent");
  const closeScanResults = document.getElementById("closeScanResults");
  const saveConfigBtn = document.getElementById("saveConfigBtn");
  const clearConfigBtn = document.getElementById("clearConfigBtn");
  const countryFieldValue = document.getElementById("countryFieldValue");
  const phoneFieldValue = document.getElementById("phoneFieldValue");
  // URL configuration
  const urlList = document.getElementById("urlList");
  const newUrlInput = document.getElementById("newUrlInput");
  const addUrlBtn = document.getElementById("addUrlBtn");

  // Display version from manifest
  const manifest = chrome.runtime.getManifest();
  versionEl.textContent = manifest.version;

  // Field configuration state
  let fieldConfig = {
    countrySelector: null,
    countryFrame: null,
    phoneSelector: null,
    phoneFrame: null
  };
  
  // Scanned elements for selection
  let scannedElements = [];

  // Default settings
  const DEFAULT_SETTINGS = {
    countryName: "United States",
    dialCode: "+1",
    enabled: true,
    // Transfer/Consult settings
    enableTransfer: true,
    transferFillCountry: true,
    transferFillDialCode: true,
    // Outbound Dialer settings
    enableOutboundDialer: true,
    outboundFillCountry: true,
    outboundFillDialCode: false,  // Off by default - D365 usually auto-fills this
    // Other settings
    showToast: true,
    debug: false,
    fieldConfig: null,
    customUrls: []  // User-added custom URLs
  };

  // Current URLs (built-in + custom)
  let allUrls = [...DEFAULT_URLS];

  // Populate country dropdown
  function populateCountries() {
    countrySelect.innerHTML = "";
    
    COUNTRIES.forEach((country) => {
      const option = document.createElement("option");
      option.value = country.name;
      // Don't include flag emoji in dropdown - it doesn't render well on Windows
      // The flag is shown prominently in the preview section below
      option.textContent = country.disabled 
        ? country.name 
        : `${country.name} (${country.code})`;
      option.disabled = country.disabled || false;
      countrySelect.appendChild(option);
    });
  }

  // Update status indicator
  function updateStatus(enabled, message) {
    if (message) {
      statusText.textContent = message;
    } else if (enabled) {
      statusEl.classList.remove("disabled");
      statusText.textContent = "Ready";
    } else {
      statusEl.classList.add("disabled");
      statusText.textContent = "Disabled";
    }
  }

  // ========================================
  // URL MANAGEMENT FUNCTIONS
  // ========================================
  
  // Render the URL list
  function renderUrlList() {
    console.log('Rendering URL list, allUrls:', allUrls);
    urlList.innerHTML = '';
    
    if (!allUrls || allUrls.length === 0) {
      urlList.innerHTML = '<div class="url-empty">No URLs configured</div>';
      return;
    }
    
    allUrls.forEach((urlConfig, index) => {
      const urlItem = document.createElement('div');
      urlItem.className = `url-item ${urlConfig.builtin ? 'builtin' : 'custom'}`;
      
      urlItem.innerHTML = `
        <div class="url-pattern">
          <span class="url-text">${urlConfig.pattern}</span>
          ${urlConfig.builtin ? '<span class="url-badge builtin">Built-in</span>' : '<span class="url-badge custom">Custom</span>'}
        </div>
        <div class="url-actions">
          ${!urlConfig.builtin ? `<button class="url-delete-btn" data-index="${index}" title="Remove URL">×</button>` : ''}
        </div>
      `;
      
      urlList.appendChild(urlItem);
    });
    
    // Add event listeners for delete buttons
    urlList.querySelectorAll('.url-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        removeCustomUrl(index);
      });
    });
  }
  
  // Add a new custom URL
  async function addCustomUrl() {
    const pattern = newUrlInput.value.trim();
    console.log('Adding URL:', pattern);
    
    // Immediate feedback
    updateStatus(true, 'Adding URL...');
    addUrlBtn.disabled = true;
    
    if (!pattern) {
      updateStatus(true, 'Please enter a URL pattern');
      addUrlBtn.disabled = false;
      setTimeout(() => updateStatus(enabledToggle.checked), 2000);
      return;
    }
    
    // Validate URL pattern
    if (!isValidUrlPattern(pattern)) {
      console.log('Invalid URL pattern:', pattern);
      updateStatus(true, 'Invalid URL pattern');
      addUrlBtn.disabled = false;
      setTimeout(() => updateStatus(enabledToggle.checked), 2000);
      return;
    }
    
    // Check for duplicates
    if (allUrls.some(u => u.pattern === pattern)) {
      console.log('URL already exists:', pattern);
      updateStatus(true, 'URL already exists');
      addUrlBtn.disabled = false;
      setTimeout(() => updateStatus(enabledToggle.checked), 2000);
      return;
    }
    
    // Request permission for the new URL (optional - we'll add even if it fails)
    console.log('Requesting permission...');
    try {
      await requestUrlPermission(pattern);
    } catch (e) {
      console.log('Permission request failed, continuing anyway:', e);
    }
    
    // Add to allUrls array first
    allUrls.push({ pattern, builtin: false, enabled: true });
    console.log('Added to allUrls:', allUrls);
    
    // Get all custom URLs (non-builtin) and save
    const customUrls = allUrls.filter(u => !u.builtin).map(u => u.pattern);
    console.log('Saving custom URLs:', customUrls);
    
    // Save to storage
    chrome.storage.sync.set({ customUrls }, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        updateStatus(true, 'Error saving URL');
        addUrlBtn.disabled = false;
        setTimeout(() => updateStatus(enabledToggle.checked), 2000);
        return;
      }
      
      console.log('Custom URLs saved to storage');
      renderUrlList();
      
      newUrlInput.value = '';
      addUrlBtn.disabled = false;
      updateStatus(true, 'URL added!');
      setTimeout(() => updateStatus(enabledToggle.checked), 2000);
      
      // Notify background script to register the new URL
      chrome.runtime.sendMessage({ action: 'URLS_UPDATED', customUrls });
    });
  }
  
  // Remove a custom URL
  function removeCustomUrl(index) {
    const urlConfig = allUrls[index];
    console.log('Removing URL at index:', index, urlConfig);
    
    if (!urlConfig || urlConfig.builtin) {
      console.log('Cannot remove - builtin or invalid');
      return; // Can't remove built-in URLs
    }
    
    allUrls.splice(index, 1);
    const customUrls = allUrls.filter(u => !u.builtin).map(u => u.pattern);
    console.log('Remaining custom URLs:', customUrls);
    
    chrome.storage.sync.set({ customUrls }, () => {
      console.log('Custom URLs updated in storage');
      renderUrlList();
      
      updateStatus(true, 'URL removed');
      setTimeout(() => updateStatus(enabledToggle.checked), 2000);
      
      // Notify background script
      chrome.runtime.sendMessage({ action: 'URLS_UPDATED', customUrls });
    });
  }
  
  // Validate URL pattern
  function isValidUrlPattern(pattern) {
    // Must start with http:// or https://
    if (!pattern.startsWith('http://') && !pattern.startsWith('https://')) {
      return false;
    }
    // Basic structure check - must have at least a domain
    try {
      // Replace wildcards temporarily for URL parsing
      const testUrl = pattern.replace(/\*/g, 'wildcard');
      new URL(testUrl);
      return true;
    } catch {
      return false;
    }
  }
  
  // Request permission for a URL pattern
  async function requestUrlPermission(pattern) {
    try {
      // Convert wildcard pattern to a format Chrome permissions understand
      // Chrome requires specific format: scheme + host (with optional *. prefix) + /*
      // Example: https://*.example.com/* or https://example.com/*
      const origins = [pattern];
      console.log('Requesting permission for:', origins);
      const granted = await chrome.permissions.request({ origins });
      console.log('Permission granted:', granted);
      return granted;
    } catch (error) {
      console.error('Permission request error:', error);
      // Permission request failed - still allow adding URL
      // The background script will handle injection if possible
      return true;
    }
  }

  // Save settings to storage
  function saveSettings(settings) {
    chrome.storage.sync.set(settings);
  }

  // Load settings from storage
  function loadSettings() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
      console.log('Loaded settings:', settings);
      
      // Apply settings to UI
      enabledToggle.checked = settings.enabled;
      // Transfer/Consult
      enableTransferToggle.checked = settings.enableTransfer !== false;
      transferFillCountryToggle.checked = settings.transferFillCountry !== false;
      transferFillDialCodeToggle.checked = settings.transferFillDialCode !== false;
      // Outbound Dialer
      enableOutboundDialerToggle.checked = settings.enableOutboundDialer !== false;
      outboundFillCountryToggle.checked = settings.outboundFillCountry !== false;
      outboundFillDialCodeToggle.checked = settings.outboundFillDialCode === true;  // Off by default
      // Other
      toastToggle.checked = settings.showToast;
      debugToggle.checked = settings.debug || false;
      countrySelect.value = settings.countryName;
      updateStatus(settings.enabled);
      
      // Set initial disabled state for child toggles
      transferFillCountryToggle.disabled = !enableTransferToggle.checked;
      transferFillDialCodeToggle.disabled = !enableTransferToggle.checked;
      outboundFillCountryToggle.disabled = !enableOutboundDialerToggle.checked;
      outboundFillDialCodeToggle.disabled = !enableOutboundDialerToggle.checked;
      updateToggleVisuals();
      
      // Load field configuration
      if (settings.fieldConfig) {
        fieldConfig = settings.fieldConfig;
        updateFieldConfigDisplay();
      }
      
      // Load custom URLs - reset to defaults first, then add custom
      allUrls = [...DEFAULT_URLS];
      console.log('Custom URLs from storage:', settings.customUrls);
      if (settings.customUrls && Array.isArray(settings.customUrls) && settings.customUrls.length > 0) {
        settings.customUrls.forEach(pattern => {
          allUrls.push({ pattern, builtin: false, enabled: true });
        });
        console.log('All URLs after loading:', allUrls);
      }
      renderUrlList();
    });
  }
  
  // Update visual state of disabled toggles
  function updateToggleVisuals() {
    // Transfer child toggles
    const transferEnabled = enableTransferToggle.checked;
    transferFillCountryToggle.closest('.option-row').style.opacity = transferEnabled ? '1' : '0.5';
    transferFillDialCodeToggle.closest('.option-row').style.opacity = transferEnabled ? '1' : '0.5';
    
    // Outbound child toggles
    const outboundEnabled = enableOutboundDialerToggle.checked;
    outboundFillCountryToggle.closest('.option-row').style.opacity = outboundEnabled ? '1' : '0.5';
    outboundFillDialCodeToggle.closest('.option-row').style.opacity = outboundEnabled ? '1' : '0.5';
  }
  
  // Update the field configuration display
  function updateFieldConfigDisplay() {
    if (fieldConfig.countrySelector) {
      countryFieldValue.textContent = fieldConfig.countrySelector;
      countryFieldValue.classList.remove('not-set');
      countryFieldValue.classList.add('configured');
    } else {
      countryFieldValue.textContent = 'Not configured';
      countryFieldValue.classList.add('not-set');
      countryFieldValue.classList.remove('configured');
    }
    
    if (fieldConfig.phoneSelector) {
      phoneFieldValue.textContent = fieldConfig.phoneSelector;
      phoneFieldValue.classList.remove('not-set');
      phoneFieldValue.classList.add('configured');
    } else {
      phoneFieldValue.textContent = 'Not configured';
      phoneFieldValue.classList.add('not-set');
      phoneFieldValue.classList.remove('configured');
    }
  }

  // Fill country NOW - sends message to background
  async function fillCountryNow() {
    const selectedCountry = countrySelect.value;
    if (!selectedCountry) return;

    fillNowBtn.disabled = true;
    fillNowBtn.innerHTML = `
      <svg class="spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
      </svg>
      Filling...
    `;
    updateStatus(true, "Searching...");

    try {
      // Add timeout to prevent hanging forever
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: Operation took too long (10s)')), 10000);
      });
      
      const messagePromise = chrome.runtime.sendMessage({
        action: 'FILL_COUNTRY',
        countryName: selectedCountry
      });
      
      const response = await Promise.race([messagePromise, timeoutPromise]);

      console.log('📞 Fill response:', response);

      if (response && response.found) {
        fillNowBtn.classList.add('success');
        fillNowBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Filled!
        `;
        updateStatus(true, "Country filled successfully!");
      } else {
        fillNowBtn.classList.add('error');
        fillNowBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          Not Found
        `;
        updateStatus(true, "Open Transfer dialog first");
      }

      // Reset button after 2 seconds
      setTimeout(() => {
        fillNowBtn.disabled = false;
        fillNowBtn.classList.remove('success', 'error');
        fillNowBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          Fill Country Now
        `;
        updateStatus(enabledToggle.checked);
      }, 2000);

    } catch (error) {
      console.error('📞 Fill error:', error);
      fillNowBtn.disabled = false;
      fillNowBtn.classList.add('error');
      fillNowBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        Error
      `;
      updateStatus(true, error.message || "Unknown error");
      
      // Reset button after 3 seconds
      setTimeout(() => {
        fillNowBtn.disabled = false;
        fillNowBtn.classList.remove('error');
        fillNowBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          Fill Country Now
        `;
        updateStatus(enabledToggle.checked);
      }, 3000);
    }
  }

  // Initialize
  populateCountries();
  loadSettings();

  // Event: Enable toggle
  enabledToggle.addEventListener("change", () => {
    const enabled = enabledToggle.checked;
    updateStatus(enabled);
    saveSettings({ enabled });
  });

  // === TRANSFER/CONSULT TOGGLES ===
  enableTransferToggle.addEventListener("change", () => {
    const enabled = enableTransferToggle.checked;
    saveSettings({ enableTransfer: enabled });
    // Disable/enable child toggles
    transferFillCountryToggle.disabled = !enabled;
    transferFillDialCodeToggle.disabled = !enabled;
    updateToggleVisuals();
  });

  transferFillCountryToggle.addEventListener("change", () => {
    saveSettings({ transferFillCountry: transferFillCountryToggle.checked });
  });

  transferFillDialCodeToggle.addEventListener("change", () => {
    saveSettings({ transferFillDialCode: transferFillDialCodeToggle.checked });
  });

  // === OUTBOUND DIALER TOGGLES ===
  enableOutboundDialerToggle.addEventListener("change", () => {
    const enabled = enableOutboundDialerToggle.checked;
    saveSettings({ enableOutboundDialer: enabled });
    // Disable/enable child toggles
    outboundFillCountryToggle.disabled = !enabled;
    outboundFillDialCodeToggle.disabled = !enabled;
    updateToggleVisuals();
  });

  outboundFillCountryToggle.addEventListener("change", () => {
    saveSettings({ outboundFillCountry: outboundFillCountryToggle.checked });
  });

  outboundFillDialCodeToggle.addEventListener("change", () => {
    saveSettings({ outboundFillDialCode: outboundFillDialCodeToggle.checked });
  });

  // Event: Toast toggle
  toastToggle.addEventListener("change", () => {
    saveSettings({ showToast: toastToggle.checked });
  });

  // Event: Country selection
  countrySelect.addEventListener("change", () => {
    const selectedCountry = countrySelect.value;
    const country = findCountry(selectedCountry);
    
    if (country) {
      saveSettings({
        countryName: country.name,
        dialCode: country.code
      });
    }
  });

  // Event: Fill Now button
  fillNowBtn.addEventListener("click", fillCountryNow);

  // Event: Add URL button
  addUrlBtn.addEventListener("click", addCustomUrl);
  
  // Event: Enter key in URL input
  newUrlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addCustomUrl();
    }
  });

  // Event: Debug toggle
  debugToggle.addEventListener("change", () => {
    const debug = debugToggle.checked;
    saveSettings({ debug });
    console.log(`🔧 Debug mode ${debug ? 'enabled' : 'disabled'}`);
  });

  // Event: Scan button
  scanBtn.addEventListener("click", scanPageElements);

  // Event: Close scan results
  closeScanResults.addEventListener("click", () => {
    scanResults.classList.add("hidden");
  });

  // Scan page for form elements across all frames
  async function scanPageElements() {
    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning...";
    scanResultsContent.innerHTML = '<div class="scan-loading">Scanning page...</div>';
    scanResults.classList.remove("hidden");

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error("No active tab found");
      }

      // Execute scan script in the main frame and all iframes
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: scanFrameForElements
      });

      // Combine results from all frames
      let allElements = [];
      let frameIndex = 0;
      
      for (const result of results) {
        if (result.result && result.result.elements) {
          const frameInfo = result.result.frameUrl || `Frame ${frameIndex}`;
          result.result.elements.forEach(el => {
            el.frame = frameInfo;
          });
          allElements = allElements.concat(result.result.elements);
        }
        frameIndex++;
      }

      // Display results
      displayScanResults(allElements);

    } catch (error) {
      console.error('🔍 Scan error:', error);
      scanResultsContent.innerHTML = `<div class="scan-error">Error: ${error.message}</div>`;
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = "🔍 Scan Page";
    }
  }

  // Function that runs in the page context to find elements
  function scanFrameForElements() {
    const elements = [];
    const frameUrl = window.location.href;
    
    // Find all inputs
    document.querySelectorAll('input').forEach(el => {
      if (el.id || el.name || el.className) {
        elements.push({
          type: 'input',
          inputType: el.type || 'text',
          id: el.id || '',
          name: el.name || '',
          className: el.className || '',
          placeholder: el.placeholder || '',
          value: el.value || ''
        });
      }
    });

    // Find all selects/comboboxes
    document.querySelectorAll('select, [role="combobox"], [role="listbox"]').forEach(el => {
      elements.push({
        type: 'select/combobox',
        id: el.id || '',
        name: el.name || '',
        className: el.className || '',
        role: el.getAttribute('role') || ''
      });
    });

    // Find Fluent UI inputs (span.fui-Input)
    document.querySelectorAll('span.fui-Input, div.fui-Input').forEach(el => {
      const input = el.querySelector('input');
      elements.push({
        type: 'fui-Input',
        id: input?.id || el.id || '',
        className: el.className || '',
        inputId: input?.id || '',
        hasReactProps: Object.keys(el).some(k => k.startsWith('__reactProps'))
      });
    });

    // Find Fluent UI comboboxes
    document.querySelectorAll('[class*="fui-Combobox"], [class*="ComboboxWrapper"]').forEach(el => {
      elements.push({
        type: 'fui-Combobox',
        id: el.id || '',
        className: el.className || '',
        hasReactProps: Object.keys(el).some(k => k.startsWith('__reactProps'))
      });
    });

    // Look for specific D365 dialer elements
    const dialerElements = document.querySelectorAll('[id*="Dialer"], [id*="dialer"], [id*="transfer"], [id*="Transfer"]');
    dialerElements.forEach(el => {
      elements.push({
        type: 'dialer-related',
        tagName: el.tagName,
        id: el.id || '',
        className: el.className || ''
      });
    });

    // Look for specific country/region elements
    const countryElements = document.querySelectorAll('[id*="region"], [id*="Region"], [id*="country"], [id*="Country"], [id*="nationalNumber"]');
    countryElements.forEach(el => {
      elements.push({
        type: 'country-related',
        tagName: el.tagName,
        id: el.id || '',
        className: el.className || '',
        value: el.value || el.textContent?.substring(0, 50) || ''
      });
    });

    return { frameUrl, elements };
  }

  // Generate a friendly display name for an element
  function getDisplayName(el) {
    if (el.id) {
      const id = el.id;
      // Be specific about which element
      if (id === 'CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id') {
        return '🌍 Country/Region Input (RECOMMENDED)';
      }
      if (id === 'CRM-Omnichannel-Control-Dialer-nationalNumberInput-data-automation-id') {
        return '📞 Phone Number Input (RECOMMENDED)';
      }
      if (id.includes('ExpandIcon')) return '⬇️ Expand Icon (not input)';
      if (id.includes('callButton')) return '📱 Call Button';
      if (id.includes('live_region')) return '🔊 Live Region (accessibility)';
      if (id.includes('SimpleLookup')) return '🔍 Lookup Field';
      if (id.includes('Dialer')) return '📱 Dialer Element';
      // Clean up generic IDs
      return id.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    if (el.placeholder) return `"${el.placeholder}"`;
    if (el.name) return el.name;
    return el.type || 'Unknown';
  }
  
  // Check if element is the actual country INPUT (not icon, not wrapper)
  function isActualCountryInput(el) {
    const id = (el.id || '');
    return id === 'CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id';
  }
  
  // Check if element is the actual phone INPUT
  function isActualPhoneInput(el) {
    const id = (el.id || '');
    return id === 'CRM-Omnichannel-Control-Dialer-nationalNumberInput-data-automation-id';
  }
  
  // Check if element should be shown (filter out useless ones)
  function isRelevantElement(el) {
    const id = el.id || '';
    const idLower = id.toLowerCase();
    // Skip: expand icons, live regions, buttons, spans
    if (idLower.includes('expandicon')) return false;
    if (idLower.includes('live_region')) return false;
    if (idLower.includes('callbutton')) return false;
    if (idLower.includes('arialive')) return false;
    if (idLower.includes('icon')) return false;  // Any icon elements
    // Skip main page lookup fields (not transfer dialog)
    if (idLower.includes('simplelookup')) return false;
    // Skip dialer command buttons
    if (idLower.includes('dialogcommand')) return false;
    // Skip wrappers/containers - we want actual inputs
    if (idLower.includes('wrapper') && !id.includes('nationalNumber') && !id.includes('region')) return false;
    // Only show the TWO specific inputs we care about from msdyn_chatcontrol
    // This greatly simplifies the user experience
    const isDialerInput = id.includes('CRM-Omnichannel-Control-Dialer');
    if (isDialerInput) {
      // Only show the actual input fields, not icons/buttons/wrappers
      return id === 'CRM-Omnichannel-Control-Dialer-regionComboBox-data-automation-id' ||
             id === 'CRM-Omnichannel-Control-Dialer-nationalNumberInput-data-automation-id';
    }
    return true;
  }

  // Display scan results with interactive selection
  function displayScanResults(elements) {
    // Filter to relevant input elements only
    let relevantElements = elements.filter(el => 
      el.id && 
      (el.type === 'input' || el.type === 'fui-Input') &&
      isRelevantElement(el)
    );
    
    // Deduplicate by ID
    const seen = new Set();
    relevantElements = relevantElements.filter(el => {
      if (seen.has(el.id)) return false;
      seen.add(el.id);
      return true;
    });
    
    // Sort: recommended elements first, then by frame (chatcontrol first)
    relevantElements.sort((a, b) => {
      // Recommended inputs first
      const aRecommended = isActualCountryInput(a) || isActualPhoneInput(a);
      const bRecommended = isActualCountryInput(b) || isActualPhoneInput(b);
      if (aRecommended && !bRecommended) return -1;
      if (!aRecommended && bRecommended) return 1;
      // Then chatcontrol frame
      const aChatControl = (a.frame || '').includes('chatcontrol');
      const bChatControl = (b.frame || '').includes('chatcontrol');
      if (aChatControl && !bChatControl) return -1;
      if (!aChatControl && bChatControl) return 1;
      return 0;
    });
    
    scannedElements = relevantElements;
    
    if (scannedElements.length === 0) {
      scanResultsContent.innerHTML = '<div class="scan-empty">No input fields found. Make sure the Transfer dialog is open.</div>';
      saveConfigBtn.disabled = true;
      return;
    }

    let html = '<div class="scan-tip">💡 Select the ⭐ RECOMMENDED fields below. Only the actual input fields from the transfer dialog are shown.</div>';
    
    scannedElements.forEach((el, index) => {
      const displayName = getDisplayName(el);
      const isRecommendedCountry = isActualCountryInput(el);
      const isRecommendedPhone = isActualPhoneInput(el);
      const shortFrame = el.frame ? el.frame.split('?')[0].split('/').pop() : '';
      
      // Auto-select if matches current config
      const isSelectedCountry = fieldConfig.countrySelector === el.id;
      const isSelectedPhone = fieldConfig.phoneSelector === el.id;
      
      html += `
        <div class="scan-item ${isSelectedCountry ? 'selected-country' : ''} ${isSelectedPhone ? 'selected-phone' : ''}" data-index="${index}">
          <div class="scan-item-header">
            <span class="scan-item-name">${displayName}</span>
            <div class="scan-item-badges">
              ${isSelectedCountry ? '<span class="scan-item-badge country">COUNTRY</span>' : ''}
              ${isSelectedPhone ? '<span class="scan-item-badge phone">PHONE</span>' : ''}
              <span class="scan-item-badge type">${el.type}</span>
            </div>
          </div>
          <div class="scan-item-id">#${el.id}</div>
          <div class="scan-item-frame">📁 ${shortFrame} ${(shortFrame === 'msdyn_chatcontrol.htm') ? '✅' : ''}</div>
          <div class="scan-item-actions">
            <button class="assign-btn country ${isSelectedCountry ? 'active' : ''} ${isRecommendedCountry ? 'recommended' : ''}" data-index="${index}" data-role="country">
              ${isSelectedCountry ? '✓ Country Field' : (isRecommendedCountry ? '⭐ Set as Country' : '🌍 Set as Country')}
            </button>
            <button class="assign-btn phone ${isSelectedPhone ? 'active' : ''} ${isRecommendedPhone ? 'recommended' : ''}" data-index="${index}" data-role="phone">
              ${isSelectedPhone ? '✓ Phone Field' : (isRecommendedPhone ? '⭐ Set as Phone' : '📞 Set as Phone')}
            </button>
          </div>
        </div>
      `;
    });

    scanResultsContent.innerHTML = html;
    saveConfigBtn.disabled = false;
    
    // Add click handlers for assign buttons
    scanResultsContent.querySelectorAll('.assign-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        const role = btn.dataset.role;
        assignFieldRole(index, role);
      });
    });
  }
  
  // Assign a role (country/phone) to an element
  function assignFieldRole(index, role) {
    const element = scannedElements[index];
    if (!element) return;
    
    if (role === 'country') {
      // Toggle off if already selected
      if (fieldConfig.countrySelector === element.id) {
        fieldConfig.countrySelector = null;
        fieldConfig.countryFrame = null;
      } else {
        fieldConfig.countrySelector = element.id;
        fieldConfig.countryFrame = element.frame;
      }
    } else if (role === 'phone') {
      // Toggle off if already selected
      if (fieldConfig.phoneSelector === element.id) {
        fieldConfig.phoneSelector = null;
        fieldConfig.phoneFrame = null;
      } else {
        fieldConfig.phoneSelector = element.id;
        fieldConfig.phoneFrame = element.frame;
      }
    }
    
    // Re-render the list
    displayScanResults(scannedElements.map(el => el)); // Re-render with current selections
    updateFieldConfigDisplay();
  }
  
  // Save configuration button
  saveConfigBtn.addEventListener('click', () => {
    saveSettings({ fieldConfig });
    updateFieldConfigDisplay();
    scanResults.classList.add('hidden');
    updateStatus(true, 'Configuration saved!');
    
    // Reset status after 2 seconds
    setTimeout(() => {
      updateStatus(enabledToggle.checked);
    }, 2000);
  });
  
  // Clear configuration button
  clearConfigBtn.addEventListener('click', () => {
    fieldConfig = {
      countrySelector: null,
      countryFrame: null,
      phoneSelector: null,
      phoneFrame: null
    };
    saveSettings({ fieldConfig });
    updateFieldConfigDisplay();
    updateStatus(true, 'Configuration cleared');
    
    setTimeout(() => {
      updateStatus(enabledToggle.checked);
    }, 2000);
  });
});
