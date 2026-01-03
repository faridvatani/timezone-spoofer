/**
 * GeoService - Handles IP-based geolocation and metadata
 */
export class GeoService {
  /**
   * Fetches location data based on the user's current IP.
   * Uses ipapi.co (free tier, no key required for basic usage).
   */
  static async fetchLocation() {
    try {
      const response = await fetch("https://ipapi.co/json/");
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();

      return {
        ip: data.ip,
        timezone: data.timezone,
        country: data.country_name,
        countryCode: data.country_code, // e.g., 'US'
        callingCode: data.country_calling_code, // e.g., '+1'
        currency: data.currency, // e.g., 'USD'
        city: data.city,
      };
    } catch (error) {
      console.error("GeoService Error:", error);
      return null;
    }
  }
}
