// Semaphore ringkas - hadkan bilangan PDF generation serentak supaya Puppeteer
// tidak membebankan RAM/CPU pada server yang dikongsi dengan aplikasi lain.
// Sengaja tanpa queue/library luar (Bahagian 31: "Jangan bina queue enterprise").
function createSemaphore(maxConcurrent) {
  let active = 0;
  const waiting = [];

  function grantNext() {
    if (active >= maxConcurrent || waiting.length === 0) return;
    active += 1;
    const resolve = waiting.shift();
    resolve();
  }

  return {
    acquire() {
      if (active < maxConcurrent) {
        active += 1;
        return Promise.resolve();
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
    release() {
      active = Math.max(0, active - 1);
      grantNext();
    },
  };
}

module.exports = { createSemaphore };
