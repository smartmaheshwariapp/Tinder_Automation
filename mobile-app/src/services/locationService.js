// mobile-app/src/services/locationService.js
// Physical Device GPS & Geolocation Service for Linksy / FlirtEasy
import { Platform, Linking } from 'react-native';
import * as Location from 'expo-location';

export class LocationService {
  /**
   * Check current foreground location permission status
   */
  static async checkLocationPermissions() {
    if (!Location || !Location.getForegroundPermissionsAsync) {
      return { status: 'undetermined', granted: false, canAskAgain: true };
    }
    try {
      const response = await Location.getForegroundPermissionsAsync();
      return {
        status: response.status,
        granted: !!response.granted,
        canAskAgain: response.canAskAgain !== false,
      };
    } catch (err) {
      console.warn('[LocationService] Error checking permissions:', err.message);
      return { status: 'undetermined', granted: false, canAskAgain: true };
    }
  }

  /**
   * Prompt user for physical foreground location permission
   */
  static async requestLocationPermissions() {
    if (!Location || !Location.requestForegroundPermissionsAsync) {
      return { status: 'granted', granted: true, canAskAgain: true };
    }
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      return {
        status: response.status,
        granted: !!response.granted,
        canAskAgain: response.canAskAgain !== false,
      };
    } catch (err) {
      console.warn('[LocationService] Error requesting permissions:', err.message);
      return { status: 'denied', granted: false, canAskAgain: false };
    }
  }

  /**
   * Check whether physical GPS / device location service is switched on
   */
  static async isLocationServicesEnabled() {
    if (!Location || !Location.hasServicesEnabledAsync) {
      return true;
    }
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (_) {
      return true;
    }
  }

  /**
   * On Android, trigger Google Play services prompt to turn on location provider
   */
  static async enableNetworkProvider() {
    if (Platform.OS === 'android' && Location && Location.enableNetworkProviderAsync) {
      try {
        await Location.enableNetworkProviderAsync();
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  /**
   * Open native device settings for the Linksy app
   */
  static async openDeviceSettings() {
    try {
      await Linking.openSettings();
      return true;
    } catch (err) {
      console.warn('[LocationService] Failed to open settings:', err.message);
      return false;
    }
  }

  /**
   * Reverse geocode latitude and longitude to a human-readable city and country
   */
  static async reverseGeocodeCoords(latitude, longitude) {
    // 1. Try native Expo reverse geocoding
    if (Location && Location.reverseGeocodeAsync && Platform.OS !== 'web') {
      try {
        const reversePromise = Location.reverseGeocodeAsync({ latitude, longitude });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Native reverse geocode timeout')), 3000)
        );
        const results = await Promise.race([reversePromise, timeoutPromise]);
        if (results && results.length > 0) {
          const place = results[0];
          const city = place.city || place.subregion || place.district || place.name || 'Local City';
          const country = place.country || place.isoCountryCode || '';
          const region = place.region || '';
          const formattedName = country ? `${city}, ${country}` : city;
          return {
            city,
            country,
            region,
            cityName: formattedName,
          };
        }
      } catch (err) {
        console.warn('[LocationService] Native reverse geocode warning:', err.message);
      }
    }

    // 2. Fallback to OpenStreetMap Nominatim reverse geocode (network request)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'LinksyDatingApp/1.0' },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const city = address.city || address.town || address.village || address.municipality || address.state || 'Local Area';
        const country = address.country || '';
        const formattedName = country ? `${city}, ${country}` : city;
        return {
          city,
          country,
          region: address.state || '',
          cityName: formattedName,
        };
      }
    } catch (_) {}

    return {
      city: 'Local Area',
      country: '',
      region: '',
      cityName: `${Number(latitude).toFixed(3)}°, ${Number(longitude).toFixed(3)}°`,
    };
  }

  /**
   * Fallback IP Geolocation for simulation, web, or when GPS hardware is indoor/unavailable
   */
  static async getFallbackIpLocation() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://freeipapi.com/api/json', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          const city = data.cityName || 'Local Area';
          const country = data.countryName || '';
          return {
            success: true,
            latitude: data.latitude,
            longitude: data.longitude,
            cityName: country ? `${city}, ${country}` : city,
            city,
            country,
            region: data.regionName || '',
            isFallback: true,
          };
        }
      }
    } catch (_) {}

    // Ultimate fallback: default metropolitan coordinates
    return {
      success: true,
      latitude: 40.7128,
      longitude: -74.0060,
      cityName: 'New York, United States',
      city: 'New York',
      country: 'United States',
      region: 'NY',
      isFallback: true,
    };
  }

  /**
   * High-level acquisition method:
   * 1. Verifies/requests permission
   * 2. Checks & enables GPS if possible
   * 3. Obtains current/last known GPS coordinates
   * 4. Reverse geocodes to city name
   */
  static async requestAndGetDeviceLocation() {
    // 1. Permission check & request
    let perm = await this.checkLocationPermissions();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        perm = await this.requestLocationPermissions();
      }
    }

    if (!perm.granted) {
      return {
        success: false,
        error: perm.canAskAgain
          ? 'Location access was not granted.'
          : 'Location access is disabled in device settings.',
        code: perm.canAskAgain ? 'PERMISSION_DENIED' : 'PERMISSION_BLOCKED',
        canAskAgain: perm.canAskAgain,
      };
    }

    // 2. Hardware GPS switch check
    let servicesOn = await this.isLocationServicesEnabled();
    if (!servicesOn) {
      // Try enabling network provider on Android
      const enabled = await this.enableNetworkProvider();
      if (!enabled) {
        servicesOn = await this.isLocationServicesEnabled();
      }
      if (!servicesOn) {
        return {
          success: false,
          error: 'Location services are turned off on your device. Please turn on GPS in your device settings.',
          code: 'SERVICES_DISABLED',
          canAskAgain: true,
        };
      }
    }

    // 3. Acquire GPS coordinates
    let coords = null;

    // Fast-path: Check last known position first (instantaneous response)
    if (Location && Location.getLastKnownPositionAsync) {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown && lastKnown.coords) {
          coords = lastKnown.coords;
        }
      } catch (_) {}
    }

    // Active fix: Try getCurrentPositionAsync with a 6-second race
    if (Location && Location.getCurrentPositionAsync) {
      try {
        const positionPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy ? Location.Accuracy.Balanced : 3,
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('GPS fix timeout')), 6000)
        );
        const position = await Promise.race([positionPromise, timeoutPromise]);
        if (position && position.coords) {
          coords = position.coords;
        }
      } catch (posErr) {
        console.warn('[LocationService] Live GPS fetch notice:', posErr.message);
      }
    }

    // If native GPS did not return coordinates, use IP geolocation fallback
    if (!coords) {
      const ipFallback = await this.getFallbackIpLocation();
      return ipFallback;
    }

    const { latitude, longitude } = coords;

    // 4. Reverse geocode
    const geoInfo = await this.reverseGeocodeCoords(latitude, longitude);

    return {
      success: true,
      latitude,
      longitude,
      cityName: geoInfo.cityName,
      city: geoInfo.city,
      country: geoInfo.country,
      region: geoInfo.region,
    };
  }
}

export default LocationService;

