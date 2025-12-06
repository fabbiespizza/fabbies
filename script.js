// DOM Elements
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const navLinks = document.getElementById('nav-links');
const cartBtn = document.getElementById('cart-btn');
const cartSidebar = document.getElementById('cart-sidebar');
const closeCartBtn = document.getElementById('close-cart');
const cartCount = document.getElementById('cart-count');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotal = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckout = document.getElementById('close-checkout');
const confirmationModal = document.getElementById('confirmation-modal');
const closeConfirmation = document.getElementById('close-confirmation');
const categoryBtns = document.querySelectorAll('.category-btn');
const menuItems = document.querySelectorAll('.menu-item');
const checkoutForm = document.getElementById('checkout-form');
const orderIdElement = document.getElementById('order-id');
const paymentMethodElement = document.getElementById('payment-method');

// ===== IMPROVED DYNAMIC AUTH BUTTON with Profile Dropdown (Click-based) =====
function updateAuthButton() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const authDropdown = document.getElementById('auth-dropdown');
    const authDropdownBtn = document.getElementById('auth-dropdown-btn');
    const profileMenu = document.getElementById('profile-menu');
    const authText = document.getElementById('auth-text');

    // Ensure all necessary elements exist (e.g., not on profile.html)
    if (!authDropdown || !authDropdownBtn || !profileMenu || !authText) {
        return;
    }

    if (user) {
        // User is logged in
        authText.textContent = ''; // Clear the "Login / Sign Up" text
        authDropdownBtn.style.padding = '8px 12px';
        authDropdownBtn.style.gap = '6px';

        // Update profile info in dropdown header
        document.getElementById('profile-name-header').textContent = user.name || 'User';
        document.getElementById('profile-email-header').textContent = user.email || 'user@example.com';

        // --- Click-based Dropdown Logic ---
        let isMenuOpen = false;

        const toggleMenu = (event) => {
            // Prevent the click on the dropdown button from propagating to the document listener
            // which would immediately close it again.
            event.stopPropagation();
            isMenuOpen = !isMenuOpen;
            profileMenu.style.display = isMenuOpen ? 'block' : 'none';
        };

        const hideMenu = () => {
            isMenuOpen = false;
            profileMenu.style.display = 'none';
        };

        // Remove any previous event listeners to avoid duplication
        authDropdownBtn.removeEventListener('click', toggleMenu);
        document.removeEventListener('click', hideMenu);

        // Add new event listeners
        authDropdownBtn.addEventListener('click', toggleMenu);
        document.addEventListener('click', hideMenu); // Click anywhere else to close

        // Handle Logout
        // Remove previous listener to avoid duplication
        const logoutLink = document.getElementById('menu-logout');
        if (logoutLink) {
            logoutLink.onclick = (e) => { // Use onclick property for simplicity and to override
                e.preventDefault();
                if (confirm('Are you sure you want to log out?')) {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    updateAuthButton(); // Update button state
                    showToast('Logged out successfully!', 'success');
                    // Optionally reload or redirect
                    // window.location.reload();
                }
                // Ensure menu closes after logout attempt
                hideMenu();
            };
        }

    } else {
        // User is not logged in
        authText.textContent = 'Login / Sign Up';
        authDropdownBtn.style.padding = '8px 16px'; // Revert padding
        authDropdownBtn.style.gap = ''; // Revert gap
        profileMenu.style.display = 'none';

        // Remove dropdown event listeners if they exist
        authDropdownBtn.onclick = null;
        document.removeEventListener('click', () => {}); // Cannot remove anonymous, but we override onclick

        // Revert to opening login modal on auth button click
        authDropdownBtn.onclick = () => {
            window.location.href = 'login.html';
        };
    }
}

// ===== AUTH/profile display and checkout behavior fixes =====
// Remove duplicated implementations and use a single reliable function
function updateAuthDisplay() {
    const token = localStorage.getItem('authToken');
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { user = null; }

    const notLoggedEl = document.getElementById('auth-not-logged-in');
    const loggedEl = document.getElementById('auth-logged-in');
    const userNameEl = document.getElementById('auth-user-name');
    const profileInitialEl = document.getElementById('profile-initial');
    const accountBtn = document.getElementById('auth-account-btn');
    const accountMenu = document.getElementById('auth-account-menu');
    const logoutBtn = document.getElementById('auth-logout-btn');

    // Defensive checks (page may not include these IDs)
    if (!notLoggedEl && !loggedEl) return;

    if (token && user && user.id) {
        // Show logged-in UI
        if (notLoggedEl) notLoggedEl.style.display = 'none';
        if (loggedEl) loggedEl.style.display = 'flex';
        if (userNameEl) userNameEl.textContent = user.name || 'Account';
        if (profileInitialEl) profileInitialEl.textContent = (user.name ? user.name.charAt(0).toUpperCase() : 'U');

        // Toggle account menu on button click (or navigate to profile on double-click)
        if (accountBtn) {
            accountBtn.onclick = (e) => {
                e.stopPropagation();
                if (!accountMenu) return;
                const isOpen = accountMenu.style.display === 'block';
                accountMenu.style.display = isOpen ? 'none' : 'block';
            };
            // Keyboard accessible
            accountBtn.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    accountBtn.click();
                }
            };
        }

        // Clicking profile initials goes to profile page
        if (profileInitialEl) {
            profileInitialEl.style.cursor = 'pointer';
            profileInitialEl.onclick = () => {
                window.location.href = 'profile.html';
            };
        }

        // Logout: clear storage and update UI
        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                if (!confirm('Are you sure you want to log out?')) return;
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                // close menu and update UI
                if (accountMenu) accountMenu.style.display = 'none';
                updateAuthDisplay();
                updateAuthButton?.();
                showToast('Logged out successfully!', 'success');
            };
        }

        // Close menu when clicking outside
        document.addEventListener('click', (ev) => {
            if (!ev.target.closest('#auth-logged-in')) {
                if (accountMenu) accountMenu.style.display = 'none';
            }
        }, { capture: true });

    } else {
        // Show guest/login UI
        if (notLoggedEl) notLoggedEl.style.display = 'flex';
        if (loggedEl) loggedEl.style.display = 'none';
        if (accountMenu) accountMenu.style.display = 'none';

        // Ensure the "guest" profile link leads to login
        const guestAnchor = document.getElementById('profile-link-guest');
        if (guestAnchor) {
            guestAnchor.onclick = null; // let the anchor href work
        }
    }
}

// Call on page load (ensure auth UI updates)
document.addEventListener('DOMContentLoaded', () => {
  initSlideshow();
  window.addEventListener('scroll', handleScroll);
  mobileMenuBtn?.addEventListener('click', toggleMobileMenu);
  restoreCartFromStorage();
  // Ensure auth display is updated first
  updateAuthDisplay();
  initCart();
  initMenuFilter();
  updateAuthButton(); // Update the more advanced dropdown if present
  initGuestCheckout(); // Initialize guest checkout functionality
});

// Cart Data
let cart = [];
const LOCAL_STORAGE_CART_KEY = 'fabbies_cart_v1';

// Hero Slideshow
function initSlideshow() {
    const slides = document.querySelectorAll('.hero-slide');
    let currentSlide = 0;
    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        slides[index].classList.add('active');
    }
    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }
    showSlide(0);
    setInterval(nextSlide, 5000);
}

// Scroll Header Effect
function handleScroll() {
    const header = document.getElementById('header');
    if (window.scrollY > 50) {
        header?.classList.add('scrolled');
    } else {
        header?.classList.remove('scrolled');
    }
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    navLinks?.classList.toggle('active');
    const isOpen = navLinks?.classList.contains('active');
    mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    mobileMenuBtn.innerHTML = isOpen ?
        '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
}

// Cart Functionality
function initCart() {
    // Toggle cart sidebar
    cartBtn?.addEventListener('click', () => {
        cartSidebar.classList.add('active');
        document.documentElement.classList.add('ui-overlay-open');
        updateCartDisplay();
    });
    closeCartBtn?.addEventListener('click', () => {
        cartSidebar.classList.remove('active');
        document.documentElement.classList.remove('ui-overlay-open');
    });

    // Add to cart buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function () {
            const itemName = this.getAttribute('data-item');
            let itemElement = this.closest('.menu-item') || this.closest('.offer-card');
            if (!itemElement) return;
            const sizeSelector = itemElement.querySelector('.size-selector');
            const selectedSize = sizeSelector ? sizeSelector.value : null;
            const selectedSizeText = sizeSelector ? sizeSelector.options[sizeSelector.selectedIndex]?.text : null;
            let price = parseFloat(this.getAttribute('data-price'));

            if (selectedSize && itemElement.querySelector('.price-size')) {
                const priceSpans = itemElement.querySelectorAll('.price-size .item-price');
                let priceText = '';
                for (let span of priceSpans) {
                    const text = span.textContent.trim();
                    if (text.toLowerCase().includes(selectedSizeText?.toLowerCase())) {
                        priceText = text;
                        break;
                    }
                }
                const extractedPrice = priceText.match(/[\d,]+(\.\d+)?/);
                price = extractedPrice ? parseFloat(extractedPrice[0].replace(',', '')) : 0;
            }

            const displayName = selectedSizeText ? `${itemName} (${selectedSizeText})` : itemName;
            const imageElement = itemElement.querySelector('img');
            const imageSrc = imageElement ? imageElement.src : '';

            const existingItemIndex = cart.findIndex(item => item.name === displayName);
            if (existingItemIndex >= 0) {
                cart[existingItemIndex].quantity += 1;
            } else {
                cart.push({
                    name: displayName,
                    price: price,
                    quantity: 1,
                    size: selectedSize,
                    image: imageSrc
                });
            }
            updateCartCount();
            saveCartToStorage();
            showCartNotification();
        });
    });

    // Show login/signup/guest options when checkout is clicked
    checkoutBtn?.addEventListener('click', function () {
        if (cart.length === 0) {
            showToast('Your cart is empty!', 'error');
            return;
        }

        const token = localStorage.getItem('authToken');
        const user = JSON.parse(localStorage.getItem('user') || 'null');

        // If logged in → open checkout modal directly
        if (token && user && user.id) {
            cartSidebar.classList.remove('active');
            checkoutModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            document.documentElement.classList.add('ui-overlay-open');
            autoFillCheckout();
            return;
        }

        // If NOT logged in → show guest options modal
        const guestOptionsModal = document.getElementById('guest-options-modal');
        if (guestOptionsModal) {
            cartSidebar.classList.remove('active');
            guestOptionsModal.style.display = 'flex';
            document.documentElement.style.overflow = 'hidden';
        }
    });

    // Close modals
    closeCheckout?.addEventListener('click', function() {
        checkoutModal.classList.remove('active');
        document.body.style.overflow = '';
        document.documentElement.classList.remove('ui-overlay-open');
    });
    closeConfirmation?.addEventListener('click', function() {
        confirmationModal.classList.remove('active');
        document.body.style.overflow = '';
        document.documentElement.classList.remove('ui-overlay-open');
    });

    window.addEventListener('click', function(e) {
        if (e.target === checkoutModal) {
            checkoutModal.classList.remove('active');
            document.body.style.overflow = '';
            document.documentElement.classList.remove('ui-overlay-open');
        }
        if (e.target === confirmationModal) {
            confirmationModal.classList.remove('active');
            document.body.style.overflow = '';
            document.documentElement.classList.remove('ui-overlay-open');
        }
    });

    // Form submission - UPDATED to use backend order ID
    checkoutForm?.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Enhanced validation
        const nameVal = document.getElementById('checkout-name')?.value.trim();
        const emailVal = document.getElementById('checkout-email')?.value.trim();
        const phoneVal = document.getElementById('checkout-phone')?.value.trim();
        const addressVal = document.getElementById('checkout-address')?.value.trim();

        const emailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailVal);
        const phoneValid = /^[\+]?[0-9\s\-\(\)]{9,15}$/.test(phoneVal);
        const nameValid = /^[a-zA-Z\s]{3,50}$/.test(nameVal);

        if (!nameValid || nameVal.length < 3) {
            showToast('Please enter a valid full name', 'error');
            document.getElementById('checkout-name')?.focus(); return;
        }
        if (!emailValid) {
            showToast('Please enter a valid email address', 'error');
            document.getElementById('checkout-email')?.focus(); return;
        }
        if (!phoneValid) {
            showToast('Please enter a valid phone number', 'error');
            document.getElementById('checkout-phone')?.focus(); return;
        }
        if (addressVal.length < 15) {
            showToast('Please enter a complete delivery address', 'error');
            document.getElementById('checkout-address')?.focus(); return;
        }

        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
        const paymentMethodText = {
            'jazzcash': 'JazzCash',
            'easypaisa': 'EasyPaisa',
            'card': 'Credit/Debit Card',
            'cod': 'Cash on Delivery'
        }[paymentMethod];

        const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const deliveryFee = 99;
        const totalCost = subtotal + deliveryFee;

        // === UPDATED: Send to Backend and use backend order ID ===
        try {
            const response = await fetch('http://localhost:5000/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart,
                    subtotal: subtotal,
                    total: totalCost,
                    payment_method: paymentMethod,
                    delivery_address: addressVal,
                    customer_name: nameVal,
                    customer_email: emailVal,
                    customer_phone: phoneVal
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                // handle error
                console.error('Order failed', data);
                showToast(data.error || 'Order failed', 'error');
                return;
            }
            
            // ✅ Use backend canonical ID for UI and local storage
            const canonicalId = data.orderNumber || data.orderId;
            
            console.log('✅ Order saved to backend:', canonicalId);
            showToast('Order placed successfully!', 'success');
            
            // Update confirmation modal with backend order ID
            orderIdElement.textContent = canonicalId;
            paymentMethodElement.textContent = paymentMethodText;
            
            // Show confirmation
            checkoutModal.classList.remove('active');
            confirmationModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            document.documentElement.classList.add('ui-overlay-open');

            // Clear cart and reset form
            cart = [];
            updateCartCount();
            updateCartDisplay();
            saveCartToStorage();
            checkoutForm.reset();
            
            // Optionally save to localStorage
            localStorage.setItem('lastOrderNumber', canonicalId);
            
        } catch (err) {
            console.error('Order submission error:', err);
            showToast('Could not connect to server. We will contact you.', 'warning');
            
            // Fallback: Show confirmation with temporary ID
            const fallbackOrderId = Math.floor(Math.random() * 90000) + 10000;
            orderIdElement.textContent = fallbackOrderId;
            paymentMethodElement.textContent = paymentMethodText;
            
            checkoutModal.classList.remove('active');
            confirmationModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            document.documentElement.classList.add('ui-overlay-open');
            
            cart = [];
            updateCartCount();
            updateCartDisplay();
            saveCartToStorage();
            checkoutForm.reset();
        }
    });
}

// Example checkout submit handler — ensure you DO NOT generate an order id on client
async function submitCheckout(payload) {
    // payload includes subtotal, total, items, delivery_address, phone, payment_method, etc.
    const res = await fetch('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
        // handle error
        console.error('Order failed', data);
        showToast(data.error || 'Order failed', 'error');
        return;
    }
    // Use backend canonical ID for UI and local storage
    const canonicalId = data.orderNumber || data.orderId;
    // Update UI: show canonicalId to user
    document.getElementById('order-confirmation-id').textContent = canonicalId;
    // Optionally save to localStorage
    localStorage.setItem('lastOrderNumber', canonicalId);
}

// Update cart count
function updateCartCount() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalItems;
}

// Update cart display
function updateCartDisplay() {
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #777;">
                <i class="fas fa-shopping-cart" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        cartTotal.textContent = '0';
        return;
    }
    cartItemsContainer.innerHTML = '';
    let total = 0;
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <div class="cart-item-image">
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="cart-item-details">
                <h4 class="cart-item-title">${item.name}</h4>
                <div class="cart-item-qty-row">
                    <button class="cart-qty-btn cart-qty-minus" data-index="${index}" aria-label="Decrease quantity"><i class="fas fa-minus"></i></button>
                    <span class="cart-item-qty">${item.quantity}</span>
                    <button class="cart-qty-btn cart-qty-plus" data-index="${index}" aria-label="Increase quantity"><i class="fas fa-plus"></i></button>
                </div>
                <p class="cart-item-price">Rs. ${(item.price * item.quantity).toFixed(2)}</p>
                <div class="cart-item-actions">
                    <button class="remove-item" data-index="${index}">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
        cartItemsContainer.appendChild(itemElement);

        itemElement.querySelector('.remove-item')?.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            cart.splice(index, 1);
            updateCartDisplay();
            updateCartCount();
            saveCartToStorage();
        });
        itemElement.querySelector('.cart-qty-minus')?.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-index'));
            if (cart[idx].quantity > 1) cart[idx].quantity -= 1;
            else cart.splice(idx, 1);
            updateCartDisplay();
            updateCartCount();
            saveCartToStorage();
        });
        itemElement.querySelector('.cart-qty-plus')?.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-index'));
            cart[idx].quantity += 1;
            updateCartDisplay();
            updateCartCount();
            saveCartToStorage();
        });
    });
    cartTotal.textContent = total.toFixed(2);
}

// Show notification
function showCartNotification() {
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = 'var(--success)';
    notification.style.color = 'white';
    notification.style.padding = '15px 25px';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    notification.style.zIndex = '1000';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.gap = '10px';
    notification.innerHTML = `
        <i class="fas fa-check-circle" style="font-size: 1.2rem;"></i>
        <span>Item added to cart!</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Generic toast
// Generic toast - modified to handle special messages
function showToast(message, type = 'info') {
    // Handle special reorder message
    let displayMessage = message;
    if (message.startsWith('_reordered')) {
        // Extract count and order ID if needed, or just use the message as is
        // message format: "_reordered X item(s) from Order #XXXX to your cart!"
        displayMessage = message.substring(1); // Remove the leading underscore
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    const bgColor = type === 'error' ? '#e53935' : type === 'success' ? 'var(--success)' : '#333';
    const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    
    toast.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; right: 20px; max-width: 400px; margin: 0 auto;
        background-color: ${bgColor}; color: white; padding: 16px 20px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 9999; font-size: 14px;
        display: flex; align-items: center; gap: 12px; word-wrap: break-word;
    `;
    toast.innerHTML = `<span style="font-size: 18px;">${icon}</span><span>${displayMessage}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Persistence helpers
function saveCartToStorage() {
    try {
        localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cart));
    } catch (e) {
        console.warn('Unable to save cart');
    }
}

function restoreCartFromStorage() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                cart = parsed;
                updateCartCount();
                updateCartDisplay();
            }
        }
    } catch (e) {
        console.warn('Unable to restore cart');
    }
}

// Menu Filter
function initMenuFilter() {
    categoryBtns.forEach(button => {
        button.addEventListener('click', function() {
            categoryBtns.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            const category = this.getAttribute('data-category');
            menuItems.forEach(item => {
                if (category === 'all' || item.getAttribute('data-category') === category) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// ✅ Auto-fill Checkout if Logged In
function autoFillCheckout() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) return;

  const nameField = document.getElementById('checkout-name');
  const emailField = document.getElementById('checkout-email');
  const phoneField = document.getElementById('checkout-phone');

  if (nameField && !nameField.value) nameField.value = user.name;
  if (emailField && !emailField.value) emailField.value = user.email;
  if (phoneField && !phoneField.value) phoneField.value = user.phone;
}

// ===== GUEST CHECKOUT FUNCTIONS =====
function closeGuestOptions() {
    const guestOptionsModal = document.getElementById('guest-options-modal');
    if (guestOptionsModal) {
        guestOptionsModal.style.display = 'none';
        document.documentElement.style.overflow = '';
    }
}

// Guest checkout option
function initGuestCheckout() {
    document.getElementById('guest-checkout-option')?.addEventListener('click', () => {
        closeGuestOptions();
        checkoutModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.documentElement.classList.add('ui-overlay-open');
    });
    
    // Login option - save cart and redirect to login page
    document.getElementById('login-checkout-option')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeGuestOptions();
        // Save current cart to localStorage so it's preserved after login
        saveCartToStorage();
        // Redirect to login page
        window.location.href = 'login.html';
    });
    
    // Signup option - save cart and redirect to signup page
    document.getElementById('signup-checkout-option')?.addEventListener('click', (e) => {
        e.preventDefault();
        closeGuestOptions();
        // Save current cart to localStorage so it's preserved after signup
        saveCartToStorage();
        // Redirect to signup page
        window.location.href = 'signup.html';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        const guestOptionsModal = document.getElementById('guest-options-modal');
        if (e.target === guestOptionsModal) {
            closeGuestOptions();
        }
    });
}

// Google Login (Placeholder)
function loginWithGoogle() {
    showToast('Google login coming soon!', 'info');
}