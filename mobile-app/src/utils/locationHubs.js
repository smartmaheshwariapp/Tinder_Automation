// mobile-app/src/utils/locationHubs.js
// Complete Global Dating Hubs & Country Matrix for all 32 supported languages

export const REGION_FILTERS = [
  'All',
  'Popular',
  'Americas',
  'Europe',
  'Asia & Pacific',
  'Middle East & Africa',
];

export const LANGUAGE_TO_HUBS_MAP = {
  ar: 'Arabic',
  bn: 'Bengali',
  zh: 'Chinese',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  no: 'Norwegian',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  es: 'Spanish',
  sw: 'Swahili',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
};

export const CITY_PRESETS = [
  // ── English (en) ──
  { id: 'nyc', name: 'New York, USA', short: 'New York', country: 'United States', flag: '🇺🇸', lang: 'English', langCode: 'en', latitude: 40.7128, longitude: -74.0060, region: 'Americas', popular: true },
  { id: 'london', name: 'London, UK', short: 'London', country: 'United Kingdom', flag: '🇬🇧', lang: 'English', langCode: 'en', latitude: 51.5074, longitude: -0.1278, region: 'Europe', popular: true },
  { id: 'la', name: 'Los Angeles, USA', short: 'Los Angeles', country: 'United States', flag: '🌴', lang: 'English', langCode: 'en', latitude: 34.0522, longitude: -118.2437, region: 'Americas', popular: true },
  { id: 'miami', name: 'Miami, USA', short: 'Miami', country: 'United States', flag: '🏖️', lang: 'English', langCode: 'en', latitude: 25.7617, longitude: -80.1918, region: 'Americas', popular: true },
  { id: 'sydney', name: 'Sydney, Australia', short: 'Sydney', country: 'Australia', flag: '🇦🇺', lang: 'English', langCode: 'en', latitude: -33.8688, longitude: 151.2093, region: 'Asia & Pacific', popular: true },
  { id: 'melbourne', name: 'Melbourne, Australia', short: 'Melbourne', country: 'Australia', flag: '🇦🇺', lang: 'English', langCode: 'en', latitude: -37.8136, longitude: 144.9631, region: 'Asia & Pacific', popular: false },
  { id: 'toronto', name: 'Toronto, Canada', short: 'Toronto', country: 'Canada', flag: '🇨🇦', lang: 'English', langCode: 'en', latitude: 43.6532, longitude: -79.3832, region: 'Americas', popular: false },
  { id: 'dublin', name: 'Dublin, Ireland', short: 'Dublin', country: 'Ireland', flag: '🇮🇪', lang: 'English', langCode: 'en', latitude: 53.3498, longitude: -6.2603, region: 'Europe', popular: false },
  { id: 'auckland', name: 'Auckland, New Zealand', short: 'Auckland', country: 'New Zealand', flag: '🇳🇿', lang: 'English', langCode: 'en', latitude: -36.8485, longitude: 174.7633, region: 'Asia & Pacific', popular: false },
  { id: 'singapore', name: 'Singapore', short: 'Singapore', country: 'Singapore', flag: '🇸🇬', lang: 'English', langCode: 'en', latitude: 1.3521, longitude: 103.8198, region: 'Asia & Pacific', popular: true },
  { id: 'capetown', name: 'Cape Town, South Africa', short: 'Cape Town', country: 'South Africa', flag: '🇿🇦', lang: 'English', langCode: 'en', latitude: -33.9249, longitude: 18.4241, region: 'Middle East & Africa', popular: false },

  // ── Spanish (es) ──
  { id: 'madrid', name: 'Madrid, Spain', short: 'Madrid', country: 'Spain', flag: '🇪🇸', lang: 'Spanish', langCode: 'es', latitude: 40.4168, longitude: -3.7038, region: 'Europe', popular: true },
  { id: 'barcelona', name: 'Barcelona, Spain', short: 'Barcelona', country: 'Spain', flag: '🇪🇸', lang: 'Spanish', langCode: 'es', latitude: 41.3851, longitude: 2.1734, region: 'Europe', popular: true },
  { id: 'cdmx', name: 'Mexico City, Mexico', short: 'Mexico City', country: 'Mexico', flag: '🇲🇽', lang: 'Spanish', langCode: 'es', latitude: 19.4326, longitude: -99.1332, region: 'Americas', popular: true },
  { id: 'buenosaires', name: 'Buenos Aires, Argentina', short: 'Buenos Aires', country: 'Argentina', flag: '🇦🇷', lang: 'Spanish', langCode: 'es', latitude: -34.6037, longitude: -58.3816, region: 'Americas', popular: false },
  { id: 'bogota', name: 'Bogotá, Colombia', short: 'Bogotá', country: 'Colombia', flag: '🇨🇴', lang: 'Spanish', langCode: 'es', latitude: 4.7110, longitude: -74.0721, region: 'Americas', popular: false },
  { id: 'medellin', name: 'Medellín, Colombia', short: 'Medellín', country: 'Colombia', flag: '🇨🇴', lang: 'Spanish', langCode: 'es', latitude: 6.2442, longitude: -75.5812, region: 'Americas', popular: false },
  { id: 'santiago', name: 'Santiago, Chile', short: 'Santiago', country: 'Chile', flag: '🇨🇱', lang: 'Spanish', langCode: 'es', latitude: -33.4489, longitude: -70.6693, region: 'Americas', popular: false },
  { id: 'lima', name: 'Lima, Peru', short: 'Lima', country: 'Peru', flag: '🇵🇪', lang: 'Spanish', langCode: 'es', latitude: -12.0464, longitude: -77.0428, region: 'Americas', popular: false },

  // ── French (fr) ──
  { id: 'paris', name: 'Paris, France', short: 'Paris', country: 'France', flag: '🇫🇷', lang: 'French', langCode: 'fr', latitude: 48.8566, longitude: 2.3522, region: 'Europe', popular: true },
  { id: 'montreal', name: 'Montreal, Canada', short: 'Montreal', country: 'Canada', flag: '🇨🇦', lang: 'French', langCode: 'fr', latitude: 45.5017, longitude: -73.5673, region: 'Americas', popular: false },
  { id: 'brussels', name: 'Brussels, Belgium', short: 'Brussels', country: 'Belgium', flag: '🇧🇪', lang: 'French', langCode: 'fr', latitude: 50.8503, longitude: 4.3517, region: 'Europe', popular: false },
  { id: 'geneva', name: 'Geneva, Switzerland', short: 'Geneva', country: 'Switzerland', flag: '🇨🇭', lang: 'French', langCode: 'fr', latitude: 46.2044, longitude: 6.1432, region: 'Europe', popular: false },

  // ── German (de) ──
  { id: 'berlin', name: 'Berlin, Germany', short: 'Berlin', country: 'Germany', flag: '🇩🇪', lang: 'German', langCode: 'de', latitude: 52.5200, longitude: 13.4050, region: 'Europe', popular: true },
  { id: 'munich', name: 'Munich, Germany', short: 'Munich', country: 'Germany', flag: '🇩🇪', lang: 'German', langCode: 'de', latitude: 48.1351, longitude: 11.5820, region: 'Europe', popular: false },
  { id: 'vienna', name: 'Vienna, Austria', short: 'Vienna', country: 'Austria', flag: '🇦🇹', lang: 'German', langCode: 'de', latitude: 48.2082, longitude: 16.3738, region: 'Europe', popular: false },
  { id: 'zurich', name: 'Zurich, Switzerland', short: 'Zurich', country: 'Switzerland', flag: '🇨🇭', lang: 'German', langCode: 'de', latitude: 47.3769, longitude: 8.5417, region: 'Europe', popular: false },

  // ── Italian (it) ──
  { id: 'rome', name: 'Rome, Italy', short: 'Rome', country: 'Italy', flag: '🇮🇹', lang: 'Italian', langCode: 'it', latitude: 41.9028, longitude: 12.4964, region: 'Europe', popular: true },
  { id: 'milan', name: 'Milan, Italy', short: 'Milan', country: 'Italy', flag: '🇮🇹', lang: 'Italian', langCode: 'it', latitude: 45.4642, longitude: 9.1900, region: 'Europe', popular: false },
  { id: 'florence', name: 'Florence, Italy', short: 'Florence', country: 'Italy', flag: '🇮🇹', lang: 'Italian', langCode: 'it', latitude: 43.7696, longitude: 11.2558, region: 'Europe', popular: false },

  // ── Portuguese (pt) ──
  { id: 'saopaulo', name: 'São Paulo, Brazil', short: 'São Paulo', country: 'Brazil', flag: '🇧🇷', lang: 'Portuguese', langCode: 'pt', latitude: -23.5505, longitude: -46.6333, region: 'Americas', popular: true },
  { id: 'rio', name: 'Rio de Janeiro, Brazil', short: 'Rio', country: 'Brazil', flag: '🇧🇷', lang: 'Portuguese', langCode: 'pt', latitude: -22.9068, longitude: -43.1729, region: 'Americas', popular: false },
  { id: 'lisbon', name: 'Lisbon, Portugal', short: 'Lisbon', country: 'Portugal', flag: '🇵🇹', lang: 'Portuguese', langCode: 'pt', latitude: 38.7223, longitude: -9.1393, region: 'Europe', popular: false },
  { id: 'porto', name: 'Porto, Portugal', short: 'Porto', country: 'Portugal', flag: '🇵🇹', lang: 'Portuguese', langCode: 'pt', latitude: 41.1579, longitude: -8.6291, region: 'Europe', popular: false },

  // ── Japanese (ja) ──
  { id: 'tokyo', name: 'Tokyo, Japan', short: 'Tokyo', country: 'Japan', flag: '🇯🇵', lang: 'Japanese', langCode: 'ja', latitude: 35.6762, longitude: 139.6503, region: 'Asia & Pacific', popular: true },
  { id: 'osaka', name: 'Osaka, Japan', short: 'Osaka', country: 'Japan', flag: '🇯🇵', lang: 'Japanese', langCode: 'ja', latitude: 34.6937, longitude: 135.5023, region: 'Asia & Pacific', popular: false },
  { id: 'kyoto', name: 'Kyoto, Japan', short: 'Kyoto', country: 'Japan', flag: '🇯🇵', lang: 'Japanese', langCode: 'ja', latitude: 35.0116, longitude: 135.7681, region: 'Asia & Pacific', popular: false },

  // ── Korean (ko) ──
  { id: 'seoul', name: 'Seoul, South Korea', short: 'Seoul', country: 'South Korea', flag: '🇰🇷', lang: 'Korean', langCode: 'ko', latitude: 37.5665, longitude: 126.9780, region: 'Asia & Pacific', popular: true },
  { id: 'busan', name: 'Busan, South Korea', short: 'Busan', country: 'South Korea', flag: '🇰🇷', lang: 'Korean', langCode: 'ko', latitude: 35.1796, longitude: 129.0756, region: 'Asia & Pacific', popular: false },

  // ── Chinese (zh) ──
  { id: 'taipei', name: 'Taipei, Taiwan', short: 'Taipei', country: 'Taiwan', flag: '🇹🇼', lang: 'Chinese', langCode: 'zh', latitude: 25.0330, longitude: 121.5654, region: 'Asia & Pacific', popular: true },
  { id: 'hongkong', name: 'Hong Kong', short: 'Hong Kong', country: 'Hong Kong', flag: '🇭🇰', lang: 'Chinese', langCode: 'zh', latitude: 22.3193, longitude: 114.1694, region: 'Asia & Pacific', popular: true },
  { id: 'shanghai', name: 'Shanghai, China', short: 'Shanghai', country: 'China', flag: '🇨🇳', lang: 'Chinese', langCode: 'zh', latitude: 31.2304, longitude: 121.4737, region: 'Asia & Pacific', popular: false },
  { id: 'beijing', name: 'Beijing, China', short: 'Beijing', country: 'China', flag: '🇨🇳', lang: 'Chinese', langCode: 'zh', latitude: 39.9042, longitude: 116.4074, region: 'Asia & Pacific', popular: false },

  // ── Hindi (hi) ──
  { id: 'mumbai', name: 'Mumbai, India', short: 'Mumbai', country: 'India', flag: '🇮🇳', lang: 'Hindi', langCode: 'hi', latitude: 19.0760, longitude: 72.8777, region: 'Asia & Pacific', popular: true },
  { id: 'delhi', name: 'New Delhi, India', short: 'New Delhi', country: 'India', flag: '🇮🇳', lang: 'Hindi', langCode: 'hi', latitude: 28.6139, longitude: 77.2090, region: 'Asia & Pacific', popular: false },
  { id: 'bangalore', name: 'Bangalore, India', short: 'Bangalore', country: 'India', flag: '🇮🇳', lang: 'Hindi', langCode: 'hi', latitude: 12.9716, longitude: 77.5946, region: 'Asia & Pacific', popular: false },
  { id: 'goa', name: 'Goa, India', short: 'Goa', country: 'India', flag: '🌴', lang: 'Hindi', langCode: 'hi', latitude: 15.2993, longitude: 74.1240, region: 'Asia & Pacific', popular: false },

  // ── Arabic (ar) ──
  { id: 'dubai', name: 'Dubai, UAE', short: 'Dubai', country: 'United Arab Emirates', flag: '🇦🇪', lang: 'Arabic', langCode: 'ar', latitude: 25.2048, longitude: 55.2708, region: 'Middle East & Africa', popular: true },
  { id: 'riyadh', name: 'Riyadh, Saudi Arabia', short: 'Riyadh', country: 'Saudi Arabia', flag: '🇸🇦', lang: 'Arabic', langCode: 'ar', latitude: 24.7136, longitude: 46.6753, region: 'Middle East & Africa', popular: false },
  { id: 'cairo', name: 'Cairo, Egypt', short: 'Cairo', country: 'Egypt', flag: '🇪🇬', lang: 'Arabic', langCode: 'ar', latitude: 30.0444, longitude: 31.2357, region: 'Middle East & Africa', popular: false },
  { id: 'doha', name: 'Doha, Qatar', short: 'Doha', country: 'Qatar', flag: '🇶🇦', lang: 'Arabic', langCode: 'ar', latitude: 25.2854, longitude: 51.5310, region: 'Middle East & Africa', popular: false },
  { id: 'beirut', name: 'Beirut, Lebanon', short: 'Beirut', country: 'Lebanon', flag: '🇱🇧', lang: 'Arabic', langCode: 'ar', latitude: 33.8938, longitude: 35.5018, region: 'Middle East & Africa', popular: false },

  // ── Dutch (nl) ──
  { id: 'amsterdam', name: 'Amsterdam, Netherlands', short: 'Amsterdam', country: 'Netherlands', flag: '🇳🇱', lang: 'Dutch', langCode: 'nl', latitude: 52.3676, longitude: 4.9041, region: 'Europe', popular: true },
  { id: 'rotterdam', name: 'Rotterdam, Netherlands', short: 'Rotterdam', country: 'Netherlands', flag: '🇳🇱', lang: 'Dutch', langCode: 'nl', latitude: 51.9244, longitude: 4.4777, region: 'Europe', popular: false },
  { id: 'antwerp', name: 'Antwerp, Belgium', short: 'Antwerp', country: 'Belgium', flag: '🇧🇪', lang: 'Dutch', langCode: 'nl', latitude: 51.2194, longitude: 4.4025, region: 'Europe', popular: false },

  // ── Turkish (tr) ──
  { id: 'istanbul', name: 'Istanbul, Turkey', short: 'Istanbul', country: 'Turkey', flag: '🇹🇷', lang: 'Turkish', langCode: 'tr', latitude: 41.0082, longitude: 28.9784, region: 'Europe', popular: true },
  { id: 'ankara', name: 'Ankara, Turkey', short: 'Ankara', country: 'Turkey', flag: '🇹🇷', lang: 'Turkish', langCode: 'tr', latitude: 39.9334, longitude: 32.8597, region: 'Europe', popular: false },
  { id: 'antalya', name: 'Antalya, Turkey', short: 'Antalya', country: 'Turkey', flag: '🇹🇷', lang: 'Turkish', langCode: 'tr', latitude: 36.8969, longitude: 30.7133, region: 'Europe', popular: false },

  // ── Polish (pl) ──
  { id: 'warsaw', name: 'Warsaw, Poland', short: 'Warsaw', country: 'Poland', flag: '🇵🇱', lang: 'Polish', langCode: 'pl', latitude: 52.2297, longitude: 21.0122, region: 'Europe', popular: false },
  { id: 'krakow', name: 'Kraków, Poland', short: 'Kraków', country: 'Poland', flag: '🇵🇱', lang: 'Polish', langCode: 'pl', latitude: 50.0647, longitude: 19.9450, region: 'Europe', popular: false },

  // ── Swedish (sv) ──
  { id: 'stockholm', name: 'Stockholm, Sweden', short: 'Stockholm', country: 'Sweden', flag: '🇸🇪', lang: 'Swedish', langCode: 'sv', latitude: 59.3293, longitude: 18.0686, region: 'Europe', popular: false },
  { id: 'gothenburg', name: 'Gothenburg, Sweden', short: 'Gothenburg', country: 'Sweden', flag: '🇸🇪', lang: 'Swedish', langCode: 'sv', latitude: 57.7089, longitude: 11.9746, region: 'Europe', popular: false },

  // ── Norwegian (no) ──
  { id: 'oslo', name: 'Oslo, Norway', short: 'Oslo', country: 'Norway', flag: '🇳🇴', lang: 'Norwegian', langCode: 'no', latitude: 59.9139, longitude: 10.7522, region: 'Europe', popular: false },
  { id: 'bergen', name: 'Bergen, Norway', short: 'Bergen', country: 'Norway', flag: '🇳🇴', lang: 'Norwegian', langCode: 'no', latitude: 60.3913, longitude: 5.3221, region: 'Europe', popular: false },

  // ── Danish (da) ──
  { id: 'copenhagen', name: 'Copenhagen, Denmark', short: 'Copenhagen', country: 'Denmark', flag: '🇩🇰', lang: 'Danish', langCode: 'da', latitude: 55.6761, longitude: 12.5683, region: 'Europe', popular: false },
  { id: 'aarhus', name: 'Aarhus, Denmark', short: 'Aarhus', country: 'Denmark', flag: '🇩🇰', lang: 'Danish', langCode: 'da', latitude: 56.1629, longitude: 10.2039, region: 'Europe', popular: false },

  // ── Finnish (fi) ──
  { id: 'helsinki', name: 'Helsinki, Finland', short: 'Helsinki', country: 'Finland', flag: '🇫🇮', lang: 'Finnish', langCode: 'fi', latitude: 60.1699, longitude: 24.9384, region: 'Europe', popular: false },
  { id: 'tampere', name: 'Tampere, Finland', short: 'Tampere', country: 'Finland', flag: '🇫🇮', lang: 'Finnish', langCode: 'fi', latitude: 61.4978, longitude: 23.7610, region: 'Europe', popular: false },

  // ── Greek (el) ──
  { id: 'athens', name: 'Athens, Greece', short: 'Athens', country: 'Greece', flag: '🇬🇷', lang: 'Greek', langCode: 'el', latitude: 37.9838, longitude: 23.7275, region: 'Europe', popular: false },
  { id: 'thessaloniki', name: 'Thessaloniki, Greece', short: 'Thessaloniki', country: 'Greece', flag: '🇬🇷', lang: 'Greek', langCode: 'el', latitude: 40.6401, longitude: 22.9444, region: 'Europe', popular: false },
  { id: 'santorini', name: 'Santorini, Greece', short: 'Santorini', country: 'Greece', flag: '🇬🇷', lang: 'Greek', langCode: 'el', latitude: 36.3932, longitude: 25.4615, region: 'Europe', popular: false },

  // ── Hebrew (he) ──
  { id: 'telaviv', name: 'Tel Aviv, Israel', short: 'Tel Aviv', country: 'Israel', flag: '🇮🇱', lang: 'Hebrew', langCode: 'he', latitude: 32.0853, longitude: 34.7818, region: 'Middle East & Africa', popular: true },
  { id: 'jerusalem', name: 'Jerusalem, Israel', short: 'Jerusalem', country: 'Israel', flag: '🇮🇱', lang: 'Hebrew', langCode: 'he', latitude: 31.7683, longitude: 35.2137, region: 'Middle East & Africa', popular: false },

  // ── Thai (th) ──
  { id: 'bangkok', name: 'Bangkok, Thailand', short: 'Bangkok', country: 'Thailand', flag: '🇹🇭', lang: 'Thai', langCode: 'th', latitude: 13.7563, longitude: 100.5018, region: 'Asia & Pacific', popular: true },
  { id: 'phuket', name: 'Phuket, Thailand', short: 'Phuket', country: 'Thailand', flag: '🇹🇭', lang: 'Thai', langCode: 'th', latitude: 7.8804, longitude: 98.3923, region: 'Asia & Pacific', popular: false },
  { id: 'chiangmai', name: 'Chiang Mai, Thailand', short: 'Chiang Mai', country: 'Thailand', flag: '🇹🇭', lang: 'Thai', langCode: 'th', latitude: 18.7883, longitude: 98.9853, region: 'Asia & Pacific', popular: false },

  // ── Vietnamese (vi) ──
  { id: 'saigon', name: 'Ho Chi Minh City, Vietnam', short: 'Saigon', country: 'Vietnam', flag: '🇻🇳', lang: 'Vietnamese', langCode: 'vi', latitude: 10.8231, longitude: 106.6297, region: 'Asia & Pacific', popular: false },
  { id: 'hanoi', name: 'Hanoi, Vietnam', short: 'Hanoi', country: 'Vietnam', flag: '🇻🇳', lang: 'Vietnamese', langCode: 'vi', latitude: 21.0285, longitude: 105.8542, region: 'Asia & Pacific', popular: false },
  { id: 'danang', name: 'Da Nang, Vietnam', short: 'Da Nang', country: 'Vietnam', flag: '🇻🇳', lang: 'Vietnamese', langCode: 'vi', latitude: 16.0544, longitude: 108.2022, region: 'Asia & Pacific', popular: false },

  // ── Indonesian (id) ──
  { id: 'jakarta', name: 'Jakarta, Indonesia', short: 'Jakarta', country: 'Indonesia', flag: '🇮🇩', lang: 'Indonesian', langCode: 'id', latitude: -6.2088, longitude: 106.8456, region: 'Asia & Pacific', popular: false },
  { id: 'bali', name: 'Bali / Denpasar, Indonesia', short: 'Bali', country: 'Indonesia', flag: '🇮🇩', lang: 'Indonesian', langCode: 'id', latitude: -8.6705, longitude: 115.2126, region: 'Asia & Pacific', popular: true },

  // ── Czech (cs) ──
  { id: 'prague', name: 'Prague, Czechia', short: 'Prague', country: 'Czechia', flag: '🇨🇿', lang: 'Czech', langCode: 'cs', latitude: 50.0755, longitude: 14.4378, region: 'Europe', popular: false },
  { id: 'brno', name: 'Brno, Czechia', short: 'Brno', country: 'Czechia', flag: '🇨🇿', lang: 'Czech', langCode: 'cs', latitude: 49.1951, longitude: 16.6068, region: 'Europe', popular: false },

  // ── Hungarian (hu) ──
  { id: 'budapest', name: 'Budapest, Hungary', short: 'Budapest', country: 'Hungary', flag: '🇭🇺', lang: 'Hungarian', langCode: 'hu', latitude: 47.4979, longitude: 19.0402, region: 'Europe', popular: false },

  // ── Romanian (ro) ──
  { id: 'bucharest', name: 'Bucharest, Romania', short: 'Bucharest', country: 'Romania', flag: '🇷🇴', lang: 'Romanian', langCode: 'ro', latitude: 44.4268, longitude: 26.1025, region: 'Europe', popular: false },
  { id: 'cluj', name: 'Cluj-Napoca, Romania', short: 'Cluj', country: 'Romania', flag: '🇷🇴', lang: 'Romanian', langCode: 'ro', latitude: 46.7712, longitude: 23.6236, region: 'Europe', popular: false },

  // ── Russian (ru) ──
  { id: 'moscow', name: 'Moscow, Russia', short: 'Moscow', country: 'Russia', flag: '🇷🇺', lang: 'Russian', langCode: 'ru', latitude: 55.7558, longitude: 37.6173, region: 'Europe', popular: false },
  { id: 'spb', name: 'Saint Petersburg, Russia', short: 'St Petersburg', country: 'Russia', flag: '🇷🇺', lang: 'Russian', langCode: 'ru', latitude: 59.9343, longitude: 30.3351, region: 'Europe', popular: false },
  { id: 'almaty', name: 'Almaty, Kazakhstan', short: 'Almaty', country: 'Kazakhstan', flag: '🇰🇿', lang: 'Russian', langCode: 'ru', latitude: 43.2220, longitude: 76.8512, region: 'Asia & Pacific', popular: false },

  // ── Ukrainian (uk) ──
  { id: 'kyiv', name: 'Kyiv, Ukraine', short: 'Kyiv', country: 'Ukraine', flag: '🇺🇦', lang: 'Ukrainian', langCode: 'uk', latitude: 50.4501, longitude: 30.5234, region: 'Europe', popular: false },
  { id: 'lviv', name: 'Lviv, Ukraine', short: 'Lviv', country: 'Ukraine', flag: '🇺🇦', lang: 'Ukrainian', langCode: 'uk', latitude: 49.8397, longitude: 24.0297, region: 'Europe', popular: false },

  // ── Bengali (bn) ──
  { id: 'dhaka', name: 'Dhaka, Bangladesh', short: 'Dhaka', country: 'Bangladesh', flag: '🇧🇩', lang: 'Bengali', langCode: 'bn', latitude: 23.8103, longitude: 90.4125, region: 'Asia & Pacific', popular: false },
  { id: 'kolkata', name: 'Kolkata, India', short: 'Kolkata', country: 'India', flag: '🇮🇳', lang: 'Bengali', langCode: 'bn', latitude: 22.5726, longitude: 88.3639, region: 'Asia & Pacific', popular: false },

  // ── Persian (fa) ──
  { id: 'tehran', name: 'Tehran, Iran', short: 'Tehran', country: 'Iran', flag: '🇮🇷', lang: 'Persian', langCode: 'fa', latitude: 35.6892, longitude: 51.3890, region: 'Middle East & Africa', popular: false },
  { id: 'isfahan', name: 'Isfahan, Iran', short: 'Isfahan', country: 'Iran', flag: '🇮🇷', lang: 'Persian', langCode: 'fa', latitude: 32.6546, longitude: 51.6680, region: 'Middle East & Africa', popular: false },

  // ── Urdu (ur) ──
  { id: 'lahore', name: 'Lahore, Pakistan', short: 'Lahore', country: 'Pakistan', flag: '🇵🇰', lang: 'Urdu', langCode: 'ur', latitude: 31.5204, longitude: 74.3587, region: 'Asia & Pacific', popular: false },
  { id: 'karachi', name: 'Karachi, Pakistan', short: 'Karachi', country: 'Pakistan', flag: '🇵🇰', lang: 'Urdu', langCode: 'ur', latitude: 24.8607, longitude: 67.0011, region: 'Asia & Pacific', popular: false },
  { id: 'islamabad', name: 'Islamabad, Pakistan', short: 'Islamabad', country: 'Pakistan', flag: '🇵🇰', lang: 'Urdu', langCode: 'ur', latitude: 33.6844, longitude: 73.0479, region: 'Asia & Pacific', popular: false },

  // ── Swahili (sw) ──
  { id: 'nairobi', name: 'Nairobi, Kenya', short: 'Nairobi', country: 'Kenya', flag: '🇰🇪', lang: 'Swahili', langCode: 'sw', latitude: -1.2921, longitude: 36.8219, region: 'Middle East & Africa', popular: false },
  { id: 'daressalaam', name: 'Dar es Salaam, Tanzania', short: 'Dar es Salaam', country: 'Tanzania', flag: '🇹🇿', lang: 'Swahili', langCode: 'sw', latitude: -6.7924, longitude: 39.2083, region: 'Middle East & Africa', popular: false },
  { id: 'mombasa', name: 'Mombasa, Kenya', short: 'Mombasa', country: 'Kenya', flag: '🇰🇪', lang: 'Swahili', langCode: 'sw', latitude: -4.0435, longitude: 39.6682, region: 'Middle East & Africa', popular: false },
];

export const getHubById = (id) => CITY_PRESETS.find(h => h.id === id);

export const getHubsByLanguage = (langCode) => {
  if (!langCode || langCode === 'auto') return CITY_PRESETS;
  return CITY_PRESETS.filter(h => h.langCode === langCode.toLowerCase());
};
