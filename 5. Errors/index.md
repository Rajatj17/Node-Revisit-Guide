# Node.js Error Handling - Complete Guide

Error handling in Node.js is **fundamentally different** from other languages due to its asynchronous nature. Understanding this is crucial for building robust applications.

## Types of Errors in Node.js

### 1. Synchronous Errors (Traditional Try-Catch)

```javascript
// Basic synchronous error handling
function divideNumbers(a, b) {
  try {
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    return a / b;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

// JSON parsing errors
function parseJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Invalid JSON:', error.message);
    return null;
  }
}

// File system synchronous errors
const fs = require('fs');

try {
  const data = fs.readFileSync('nonexistent.txt', 'utf8');
  console.log(data);
} catch (error) {
  console.error('File error:', error.message);
}
```

### 2. Asynchronous Errors - Callbacks (Error-First Pattern)

```javascript
const fs = require('fs');

// Error-first callback pattern
fs.readFile('somefile.txt', 'utf8', (error, data) => {
  if (error) {
    console.error('Error reading file:', error.message);
    return;
  }
  
  console.log('File contents:', data);
});

// Custom async function with error-first callback
function asyncOperation(input, callback) {
  setTimeout(() => {
    if (!input) {
      return callback(new Error('Input is required'));
    }
    
    if (input < 0) {
      return callback(new Error('Input must be positive'));
    }
    
    // Success case
    callback(null, input * 2);
  }, 1000);
}

// Usage
asyncOperation(5, (error, result) => {
  if (error) {
    console.error('Operation failed:', error.message);
    return;
  }
  
  console.log('Result:', result);
});
```

### 3. Promise-Based Error Handling

```javascript
const fs = require('fs').promises;

// Basic Promise error handling
fs.readFile('somefile.txt', 'utf8')
  .then(data => {
    console.log('File contents:', data);
  })
  .catch(error => {
    console.error('Error reading file:', error.message);
  });

// Chaining with error handling
function processFile(filename) {
  return fs.readFile(filename, 'utf8')
    .then(data => {
      if (!data.trim()) {
        throw new Error('File is empty');
      }
      return JSON.parse(data);
    })
    .then(jsonData => {
      if (!jsonData.id) {
        throw new Error('Missing required field: id');
      }
      return jsonData;
    })
    .catch(error => {
      console.error('Processing failed:', error.message);
      throw error; // Re-throw for caller to handle
    });
}

// Usage
processFile('data.json')
  .then(result => console.log('Processed:', result))
  .catch(error => console.error('Final error:', error.message));
```

### 4. Async/Await Error Handling

```javascript
const fs = require('fs').promises;

// Basic async/await with try-catch
async function readFileAsync(filename) {
  try {
    const data = await fs.readFile(filename, 'utf8');
    return data;
  } catch (error) {
    console.error('Error reading file:', error.message);
    throw error; // Re-throw or return default value
  }
}

// Multiple async operations
async function processMultipleFiles(filenames) {
  const results = [];
  
  for (const filename of filenames) {
    try {
      const data = await fs.readFile(filename, 'utf8');
      const parsed = JSON.parse(data);
      results.push(parsed);
    } catch (error) {
      console.error(`Error processing ${filename}:`, error.message);
      // Continue with other files instead of failing completely
      results.push(null);
    }
  }
  
  return results;
}

// Parallel processing with error handling
async function processFilesParallel(filenames) {
  const promises = filenames.map(async (filename) => {
    try {
      const data = await fs.readFile(filename, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error processing ${filename}:`, error.message);
      return { error: error.message, filename };
    }
  });
  
  return await Promise.all(promises);
}
```

## Custom Error Classes

```javascript
// Base custom error class
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
class ValidationError extends AppError {
  constructor(field, value) {
    super(`Invalid ${field}: ${value}`, 400);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} with id ${id} not found`, 404);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
  }
}

class DatabaseError extends AppError {
  constructor(operation, originalError) {
    super(`Database operation failed: ${operation}`, 500);
    this.name = 'DatabaseError';
    this.operation = operation;
    this.originalError = originalError;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

// Usage
function validateUser(user) {
  if (!user.email) {
    throw new ValidationError('email', user.email);
  }
  
  if (!user.email.includes('@')) {
    throw new ValidationError('email', user.email);
  }
  
  if (user.age < 18) {
    throw new ValidationError('age', user.age);
  }
}

async function findUser(id) {
  try {
    const user = await database.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return user;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('findById', error);
  }
}
```

## Event Emitter Error Handling

```javascript
const EventEmitter = require('events');

class DataProcessor extends EventEmitter {
  constructor() {
    super();
    
    // Always handle error events to prevent crashes
    this.on('error', (error) => {
      console.error('DataProcessor error:', error.message);
    });
  }
  
  async processData(data) {
    try {
      if (!data) {
        this.emit('error', new Error('No data provided'));
        return;
      }
      
      // Simulate processing
      const result = await this.transform(data);
      this.emit('processed', result);
      
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  async transform(data) {
    // Simulate async transformation
    if (Math.random() > 0.8) {
      throw new Error('Random processing error');
    }
    
    return data.toUpperCase();
  }
}

// Usage
const processor = new DataProcessor();

processor.on('processed', (result) => {
  console.log('Processing complete:', result);
});

processor.on('error', (error) => {
  console.error('Processing failed:', error.message);
});

// Process some data
processor.processData('hello world');
```

## Global Error Handling

### Uncaught Exceptions

```javascript
// Handle uncaught exceptions (synchronous errors)
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  // Log the error
  logError(error);
  
  // Graceful shutdown
  process.exit(1);
});

// Example that would trigger uncaught exception
setTimeout(() => {
  throw new Error('This will be caught by uncaughtException handler');
}, 1000);
```

### Unhandled Promise Rejections

```javascript
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Log the error
  logError(reason);
  
  // Graceful shutdown
  process.exit(1);
});

// Example that would trigger unhandled rejection
Promise.reject(new Error('This promise rejection is not handled'));

// Better approach - always handle promises
Promise.reject(new Error('This is handled'))
  .catch(error => console.error('Handled rejection:', error.message));
```

### Graceful Shutdown

```javascript
const express = require('express');
const app = express();

let server;

// Start server
function startServer() {
  server = app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}

// Graceful shutdown function
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connections
    closeDatabase()
      .then(() => {
        console.log('Database connections closed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

startServer();
```

## Express.js Error Handling

### Centralized Error Handler

```javascript
const express = require('express');
const app = express();

// Custom error handler middleware
function errorHandler(err, req, res, next) {
  // Log error
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Handle specific error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      error: 'Validation Error',
      message: err.message,
      field: err.field
    });
  }
  
  if (err instanceof NotFoundError) {
    return res.status(err.statusCode).json({
      error: 'Not Found',
      message: err.message
    });
  }
  
  if (err instanceof AuthenticationError) {
    return res.status(err.statusCode).json({
      error: 'Authentication Error',
      message: err.message
    });
  }
  
  // Handle mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation Error',
      messages: errors
    });
  }
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Please provide a valid token'
    });
  }
  
  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
  res.status(statusCode).json({
    error: 'Server Error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

// Async wrapper to catch async errors
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Routes with error handling
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await findUser(req.params.id);
  res.json(user);
}));

app.post('/users', asyncHandler(async (req, res) => {
  validateUser(req.body);
  const user = await createUser(req.body);
  res.status(201).json(user);
}));

// 404 handler
app.use((req, res, next) => {
  const error = new NotFoundError('Route', req.originalUrl);
  next(error);
});

// Error handler (must be last)
app.use(errorHandler);
```

## Database Error Handling

```javascript
const mongoose = require('mongoose');

// MongoDB connection with error handling
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Handle connection events
mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Repository pattern with error handling
class UserRepository {
  async findById(id) {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new NotFoundError('User', id);
      }
      return user;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      if (error.name === 'CastError') {
        throw new ValidationError('id', id);
      }
      
      throw new DatabaseError('findById', error);
    }
  }
  
  async create(userData) {
    try {
      const user = new User(userData);
      return await user.save();
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError('user data', error.message);
      }
      
      if (error.code === 11000) {
        throw new ValidationError('email', 'Email already exists');
      }
      
      throw new DatabaseError('create', error);
    }
  }
  
  async update(id, updates) {
    try {
      const user = await User.findByIdAndUpdate(
        id, 
        updates, 
        { new: true, runValidators: true }
      );
      
      if (!user) {
        throw new NotFoundError('User', id);
      }
      
      return user;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      if (error.name === 'ValidationError') {
        throw new ValidationError('user data', error.message);
      }
      
      throw new DatabaseError('update', error);
    }
  }
}
```

## Error Logging and Monitoring

```javascript
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Error logging function
function logError(error, context = {}) {
  logger.error({
    message: error.message,
    stack: error.stack,
    name: error.name,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    timestamp: new Date().toISOString(),
    ...context
  });
}

// Enhanced error handler with logging
function errorHandler(err, req, res, next) {
  // Log error with request context
  logError(err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    requestId: req.id
  });
  
  // Send error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
  res.status(statusCode).json({
    error: message,
    requestId: req.id
  });
}
```

## Error Recovery Strategies

```javascript
// Retry mechanism for transient errors
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      // Don't retry for certain error types
      if (error instanceof ValidationError || 
          error instanceof AuthenticationError) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw new Error(`Operation failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
}

// Circuit breaker pattern
class CircuitBreaker {
  constructor(operation, threshold = 5, timeout = 60000) {
    this.operation = operation;
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async execute(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await this.operation(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Usage
const dbOperation = new CircuitBreaker(async (query) => {
  return await database.query(query);
}, 5, 30000);

async function getData(query) {
  try {
    return await retryOperation(() => dbOperation.execute(query));
  } catch (error) {
    // Fallback to cache or default data
    console.log('Using fallback data due to error:', error.message);
    return await getCachedData(query);
  }
}
```

## Testing Error Scenarios

```javascript
const request = require('supertest');
const app = require('../app');

describe('Error Handling', () => {
  describe('Validation Errors', () => {
    it('should return 400 for invalid user data', async () => {
      const response = await request(app)
        .post('/users')
        .send({ email: 'invalid-email' })
        .expect(400);
      
      expect(response.body.error).toBe('Validation Error');
      expect(response.body.field).toBe('email');
    });
  });
  
  describe('Not Found Errors', () => {
    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/users/nonexistent-id')
        .expect(404);
      
      expect(response.body.error).toBe('Not Found');
    });
  });
  
  describe('Database Errors', () => {
    it('should handle database connection errors', async () => {
      // Mock database error
      jest.spyOn(User, 'findById').mockRejectedValue(new Error('Connection failed'));
      
      const response = await request(app)
        .get('/users/123')
        .expect(500);
      
      expect(response.body.error).toBe('Server Error');
    });
  });
});
```

## Best Practices Summary

### ✅ Do:
- Always handle errors explicitly
- Use custom error classes for different types
- Implement centralized error handling
- Log errors with context
- Use async wrappers for Express routes
- Handle uncaught exceptions and unhandled rejections
- Implement graceful shutdown
- Test error scenarios

### ❌ Don't:
- Ignore errors or use empty catch blocks
- Expose sensitive information in error messages
- Let the application crash on unexpected errors
- Use process.exit() in libraries (only in main application)
- Forget to handle Promise rejections
- Mix error handling patterns (callbacks vs promises)

Proper error handling is what makes the difference between a demo application and a production-ready system!