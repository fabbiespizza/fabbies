require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ====================
app.use(express.static('.'));
app.use(cors({ origin: '*' }));
app.use(express.json());

// ==================== DATABASE CONNECTION ====================
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fabbies_pizza',
});

db.connect(err => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
    console.log('✅ Connected to MySQL database');
});

// 📧 Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Test connection
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email config error:', error);
    } else {
        console.log('✅ Email server ready');
    }
});

// 📨 Reusable Email Function
async function sendEmail(to, subject, text, html) {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
        html: html || text
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}`);
    } catch (error) {
        console.error('❌ Email send failed:', error);
        throw new Error('Could not send email');
    }
}

// ==================== JWT AUTH MIDDLEWARE ====================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: 'Access denied. No token provided.' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                error: 'Invalid or expired token.' 
            });
        }
        req.user = user;
        next();
    });
}

// ==================== API ENDPOINTS ====================

// 🔹 GET: All Menu Items
app.get('/menu', (req, res) => {
    const sql = `
        SELECT 
            m.id,
            m.name,
            m.description,
            m.price,
            m.image_url,
            c.name as category,
            m.is_popular
        FROM menu_items m
        JOIN menu_categories c ON m.category_id = c.id
        WHERE m.available = 1
        ORDER BY c.display_order, m.name
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ DB Error fetching menu:', err);
            return res.status(500).json({ error: 'Failed to load menu items' });
        }
        res.json(results);
    });
});

// --- PROFILE ROUTES ---

// GET /profile - Get user profile (Protected)
app.get('/profile', authenticateToken, (req, res) => {
    const userId = req.user.id; // From JWT

    const sql = 'SELECT id, name, email, phone FROM users WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('❌ DB Error fetching user profile:', err);
            return res.status(500).json({ error: 'Failed to load profile' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Return user data (excluding password)
        const user = results[0];
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone
        });
    });
});

// PUT /profile - Update user profile (Protected)
app.put('/profile', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { name, phone } = req.body;

    // Basic validation
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    // Add phone validation if necessary

    const sql = 'UPDATE users SET name = ?, phone = ? WHERE id = ?';
    db.query(sql, [name, phone, userId], (err, result) => {
        if (err) {
            console.error('❌ DB Error updating user profile:', err);
            return res.status(500).json({ error: 'Failed to update profile' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'Profile updated successfully' });
    });
});

// GET /orders/my - Get orders for the logged-in user (Protected)
app.get('/orders/my', authenticateToken, (req, res) => {
    const userId = req.user.id; // From JWT

    // Fetch user email first
    const getUserSql = 'SELECT email FROM users WHERE id = ?';
    db.query(getUserSql, [userId], (err, userResults) => {
        if (err) {
            console.error('❌ DB Error fetching user for orders:', err);
            return res.status(500).json({ error: 'Failed to load orders' });
        }
        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userEmail = userResults[0].email;

        // Fetch orders associated with this email
        const getOrdersSql = `
    SELECT
        o.order_number,
        o.total,
        o.status,
        o.created_at,
        o.delivery_address,
        GROUP_CONCAT(CONCAT(oi.name, ' (x', oi.quantity, ')') SEPARATOR ', ') as items,
        JSON_ARRAYAGG(
            JSON_OBJECT('name', oi.name, 'quantity', oi.quantity, 'price', oi.price, 'image_url', oi.image_url)
        ) as items_full
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.delivery_address LIKE ?
    GROUP BY o.id
    ORDER BY o.created_at DESC
`;
        
        db.query(getOrdersSql, [`%${userEmail}%`], (err, orderResults) => {
            if (err) {
                console.error('❌ DB Error fetching user orders:', err);
                return res.status(500).json({ error: 'Failed to load orders' });
            }
            
            const processedOrders = orderResults.map(order => {
                 try {
                     if (typeof order.items_full === 'string') {
                         order.items_full = JSON.parse(order.items_full);
                     }
                     if (Array.isArray(order.items_full)) {
                         order.items_full = order.items_full.filter(item => item && item.name);
                     } else {
                         order.items_full = [];
                     }
                 } catch (parseErr) {
                     console.warn('Could not parse items_full for order:', order.order_number, parseErr);
                     order.items_full = [];
                 }
                 return order;
            });

            res.json(processedOrders);
        });
    });
});

// --- END PROFILE ROUTES ---

// 🔹 POST: User Signup
app.post('/signup', async (req, res) => {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
        return res.status(400).json({ error: 'All fields required' });
    }

    const checkSql = 'SELECT * FROM users WHERE email = ? OR phone = ?';
    db.query(checkSql, [email, phone], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length > 0) {
            const field = results[0].email === email ? 'email' : 'phone';
            return res.status(400).json({ 
                error: `User with this ${field} already exists.` 
            });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const insertSql = 'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, "customer")';
            
            db.query(insertSql, [name, email, phone, hashedPassword], async (err, result) => {
                if (err) {
                    console.error('❌ DB Error creating user:', err);
                    return res.status(500).json({ error: 'Failed to create account' });
                }

                // ✅ Auto-login after signup
                const token = jwt.sign(
                    { id: result.insertId, email, role: 'customer' },
                    process.env.JWT_SECRET,
                    { expiresIn: '1d' }
                );

                // ✅ Send Welcome Email
                try {
                    await sendEmail(
                        email,
                        'Welcome to Fabbies Pizza! 🎉',
                        `Hi ${name},\n\nThank you for signing up with Fabbies Pizza! Use code WELCOME10 for 10% off your first order.\n\nThe Fabbies Team`,
                        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px;">
                            <h2 style="color:#d62929;">Welcome to Fabbies Pizza! 🎉</h2>
                            <p>Hi <strong>${name}</strong>,</p>
                            <p>Thank you for signing up! Use code <strong style="color:#d62929;">WELCOME10</strong> for <strong>10% off</strong> your first order!</p>
                            <p>We're excited to serve you!</p>
                            <p>🍕 <strong>The Fabbies Team</strong></p>
                            <hr>
                            <p><small>You received this email because you signed up at fabbiespizza.com</small></p>
                        </div>`
                    );
                } catch (emailErr) {
                    console.warn('📧 Welcome email failed:', emailErr.message);
                }

                res.json({
                    message: 'User registered successfully',
                    token,
                    user: { name, email, role: 'customer' }
                });
            });
        } catch (hashError) {
            console.error('❌ Hashing error:', hashError);
            return res.status(500).json({ error: 'Password hashing failed' });
        }
    });
});

// 🔹 POST: Login (Admin or Customer)
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error('❌ DB Error during login:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = results[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // ✅ Send Login Notification
        try {
            await sendEmail(
                user.email,
                'Login Detected 🔐',
                `Hello ${user.name},\n\nA login was detected on your Fabbies Pizza account.\n\nTime: ${new Date().toLocaleString()}\n\nThe Fabbies Team`,
                `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px;">
                    <h2 style="color:#43a047;">Login Notification 🔐</h2>
                    <p>Hello <strong>${user.name}</strong>,</p>
                    <p>A login was detected on your account.</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    <p>If this wasn't you, please contact us.</p>
                    <p>Stay safe,<br><strong>The Fabbies Team</strong></p>
                    <hr>
                    <p><small>You received this email because of activity on your account.</small></p>
                </div>`
            );
        } catch (emailErr) {
            console.warn('📧 Login email failed:', emailErr.message);
        }

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    });
});

// 🔹 POST: Place Order - CORRECTED VERSION WITH phone COLUMN
app.post('/orders', async (req, res) => {
    const { subtotal, delivery_fee = 0, total, payment_method, delivery_address, items = [], phone } = req.body;
    const orderNumber = 'FB-' + Date.now();
    const status = 'pending';

    console.log('POST /orders body:', {
        subtotal, delivery_fee, total, payment_method, delivery_address, phone, itemsLength: Array.isArray(items) ? items.length : 0
    });

    let userId = null;
    try {
        const authHeader = req.headers.authorization || req.body.authToken || '';
        let token = '';
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (typeof authHeader === 'string') {
            token = authHeader;
        }
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && (decoded.id || decoded.userId)) {
                userId = decoded.id || decoded.userId;
            }
        }
    } catch (err) {
        console.warn('Invalid token or token parsing failed (guest order):', err?.message || err);
        userId = null;
    }

    const orderSql = `
        INSERT INTO orders
        (order_number, subtotal, delivery_fee, total, payment_method, delivery_address, phone, status, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        orderNumber,
        subtotal ?? 0,
        delivery_fee ?? 0,
        total ?? 0,
        payment_method ?? 'cod',
        delivery_address ?? '',
        phone ?? null,
        status,
        userId
    ];

    console.log('Inserting order with params:', params);

    // Make the db.query callback async so we can use await inside it safely
    db.query(orderSql, params, async (err, result) => {
        if (err) {
            console.error('DB Error saving order:', err);
            return res.status(500).json({ error: 'Could not save order' });
        }

        // Insert order items only if provided
        if (Array.isArray(items) && items.length > 0) {
            const orderItemsSql = 'INSERT INTO order_items (order_id, name, quantity, price, image_url) VALUES ?';
            const orderItems = items.map(item => [
                result.insertId,
                item.name,
                item.quantity,
                item.price,
                item.image || null
            ]);

            // mark this callback async too (uses await for sendEmail)
            db.query(orderItemsSql, [orderItems], async (err2) => {
                if (err2) {
                    console.error('❌ DB Error saving order items:', err2);
                    return res.status(500).json({ error: 'Order items could not be saved' });
                }

                try {
                    const to = (typeof delivery_address === 'string' && delivery_address.includes('@')) ? delivery_address : 'customer@example.com';
                    await sendEmail(
                        to,
                        `Order Confirmed! #${orderNumber} 🍕`,
                        `Hi,\n\nYour order #${orderNumber} has been confirmed!\nTotal: Rs ${total}\nPayment: ${payment_method}\n\nThanks for ordering with Fabbies Pizza!`
                    );
                } catch (emailErr) {
                    console.warn('📧 Order email failed:', emailErr.message);
                }

                return res.status(201).json({
                    message: 'Order placed successfully!',
                    orderId: orderNumber,
                    orderNumber: orderNumber, // ensure frontend can read canonical ID
                    userId: userId
                });
            });
        } else {
            // No items to insert — still send confirmation and respond
            try {
                const to = (typeof delivery_address === 'string' && delivery_address.includes('@')) ? delivery_address : 'customer@example.com';
                await sendEmail(
                    to,
                    `Order Confirmed! #${orderNumber} 🍕`,
                    `Hi,\n\nYour order #${orderNumber} has been confirmed!\nTotal: Rs ${total}\nPayment: ${payment_method}\n\nThanks for ordering with Fabbies Pizza!`
                );
            } catch (emailErr) {
                console.warn('📧 Order email failed:', emailErr.message);
            }
            return res.status(201).json({
                message: 'Order placed successfully!',
                orderId: orderNumber,
                orderNumber: orderNumber, // ensure frontend can read canonical ID
                userId: userId
            });
        }
    });
});

// 🔐 PROTECTED ROUTES (Admin Only)

// 🔹 GET: All Orders (Admin Only)
app.get('/orders', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admins only.' });
    }

    const sql = `
        SELECT 
            o.order_number, 
            o.total, 
            o.payment_method, 
            o.delivery_address, 
            o.status, 
            o.created_at,
            GROUP_CONCAT(oi.name SEPARATOR ', ') as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ DB Error fetching orders:', err);
            return res.status(500).json({ error: 'Failed to fetch orders' });
        }
        res.json(results);
    });
});

// 🔹 PUT: Update Order Status (Admin Only)
app.put('/orders/:orderNumber/status', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admins only.' });
    }

    const { orderNumber } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    const sql = 'UPDATE orders SET status = ? WHERE order_number = ?';
    db.query(sql, [status, orderNumber], (err, result) => {
        if (err) {
            console.error('❌ DB Error updating status:', err);
            return res.status(500).json({ error: 'Failed to update status' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ message: 'Order status updated successfully' });
    });
});

// 🔐 POST: Forgot Password - Send Reset Code
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) {
      return res.status(404).json({ error: 'No account found with this email' });
    }

    const user = results[0];
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token and expiry in DB
    const updateSql = 'UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?';
    db.query(updateSql, [resetToken, resetExpires, email], async (err) => {
      if (err) return res.status(500).json({ error: 'Could not save reset token' });

      // Send email via Nodemailer
      try {
        await sendEmail(
          user.email,
          'Password Reset Code 🔐',
          `Hi ${user.name},\n\nYour 6-digit reset code: ${resetToken}\n\nThis code expires in 1 hour.\n\nIf you didn't request this, ignore this email.\n\nThe Fabbies Team`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:10px;">
            <h2>Password Reset 🔐</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>Your 6-digit reset code:</p>
            <p><strong style="font-size:24px;color:#d62929;">${resetToken}</strong></p>
            <p>This code expires in <strong>1 hour</strong>.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>The Fabbies Team</p>
          </div>`
        );
        res.json({ message: 'Reset code sent to your email!' });
      } catch (emailErr) {
        console.error('📧 Failed to send reset email:', emailErr);
        return res.status(500).json({ error: 'Could not send reset code' });
      }
    });
  });
});

// 🔐 POST: Reset Password with Code
app.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const sql = 'SELECT * FROM users WHERE email = ? AND reset_token = ?';
  db.query(sql, [email, code], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    const user = results[0];
    const now = new Date();

    if (new Date(user.reset_expires) < now) {
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    const updateSql = 'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE email = ?';
    db.query(updateSql, [hashedPassword, email], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update password' });
      res.json({ message: 'Password reset successfully!' });
    });
  });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`\n🚀 Backend Server Running at http://localhost:${PORT}`);
    console.log(`📦 Available Endpoints:`);
    console.log(`  GET    /menu`);
    console.log(`  POST   /signup`);
    console.log(`  POST   /login`);
    console.log(`  POST   /orders`);
    console.log(`  GET    /orders         🔐 (Admin only)`);
    console.log(`  PUT    /orders/:orderNumber/status  🔐 (Admin only)`);
    console.log(`  Static Pages: index.html, login.html, admin.html`);
    console.log(`\n👉 Open Your App: http://localhost:${PORT}`);
});