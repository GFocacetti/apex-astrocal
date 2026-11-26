// M51 and NGC 5195, Hubble Space Telescope (NASA, ESA, S. Beckwith and the
// Hubble Heritage Team, STScI/AURA). Public domain as a NASA image.
import m51Url from '../assets/m51-hubble.jpg';

export const M51_WIDTH = 1280;
export const M51_HEIGHT = 888;
export const M51_CREDIT = 'M51 · NASA, ESA, S. Beckwith (STScI), Hubble Heritage Team';

let photoPromise: Promise<HTMLImageElement> | null = null;

/** Loads the bundled photo once; every simulator that uses it shares the same image. */
export function loadM51Photo(): Promise<HTMLImageElement> {
  if (!photoPromise) {
    photoPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        photoPromise = null;
        reject(new Error('M51 photo failed to load'));
      };
      img.src = m51Url;
    });
  }
  return photoPromise;
}
