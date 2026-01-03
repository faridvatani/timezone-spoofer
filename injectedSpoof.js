/**
 * Timezone Spoofer - Injected Script (Bulletproof Edition)
 *
 * Securely overrides Date and Intl APIs to spoof timezones.
 * Designed to defeat advanced fingerprinting (e.g. neberej.github.io/exposedbydefault/)
 */
(() => {
  const scriptTag = document.currentScript;
  let targetTimezone =
    (scriptTag && scriptTag.getAttribute("data-timezone")) || "UTC";
  let targetCallingCode =
    (scriptTag && scriptTag.getAttribute("data-calling-code")) || "";
  let targetCurrency =
    (scriptTag && scriptTag.getAttribute("data-currency")) || "USD";
  let targetLocale =
    (scriptTag && scriptTag.getAttribute("data-locale")) || "en-US";
  let targetCountryCode =
    (scriptTag && scriptTag.getAttribute("data-country-code")) || "US";
  let targetCountryName =
    (scriptTag && scriptTag.getAttribute("data-country-name")) ||
    "United States";
  let targetCity =
    (scriptTag && scriptTag.getAttribute("data-city")) || "San Francisco";

  // Capture original references immediately
  const OriginalDate = window.Date;
  const OriginalIntl = window.Intl;
  const OriginalNavigator = window.navigator;
  const OriginalDTF = OriginalIntl.DateTimeFormat;
  const OriginalNF = OriginalIntl.NumberFormat;
  const OriginalWorker = window.Worker;
  const OriginalSharedWorker = window.SharedWorker;
  const OriginalFetch = window.fetch;
  const OriginalXHR = window.XMLHttpRequest;

  // State
  const dtfInstances = new WeakSet();
  const nfInstances = new WeakSet();
  const formatterCache = new Map();
  const timestampToPartsCache = new Map();
  const instanceToPartsCache = new WeakMap();
  const INTERNAL_LOCALE = "en-US";

  let masterFormatter;

  const configureMasterFormatter = (tz, metadata) => {
    try {
      new OriginalDTF(undefined, { timeZone: tz });
      targetTimezone = tz;
    } catch (e) {
      targetTimezone = "UTC";
    }

    if (metadata) {
      targetCallingCode = metadata.callingCode || targetCallingCode;
      targetCurrency = metadata.currency || targetCurrency;
      targetLocale = metadata.locale || targetLocale;
      targetCountryCode = metadata.countryCode || targetCountryCode;
      targetCountryName = metadata.countryName || targetCountryName;
      targetCity = metadata.city || targetCity;
    }

    masterFormatter = new OriginalDTF(INTERNAL_LOCALE, {
      timeZone: targetTimezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      timeZoneName: "shortOffset",
    });

    timestampToPartsCache.clear();
    formatterCache.clear();
  };

  configureMasterFormatter(targetTimezone);

  // Sync updates from extension UI
  window.addEventListener("timezone-update", (e) => {
    if (e.detail?.timezone || e.detail?.metadata) {
      configureMasterFormatter(
        e.detail.timezone || targetTimezone,
        e.detail.metadata
      );
    }
  });

  // --- Utilities ---

  /**
   * Refined stealth: Matches native function characteristics (name, toString, length, non-enumerable prototype).
   */
  const wrapNative = (fn, name, length = 0) => {
    Object.defineProperty(fn, "name", { value: name, configurable: true });
    Object.defineProperty(fn, "length", { value: length, configurable: true });
    Object.defineProperty(fn, "toString", {
      value: () => `function ${name}() { [native code] }`,
      configurable: true,
    });
    // Native functions usually don't have a prototype unless they are constructors
    if (fn.prototype) {
      Object.defineProperty(fn, "prototype", { enumerable: false });
    }
    return fn;
  };

  /**
   * Spoof Navigator Language
   */
  const spoofNavigator = () => {
    const navOverrides = {
      language: { get: () => targetLocale || "en-US" },
      languages: {
        get: () => {
          const loc = targetLocale || "en-US";
          return [loc, loc.split("-")[0]];
        },
      },
      platform: { get: () => "Win32" }, // Generic value to mask OS
      vendor: { get: () => "Google Inc." }, // Standard Chrome vendor
      maxTouchPoints: { get: () => 0 }, // Prevent touch-screen detection leaks
    };

    for (const [prop, desc] of Object.entries(navOverrides)) {
      Object.defineProperty(OriginalNavigator, prop, {
        ...desc,
        configurable: true,
      });
    }
  };

  spoofNavigator();

  const getCachedFormatter = (options) => {
    const key = JSON.stringify(options);
    let f = formatterCache.get(key);
    if (!f) {
      f = new OriginalDTF(INTERNAL_LOCALE, options);
      formatterCache.set(key, f);
    }
    return f;
  };

  const getParts = (date) => {
    if (!(date instanceof OriginalDate)) return null;
    const ts = date.getTime();
    if (isNaN(ts)) return null;

    const cached = instanceToPartsCache.get(date);
    if (cached && cached.ts === ts) return cached.parts;

    let parts = timestampToPartsCache.get(ts);
    if (!parts) {
      try {
        const raw = masterFormatter.formatToParts(ts);
        parts = {};
        for (let i = 0; i < raw.length; i++) parts[raw[i].type] = raw[i].value;
        if (timestampToPartsCache.size > 2000) timestampToPartsCache.clear();
        timestampToPartsCache.set(ts, parts);
      } catch (e) {
        return null;
      }
    }

    instanceToPartsCache.set(date, { ts, parts });
    return parts;
  };

  const calculateUtcFromLocal = (
    y,
    m = 0,
    d = 1,
    h = 0,
    min = 0,
    s = 0,
    ms = 0
  ) => {
    let year = y;
    if (y >= 0 && y <= 99) year += 1900;
    const dummyTs = OriginalDate.UTC(year, m, d, h, min, s, ms);

    const fetchOffset = (ts) => {
      const p = getCachedFormatter({
        timeZone: targetTimezone,
        timeZoneName: "shortOffset",
      }).formatToParts(ts);
      const val = p.find((pt) => pt.type === "timeZoneName")?.value || "GMT+0";
      const m = val.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (!m) return 0;
      const sign = m[1] === "+" ? 1 : -1;
      return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || 0, 10));
    };

    let offset = fetchOffset(dummyTs);
    let finalTs = dummyTs - offset * 60000;
    const refinedOffset = fetchOffset(finalTs);
    if (refinedOffset !== offset) finalTs = dummyTs - refinedOffset * 60000;
    return finalTs;
  };

  // --- Date Override ---

  function SpoofedDate(...args) {
    let date;
    if (!(this instanceof SpoofedDate)) {
      return new SpoofedDate(...args).toString();
    }
    if (args.length === 0) {
      date = new OriginalDate();
    } else if (args.length === 1) {
      date = new OriginalDate(args[0]);
    } else {
      date = new OriginalDate(calculateUtcFromLocal(...args));
    }
    Object.setPrototypeOf(date, SpoofedDate.prototype);
    return date;
  }

  // Restore Date Prototype and static methods
  SpoofedDate.prototype = OriginalDate.prototype;
  Object.defineProperty(OriginalDate.prototype, "constructor", {
    value: SpoofedDate,
    configurable: true,
    enumerable: false,
    writable: true,
  });

  Object.getOwnPropertyNames(OriginalDate).forEach((prop) => {
    if (!Object.prototype.hasOwnProperty.call(SpoofedDate, prop)) {
      const desc = Object.getOwnPropertyDescriptor(OriginalDate, prop);
      if (desc) Object.defineProperty(SpoofedDate, prop, desc);
    }
  });

  const dp = OriginalDate.prototype;
  const dateOverrides = {
    getFullYear() {
      return parseInt(getParts(this)?.year, 10) || NaN;
    },
    getMonth() {
      const p = getParts(this);
      return p ? parseInt(p.month, 10) - 1 : NaN;
    },
    getDate() {
      return parseInt(getParts(this)?.day, 10) || NaN;
    },
    getDay() {
      const p = getParts(this);
      if (!p) return NaN;
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        p.weekday
      );
    },
    getHours() {
      return parseInt(getParts(this)?.hour, 10) || 0;
    },
    getMinutes() {
      return parseInt(getParts(this)?.minute, 10) || 0;
    },
    getSeconds() {
      return parseInt(getParts(this)?.second, 10) || 0;
    },
    getTimezoneOffset() {
      const p = getParts(this);
      if (!p) return 0;
      const m = p.timeZoneName?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (!m) return 0;
      const sign = m[1] === "+" ? 1 : -1;
      return -(sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || 0, 10)));
    },
    toString() {
      if (isNaN(this.getTime())) return "Invalid Date";
      const p = getParts(this);
      if (!p) return dp.toString.call(this);
      let off = p.timeZoneName || "GMT+0000";
      if (off === "GMT" || off === "UTC") off = "GMT+0000";
      const m = off.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (m)
        off = `GMT${m[1]}${m[2].padStart(2, "0")}${(m[3] || "00").padStart(
          2,
          "0"
        )}`;
      const long =
        getCachedFormatter({ timeZone: targetTimezone, timeZoneName: "long" })
          .formatToParts(this)
          .find((pt) => pt.type === "timeZoneName")?.value || "";
      const mon = getCachedFormatter({ month: "short" }).format(this);
      return `${p.weekday} ${mon} ${p.day.padStart(2, "0")} ${p.year} ${
        p.hour
      }:${p.minute}:${p.second} ${off}${long ? ` (${long})` : ""}`;
    },
  };

  ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"].forEach(
    (m) => {
      const orig = dp[m];
      dateOverrides[m] = function (locales, options = {}) {
        const opt = { ...options };
        if (opt.timeZone === undefined) opt.timeZone = targetTimezone;
        return orig.call(this, locales, opt);
      };
    }
  );

  // Apply Date overrides
  for (const name in dateOverrides) {
    Object.defineProperty(dp, name, {
      value: wrapNative(
        dateOverrides[name],
        name,
        OriginalDate.prototype[name].length
      ),
      configurable: true,
      writable: true,
      enumerable: false,
    });
  }

  // Replace Global Date securely
  Object.defineProperty(window, "Date", {
    value: wrapNative(SpoofedDate, "Date", 7),
    configurable: true,
    writable: true,
    enumerable: false,
  });

  // --- Intl Override (Functional version for better stealth) ---

  const OriginalLocale = OriginalIntl.Locale;

  const SpoofedLocale = function (tag, options = {}) {
    const finalTag = tag || targetLocale;
    return Reflect.construct(
      OriginalLocale,
      [finalTag, options],
      new.target || SpoofedLocale
    );
  };
  SpoofedLocale.prototype = OriginalLocale.prototype;
  Object.defineProperty(OriginalLocale.prototype, "constructor", {
    value: SpoofedLocale,
    configurable: true,
    enumerable: false,
    writable: true,
  });

  const SpoofedDTF = function (locales, options = {}) {
    const loc = locales || targetLocale;
    const opt = { ...options };
    const isAuto = opt.timeZone === undefined;
    if (isAuto) opt.timeZone = targetTimezone;

    // Using Reflect.construct to get a real instance with correct internal slots
    const instance = Reflect.construct(
      OriginalDTF,
      [loc, opt],
      new.target || SpoofedDTF
    );
    if (isAuto) dtfInstances.add(instance);
    return instance;
  };

  SpoofedDTF.prototype = OriginalDTF.prototype;
  Object.defineProperty(OriginalDTF.prototype, "constructor", {
    value: SpoofedDTF,
    configurable: true,
    enumerable: false,
    writable: true,
  });

  // Copy statics
  Object.getOwnPropertyNames(OriginalDTF).forEach((prop) => {
    if (!Object.prototype.hasOwnProperty.call(SpoofedDTF, prop)) {
      const desc = Object.getOwnPropertyDescriptor(OriginalDTF, prop);
      if (desc) Object.defineProperty(SpoofedDTF, prop, desc);
    }
  });

  // Override resolvedOptions
  const origResolved = OriginalDTF.prototype.resolvedOptions;
  Object.defineProperty(OriginalDTF.prototype, "resolvedOptions", {
    value: wrapNative(
      function () {
        const res = origResolved.call(this);
        if (dtfInstances.has(this)) res.timeZone = targetTimezone;
        return res;
      },
      "resolvedOptions",
      0
    ),
    configurable: true,
    writable: true,
    enumerable: false,
  });

  // Inject into Intl
  Object.defineProperty(OriginalIntl, "DateTimeFormat", {
    value: wrapNative(SpoofedDTF, "DateTimeFormat", 0),
    configurable: true,
    writable: true,
    enumerable: false,
  });

  Object.defineProperty(OriginalIntl, "Locale", {
    value: wrapNative(SpoofedLocale, "Locale", 1),
    configurable: true,
    writable: true,
    enumerable: false,
  });

  // --- Intl.NumberFormat Override ---

  const SpoofedNF = function (locales, options = {}) {
    const opt = { ...options };
    const isAuto = opt.currency === undefined;
    if (isAuto && opt.style === "currency") opt.currency = targetCurrency;

    const instance = Reflect.construct(
      OriginalNF,
      [locales, opt],
      new.target || SpoofedNF
    );
    if (isAuto) nfInstances.add(instance);
    return instance;
  };

  SpoofedNF.prototype = OriginalNF.prototype;
  Object.defineProperty(OriginalNF.prototype, "constructor", {
    value: SpoofedNF,
    configurable: true,
    enumerable: false,
    writable: true,
  });

  Object.getOwnPropertyNames(OriginalNF).forEach((prop) => {
    if (!Object.prototype.hasOwnProperty.call(SpoofedNF, prop)) {
      const desc = Object.getOwnPropertyDescriptor(OriginalNF, prop);
      if (desc) Object.defineProperty(SpoofedNF, prop, desc);
    }
  });

  const origNFResolved = OriginalNF.prototype.resolvedOptions;
  Object.defineProperty(OriginalNF.prototype, "resolvedOptions", {
    value: wrapNative(
      function () {
        const res = origNFResolved.call(this);
        if (nfInstances.has(this)) {
          if (res.style === "currency") res.currency = targetCurrency;
        }
        return res;
      },
      "resolvedOptions",
      0
    ),
    configurable: true,
    writable: true,
    enumerable: false,
  });

  Object.defineProperty(OriginalIntl, "NumberFormat", {
    value: wrapNative(SpoofedNF, "NumberFormat", 0),
    configurable: true,
    writable: true,
    enumerable: false,
  });

  // --- Network Interception (IP Geo API Spoofing) ---

  const GEO_APIS = [
    "ipapi.co",
    "ip-api.com",
    "freegeoip.app",
    "ipgeolocation.io",
    "extreme-ip-lookup.com",
    "ipstack.com",
    "ipinfo.io",
    "ip-api.io",
    "ipwhois.io",
    "ipapi.com",
    "whatismyipaddress.com",
    "iplocation.net",
  ];

  const getSpoofedGeoData = (url) => {
    const isGeoApi =
      GEO_APIS.some((api) => url.includes(api)) ||
      (url.includes("json") &&
        (url.includes("ip") ||
          url.includes("geo") ||
          url.includes("location")));
    if (!isGeoApi) return null;

    // Common schema for many IP geo APIs
    return {
      timezone: targetTimezone,
      country_calling_code: targetCallingCode,
      currency: targetCurrency,
      country_code: targetCountryCode,
      country_name: targetCountryName,
      country: targetCountryCode,
      ip: "8.8.8.8",
      city: targetCity,
      region: targetCountryName,
      region_name: targetCountryName,
      location: {
        latitude: 0,
        longitude: 0,
        languages: [
          { code: targetLocale.split("-")[0], name: targetCountryName },
        ],
      },
    };
  };

  // Intercept fetch
  window.fetch = wrapNative(
    async function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0].url;
      const spoofedData = getSpoofedGeoData(url);

      if (spoofedData) {
        return new Response(JSON.stringify(spoofedData), {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" },
        });
      }

      return OriginalFetch.apply(this, args);
    },
    "fetch",
    1
  );

  // Intercept XHR
  window.XMLHttpRequest = wrapNative(
    function () {
      const xhr = new OriginalXHR();
      const originalOpen = xhr.open;

      xhr.open = function (method, url, ...rest) {
        this._url = url;
        return originalOpen.call(this, method, url, ...rest);
      };

      const originalSend = xhr.send;
      xhr.send = function (body) {
        const spoofedData = getSpoofedGeoData(this._url);
        if (spoofedData) {
          Object.defineProperty(this, "status", { value: 200 });
          Object.defineProperty(this, "readyState", { value: 4 });
          Object.defineProperty(this, "responseText", {
            value: JSON.stringify(spoofedData),
          });
          Object.defineProperty(this, "response", { value: spoofedData });

          if (this.onreadystatechange) this.onreadystatechange();
          if (this.onload) this.onload();
          return;
        }
        return originalSend.call(this, body);
      };

      return xhr;
    },
    "XMLHttpRequest",
    0
  );

  // --- Worker Support (Bulletproof) ---

  const getWorkerSpoofScript = () => `
    (() => {
      const targetTimezone = "${targetTimezone}";
      const targetLocale = "${targetLocale}";
      const targetCountryCode = "${targetCountryCode}";
      const targetCountryName = "${targetCountryName}";
      const targetCity = "${targetCity}";
      const targetCurrency = "${targetCurrency}";
      const targetCallingCode = "${targetCallingCode}";
      const OriginalDate = self.Date;
      const OriginalIntl = self.Intl;
      const OriginalDTF = OriginalIntl.DateTimeFormat;

      // Basic Date Spoof for Worker
      const dtf = new OriginalDTF("en-US", { 
        timeZone: targetTimezone,
        timeZoneName: "shortOffset" 
      });

      self.Date = function(...args) {
        if (!(this instanceof self.Date)) return new self.Date(...args).toString();
        const d = args.length === 0 ? new OriginalDate() : new OriginalDate(...args);
        Object.setPrototypeOf(d, self.Date.prototype);
        return d;
      };
      self.Date.prototype = OriginalDate.prototype;
      Object.assign(self.Date, OriginalDate);

      self.Date.prototype.getTimezoneOffset = function() {
        const p = dtf.formatToParts(this);
        const m = p.find(pt => pt.type === 'timeZoneName')?.value.match(/GMT([+-])(\\d+)/);
        if (!m) return 0;
        return -( (m[1] === '+' ? 1 : -1) * parseInt(m[2], 10) * 60 );
      };

      // Basic Intl Spoof for Worker
      const SpoofedDTF = function(locales, options = {}) {
        const opt = { ...options };
        if (opt.timeZone === undefined) opt.timeZone = targetTimezone;
        return new OriginalDTF(locales, opt);
      };
      SpoofedDTF.prototype = OriginalDTF.prototype;
      Object.assign(SpoofedDTF, OriginalDTF);
      self.Intl.DateTimeFormat = SpoofedDTF;

      // Network Interception for Worker
      const OriginalFetch = self.fetch;
      const GEO_APIS = ["ipapi.co", "ip-api.com", "freegeoip.app", "ipgeolocation.io", "extreme-ip-lookup.com", "ipstack.com", "ipinfo.io", "ip-api.io", "ipwhois.io", "ipapi.com"];
      const spoofedGeoData = {
        timezone: targetTimezone,
        country_calling_code: targetCallingCode,
        currency: targetCurrency,
        country_code: targetCountryCode,
        country_name: targetCountryName,
        country: targetCountryCode,
        ip: "8.8.8.8",
        city: targetCity,
        region: targetCountryName,
        region_name: targetCountryName,
        location: {
          latitude: 0,
          longitude: 0,
          languages: [{ code: targetLocale.split("-")[0], name: targetCountryName }],
        }
      };

      self.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        const isGeoApi = GEO_APIS.some(api => url.includes(api)) || (url.includes("json") && (url.includes("ip") || url.includes("geo")));
        if (isGeoApi) {
          return new Response(JSON.stringify(spoofedGeoData), {
            status: 200, statusText: "OK", headers: { "Content-Type": "application/json" }
          });
        }
        return OriginalFetch.apply(this, args);
      };
    })();
  `;

  const wrapWorker = (BaseWorker, name) => {
    if (!BaseWorker) return null;
    const ProxyWorker = function (scriptURL, options) {
      if (
        (typeof scriptURL === "string" || scriptURL instanceof URL) &&
        !scriptURL.toString().startsWith("blob:")
      ) {
        try {
          // Resolve relative URLs to absolute ones before wrapping in a Blob
          const absoluteURL = new URL(scriptURL, window.location.href).href;
          const blob = new Blob(
            [getWorkerSpoofScript(), `\nimportScripts("${absoluteURL}");`],
            { type: "application/javascript" }
          );
          const finalURL = URL.createObjectURL(blob);
          return new BaseWorker(finalURL, options);
        } catch (e) {
          console.error(
            `Timezone Spoofer: Failed to wrap ${name}, falling back.`,
            e
          );
          return new BaseWorker(scriptURL, options);
        }
      }
      return new BaseWorker(scriptURL, options);
    };
    return wrapNative(ProxyWorker, name, 1);
  };

  if (OriginalWorker) window.Worker = wrapWorker(OriginalWorker, "Worker");
  if (OriginalSharedWorker)
    window.SharedWorker = wrapWorker(OriginalSharedWorker, "SharedWorker");
})();
