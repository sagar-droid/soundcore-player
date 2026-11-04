/**
 * soundcore Liberty 4 Pro — Main Application & UI Coordinator
 * Coordinates:
 * - Colorway selection synchronizer (Hero dock, Studio, Modal)
 * - Sticky Apple product subnav with active section indicator
 * - Apple-style Buy Drawer Checkout modal
 * - Shopping bag counter & toast notifications
 * - Hotspot interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // Color configuration mapping (Fab.com / Portable Music Player Palette)
  const colorNames = {
    orange: 'Sunset Orange',
    spacegray: 'Space Gray',
    silver: 'Silver',
    blue: 'Pacific Blue',
    gold: 'Champagne Gold',
    pink: 'Blush Pink'
  };

  let activeColor = 'orange';
  let bagItemCount = 0;

  /* ==========================================================================
     1. COLORWAY SYNCHRONIZATION
     ========================================================================== */
  const heroColorDockName = document.getElementById('selected-color-name');
  const modalFinishLabel = document.getElementById('modal-finish-label');

  const allSwatches = document.querySelectorAll('.color-swatch, .modal-color-card');

  function updateActiveColor(colorKey) {
    if (!colorNames[colorKey]) return;
    activeColor = colorKey;

    // Update text labels
    if (heroColorDockName) heroColorDockName.textContent = colorNames[colorKey];
    if (modalFinishLabel) modalFinishLabel.textContent = `Finish: ${colorNames[colorKey]}`;

    // Update active class on all swatch buttons
    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.toggle('active', swatch.dataset.color === colorKey);
    });

    document.querySelectorAll('.modal-color-card').forEach(card => {
      card.classList.toggle('active', card.dataset.color === colorKey);
    });

    // Update 3D WebGL Viewer materials
    if (window.soundcoreViewer && typeof window.soundcoreViewer.updateColors === 'function') {
      window.soundcoreViewer.updateColors(colorKey);
    }

    // Update 2D Canvas Renders
    if (window.SoundcoreAssets && typeof window.SoundcoreAssets.setColor === 'function') {
      window.SoundcoreAssets.setColor(colorKey);
    }
  }

  // Bind clicks on all color selectors
  allSwatches.forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      const color = swatch.dataset.color;
      if (color) updateActiveColor(color);
    });
  });

  /* ==========================================================================
     2. PRODUCT SUBNAV & SECTION TRACKING
     ========================================================================== */
  const subnav = document.getElementById('product-subnav');
  const sections = document.querySelectorAll('section[id]');
  const subnavLinks = document.querySelectorAll('.subnav-link');

  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + 120;

    // Sticky Subnav Active Section Indicator
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        subnavLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { passive: true });

  /* ==========================================================================
     3. BUY CHECKOUT MODAL & SHOPPING BAG CART
     ========================================================================== */
  const buyModal = document.getElementById('buy-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const buyTriggers = document.querySelectorAll('[data-trigger="buy"]');
  const addToBagBtn = document.getElementById('modal-add-bag-btn');
  const bagBtn = document.getElementById('bag-btn');
  const navBagCount = document.getElementById('nav-bag-count');
  const bagPopover = document.getElementById('bag-popover');
  const bagEmptyState = document.getElementById('bag-empty-state');
  const bagFilledState = document.getElementById('bag-filled-state');
  const bagItemsList = document.getElementById('bag-items-list');
  const bagSubtotalPrice = document.getElementById('bag-subtotal-price');
  const bagCheckoutBtn = document.getElementById('bag-checkout-btn');
  const bagShopBtn = document.getElementById('bag-shop-btn');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  // Shopping Cart items array
  let cartItems = [];

  const swatchColors = {
    orange: '#e65c28',
    spacegray: '#3a3a3c',
    silver: '#e1e1e6',
    blue: '#1b5e9e',
    gold: '#d8b981',
    pink: '#e098a5'
  };

  function toggleBagPopover(forceState) {
    if (!bagPopover) return;
    const willOpen = (typeof forceState === 'boolean') ? forceState : !bagPopover.classList.contains('open');
    bagPopover.classList.toggle('open', willOpen);
    bagPopover.setAttribute('aria-hidden', String(!willOpen));
    if (willOpen) {
      renderCart();
    }
  }

  function closeBagPopover() {
    if (!bagPopover) return;
    bagPopover.classList.remove('open');
    bagPopover.setAttribute('aria-hidden', 'true');
  }

  function renderCart() {
    if (!bagItemsList || !bagEmptyState || !bagFilledState) return;

    if (cartItems.length === 0) {
      bagEmptyState.style.display = 'flex';
      bagFilledState.style.display = 'none';
      if (navBagCount) {
        navBagCount.textContent = '0';
        navBagCount.classList.remove('visible');
      }
      return;
    }

    bagEmptyState.style.display = 'none';
    bagFilledState.style.display = 'block';

    if (navBagCount) {
      navBagCount.textContent = cartItems.length;
      navBagCount.classList.add('visible');
    }

    const total = cartItems.reduce((sum, item) => sum + item.price, 0);
    if (bagSubtotalPrice) {
      bagSubtotalPrice.textContent = `$${total.toFixed(2)}`;
    }

    bagItemsList.innerHTML = cartItems.map(item => `
      <div class="bag-item-card" data-id="${item.id}">
        <div class="bag-item-swatch" style="background-color: ${swatchColors[item.color] || '#e65c28'};"></div>
        <div class="bag-item-info">
          <div class="bag-item-name">${item.name}</div>
          <div class="bag-item-finish">Finish: ${item.colorName}</div>
          ${item.engraving ? `<div class="bag-item-engraving">LASER ENGRAVED: "${item.engraving}"</div>` : ''}
        </div>
        <div class="bag-item-right">
          <div class="bag-item-price">$${item.price.toFixed(2)}</div>
          <button class="bag-item-remove-btn" data-remove-id="${item.id}">Remove</button>
        </div>
      </div>
    `).join('');

    // Bind remove button handlers
    bagItemsList.querySelectorAll('[data-remove-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idToRemove = Number(btn.dataset.removeId);
        cartItems = cartItems.filter(item => item.id !== idToRemove);
        renderCart();
        showToast('Item removed from your bag.');
      });
    });
  }

  // Click on Shopping Bag icon in top navigation
  if (bagBtn) {
    bagBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleBagPopover();
    });
  }

  // Close bag popover on click outside
  document.addEventListener('click', (e) => {
    if (bagPopover && bagPopover.classList.contains('open')) {
      if (!bagPopover.contains(e.target) && !bagBtn.contains(e.target)) {
        closeBagPopover();
      }
    }
  });

  // Shop button inside empty bag
  if (bagShopBtn) {
    bagShopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeBagPopover();
      openBuyModal();
    });
  }

  // Express Checkout button
  if (bagCheckoutBtn) {
    bagCheckoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Order confirmed! Free express courier dispatches tomorrow.');
      cartItems = [];
      renderCart();
      setTimeout(closeBagPopover, 1200);
    });
  }

  function openBuyModal() {
    closeBagPopover();
    if (!buyModal) return;
    buyModal.classList.add('open');
    buyModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Render current modal thumbnail
    if (window.SoundcoreAssets && typeof window.SoundcoreAssets.renderModalThumb === 'function') {
      window.SoundcoreAssets.renderModalThumb();
    }
  }

  function closeBuyModal() {
    if (!buyModal) return;
    buyModal.classList.remove('open');
    buyModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  buyTriggers.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openBuyModal();
    });
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeBuyModal);
  }

  // Close on outside click
  if (buyModal) {
    buyModal.addEventListener('click', (e) => {
      if (e.target === buyModal) closeBuyModal();
    });
  }

  // Close on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (buyModal && buyModal.classList.contains('open')) {
        closeBuyModal();
      }
      if (arModal && arModal.classList.contains('open')) {
        closeARModal();
      }
      closeBagPopover();
    }
  });

  // Add to Bag action inside Buy Configurator Modal
  if (addToBagBtn) {
    addToBagBtn.addEventListener('click', () => {
      const engravingInput = document.getElementById('engraving-input');
      const engravingText = engravingInput && engravingInput.value.trim() ? engravingInput.value.trim().toUpperCase() : null;

      cartItems.push({
        id: Date.now(),
        name: 'soundcore Studio Player (256GB)',
        color: activeColor,
        colorName: colorNames[activeColor] || 'Sunset Orange',
        engraving: engravingText,
        price: 349.99
      });

      closeBuyModal();
      renderCart();
      toggleBagPopover(true); // Open the cart immediately so user sees their product

      showToast(`Added soundcore Studio Player (${colorNames[activeColor]}${engravingText ? ` · Engraved "${engravingText}"` : ''}) to your bag.`);
    });
  }

  function showToast(msg) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = msg;
    toast.classList.add('active');

    setTimeout(() => {
      toast.classList.remove('active');
    }, 4000);
  }

  // Smooth scroll for internal links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetElem = document.querySelector(targetId);
      if (targetElem) {
        e.preventDefault();
        const headerOffset = 80;
        const elemPosition = targetElem.getBoundingClientRect().top;
        const offsetPosition = elemPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  /* ==========================================================================
     APPLE AR QUICK LOOK (iOS Native USDZ & Desktop QR Code Experience)
     ========================================================================== */
  const arModal = document.getElementById('ar-modal');
  const arModalCloseBtn = document.getElementById('ar-modal-close-btn');
  const arButtons = document.querySelectorAll('#hero-ar-btn, #studio-ar-btn');

  function isAppleARSupported() {
    const a = document.createElement('a');
    return a.relList && a.relList.supports && a.relList.supports('ar');
  }

  function openARModal() {
    if (!arModal) return;
    arModal.classList.add('open');
    arModal.setAttribute('aria-hidden', 'false');
    drawARQRCode();
  }

  function closeARModal() {
    if (!arModal) return;
    arModal.classList.remove('open');
    arModal.setAttribute('aria-hidden', 'true');
  }

  arButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // If running on an Apple device supporting native Quick Look (iOS / iPadOS), let default <a> navigation trigger USDZ!
      if (isAppleARSupported()) {
        return;
      }
      // On desktop or non-AR browsers, display the Apple-style QR code dialog
      e.preventDefault();
      openARModal();
    });
  });

  if (arModalCloseBtn) {
    arModalCloseBtn.addEventListener('click', closeARModal);
  }

  if (arModal) {
    arModal.addEventListener('click', (e) => {
      if (e.target === arModal) closeARModal();
    });
  }

  // Draw clean high-res Apple-style QR Code onto #ar-qr-canvas
  function drawARQRCode() {
    const canvas = document.getElementById('ar-qr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    // High-resolution clean QR visual simulation encoding the page / AR session
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const grid = 25;
    const cellSize = size / grid;

    ctx.fillStyle = '#1d1d1f';

    // Helper: Draw QR Position Detection Marker (Finder Pattern)
    function drawFinder(r0, c0) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = (r === 0 || r === 6 || c === 0 || c === 6);
          const isInner = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          if (isBorder || isInner) {
            ctx.fillRect((c0 + c) * cellSize, (r0 + r) * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    // Top-left, top-right, bottom-left finder markers
    drawFinder(1, 1);
    drawFinder(1, grid - 8);
    drawFinder(grid - 8, 1);

    // Timing pattern & data modules
    let seed = 1337;
    function rand() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }

    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        if ((r < 9 && c < 9) || (r < 9 && c >= grid - 9) || (r >= grid - 9 && c < 9)) continue;
        if (rand() > 0.52) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }

    // Centered Apple AR badge
    const centerSize = 5;
    const startIdx = Math.floor((grid - centerSize) / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(startIdx * cellSize - 2, startIdx * cellSize - 2, centerSize * cellSize + 4, centerSize * cellSize + 4);

    ctx.fillStyle = '#0071e3';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (centerSize * cellSize) / 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AR', size / 2, size / 2 + 1);
  }
});
