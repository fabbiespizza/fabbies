// admin.js - Loads and manages orders in admin panel
async function loadOrders() {
  const token = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (!token) {
    alert('Not logged in. Redirecting to login.');
    window.location.href = 'login.html';
    return;
  }

  if (!user || user.role !== 'admin') {
    alert('Access denied. Admins only.');
    window.location.href = 'login.html';
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/orders', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 403) {
      throw new Error('Access denied. Invalid or expired token.');
    }

    if (!response.ok) {
      throw new Error('Failed to load orders');
    }

    const orders = await response.json();
    const container = document.getElementById('ordersContainer');

    if (!orders || orders.length === 0) {
      container.innerHTML = '<p>No orders found.</p>';
      return;
    }

    let html = '';
    orders.forEach(order => {
      html += `
        <div class="order-item">
          <strong>Order #${order.order_number}</strong>
          <p>Total: Rs ${order.total}</p>
          <p>Payment: ${order.payment_method}</p>
          <p>Address: ${order.delivery_address}</p>
          <p>Status: 
            <select onchange="updateOrderStatus('${order.order_number}', this.value)">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
              <option value="out_for_delivery" ${order.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
              <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </p>
          <p><small>Items: ${order.items}</small></p>
          <hr>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading orders:', error);
    document.getElementById('ordersContainer').innerHTML = `
      <p style="color:red;">Error: ${error.message}</p>
      <button onclick="refreshOrders()">Retry</button>
    `;
  }
}

// Update order status
async function updateOrderStatus(orderNumber, status) {
  const token = localStorage.getItem('authToken');
  try {
    const response = await fetch(`http://localhost:5000/orders/${orderNumber}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });

    const result = await response.json();
    if (response.ok) {
      alert(`Status updated to "${status}"`);
      refreshOrders();
    } else {
      alert('Error: ' + result.error);
    }
  } catch (err) {
    alert('Network error');
  }
}

// Refresh orders
function refreshOrders() {
  loadOrders();
}

// Logout function
function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Load orders when page loads
document.addEventListener('DOMContentLoaded', loadOrders);