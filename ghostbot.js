(function ultraGhostMode() {
    console.log("👻 Attempting Ghost Mode (Secure Version)...");

    const style = document.createElement('style');
    style.textContent = `
        [role="listitem"]:last-child { 
            filter: blur(8px) !important; 
            transition: filter 0.5s;
        }
        [role="listitem"]:last-child:hover {
            filter: blur(0px) !important;
        }
    `;
    document.head.appendChild(style);

    const RawObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends RawObserver {
        constructor(callback, options) {
            const patchedCallback = (entries, observer) => {
                const fakeEntries = entries.map(entry => {

                    return new Proxy(entry, {
                        get: (target, prop) => prop === 'isIntersecting' ? false : target[prop]
                    });
                });
                callback(fakeEntries, observer);
            };
            super(patchedCallback, options);
        }
    };

    window.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { get: () => true });

    console.log("✅ Ghost Mode Active. Messages are blurred until hovered, and 'Read' signals are blocked.");
})();
