/* ==============================================
   ADMIN.JS — Admin Dashboard Logic
   All data is mock/hardcoded — ready for real backend later.
   ============================================== */

const AdminData = (function() {
  // Mock orders data
  const orders = [
    {
      id: 'ORD-1047', customer: 'Mike Reynolds', email: 'mike@techstart.com',
      date: '2026-03-07', status: 'new', total: 749.52,
      items: [{ brand: 'Richardson', model: '112 Trucker', color: 'Black/White', decoration: 'Embroidery', qty: 48, unitPrice: 14.99 }],
      artwork: 'techstart-logo.ai', instructions: '3D puff on front center, PMS 286 blue thread'
    },
    {
      id: 'ORD-1046', customer: 'Sarah Chen', email: 'sarah@riverside.com',
      date: '2026-03-06', status: 'proof-sent', total: 599.76,
      items: [{ brand: 'Yupoong', model: '6089 Classic Snapback', color: 'Black', decoration: 'Leather Patch', qty: 24, unitPrice: 24.99 }],
      artwork: 'riverside-brewing.svg', instructions: 'Debossed leather patch, front center, natural tan leather'
    },
    {
      id: 'ORD-1045', customer: 'Jake Morrison', email: 'jake@morrisonranch.com',
      date: '2026-03-05', status: 'approved', total: 1079.40,
      items: [{ brand: 'Richardson', model: '112 Trucker', color: 'Brown/Khaki', decoration: 'Embroidery', qty: 100, unitPrice: 10.794 }],
      artwork: 'morrison-ranch.eps', instructions: 'Front and back embroidery. Earth tone thread colors.'
    },
    {
      id: 'ORD-1044', customer: 'Amanda Torres', email: 'amanda@hopefdn.org',
      date: '2026-03-03', status: 'production', total: 2497.50,
      items: [{ brand: 'Yupoong', model: '6245CM Dad Hat', color: 'Navy', decoration: 'Embroidery', qty: 250, unitPrice: 9.99 }],
      artwork: 'hope-foundation.png', instructions: 'Simple flat embroidery, white thread, front center'
    },
    {
      id: 'ORD-1043', customer: 'Kevin Park', email: 'kevin@parklandscaping.com',
      date: '2026-03-01', status: 'shipped', total: 359.76,
      items: [{ brand: 'Richardson', model: '115 Low Pro Trucker', color: 'Charcoal/Black', decoration: 'PVC Patch', qty: 12, unitPrice: 29.98 }],
      artwork: 'park-landscaping.ai', instructions: 'Green and white PVC patch, rectangle shape',
      trackingNumber: '1Z999AA10123456784'
    },
    {
      id: 'ORD-1042', customer: 'Lisa Wong', email: 'lisa@urbanfitness.com',
      date: '2026-02-28', status: 'shipped', total: 479.76,
      items: [{ brand: 'Flexfit', model: '6277 Wooly Combed', color: 'Black', decoration: 'Embroidery', qty: 24, unitPrice: 19.99 }],
      artwork: 'urban-fitness.svg', instructions: 'Tone-on-tone black thread, front left placement',
      trackingNumber: '1Z999AA10123456785'
    },
  ];

  function getOrders(statusFilter) {
    if (!statusFilter || statusFilter === 'all') return orders;
    return orders.filter(o => o.status === statusFilter);
  }

  function getOrder(id) {
    return orders.find(o => o.id === id);
  }

  function updateOrderStatus(id, newStatus) {
    const order = orders.find(o => o.id === id);
    if (order) order.status = newStatus;
    return order;
  }

  function getStats() {
    return {
      totalOrders: orders.length,
      newOrders: orders.filter(o => o.status === 'new').length,
      inProduction: orders.filter(o => o.status === 'production' || o.status === 'approved').length,
      revenue: orders.reduce((sum, o) => sum + o.total, 0),
    };
  }

  return { getOrders, getOrder, updateOrderStatus, getStats };
})();
