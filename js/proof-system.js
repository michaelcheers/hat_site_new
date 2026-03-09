/* ==============================================
   PROOF-SYSTEM.JS — Proof Approval/Revision Handling
   ============================================== */

const ProofSystem = (function() {
  // Mock proof data stored in memory (would be API calls in production)
  const proofs = [
    {
      orderId: 'ORD-1046',
      proofImage: null, // Would be a URL in production
      status: 'sent', // sent, approved, revision-requested
      sentAt: '2026-03-06T14:30:00Z',
      customerNotes: '',
      revisionCount: 0,
    },
  ];

  function getProof(orderId) {
    return proofs.find(p => p.orderId === orderId);
  }

  function createProof(orderId, proofImageDataUrl) {
    const existing = proofs.find(p => p.orderId === orderId);
    if (existing) {
      existing.proofImage = proofImageDataUrl;
      existing.status = 'sent';
      existing.sentAt = new Date().toISOString();
      existing.revisionCount++;
      return existing;
    }

    const proof = {
      orderId,
      proofImage: proofImageDataUrl,
      status: 'sent',
      sentAt: new Date().toISOString(),
      customerNotes: '',
      revisionCount: 0,
    };
    proofs.push(proof);
    return proof;
  }

  function approveProof(orderId) {
    const proof = proofs.find(p => p.orderId === orderId);
    if (proof) {
      proof.status = 'approved';
      // Update order status too
      AdminData.updateOrderStatus(orderId, 'approved');
    }
    return proof;
  }

  function requestRevision(orderId, notes) {
    const proof = proofs.find(p => p.orderId === orderId);
    if (proof) {
      proof.status = 'revision-requested';
      proof.customerNotes = notes;
      AdminData.updateOrderStatus(orderId, 'new');
    }
    return proof;
  }

  function getProofStatus(orderId) {
    const proof = proofs.find(p => p.orderId === orderId);
    return proof ? proof.status : 'none';
  }

  /* Proof email template (placeholder)
     Liquid: Shopify Flow or custom app handles actual email sending
     This is an HTML template for reference:

     <div style="max-width:600px; margin:0 auto; font-family:Arial,sans-serif;">
       <h2>Your Hat Proof is Ready!</h2>
       <p>Hi {{ customer_name }},</p>
       <p>Your custom hat proof for order {{ order_id }} is ready for review.</p>
       <img src="{{ proof_image_url }}" style="max-width:100%;" />
       <p><a href="{{ approval_url }}">Approve Proof</a> | <a href="{{ revision_url }}">Request Changes</a></p>
     </div>
  */

  return { getProof, createProof, approveProof, requestRevision, getProofStatus };
})();
