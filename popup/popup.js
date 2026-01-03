import { GeoService } from "../modules/geoService.js";
import { StorageManager } from "../modules/storageManager.js";
import { MetadataService } from "../modules/metadataService.js";

/**
 * Timezone Spoofer - Popup UI Logic
 */
class PopupManager {
  constructor() {
    this.state = {
      allZones: [],
      filteredZones: [],
      enabled: false,
      selectedTz: "UTC",
      systemTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isDirty: false,
      meta: {
        callingCode: "--",
        currency: "--",
      },
    };

    this.refreshBannerTimeout = null;

    this.elements = {
      toggle: document.getElementById("toggle"),
      search: document.getElementById("search"),
      list: document.getElementById("list"),
      statusText: document.getElementById("status-text"),
      selectedName: document.getElementById("selected-name"),
      selectedOffset: document.getElementById("selected-offset"),
      callingCode: document.getElementById("calling-code"),
      localCurrency: document.getElementById("local-currency"),
      currentIp: document.getElementById("current-ip"),
      previewTime: document.getElementById("preview-time"),
      previewDate: document.getElementById("preview-date"),
      previewCard: document.getElementById("preview-card"),
      refreshBanner: document.getElementById("refresh-banner"),
      ipSyncBtn: document.getElementById("ip-sync-btn"),
      container: document.querySelector(".container"),
      versionTag: document.getElementById("version-tag"),
      notification: document.getElementById("notification"),
      notificationText: document.getElementById("notification-text"),
    };

    this.formatters = {
      time: (tz) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      date: (tz) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    };
  }

  async init() {
    await this.loadTimezones();
    await this.loadInitialSettings();
    this.setupEventListeners();
    this.startClock();

    // Set version from manifest
    const version = chrome.runtime.getManifest().version;
    if (this.elements.versionTag) {
      this.elements.versionTag.textContent = `v${version}`;
    }

    // Set initial metadata based on selected timezone
    this.updateMetadata(this.state.selectedTz);

    // Load and display current IP address
    this.loadCurrentIp();

    this.render();
    this.renderList();
  }

  updateMetadata(tz) {
    if (this.state.enabled) {
      const meta = MetadataService.getMetadata(tz);
      this.state.meta = meta;
    } else {
      this.state.meta = {
        callingCode: "--",
        currency: "--",
        locale: "en-US",
        countryCode: "US",
        countryName: "United States",
        city: "Default",
      };
    }
  }

  async loadTimezones() {
    try {
      const response = await fetch(
        chrome.runtime.getURL("data/timezones.json"),
      );
      const data = await response.json();
      const hasUTC = data.some((z) => z.id === "UTC");
      if (!hasUTC) {
        data.unshift({ id: "UTC", label: "UTC (Default)", offset: "+00:00" });
      }
      this.state.allZones = data;
      this.state.filteredZones = this.state.allZones;
    } catch (error) {
      this.state.allZones = [
        { id: "UTC", label: "UTC (Default)", offset: "+00:00" },
      ];
      this.state.filteredZones = this.state.allZones;
    }
  }

  async loadInitialSettings() {
    const data = await StorageManager.get(["enabled", "timezone"]);
    this.state.enabled = !!data.enabled;
    this.state.selectedTz = data.timezone || "UTC";
    this.elements.toggle.checked = this.state.enabled;
  }

  async loadCurrentIp() {
    if (!this.elements.currentIp) return;
    
    try {
      const locationData = await GeoService.fetchLocation();
      if (locationData && locationData.ip) {
        this.elements.currentIp.textContent = locationData.ip;
      } else {
        this.elements.currentIp.textContent = "Unknown";
      }
    } catch (error) {
      console.error("Failed to load IP:", error);
      this.elements.currentIp.textContent = "Error";
    }
  }

  setupEventListeners() {
    this.elements.toggle.addEventListener("change", () => this.handleToggle());
    this.elements.ipSyncBtn.addEventListener("click", () =>
      this.handleIpSync(),
    );
    this.elements.search.addEventListener("input", (e) =>
      this.handleSearch(e.target.value),
    );
    this.elements.list.addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (li?.dataset.id) this.handleZoneSelect(li.dataset.id);
    });
  }

  handleToggle() {
    this.state.enabled = this.elements.toggle.checked;
    this.state.isDirty = true;
    this.updateMetadata(this.state.selectedTz);
    StorageManager.set({
      enabled: this.state.enabled,
      metadata: this.state.meta,
    });
    this.render();
    this.scheduleRefreshBannerHide();
  }

  handleSearch(query) {
    const q = query.toLowerCase();
    this.state.filteredZones = this.state.allZones.filter(
      (z) =>
        z.label.toLowerCase().includes(q) ||
        z.id.toLowerCase().includes(q) ||
        z.offset.includes(q),
    );
    this.renderList();
  }

  handleZoneSelect(zoneId) {
    if (this.state.selectedTz === zoneId) return;
    this.state.selectedTz = zoneId;
    this.state.isDirty = true;
    this.updateMetadata(zoneId);
    StorageManager.set({
      timezone: zoneId,
      metadata: this.state.meta,
    });
    this.render();
    this.renderList();
    this.scheduleRefreshBannerHide();
  }

  async handleIpSync() {
    if (this.elements.ipSyncBtn.classList.contains("loading")) return;

    // Reset button state
    this.elements.ipSyncBtn.classList.remove("success", "error");
    this.elements.ipSyncBtn.classList.add("loading");

    try {
      const locationData = await GeoService.fetchLocation();

      if (!locationData || !locationData.timezone) {
        throw new Error("No timezone data in response");
      }

      // Update metadata if available from GeoService
      if (
        locationData.callingCode ||
        locationData.currency ||
        locationData.countryCode
      ) {
        this.state.meta = {
          callingCode: locationData.callingCode || this.state.meta.callingCode,
          currency: locationData.currency || this.state.meta.currency,
          locale: this.state.meta.locale || "en-US",
          countryCode: locationData.countryCode || this.state.meta.countryCode,
          countryName: locationData.country || this.state.meta.countryName,
          city: locationData.city || this.state.meta.city,
        };
        
        // Save metadata to storage
        StorageManager.set({ metadata: this.state.meta });
      }

      // Update IP display if available
      if (locationData.ip && this.elements.currentIp) {
        this.elements.currentIp.textContent = locationData.ip;
      }

      this.handleZoneSelect(locationData.timezone);

      // Show success feedback
      this.showNotification(
        `Synced to ${locationData.timezone} based on your IP location`,
        "success",
      );
      this.elements.ipSyncBtn.classList.remove("loading");
      this.elements.ipSyncBtn.classList.add("success");
      setTimeout(() => {
        this.elements.ipSyncBtn.classList.remove("success");
      }, 3000);
    } catch (error) {
      console.error("IP Sync failed:", error);
      this.showNotification(
        "Failed to sync timezone. Please try again.",
        "error",
      );
      this.elements.ipSyncBtn.classList.remove("loading");
      this.elements.ipSyncBtn.classList.add("error");
      setTimeout(() => {
        this.elements.ipSyncBtn.classList.remove("error");
      }, 3000);
    }
  }

  showNotification(message, type = "success") {
    if (!this.elements.notification || !this.elements.notificationText) return;

    this.elements.notificationText.textContent = message;
    this.elements.notification.className = `notification ${type}`;
    this.elements.notification.classList.remove("hidden");

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.elements.notification.classList.add("hidden");
    }, 3000);
  }

  scheduleRefreshBannerHide() {
    // Clear any existing timeout
    if (this.refreshBannerTimeout) {
      clearTimeout(this.refreshBannerTimeout);
    }

    // Hide the banner after 2 seconds
    this.refreshBannerTimeout = setTimeout(() => {
      this.state.isDirty = false;
      this.elements.refreshBanner.classList.add("hidden");
      this.refreshBannerTimeout = null;
    }, 2000);
  }

  render() {
    const displayTz = this.state.enabled
      ? this.state.selectedTz
      : this.state.systemTz;
    const zoneData = this.state.allZones.find((z) => z.id === displayTz) || {
      id: displayTz,
      label: displayTz.split("/").pop().replace(/_/g, " "),
      offset: this.calculateOffset(displayTz),
    };

    const badgeHtml = this.state.enabled
      ? '<span class="integrity-badge">Secured</span>'
      : "";
    this.elements.selectedName.innerHTML = `
      ${zoneData.label.replace(/\(.*\)/, "").trim()}
      ${badgeHtml}
    `;
    this.elements.selectedOffset.textContent = `UTC ${zoneData.offset}`;
    this.elements.callingCode.textContent = this.state.meta.callingCode;
    this.elements.localCurrency.textContent = this.state.meta.currency;
    this.elements.statusText.textContent = this.state.enabled
      ? "Active"
      : "Disabled";

    this.elements.previewCard.className = `preview-card ${
      this.state.enabled ? "enabled" : "disabled"
    }`;
    this.elements.container.classList.toggle(
      "spoofing-active",
      this.state.enabled,
    );
    this.elements.refreshBanner.classList.toggle("hidden", !this.state.isDirty);

    this.updateClock();
  }

  renderList() {
    const fragment = document.createDocumentFragment();
    this.state.filteredZones.forEach((z) => {
      const li = document.createElement("li");
      li.dataset.id = z.id;
      if (z.id === this.state.selectedTz) li.className = "active";
      li.innerHTML = `<span class="zone-label">${z.label}</span><span class="zone-offset">UTC ${z.offset}</span>`;
      fragment.appendChild(li);
    });
    this.elements.list.innerHTML = "";
    this.elements.list.appendChild(fragment);
  }

  startClock() {
    setInterval(() => this.updateClock(), 1000);
    this.updateClock();
  }

  updateClock() {
    const displayTz = this.state.enabled
      ? this.state.selectedTz
      : this.state.systemTz;
    const now = new Date();
    try {
      this.elements.previewTime.textContent = this.formatters
        .time(displayTz)
        .format(now);
      this.elements.previewDate.textContent = this.formatters
        .date(displayTz)
        .format(now);
    } catch (e) {
      this.elements.previewTime.textContent = now.toLocaleTimeString();
      this.elements.previewDate.textContent = now.toLocaleDateString();
    }
  }

  calculateOffset(zoneId) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: zoneId,
        timeZoneName: "shortOffset",
      }).formatToParts(new Date());
      const val =
        parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
      if (val === "GMT" || val === "UTC") return "+00:00";
      return val.replace("GMT", "").replace("UTC", "");
    } catch (e) {
      return "+00:00";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const manager = new PopupManager();
  manager.init();
});
