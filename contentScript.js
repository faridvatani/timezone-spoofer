/**
 * Timezone Spoofer - Content Script
 *
 * Injects the spoofing logic into the web page context and facilitates
 * real-time synchronization between the extension and the page.
 */
(() => {
  let isScriptInjected = false;
  let currentTargetTimezone = null;

  const injectSpoofingScript = (timezone, metadata) => {
    if (isScriptInjected) return;

    currentTargetTimezone = timezone;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("injectedSpoof.js");
    script.setAttribute("data-timezone", timezone);
    if (metadata) {
      script.setAttribute("data-calling-code", metadata.callingCode || "");
      script.setAttribute("data-currency", metadata.currency || "");
      script.setAttribute("data-locale", metadata.locale || "en-US");
      script.setAttribute("data-country-code", metadata.countryCode || "US");
      script.setAttribute(
        "data-country-name",
        metadata.countryName || "United States"
      );
      script.setAttribute("data-city", metadata.city || "San Francisco");
    }
    script.async = false;

    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
    isScriptInjected = true;
  };

  const handleSettingsUpdate = (data) => {
    const isEnabled = !!data.enabled;
    const timezone = data.timezone || "UTC";
    const metadata = data.metadata;

    if (isEnabled) {
      if (!isScriptInjected) {
        injectSpoofingScript(timezone, metadata);
      } else {
        if (timezone !== currentTargetTimezone) {
          currentTargetTimezone = timezone;
        }
        window.dispatchEvent(
          new CustomEvent("timezone-update", {
            detail: { timezone, metadata },
          })
        );
      }
    }
  };

  // Initial load
  chrome.storage.local.get(["enabled", "timezone", "metadata"], (data) => {
    handleSettingsUpdate(data);
  });

  // Listen for changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      chrome.storage.local.get(["enabled", "timezone", "metadata"], (data) => {
        handleSettingsUpdate(data);
      });
    }
  });
})();
