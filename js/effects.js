// ============================================================
// Motion effects — scroll-reveal + animated counters.
// Any element with class "reveal" fades up when scrolled into
// view, including elements added to the page later.
// ============================================================

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const io = reduced
  ? null
  : new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

function register(el) {
  if (el.classList.contains("in")) return;
  if (!io) {
    el.classList.add("in");
    return;
  }
  // Stagger siblings slightly so grids cascade in
  const parent = el.parentElement;
  if (parent) {
    const siblings = [...parent.children].filter((c) => c.classList?.contains("reveal"));
    const idx = siblings.indexOf(el);
    if (idx > 0) el.style.animationDelay = `${Math.min(idx, 8) * 70}ms`;
  }
  io.observe(el);
}

document.querySelectorAll(".reveal").forEach(register);

new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.classList?.contains("reveal")) register(node);
      node.querySelectorAll?.(".reveal").forEach(register);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

/** Count an element's text up from 0 to `to` with easing. */
export function animateCount(el, to, { duration = 1400, format = (n) => n.toLocaleString() } = {}) {
  if (!el) return;
  if (reduced || to === 0) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(Math.round(to * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
