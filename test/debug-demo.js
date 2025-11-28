const express = require('express');
const app = express();

// Global array that will leak memory
const users = [];
const sessions = new Map();

// Route 1: Memory leak example
app.get('/register', (req, res) => {
  const user = {
    id: Date.now(),
    name: `User${Date.now()}`,
    data: Buffer.alloc(1024 * 1024), // 1MB per user
    createdAt: new Date()
  };
  
  users.push(user); // Never removed - MEMORY LEAK!
  
  res.json({ 
    message: 'User registered', 
    totalUsers: users.length 
  });
});

// Route 2: Session leak example
app.get('/login/:userId', (req, res) => {
  const sessionId = `session_${Date.now()}`;
  
  // Store session but never clean up
  sessions.set(sessionId, {
    userId: req.params.userId,
    data: Buffer.alloc(512 * 1024), // 512KB per session
    createdAt: new Date()
  });
  
  res.json({ 
    sessionId, 
    totalSessions: sessions.size 
  });
});

// Route 3: Closure leak example
app.get('/subscribe/:email', (req, res) => {
  const email = req.params.email;
  const heavyData = Buffer.alloc(2 * 1024 * 1024); // 2MB
  
  // Event listener with closure - captures heavyData
  process.on('customEvent', function listener() {
    console.log(`Notifying ${email}`);
    // heavyData is captured in closure
  });
  // Never removed - MEMORY LEAK!
  
  res.json({ message: 'Subscribed' });
});

// Route 4: Debugging breakpoints
app.get('/calculate', (req, res) => {
  const { a, b } = req.query;
  
  // Convert to numbers
  const num1 = parseInt(a);
  const num2 = parseInt(b);
  
  // Intentional bug - doesn't handle NaN
  const result = num1 + num2;
  
  res.json({ 
    result,
    memoryUsage: process.memoryUsage() 
  });
});

// Stats route
app.get('/stats', (req, res) => {
  const memUsage = process.memoryUsage();
  
  res.json({
    users: users.length,
    sessions: sessions.size,
    eventListeners: process.listenerCount('customEvent'),
    memory: {
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`
    }
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('\nTest URLs:');
  console.log(`  http://localhost:${PORT}/register`);
  console.log(`  http://localhost:${PORT}/login/123`);
  console.log(`  http://localhost:${PORT}/subscribe/test@example.com`);
  console.log(`  http://localhost:${PORT}/calculate?a=5&b=10`);
  console.log(`  http://localhost:${PORT}/stats`);
  console.log('\nTo debug:');
  console.log('  node --inspect debug-demo.js');
  console.log('  Open chrome://inspect in Chrome');
});