**Absolutely!** 🎉 Let me create a comprehensive document combining all the error handling questions and learnings!

---

# **Node.js Error Handling - Complete Guide**

A comprehensive guide covering all aspects of error handling in Node.js applications.

---

## **Table of Contents**

1. [Try/Catch with Async/Await](#1-trycatch-with-asyncawait)
2. [Unhandled Promise Rejections](#2-unhandled-promise-rejections)
3. [Error-First Callbacks](#3-error-first-callbacks)
4. [Express Async Route Errors](#4-express-async-route-errors)
5. [Custom Error Classes](#5-custom-error-classes)
6. [Global Error Handlers](#6-global-error-handlers)
7. [Try/Catch Trap](#7-trycatch-trap)
8. [Promise.all() Error Handling](#8-promiseall-error-handling)
9. [Express Error Middleware](#9-express-error-middleware)
10. [Finally Block & Cleanup](#10-finally-block--cleanup)

---

## **1. Try/Catch with Async/Await**

### **The Problem:**

```javascript
async function fetchUser(userId) {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  const data = await response.json();
  return data;
}

app.get('/user/:id', async (req, res) => {
  const user = await fetchUser(req.params.id);
  res.json(user);
});
```

**Issues:**
- ❌ No error handling
- ❌ If `fetch()` fails, server doesn't crash but client hangs forever
- ❌ Unhandled promise rejection logged
- ❌ Request never responds (timeout after 30-60s)

---

### **The Fix:**

#### **Option 1: Try/Catch**
```javascript
app.get('/user/:id', async (req, res) => {
  try {
    const user = await fetchUser(req.params.id);
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});
```

#### **Option 2: Async Handler Wrapper**
```javascript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/user/:id', asyncHandler(async (req, res) => {
  const user = await fetchUser(req.params.id);
  res.json(user);
}));

// Error middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

#### **Option 3: express-async-errors**
```javascript
require('express-async-errors');

app.get('/user/:id', async (req, res) => {
  const user = await fetchUser(req.params.id);
  res.json(user);
});

// Error middleware automatically catches async errors
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

---

### **Key Takeaways:**

- ✅ Async errors don't crash the server - they create unhandled rejections
- ✅ Clients hang if errors aren't handled
- ✅ Always send a response (success or error)
- ✅ Use try/catch, async wrappers, or express-async-errors
- ❌ Don't rely on `process.on('uncaughtException')` for normal error handling

---

## **2. Unhandled Promise Rejections**

### **Three Scenarios:**

```javascript
async function processData() {
  throw new Error('Processing failed!');
}

// Scenario 1: Unhandled ❌
processData();
// Result: UnhandledPromiseRejectionWarning

// Scenario 2: Handled with .catch() ✅
processData().catch(err => console.error(err));
// Result: Error caught

// Scenario 3: try/catch (doesn't work) ❌
try {
  processData();  // Returns Promise immediately
} catch (err) {
  console.error('Caught:', err);  // Never runs
}
```

---

### **Why Scenario 3 Doesn't Work:**

```javascript
try {
  processData();  // Returns Promise immediately (sync)
  // try/catch block ends here
} catch (err) {
  // Error happens later (async), outside try/catch
}
```

**Timeline:**
```
Time 0ms:  try { block starts
Time 0ms:  processData() called, returns Promise
Time 0ms:  try/catch ends (no error yet)
Time 1ms:  Inside Promise, error is thrown
Time 1ms:  Unhandled rejection (try/catch is gone)
```

---

### **The Fix:**

```javascript
// ✅ Use .catch()
processData().catch(err => console.error(err));

// ✅ Use await in try/catch
async function main() {
  try {
    await processData();  // Waits for Promise
  } catch (err) {
    console.error('Caught:', err);
  }
}
```

---

### **Key Takeaways:**

- ✅ Async functions always return Promises
- ✅ try/catch only catches synchronous errors
- ✅ Use `.catch()` on Promises OR `await` in try/catch
- ✅ Unhandled rejection = Promise rejected with no handler
- ✅ Modern Node.js (v15+) crashes on unhandled rejections

---

## **3. Error-First Callbacks**

### **The Pattern:**

```javascript
// Old style - error-first callback
fs.readFile('file.txt', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data.toString());
});
```

**Rules:**
- First parameter is ALWAYS the error (or null)
- Second parameter is the result (if successful)
- Always check `if (err)` first

---

### **Converting to Promises:**

#### **Manual Conversion:**
```javascript
function readFilePromise(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

// Usage
readFilePromise('file.txt')
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

#### **Using util.promisify():**
```javascript
const fs = require('fs');
const util = require('util');

const readFilePromise = util.promisify(fs.readFile);

// Usage
await readFilePromise('file.txt');
```

---

### **Key Takeaways:**

- ✅ Error-first callbacks: `(err, result) => {}`
- ✅ Use `util.promisify()` to convert to Promises
- ✅ Modern Node.js has Promise-based APIs built-in (`fs.promises`)

---

## **4. Express Async Route Errors**

### **The Problem:**

```javascript
app.get('/api/data', async (req, res) => {
  const data = await database.query('SELECT * FROM users');
  
  if (!data) {
    throw new Error('No data found');
  }
  
  res.json(data);
});
```

**What happens if `database.query()` throws:**
1. ❌ Async function returns rejected Promise
2. ❌ Express doesn't catch async errors
3. ❌ Client hangs forever
4. ❌ UnhandledPromiseRejectionWarning logged
5. ❌ Connection stays open until timeout
6. ❌ Memory leak potential

---

### **Throwing After Response:**

```javascript
app.get('/api/data', async (req, res) => {
  res.json(data);  // ✅ Response sent
  
  if (!data) {
    throw new Error('No data found');  // ❌ Throws AFTER response
  }
});
```

**Danger:**
- Can't send another response (already sent)
- Error: `Cannot set headers after they are sent`

---

### **The Fix:**

#### **Option 1: Try/Catch in Route**
```javascript
app.get('/api/data', async (req, res) => {
  try {
    const data = await database.query('SELECT * FROM users');
    
    if (!data) {
      return res.status(404).json({ error: 'No data found' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database query failed' });
  }
});
```

#### **Option 2: express-async-errors**
```javascript
require('express-async-errors');

app.get('/api/data', async (req, res) => {
  const data = await database.query('SELECT * FROM users');
  
  if (!data) {
    throw new Error('No data found');
  }
  
  res.json(data);
});

// Error middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

---

### **Key Takeaways:**

- ✅ Express doesn't catch async errors automatically
- ✅ Always handle errors - client needs response
- ✅ Can't send response twice
- ✅ express-async-errors is the cleanest solution
- ✅ Always have error middleware as last middleware

---

## **5. Custom Error Classes**

### **Why Custom Errors?**

```javascript
// ❌ BAD: All errors look the same
throw new Error('Email required');  // What status code?
throw new Error('Database failed');  // Same Error type!

// ✅ GOOD: Different error types
throw new ValidationError('Email required');  // 400
throw new DatabaseError('Database failed');   // 500
```

---

### **Implementation:**

```javascript
// Base class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
class ValidationError extends AppError {
  constructor(message, fields = {}) {
    super(message, 400);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message) {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

class DatabaseError extends AppError {
  constructor(message) {
    super(message, 500);
    this.name = 'DatabaseError';
  }
}
```

---

### **Usage:**

```javascript
app.post('/api/users', async (req, res) => {
  const { email, password } = req.body;
  
  // Validation
  if (!email) {
    throw new ValidationError('Email is required');
  }
  
  // Check if exists
  const existing = await db.findUserByEmail(email);
  if (existing) {
    throw new ValidationError('Email already in use');
  }
  
  const user = await db.createUser({ email, password });
  res.status(201).json(user);
});

app.get('/api/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  res.json(user);
});
```

---

### **Checking Error Types:**

```javascript
// Method 1: instanceof
if (error instanceof ValidationError) {
  res.status(400).json({ error: error.message });
}

// Method 2: error.name
switch (error.name) {
  case 'ValidationError':
    res.status(400).json({ error: error.message });
    break;
}

// Method 3: error.statusCode (cleanest!)
const statusCode = error.statusCode || 500;
res.status(statusCode).json({ error: error.message });
```

---

### **Benefits:**

1. ✅ Automatic status codes
2. ✅ Consistent error responses
3. ✅ Easy to filter errors (`isOperational` flag)
4. ✅ Better error tracking
5. ✅ Cleaner code (throw anywhere, handle in middleware)

---

### **Key Takeaways:**

- ✅ Custom errors = automatic status codes
- ✅ Use `instanceof` or `statusCode` to check error types
- ✅ `isOperational` flag distinguishes known errors from bugs
- ✅ Centralized error handling in middleware

---

## **6. Global Error Handlers**

### **uncaughtException vs unhandledRejection:**

```javascript
// Uncaught Exception - Synchronous errors
throw new Error('Sync error');
someFunctionThatDoesntExist();
null.property;

// Unhandled Rejection - Promise rejections
Promise.reject(new Error('Async error'));
async function fail() {
  throw new Error('Error');
}
fail();  // No .catch()
```

---

### **Should You Shut Down?**

#### **uncaughtException - ALWAYS shut down:**

```javascript
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION');
  console.error(error);
  
  // App is in undefined state
  // MUST shut down
  gracefulShutdown('uncaughtException', 1);
});
```

**Why?** After uncaughtException, the app is in an **undefined state**:
- Memory might be corrupted
- Resources might not be cleaned up
- Event listeners might be broken
- Database connections might be dead

---

#### **unhandledRejection - Shut down in production:**

```javascript
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION');
  console.error('Reason:', reason);
  
  // In production, treat as fatal
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('unhandledRejection', 1);
  }
});
```

**Node.js v15+:** Process exits by default on unhandled rejections

---

### **Graceful Shutdown:**

```javascript
async function gracefulShutdown(signal, exitCode) {
  console.log(`\n${signal} - Starting graceful shutdown...`);
  
  // Force exit after 10 seconds
  const forceExitTimer = setTimeout(() => {
    console.error('⏰ FORCED EXIT');
    process.exit(exitCode);
  }, 10000);
  forceExitTimer.unref();
  
  try {
    // 1. Stop accepting new connections
    await new Promise((resolve) => {
      server.close(() => {
        console.log('✅ Server closed');
        resolve();
      });
    });
    
    // 2. Close database
    try {
      await database.close();
      console.log('✅ Database closed');
    } catch (err) {
      console.error('⚠️ Database close error:', err.message);
    }
    
    // 3. Close Redis
    try {
      await redis.quit();
      console.log('✅ Redis closed');
    } catch (err) {
      console.error('⚠️ Redis close error:', err.message);
    }
    
    console.log('✅ Graceful shutdown complete');
    
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(exitCode);
  }
}

// Graceful signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM', 0));
process.on('SIGINT', () => gracefulShutdown('SIGINT', 0));

// Fatal errors
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION');
  console.error(error);
  gracefulShutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  console.error('🔥 UNHANDLED REJECTION');
  console.error(reason);
  gracefulShutdown('unhandledRejection', 1);
});
```

---

### **Exit Codes:**

- `process.exit(0)` - Success (normal shutdown)
- `process.exit(1)` - Failure (error occurred)

**Why it matters:**
```bash
# Docker/Kubernetes detects exit code
node app.js
if [ $? -eq 0 ]; then
  echo "Normal shutdown"
else
  echo "Crash - restarting..."
fi
```

---

### **Key Takeaways:**

1. ✅ `uncaughtException` = ALWAYS shut down (undefined state)
2. ✅ `unhandledRejection` = Shut down in production
3. ✅ Use `process.exit(1)` for errors (signals failure)
4. ✅ Use `process.exit(0)` for graceful shutdown
5. ✅ Implement graceful shutdown (close connections)
6. ✅ Have timeout for forced exit (10 seconds)
7. ✅ Let orchestrator restart (Docker, Kubernetes, PM2)

---

## **7. Try/Catch Trap**

### **The Problem:**

```javascript
function getUserData(userId) {
  try {
    setTimeout(() => {
      throw new Error('User not found');
    }, 1000);
  } catch (err) {
    console.error('Caught:', err);  // ❌ Never runs
  }
}
```

**Why it doesn't work:**
```
Time 0ms:   try { block starts
Time 0ms:   setTimeout() schedules callback
Time 0ms:   try/catch ends (no error yet)
Time 1000ms: Callback executes (different call stack)
Time 1000ms: Error thrown (try/catch is gone)
```

---

### **The Rule:**

**try/catch only catches:**
- ✅ Synchronous errors
- ✅ Await-ed Promises

**try/catch does NOT catch:**
- ❌ Callbacks (setTimeout, event handlers)
- ❌ Promises without await

---

### **The Fix:**

```javascript
// ✅ Wrap in Promise
function delay(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('User not found'));
    }, ms);
  });
}

async function getUserData(userId) {
  try {
    await delay(1000);
  } catch (err) {
    console.error('Caught:', err);  // ✅ Works!
  }
}

// ✅ Error-first callback
function getUserData(userId, callback) {
  setTimeout(() => {
    callback(new Error('User not found'), null);
  }, 1000);
}

getUserData(123, (err, data) => {
  if (err) {
    console.error('Error:', err);  // ✅ Works!
  }
});
```

---

### **Quick Reference:**

| Pattern | try/catch Works? | How to Handle |
|---------|------------------|---------------|
| `throw new Error()` | ✅ Yes | try/catch |
| `await promise()` | ✅ Yes | try/catch |
| `setTimeout(() => throw)` | ❌ No | Wrap in Promise |
| `promise().then()` | ❌ No | Use .catch() |
| `callback(err)` | ❌ No | Check `if (err)` |

---

### **Key Takeaways:**

- ✅ try/catch only catches SYNCHRONOUS errors
- ✅ Callbacks execute in a DIFFERENT call stack
- ✅ Use `await` to make async errors catchable
- ✅ Wrap callbacks in Promises
- ❌ Never assume try/catch works with callbacks

---

## **8. Promise.all() Error Handling**

### **The Behavior:**

```javascript
const promises = [
  Promise.resolve('User 1'),
  Promise.resolve('User 2'),
  Promise.reject(new Error('User 3 failed')),
  Promise.resolve('User 4'),
];

Promise.all(promises)
  .then(users => console.log('Success:', users))  // ❌ Never runs
  .catch(err => console.error('Error:', err));    // ✅ Runs with first error
```

**What happens:**
1. ❌ `Promise.all()` fails fast - rejects immediately when ANY promise rejects
2. ❌ `.then()` never called
3. ✅ `.catch()` receives the FIRST rejection only
4. ⚠️ All successful results are LOST

---

### **Do Other Promises Still Execute?**

**YES!** Common misconception:

```javascript
async function fetchUser(id) {
  console.log(`Starting fetch for user ${id}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (id === 3) {
    console.log(`User ${id} failed!`);
    throw new Error(`User ${id} not found`);
  }
  
  console.log(`User ${id} completed`);
  return { id, name: `User ${id}` };
}

const promises = [
  fetchUser(1),
  fetchUser(2),
  fetchUser(3),  // Fails
  fetchUser(4),
];

Promise.all(promises).catch(err => console.error(err.message));
```

**Output:**
```
Starting fetch for user 1
Starting fetch for user 2
Starting fetch for user 3
Starting fetch for user 4
User 1 completed
User 2 completed
User 3 failed!
User 4 completed
User 3 not found
```

**All promises execute, but `Promise.all()` stops waiting after first rejection.**

---

### **Handling Partial Failures:**

#### **Option 1: Promise.allSettled() (BEST!)**

```javascript
const promises = [
  fetchUser(1),
  fetchUser(2),
  fetchUser(3),  // Fails
  fetchUser(4),
];

const results = await Promise.allSettled(promises);

console.log(results);
```

**Output:**
```javascript
[
  { status: 'fulfilled', value: { id: 1, name: 'User 1' } },
  { status: 'fulfilled', value: { id: 2, name: 'User 2' } },
  { status: 'rejected', reason: Error: User 3 not found },
  { status: 'fulfilled', value: { id: 4, name: 'User 4' } }
]
```

**Process results:**
```javascript
const successful = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);

const failed = results
  .filter(r => r.status === 'rejected')
  .map(r => r.reason);
```

---

#### **Option 2: Wrap Promises**

```javascript
function catchPromise(promise) {
  return promise
    .then(result => ({ success: true, data: result }))
    .catch(error => ({ success: false, error }));
}

const promises = [
  catchPromise(fetchUser(1)),
  catchPromise(fetchUser(2)),
  catchPromise(fetchUser(3)),
  catchPromise(fetchUser(4)),
];

const results = await Promise.all(promises);
```

---

### **Promise Methods Comparison:**

| Method | Resolves When | Rejects When | Use Case |
|--------|---------------|--------------|----------|
| `Promise.all()` | ALL succeed | ANY fails | Need all results |
| `Promise.allSettled()` | ALL settle | Never rejects | Partial success OK |
| `Promise.race()` | FIRST settles | FIRST rejects | Need fastest result |
| `Promise.any()` | FIRST succeeds | ALL fail | Need any one success |

---

### **Real-World Example:**

```javascript
// All required - use Promise.all
const [user, profile] = await Promise.all([
  fetchUser(userId),
  fetchProfile(userId)
]);

// Optional features - use Promise.allSettled
const optionalResults = await Promise.allSettled([
  fetchRecentActivity(userId),
  fetchNotifications(userId),
  fetchRecommendations(userId)
]);

const [activity, notifications, recommendations] = optionalResults.map(r =>
  r.status === 'fulfilled' ? r.value : null
);
```

---

### **Key Takeaways:**

1. ✅ `Promise.all()` fails fast - one rejection stops everything
2. ✅ Other promises keep executing - but results are lost
3. ✅ Use `Promise.allSettled()` for partial failures
4. ✅ Each Promise method has specific use cases
5. ✅ Choose based on requirements (all vs any vs first)

---

## **9. Express Error Middleware**

### **The Problem:**

```javascript
app.get('/api/users', async (req, res) => {
  const users = await db.getUsers();  // ❌ If throws...
  res.json(users);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');  // ❌ Never runs
});
```

**Express doesn't catch async errors by default!**

---

### **The Solution:**

#### **Option 1: Async Handler Wrapper**

```javascript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await db.getUsers();  // ✅ Errors caught
  res.json(users);
}));
```

---

#### **Option 2: express-async-errors**

```javascript
require('express-async-errors');

app.get('/api/users', async (req, res) => {
  const users = await db.getUsers();  // ✅ Auto-caught
  res.json(users);
});
```

---

### **Middleware Order Matters!**

```javascript
// ✅ CORRECT Order
app.use(express.json());        // 1. General middleware
app.use(cors());

app.get('/api/users', ...);     // 2. Routes

app.use((req, res) => {         // 3. 404 handler
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {  // 4. Error middleware (LAST!)
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

---

### **Complete Error Middleware:**

```javascript
const express = require('express');
require('express-async-errors');
const app = express();

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

// Routes
app.get('/api/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  res.json(user);
});

// 404 handler
app.use((req, res) => {
  throw new AppError('Route not found', 404);
});

// Error middleware (LAST!)
app.use((err, req, res, next) => {
  // Log error
  console.error({
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Determine message
  const message = err.isOperational 
    ? err.message 
    : 'Internal server error';
  
  // Send response
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack 
    })
  });
});
```

---

### **Key Takeaways:**

1. ✅ Express doesn't catch async errors by default
2. ✅ Use wrapper or express-async-errors
3. ✅ Error middleware MUST have 4 parameters
4. ✅ Error middleware MUST be defined LAST
5. ✅ Call `next(err)` to pass errors to error middleware
6. ✅ Have 404 handler before error middleware

---

## **10. Finally Block & Cleanup**

### **When Finally Executes:**

**ALWAYS!** (Even with return, throw, break, continue)

```javascript
// Scenario 1: Success
try {
  await processData();  // ✅ Succeeds
} finally {
  await cleanup();  // ✅ Runs
}

// Scenario 2: Error
try {
  await processData();  // ❌ Throws
} catch (err) {
  console.error(err);  // ✅ Runs
} finally {
  await cleanup();  // ✅ Runs
}

// Scenario 3: Return
try {
  await processData();
  return 'success';  // ✅ Returns
} finally {
  await cleanup();  // ✅ Runs BEFORE return!
}
```

---

### **Danger: Errors in Finally**

```javascript
// ❌ PROBLEM: Finally error overrides original error
try {
  throw new Error('Processing failed');  // Original error
} catch (err) {
  console.error('Caught:', err.message);
} finally {
  throw new Error('Cleanup failed');  // Finally error
}

// Result: Original error is LOST!
// Only finally error propagates
```

---

### **The Fix: Wrap Finally in Try/Catch**

```javascript
async function processFile(filename) {
  const file = await openFile(filename);
  
  try {
    await processData(file);
  } catch (err) {
    console.error('Processing failed:', err);
    throw err;  // Preserve original error
  } finally {
    try {
      await closeFile(file);
    } catch (cleanupErr) {
      console.error('Cleanup failed:', cleanupErr);
      // Log but don't throw - preserve original error
    }
  }
}
```

---

### **Best Pattern: try/finally (No Catch)**

```javascript
async function processFile(filename) {
  const file = await openFile(filename);
  
  try {
    await processData(file);
    return file.data;
  } finally {
    // Cleanup ALWAYS happens
    try {
      await closeFile(file);
    } catch (err) {
      console.error('Failed to close file:', err);
    }
  }
}

// Caller handles errors
try {
  const data = await processFile('test.txt');
  console.log('Success:', data);
} catch (err) {
  console.error('Failed:', err);
}
```

**Benefits:**
- ✅ Cleanup always happens
- ✅ Errors propagate naturally
- ✅ Caller handles errors (separation of concerns)
- ✅ Cleanup errors don't hide original errors

---

### **Production Pattern:**

```javascript
async function withResource() {
  let resource = null;
  
  try {
    // 1. Acquire resource
    resource = await acquire();
    
    // 2. Use resource
    return await use(resource);
    
  } finally {
    // 3. Cleanup (always!)
    if (resource) {
      try {
        await release(resource);
        console.log('✅ Resource released');
      } catch (err) {
        console.error('⚠️ Release failed:', err);
        // Log but don't throw
      }
    }
  }
}
```

---

### **Real-World Examples:**

#### **Database Connection:**
```javascript
async function queryDatabase(sql) {
  const connection = await db.connect();
  
  try {
    const results = await connection.query(sql);
    return results;
  } finally {
    try {
      await connection.close();
    } catch (err) {
      console.error('Failed to close connection:', err);
    }
  }
}
```

#### **File Upload:**
```javascript
async function uploadFile(file) {
  const tempPath = await saveTempFile(file);
  
  try {
    const uploadedUrl = await cloudStorage.upload(tempPath);
    return uploadedUrl;
  } finally {
    try {
      await fs.unlink(tempPath);  // Delete temp file
    } catch (err) {
      console.error('Failed to delete temp file:', err);
    }
  }
}
```

#### **Mutex Lock:**
```javascript
async function updateCounter() {
  const lock = await mutex.acquire();
  
  try {
    const count = await getCount();
    await setCount(count + 1);
    return count + 1;
  } finally {
    lock.release();  // ALWAYS release lock!
  }
}
```

---

### **Key Takeaways:**

1. ✅ `finally` ALWAYS runs (even with return/throw)
2. ✅ Errors in `finally` override original errors
3. ✅ Wrap cleanup in try/catch to preserve original errors
4. ✅ DO await in finally (with error handling)
5. ✅ Use try/finally without catch for pure cleanup
6. ✅ Let errors propagate - caller handles them
7. ✅ Log cleanup errors but don't throw them
8. ✅ Check if resource exists before cleanup

---

## **Quick Reference: Error Handling Cheat Sheet**

### **Async Functions:**
```javascript
// ❌ WRONG
async function bad() {
  throw new Error();  // Unhandled
}
bad();

// ✅ RIGHT
bad().catch(err => console.error(err));
// OR
try { await bad(); } catch (err) { ... }
```

---

### **Express Routes:**
```javascript
// ❌ WRONG
app.get('/route', async (req, res) => {
  await something();  // Unhandled if throws
});

// ✅ RIGHT
require('express-async-errors');
app.get('/route', async (req, res) => {
  await something();  // Auto-caught
});
```

---

### **Promise.all:**
```javascript
// ❌ Fails fast, loses data
Promise.all([p1, p2, p3]).catch(err => ...);

// ✅ Gets all results
Promise.allSettled([p1, p2, p3]).then(results => ...);
```

---

### **Cleanup:**
```javascript
// ✅ ALWAYS use try/finally
try {
  const resource = await acquire();
  return await use(resource);
} finally {
  try {
    await release(resource);
  } catch (err) {
    console.error(err);
  }
}
```

---

### **Global Handlers:**
```javascript
// Fatal errors - ALWAYS shut down
process.on('uncaughtException', (err) => {
  console.error('Fatal error:', err);
  gracefulShutdown(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  gracefulShutdown(1);
});
```

---

## **Summary**

**The Golden Rules:**

1. ✅ **Always handle async errors** (try/catch, .catch(), or express-async-errors)
2. ✅ **Use custom error classes** (automatic status codes)
3. ✅ **Shut down after fatal errors** (gracefully with timeout)
4. ✅ **try/catch only works with sync code and await**
5. ✅ **Use Promise.allSettled() for partial failures**
6. ✅ **Error middleware must be last in Express**
7. ✅ **Always cleanup in finally** (with error handling)
8. ✅ **Let errors propagate** (caller decides how to handle)

---

**🎉 Congratulations!** You now have a complete understanding of error handling in Node.js!

---