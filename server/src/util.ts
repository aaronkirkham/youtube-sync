/**
 * Generate a random sequence of characters which are URL safe
 * @param length How many characters the string should contain
 */
export function getRandomString(length: number): string {
  return Math.random().toString(36).substr(2, length);
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
