/**
 * Generate a random sequence of characters which are URL safe
 * @param length How many characters the string should contain
 */
export function getRandomString(length: number): string {
  return Math.random().toString(36).substr(2, length);
}

/**
   * Get a value from the config file
   * @param key Key to get the value of
   * @param def Default value incase the key doesn't exist
   */
export function getFromConfig(key: string, def: any = null): any {
  const config = require('../config.json');

  if (!config) return def;
  if (!config.hasOwnProperty(key)) return def;
  return config[key];
}

/**
   * Test if a given URL is a valid address
   * @param url URL to test
   */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}
