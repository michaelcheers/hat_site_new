/* ==============================================
   MAIN.JS — Global Nav, Mobile Menu, Shared Utils
   ============================================== */

// ---- Sticky Header ----
const siteHeader = document.querySelector('.site-header');
if (siteHeader) {
  window.addEventListener('scroll', () => {
    siteHeader.classList.toggle('site-header--scrolled', window.scrollY > 20);
  });
}

// ---- Mobile Menu ----
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const mainNavList = document.querySelector('.main-nav__list');

if (mobileMenuBtn && mainNavList) {
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenuBtn.classList.toggle('active');
    mainNavList.classList.toggle('active');
    document.body.style.overflow = mainNavList.classList.contains('active') ? 'hidden' : '';
  });

  // Mobile dropdown toggle
  document.querySelectorAll('.main-nav__item').forEach(item => {
    const link = item.querySelector('.main-nav__link');
    const dropdown = item.querySelector('.dropdown-menu');
    if (dropdown && link) {
      link.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
          e.preventDefault();
          item.classList.toggle('dropdown-open');
        }
      });
    }
  });
}

// ---- Testimonials Slider ----
function initTestimonialsSlider() {
  const track = document.querySelector('.testimonials-track');
  const dots = document.querySelectorAll('.testimonials-nav__dot');
  if (!track || dots.length === 0) return;

  let current = 0;
  const total = dots.length;

  function goTo(index) {
    current = index;
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => goTo(i));
  });

  // Auto-advance
  setInterval(() => {
    goTo((current + 1) % total);
  }, 5000);
}

// ---- Toast Notifications ----
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__message">${message}</span>
    <span class="toast__close">&times;</span>
  `;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  toast.querySelector('.toast__close').addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ---- Cart Count Badge ----
function updateCartBadge() {
  const badge = document.querySelector('.cart-btn__count');
  if (!badge) return;
  const cart = JSON.parse(localStorage.getItem('hatCart') || '[]');
  const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  badge.textContent = count;
  badge.setAttribute('data-count', count);
}

// ---- FAQ Accordion ----
function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const body = item.querySelector('.accordion-body');
      const inner = body.querySelector('.accordion-body__inner');
      const isActive = item.classList.contains('active');

      // Close all
      item.closest('.accordion')?.querySelectorAll('.accordion-item.active').forEach(open => {
        open.classList.remove('active');
        open.querySelector('.accordion-body').style.maxHeight = '0';
      });

      // Open clicked (if wasn't already open)
      if (!isActive) {
        item.classList.add('active');
        body.style.maxHeight = inner.scrollHeight + 'px';
      }
    });
  });
}

// ---- Smooth scroll for anchor links ----
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (link) {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
});

// ---- Helper: Format currency ----
function formatPrice(amount) {
  return '$' + Number(amount).toFixed(2);
}

// ---- Helper: Build the inline style for a color swatch ----
// Two-tone color names ("Hot Pink / Black") render as concentric rings:
// the first color forms the outer ring, the second fills the center.
// A faint inset outline keeps white/light swatches visible without
// changing the element's size.
function isLightHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 200;
}
function swatchStyle(color) {
  const hex1 = (color && color.swatchHex) || '#9a9a9a';
  const hex2 = color && color.swatchHex2;
  const outline = 'box-shadow:inset 0 0 0 1px rgba(0,0,0,0.14);';
  if (hex2) {
    return `background:radial-gradient(circle, ${hex2} 0 46%, ${hex1} 47% 100%);${outline}`;
  }
  return `background:${hex1};${isLightHex(hex1) ? outline : ''}`;
}
window.swatchStyle = swatchStyle;

// ---- Helper: Generate placeholder hat SVG ----
function hatPlaceholderSVG() {
  return `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="140" rx="80" ry="16" fill="#ddd"/>
    <path d="M30 140 C30 140 35 70 100 60 C165 70 170 140 170 140" fill="#ccc"/>
    <ellipse cx="100" cy="65" rx="50" ry="15" fill="#bbb"/>
    <path d="M20 140 L0 150 Q100 170 200 150 L180 140" fill="#bbb"/>
  </svg>`;
}

// ---- Init on DOM ready ----
document.addEventListener('DOMContentLoaded', () => {
  initTestimonialsSlider();
  initAccordions();
  updateCartBadge();
});
