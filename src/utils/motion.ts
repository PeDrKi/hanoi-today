import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)
export { gsap, ScrollTrigger }

/** Người dùng bật "giảm chuyển động" → không chạy hiệu ứng (nội dung hiện ngay). */
export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const EASE = 'power3.out'

/** Cùng giá trị với biến CSS --ease-out / --ease-io trong global.css: vào = giảm tốc, đổi trạng thái = tăng-giảm tốc. */
export const EASE_IO = 'power2.inOut'

/**
 * Nút chính → hình tròn → mở rộng phủ màn hình rồi nhường chỗ cho trang mới.
 *  • Transformation: nút (viên thuốc) co lại thành hình tròn.
 *  • Masking: hình tròn lớn dần như một "mặt nạ" che trang cũ; ngay lúc phủ kín thì gọi onCovered() để đổi trang, rồi mờ đi để lộ trang mới.
 * Bật "giảm chuyển động" (hoặc không có DOM) → gọi onCovered() ngay.
 */
export function morphAndReveal(btn: HTMLElement | null, cover: string, onCovered: () => void): void {
  if (!btn || typeof document === 'undefined' || reducedMotion()) { onCovered(); return }
  const r = btn.getBoundingClientRect(), cs = getComputedStyle(btn)
  const o = document.createElement('div')
  o.setAttribute('aria-hidden', 'true')
  Object.assign(o.style, {
    position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: '10000',
    background: cs.backgroundColor, color: cs.color, borderRadius: cs.borderRadius, font: cs.font, letterSpacing: cs.letterSpacing,
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', willChange: 'transform',
  })
  o.textContent = btn.textContent
  document.body.appendChild(o)
  btn.style.visibility = 'hidden'
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = r.height
  const reach = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy))
  let ended = false
  const end = () => { if (ended) return; ended = true; o.remove(); btn.style.visibility = '' }
  let covered = false
  const cb = () => { if (!covered) { covered = true; onCovered() } }
  gsap.timeline({ onComplete: end })
    .to(o, { color: 'rgba(0,0,0,0)', duration: 0.14 })
    .to(o, { left: cx - d / 2, width: d, borderRadius: d / 2, duration: 0.34, ease: EASE_IO }, 0.04)
    .to(o, { scale: (reach / (d / 2)) * 1.06, backgroundColor: cover, duration: 0.55, ease: 'power2.in', onComplete: cb })
    .to(o, { opacity: 0, duration: 0.35, ease: 'power1.out' })
  window.setTimeout(() => { cb(); end() }, 3500)   // safety net: never leave the user stuck behind the overlay
}
