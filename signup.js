// signup.js
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  // Basic validation
  if (!name || !email || !phone || !password) {
    alert('Please fill in all fields');
    return;
  }

  if (password.length < 6) {
    alert('Password must be at least 6 characters');
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, phone, password })
    });

    const data = await response.json();

    if (response.ok) {
      alert('Account created successfully!');
      // Redirect to login page
      window.location.href = 'login.html';
    } else {
      alert('Error: ' + (data.error || 'Something went wrong'));
    }
  } catch (error) {
    console.error('Network error:', error);
    alert('Could not connect to server. Try again later.');
  }
});