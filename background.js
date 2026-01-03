/**
 * Timezone Spoofer - Background Service Worker
 */

import { StorageManager } from "./modules/storageManager.js";

const CSP_RULES = [
  {
    id: 1,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        {
          header: "content-security-policy",
          operation: "set",
          value:
            "script-src * 'unsafe-inline' 'unsafe-eval' blob: chrome-extension:; script-src-elem * 'unsafe-inline' 'unsafe-eval' blob: chrome-extension:; worker-src * 'unsafe-inline' 'unsafe-eval' blob: chrome-extension:; child-src * 'unsafe-inline' 'unsafe-eval' blob: chrome-extension:;",
        },
      ],
    },
    condition: {
      urlFilter: "*",
      resourceTypes: ["main_frame", "sub_frame"],
    },
  },
];

async function updateCSPRules(enabled) {
  if (enabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: CSP_RULES,
    });
  } else {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
    });
  }
}

const refreshUI = async () => {
  const data = await StorageManager.get("enabled");
  const isActive = !!data.enabled;

  await updateCSPRules(isActive);

  chrome.action.setBadgeText({ text: isActive ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#10B981" });

  chrome.action.setTitle({
    title: `Timezone Spoofer: ${isActive ? "Active" : "Disabled"}`,
  });

  chrome.action.setIcon({
    path: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  });
};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await StorageManager.set({
      enabled: false,
      timezone: "UTC",
      metadata: { callingCode: "+0", currency: "USD", locale: "en-US" },
    });
  }
  refreshUI();
});

StorageManager.onChange((changes) => {
  if (changes.enabled) {
    refreshUI();
  }
});

refreshUI();
