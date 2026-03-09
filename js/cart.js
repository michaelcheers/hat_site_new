/* ==============================================
   CART.JS — Cart API (localStorage + line item props)
   Liquid: Shopify Cart API /cart/add.js with line_item properties
   ============================================== */

const Cart = (function() {
  const STORAGE_KEY = 'hatCart';

  function getCart() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateBadge();
    if (typeof window.renderCartPage === 'function') window.renderCartPage();
  }

  function addItem(item) {
    const cart = getCart();
    item.id = 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    cart.push(item);
    saveCart(cart);
    return item;
  }

  function removeItem(itemId) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== itemId);
    saveCart(cart);
  }

  function updateQuantity(itemId, newQty) {
    const cart = getCart();
    const item = cart.find(i => i.id === itemId);
    if (!item) return;
    item.quantity = Math.max(1, newQty);
    item.lineTotal = Math.round(item.unitPrice * item.quantity * 100) / 100;
    saveCart(cart);
  }

  function clearCart() {
    saveCart([]);
  }

  function getTotal() {
    return getCart().reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  }

  function getItemCount() {
    return getCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  function updateBadge() {
    const badges = document.querySelectorAll('.cart-btn__count');
    const count = getItemCount();
    badges.forEach(badge => {
      badge.textContent = count;
      badge.setAttribute('data-count', count);
    });
  }

  // Init badge on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadge);
  } else {
    updateBadge();
  }

  return { getCart, addItem, removeItem, updateQuantity, clearCart, getTotal, getItemCount, updateBadge };
})();
