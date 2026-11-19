/**
 * Sends a copy of the pack photo along an arc into the header cart, then nudges the cart.
 * Purely decorative: skipped for reduced motion, inside modal sheets, or without a photo.
 */
export function flyToCart(from: Element | null | undefined) {
  if (!(from instanceof HTMLImageElement) || document.hidden || from.closest("dialog") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const to = [...document.querySelectorAll<HTMLElement>("[data-cart-target]")].find((el) => el.getClientRects().length);
  if (!to) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const size = Math.min(a.width, a.height, 160);
  const ghost = from.cloneNode() as HTMLImageElement;
  ghost.removeAttribute("style");
  ghost.className = "";
  ghost.alt = "";
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${a.left + a.width / 2 - size / 2}px`,
    top: `${a.top + a.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    objectFit: "contain",
    zIndex: "60",
    pointerEvents: "none",
    filter: "drop-shadow(0 10px 14px rgb(36 23 15 / 0.25))",
  });
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)" },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 70}px) scale(0.6) rotate(-8deg)`, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.12) rotate(6deg)`, opacity: 0.5 },
    ],
    { duration: 700, easing: "cubic-bezier(0.5, 0, 0.4, 1)" },
  ).onfinish = () => {
    ghost.remove();
    to.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 360, easing: "cubic-bezier(0.3, 1.6, 0.5, 1)" });
  };
}
