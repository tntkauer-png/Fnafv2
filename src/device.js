/* Small capability probe used to pick a sensible render budget.
   High-DPI phones such as the Pixel 9 have plenty of fill-rate and memory,
   but they are not desktop GPUs, so resolution and shadow cost are tuned
   separately instead of simply maxing everything out. */
export function deviceProfile() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth || 0, window.innerHeight || 0) < 820;
  const mobile = coarse || narrow;
  // Pixel-class devices report 8+ GB / 8+ cores and a dense display.
  const high = mobile && (mem >= 8 || cores >= 8) && dpr >= 2;
  return {
    dpr,
    mobile,
    high,
    tier: high ? 'high' : mobile ? 'mid' : 'desktop'
  };
}
