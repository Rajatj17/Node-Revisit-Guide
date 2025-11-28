# Node.js Interview Questions with Comprehensive Answers

Given the extensive list of 160+ questions, I'll provide detailed answers for the most important and commonly asked questions across all levels. Here's a structured approach:

## Junior Level Questions (0-2 years)

### 1. What is Node.js and how does it differ from browser JavaScript?

**Answer:**
Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine that allows you to run JavaScript on the server-side. Key differences:

```javascript
// Browser JavaScript
window.alert('Hello'); // Browser-specific API
document.getElementById('myDiv'); // DOM manipulation
localStorage.setItem('key', 'value'); // Browser storage

// Node.js
const fs = require('fs'); // File system access
const http = require('http'); // HTTP server creation
process.env.NODE_ENV; // Environment variables

// Key Differences:
// 1. Environment: Browser vs Server
// 2. APIs: DOM/BOM vs File System/HTTP
// 3. Module System: ES modules vs CommonJS (traditionally)
// 4. Global Object: window vs global/globalThis
// 5. Event Loop: Similar concept but different implementation
```

### 2. What is the Event Loop in Node.js?

**Answer:**
The Event Loop is the mechanism that allows Node.js to perform non-blocking I/O operations by offloading operations to the system kernel whenever possible.

```javascript
// Event Loop Phases:
console.log('Start'); // 1. Synchronous execution

setTimeout(() => console.log('Timer'), 0); // 4. Timer phase

setImmediate(() => console.log('Immediate')); // 5. Check phase

process.nextTick(() => console.log('NextTick')); // 2. Microtask

Promise.resolve().then(() => console.log('Promise')); // 3. Microtask

console.log('End'); // 1. Synchronous execution

// Output: Start, End, NextTick, Promise, Timer, Immediate
```

### 3. What is npm and how do you use it?

**Answer:**
npm (Node Package Manager) is the default package manager for Node.js that helps manage dependencies and scripts.

```bash
# Initialize a new project
npm init -y

# Install dependencies
npm install express          # Production dependency
npm install --save-dev jest  # Development dependency
npm install -g nodemon       # Global installation

# Package.json example
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "jest": "^28.0.0"
  }
}
```

### 4. Explain the difference between `require()` and `import` statements.

**Answer:**

```javascript
// CommonJS (require) - Traditional Node.js
const express = require('express');
const { readFile } = require('fs');
const config = require('./config.json');

// Characteristics:
// - Synchronous loading
// - Dynamic imports possible
// - Runtime resolution
// - Can be called conditionally

if (process.env.NODE_ENV === 'development') {
  const debugTool = require('debug-tool'); // Conditional require
}

// ES Modules (import) - Modern JavaScript
import express from 'express';
import { readFile } from 'fs/promises';
import config from './config.json' assert { type: 'json' };

// Characteristics:
// - Static analysis
// - Top-level only (mostly)
// - Compile-time resolution
// - Tree shaking support

// Dynamic import (ES modules)
const { default: chalk } = await import('chalk');
```

### 5. What is `package.json` and what is its purpose?

**Answer:**
`package.json` is a manifest file that contains metadata about a Node.js project and its dependencies.

```json
{
  "name": "my-node-app",
  "version": "1.0.0",
  "description": "A sample Node.js application",
  "main": "app.js",
  "type": "module", // For ES modules
  "engines": {
    "node": ">=14.0.0"
  },
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js",
    "test": "jest",
    "build": "webpack --mode production"
  },
  "dependencies": {
    "express": "^4.18.0",
    "mongoose": "^6.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.0",
    "jest": "^28.0.0"
  },
  "keywords": ["node", "express", "api"],
  "author": "Your Name",
  "license": "MIT"
}
```

### 6. What are modules in Node.js? How do you create and export modules?

**Answer:**

```javascript
// math.js - Creating a module
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

const PI = 3.14159;

// CommonJS exports
module.exports = {
  add,
  subtract,
  PI
};

// Alternative syntax
exports.multiply = (a, b) => a * b;

// app.js - Using the module
const math = require('./math');
const { add, PI } = require('./math');

console.log(math.add(5, 3)); // 8
console.log(PI); // 3.14159

// ES Module version
// math.mjs
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export const PI = 3.14159;

export default function multiply(a, b) {
  return a * b;
}

// app.mjs
import multiply, { add, PI } from './math.mjs';
```

### 7. What is the difference between `module.exports` and `exports`?

**Answer:**

```javascript
// Understanding the relationship
console.log(module.exports === exports); // true initially

// exports is a reference to module.exports
exports.name = 'John';
console.log(module.exports); // { name: 'John' }

// ❌ This breaks the reference
exports = { name: 'Jane' };
console.log(module.exports); // { name: 'John' } - unchanged!

// ✅ Correct ways to export
// Method 1: Add properties to exports
exports.add = (a, b) => a + b;
exports.subtract = (a, b) => a - b;

// Method 2: Replace module.exports entirely
module.exports = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b
};

// Method 3: Export a single function/class
module.exports = class Calculator {
  add(a, b) { return a + b; }
  subtract(a, b) { return a - b; }
};
```

### 8-10. Callbacks, Promises, and Async/Await

**Answer:**

```javascript
// 8. Callback Function
function readFileCallback(filename, callback) {
  const fs = require('fs');
  fs.readFile(filename, 'utf8', (err, data) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, data);
    }
  });
}

// Usage
readFileCallback('file.txt', (err, data) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Data:', data);
  }
});

// 9. Promises
function readFilePromise(filename) {
  const fs = require('fs').promises;
  return fs.readFile(filename, 'utf8');
}

// Usage
readFilePromise('file.txt')
  .then(data => console.log('Data:', data))
  .catch(err => console.error('Error:', err));

// 10. Async/Await
async function readFileAsync(filename) {
  try {
    const fs = require('fs').promises;
    const data = await fs.readFile(filename, 'utf8');
    return data;
  } catch (error) {
    throw error;
  }
}

// Usage
async function main() {
  try {
    const data = await readFileAsync('file.txt');
    console.log('Data:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Mid Level Questions (2-4 years)

### 25. Explain the event-driven architecture of Node.js

**Answer:**

```javascript
// Event-driven architecture components:
const EventEmitter = require('events');

// 1. Event Emitter
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

// 2. Event Listeners
myEmitter.on('event', (data) => {
  console.log('Event received:', data);
});

// 3. Event Emission
myEmitter.emit('event', { message: 'Hello World' });

// Real-world example: HTTP Server
const http = require('http');

const server = http.createServer();

// Event listeners
server.on('request', (req, res) => {
  console.log('Request received');
  res.end('Hello World');
});

server.on('connection', (socket) => {
  console.log('New connection established');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

// Start listening
server.listen(3000, () => {
  console.log('Server running on port 3000');
});

// Custom event-driven service
class OrderService extends EventEmitter {
  constructor() {
    super();
    this.orders = [];
  }
  
  createOrder(orderData) {
    const order = { id: Date.now(), ...orderData };
    this.orders.push(order);
    
    // Emit events for different listeners
    this.emit('orderCreated', order);
    this.emit('inventoryUpdate', order.items);
    this.emit('emailNotification', order.customerEmail);
    
    return order;
  }
}

const orderService = new OrderService();

// Different services listen to events
orderService.on('orderCreated', (order) => {
  console.log('Order created:', order.id);
});

orderService.on('inventoryUpdate', (items) => {
  console.log('Update inventory for:', items);
});

orderService.on('emailNotification', (email) => {
  console.log('Send email to:', email);
});
```

### 28. Explain `process.nextTick()` and `setImmediate()`. What's the difference?

**Answer:**

```javascript
// Execution order demonstration
console.log('Start');

// Timer phase
setTimeout(() => console.log('Timer'), 0);

// Check phase  
setImmediate(() => console.log('Immediate'));

// Microtask queue - highest priority
process.nextTick(() => console.log('NextTick 1'));
process.nextTick(() => console.log('NextTick 2'));

// Promise microtasks - lower priority than nextTick
Promise.resolve().then(() => console.log('Promise'));

console.log('End');

// Output: Start, End, NextTick 1, NextTick 2, Promise, Timer, Immediate

// Key Differences:
// 1. process.nextTick: Executes before any other async operation
// 2. setImmediate: Executes in the check phase of event loop

// Practical example
function recursiveNextTick() {
  process.nextTick(recursiveNextTick); // Can starve the event loop!
}

function recursiveImmediate() {
  setImmediate(recursiveImmediate); // Allows other operations
}

// Use cases:
// process.nextTick: For ensuring APIs are always async
function asyncAPI(callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function');
  }
  
  // Ensure callback is always async
  process.nextTick(callback);
}

// setImmediate: For deferring execution after I/O events
const fs = require('fs');

fs.readFile('file.txt', (err, data) => {
  if (err) throw err;
  
  // Execute after I/O completion
  setImmediate(() => {
    console.log('Process file data');
  });
});
```

### 31. How do you implement authentication in Express?

**Answer:**

```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// User storage (use database in production)
const users = [];

// Registration endpoint
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      id: users.length + 1,
      username,
      password: hashedPassword
    };
    
    users.push(user);
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    next();
  });
}

// Protected route
app.get('/profile', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Session-based authentication alternative
const session = require('express-session');

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true with HTTPS
}));

app.post('/login-session', async (req, res) => {
  // ... validation logic ...
  
  req.session.userId = user.id;
  req.session.username = user.username;
  
  res.json({ message: 'Logged in successfully' });
});

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Login required' });
  }
  next();
}
```

### 43-47. Testing in Node.js

**Answer:**

```javascript
// 43. Unit Testing with Jest
// math.js
function add(a, b) {
  return a + b;
}

function divide(a, b) {
  if (b === 0) {
    throw new Error('Cannot divide by zero');
  }
  return a / b;
}

module.exports = { add, divide };

// math.test.js
const { add, divide } = require('./math');

describe('Math functions', () => {
  test('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
  });
  
  test('should divide two numbers correctly', () => {
    expect(divide(10, 2)).toBe(5);
  });
  
  test('should throw error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
  });
});

// 44. Testing frameworks
// Jest configuration (jest.config.js)
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};

// 45. Mocking dependencies
const request = require('supertest');
const app = require('../app');

// Mock external service
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

const emailService = require('../services/emailService');

describe('POST /users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should create user and send welcome email', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com'
    };
    
    const response = await request(app)
      .post('/users')
      .send(userData)
      .expect(201);
    
    expect(response.body).toHaveProperty('id');
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      userData.email,
      'Welcome!'
    );
  });
});

// 47. Testing asynchronous code
describe('Async functions', () => {
  test('async function with async/await', async () => {
    const result = await fetchUserData(1);
    expect(result).toHaveProperty('name');
  });
  
  test('promise-based function', () => {
    return fetchUserData(1).then(result => {
      expect(result).toHaveProperty('name');
    });
  });
  
  test('callback-based function', (done) => {
    fetchUserDataCallback(1, (err, result) => {
      expect(err).toBeNull();
      expect(result).toHaveProperty('name');
      done();
    });
  });
});
```

## Senior Level Questions (4+ years)

### 52. Explain the internal architecture of Node.js and V8 engine

**Answer:**

```javascript
// Node.js Architecture Layers:

/*
┌─────────────────────────────────────┐
│        JavaScript Application       │
├─────────────────────────────────────┤
│          Node.js API Layer         │
│  (fs, http, crypto, path, etc.)     │
├─────────────────────────────────────┤
│           Node.js Bindings         │
│        (C++ to JS bridge)          │
├─────────────────────────────────────┤
│              V8 Engine             │
│     (JavaScript execution)         │
├─────────────────────────────────────┤
│              libuv                 │
│  (Event loop, I/O, threading)      │
├─────────────────────────────────────┤
│         Operating System           │
└─────────────────────────────────────┘
*/

// V8 Engine Components:
class V8EngineDemo {
  demonstrateV8Features() {
    // 1. Memory Management
    console.log('Heap Statistics:', v8.getHeapStatistics());
    
    // 2. Hidden Classes (Shapes)
    function Point(x, y) {
      this.x = x; // Hidden class Shape1
      this.y = y; // Hidden class Shape2
    }
    
    const p1 = new Point(1, 2);
    const p2 = new Point(3, 4);
    // Both p1 and p2 share the same hidden class
    
    // 3. Inline Caching
    function getX(point) {
      return point.x; // V8 optimizes this for specific shapes
    }
    
    // 4. Compilation Pipeline
    function hotFunction(n) {
      // Initially interpreted by Ignition
      // After multiple calls, optimized by TurboFan
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += i;
      }
      return sum;
    }
    
    // Warm up the function
    for (let i = 0; i < 10000; i++) {
      hotFunction(100);
    }
  }
}

// libuv Event Loop Phases:
const EventLoopPhases = {
  // 1. Timer Phase
  timers: 'setTimeout, setInterval callbacks',
  
  // 2. Pending Callbacks Phase  
  pendingCallbacks: 'I/O callbacks deferred from previous iteration',
  
  // 3. Idle, Prepare Phase
  idle: 'Internal use only',
  
  // 4. Poll Phase
  poll: 'Fetch new I/O events, execute I/O callbacks',
  
  // 5. Check Phase
  check: 'setImmediate callbacks',
  
  // 6. Close Callbacks Phase
  close: 'Close event callbacks (socket.on("close"))'
};

// Demonstrating Node.js internals
const { inspect } = require('util');

// Access internal Node.js information
console.log('Node.js version:', process.version);
console.log('V8 version:', process.versions.v8);
console.log('Active handles:', process._getActiveHandles().length);
console.log('Active requests:', process._getActiveRequests().length);
```

### 60. What are memory leaks and how do you detect and prevent them?

**Answer:**

```javascript
// Common Memory Leak Patterns and Solutions

// 1. ❌ Global Variables
let globalArray = [];
function addToGlobal(data) {
  globalArray.push(data); // Never cleaned up
}

// ✅ Solution: Proper cleanup
class DataManager {
  constructor() {
    this.data = [];
  }
  
  addData(item) {
    this.data.push(item);
  }
  
  cleanup() {
    this.data = [];
  }
}

// 2. ❌ Event Listener Leaks
const EventEmitter = require('events');
const emitter = new EventEmitter();

function createLeakyHandler() {
  const largeData = new Array(1000000).fill('data');
  
  const handler = () => {
    console.log('Handler called');
    // largeData is still referenced
  };
  
  emitter.on('event', handler);
  // Handler is never removed!
}

// ✅ Solution: Proper cleanup
class EventManager {
  constructor() {
    this.emitter = new EventEmitter();
    this.handlers = new Map();
  }
  
  addHandler(event, handler) {
    this.emitter.on(event, handler);
    this.handlers.set(event, handler);
  }
  
  removeHandler(event) {
    const handler = this.handlers.get(event);
    if (handler) {
      this.emitter.removeListener(event, handler);
      this.handlers.delete(event);
    }
  }
  
  cleanup() {
    this.handlers.forEach((handler, event) => {
      this.emitter.removeListener(event, handler);
    });
    this.handlers.clear();
  }
}

// 3. ❌ Timer Leaks
function createLeakyTimer() {
  const data = new Array(1000000).fill('data');
  
  setInterval(() => {
    console.log('Timer tick');
    // data is still referenced
  }, 1000);
  // Timer is never cleared!
}

// ✅ Solution: Timer management
class TimerManager {
  constructor() {
    this.timers = new Set();
  }
  
  createTimer(callback, interval) {
    const timer = setInterval(callback, interval);
    this.timers.add(timer);
    return timer;
  }
  
  clearTimer(timer) {
    clearInterval(timer);
    this.timers.delete(timer);
  }
  
  cleanup() {
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
  }
}

// Memory Leak Detection
class MemoryLeakDetector {
  constructor() {
    this.baseline = null;
    this.measurements = [];
  }
  
  captureBaseline() {
    if (global.gc) global.gc(); // Force GC if available
    this.baseline = process.memoryUsage();
  }
  
  measureGrowth() {
    if (global.gc) global.gc();
    
    const current = process.memoryUsage();
    const growth = {
      rss: current.rss - this.baseline.rss,
      heapTotal: current.heapTotal - this.baseline.heapTotal,
      heapUsed: current.heapUsed - this.baseline.heapUsed,
      external: current.external - this.baseline.external,
      timestamp: Date.now()
    };
    
    this.measurements.push(growth);
    
    if (growth.heapUsed > 50 * 1024 * 1024) { // 50MB growth
      console.warn('Potential memory leak detected!', {
        growth: Math.round(growth.heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(current.heapUsed / 1024 / 1024) + 'MB'
      });
    }
    
    return growth;
  }
  
  generateReport() {
    if (this.measurements.length === 0) return;
    
    const latest = this.measurements[this.measurements.length - 1];
    console.log('Memory Growth Report:', {
      totalGrowth: Math.round(latest.heapUsed / 1024 / 1024) + 'MB',
      measurements: this.measurements.length,
      avgGrowthPerMeasurement: Math.round(latest.heapUsed / this.measurements.length / 1024 / 1024) + 'MB'
    });
  }
}

// Heap snapshot analysis (requires --expose-gc)
const v8 = require('v8');
const fs = require('fs');

function takeHeapSnapshot(filename) {
  const snapshotStream = v8.getHeapSnapshot();
  const fileStream = fs.createWriteStream(filename);
  snapshotStream.pipe(fileStream);
  console.log(`Heap snapshot saved: ${filename}`);
}

// Prevention strategies
const preventionStrategies = {
  1: 'Use WeakMap and WeakSet for temporary references',
  2: 'Always remove event listeners when no longer needed',
  3: 'Clear timers and intervals when components unmount',
  4: 'Avoid global variables, use proper scoping',
  5: 'Use connection pooling instead of creating new connections',
  6: 'Implement proper cleanup methods in classes',
  7: 'Monitor memory usage in production',
  8: 'Use streaming for large data processing'
};
```

### 72. How do you design microservices with Node.js?

**Answer:**

```javascript
// Microservice Architecture Design

// 1. Service Structure
class BaseService {
  constructor(serviceName, port) {
    this.serviceName = serviceName;
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupHealthCheck();
  }
  
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(helmet());
    this.app.use(this.requestLogger);
  }
  
  requestLogger(req, res, next) {
    console.log(`${req.method} ${req.path} - ${req.ip}`);
    next();
  }
  
  setupHealthCheck() {
    this.app.get('/health', (req, res) => {
      res.json({
        service: this.serviceName,
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime()
      });
    });
  }
  
  start() {
    this.app.listen(this.port, () => {
      console.log(`${this.serviceName} running on port ${this.port}`);
    });
  }
}

// 2. User Service
class UserService extends BaseService {
  constructor() {
    super('user-service', 3001);
    this.users = new Map(); // Use database in production
  }
  
  setupRoutes() {
    this.app.get('/users/:id', this.getUser.bind(this));
    this.app.post('/users', this.createUser.bind(this));
    this.app.put('/users/:id', this.updateUser.bind(this));
  }
  
  async getUser(req, res) {
    try {
      const user = this.users.get(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async createUser(req, res) {
    try {
      const { name, email } = req.body;
      const user = {
        id: Date.now().toString(),
        name,
        email,
        createdAt: new Date()
      };
      
      this.users.set(user.id, user);
      
      // Publish event for other services
      await this.publishEvent('user.created', user);
      
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async publishEvent(eventType, data) {
    // Event publishing logic (Redis, RabbitMQ, etc.)
    console.log(`Publishing event: ${eventType}`, data);
  }
}

// 3. Order Service
class OrderService extends BaseService {
  constructor() {
    super('order-service', 3002);
    this.orders = new Map();
    this.userServiceClient = new ServiceClient('user-service', 'http://localhost:3001');
  }
  
  setupRoutes() {
    this.app.post('/orders', this.createOrder.bind(this));
    this.app.get('/orders/:id', this.getOrder.bind(this));
  }
  
  async createOrder(req, res) {
    try {
      const { userId, items } = req.body;
      
      // Validate user exists (inter-service call)
      const user = await this.userServiceClient.get(`/users/${userId}`);
      if (!user) {
        return res.status(400).json({ error: 'Invalid user' });
      }
      
      const order = {
        id: Date.now().toString(),
        userId,
        items,
        status: 'pending',
        createdAt: new Date()
      };
      
      this.orders.set(order.id, order);
      
      //