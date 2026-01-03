/**
 * MetadataService - Maps timezones to country-specific metadata (Calling Code, Currency, Locale, Country Name)
 */
export class MetadataService {
  // Mapping of Country Code -> { callingCode, currency, locale, countryName }
  static metaMap = {
    US: {
      callingCode: "+1",
      currency: "USD",
      locale: "en-US",
      countryName: "United States",
    },
    GB: {
      callingCode: "+44",
      currency: "GBP",
      locale: "en-GB",
      countryName: "United Kingdom",
    },
    FR: {
      callingCode: "+33",
      currency: "EUR",
      locale: "fr-FR",
      countryName: "France",
    },
    DE: {
      callingCode: "+49",
      currency: "EUR",
      locale: "de-DE",
      countryName: "Germany",
    },
    JP: {
      callingCode: "+81",
      currency: "JPY",
      locale: "ja-JP",
      countryName: "Japan",
    },
    CN: {
      callingCode: "+86",
      currency: "CNY",
      locale: "zh-CN",
      countryName: "China",
    },
    IN: {
      callingCode: "+91",
      currency: "INR",
      locale: "hi-IN",
      countryName: "India",
    },
    BR: {
      callingCode: "+55",
      currency: "BRL",
      locale: "pt-BR",
      countryName: "Brazil",
    },
    RU: {
      callingCode: "+7",
      currency: "RUB",
      locale: "ru-RU",
      countryName: "Russia",
    },
    CA: {
      callingCode: "+1",
      currency: "CAD",
      locale: "en-CA",
      countryName: "Canada",
    },
    AU: {
      callingCode: "+61",
      currency: "AUD",
      locale: "en-AU",
      countryName: "Australia",
    },
    IR: {
      callingCode: "+98",
      currency: "IRR",
      locale: "fa-IR",
      countryName: "Iran",
    },
    AE: {
      callingCode: "+971",
      currency: "AED",
      locale: "ar-AE",
      countryName: "United Arab Emirates",
    },
    SA: {
      callingCode: "+966",
      currency: "SAR",
      locale: "ar-SA",
      countryName: "Saudi Arabia",
    },
    TR: {
      callingCode: "+90",
      currency: "TRY",
      locale: "tr-TR",
      countryName: "Turkey",
    },
    IT: {
      callingCode: "+39",
      currency: "EUR",
      locale: "it-IT",
      countryName: "Italy",
    },
    ES: {
      callingCode: "+34",
      currency: "EUR",
      locale: "es-ES",
      countryName: "Spain",
    },
    NL: {
      callingCode: "+31",
      currency: "EUR",
      locale: "nl-NL",
      countryName: "Netherlands",
    },
    CH: {
      callingCode: "+41",
      currency: "CHF",
      locale: "de-CH",
      countryName: "Switzerland",
    },
    SG: {
      callingCode: "+65",
      currency: "SGD",
      locale: "en-SG",
      countryName: "Singapore",
    },
    ID: {
      callingCode: "+62",
      currency: "IDR",
      locale: "id-ID",
      countryName: "Indonesia",
    },
    KR: {
      callingCode: "+82",
      currency: "KRW",
      locale: "ko-KR",
      countryName: "South Korea",
    },
    TH: {
      callingCode: "+66",
      currency: "THB",
      locale: "th-TH",
      countryName: "Thailand",
    },
    VN: {
      callingCode: "+84",
      currency: "VND",
      locale: "vi-VN",
      countryName: "Vietnam",
    },
    EG: {
      callingCode: "+20",
      currency: "EGP",
      locale: "ar-EG",
      countryName: "Egypt",
    },
    ZA: {
      callingCode: "+27",
      currency: "ZAR",
      locale: "en-ZA",
      countryName: "South Africa",
    },
    MX: {
      callingCode: "+52",
      currency: "MXN",
      locale: "es-MX",
      countryName: "Mexico",
    },
    AR: {
      callingCode: "+54",
      currency: "ARS",
      locale: "es-AR",
      countryName: "Argentina",
    },
  };

  // Helper to guess country code from timezone ID
  static getCountryCodeFromTZ(tz) {
    if (!tz || tz === "UTC") return "US";

    const tzLower = tz.toLowerCase();

    const cityMap = {
      london: "GB",
      paris: "FR",
      berlin: "DE",
      tokyo: "JP",
      shanghai: "CN",
      beijing: "CN",
      kolkata: "IN",
      delhi: "IN",
      mumbai: "IN",
      new_york: "US",
      los_angeles: "US",
      chicago: "US",
      toronto: "CA",
      vancouver: "CA",
      tehran: "IR",
      dubai: "AE",
      riyadh: "SA",
      istanbul: "TR",
      rome: "IT",
      madrid: "ES",
      amsterdam: "NL",
      zurich: "CH",
      singapore: "SG",
      sao_paulo: "BR",
      moscow: "RU",
      jakarta: "ID",
      seoul: "KR",
      bangkok: "TH",
      ho_chi_minh: "VN",
      cairo: "EG",
      johannesburg: "ZA",
      mexico_city: "MX",
      buenos_aires: "AR",
    };

    for (const [city, code] of Object.entries(cityMap)) {
      if (tzLower.includes(city)) return code;
    }

    // Fallback based on region
    if (tzLower.startsWith("america/")) return "US";
    if (tzLower.startsWith("europe/")) return "GB";
    if (tzLower.startsWith("asia/")) return "CN";
    if (tzLower.startsWith("africa/")) return "ZA";
    if (tzLower.startsWith("australia/")) return "AU";

    return "US";
  }

  static getMetadata(tz) {
    const countryCode = this.getCountryCodeFromTZ(tz);
    const city = tz.split("/").pop().replace(/_/g, " ");
    const meta = this.metaMap[countryCode] || {
      callingCode: "+0",
      currency: "USD",
      locale: "en-US",
      countryName: "United States",
    };

    return {
      ...meta,
      countryCode,
      city,
    };
  }
}
