# Express.js Middleware - Complete Guide

Middleware is the **heart of Express.js** - it's how Express processes requests and responses. Think of middleware as a series of functions that execute in sequence during the request-response cycle.

## What is Middleware?

Middleware functions are functions that have access to:
- **Request object** (`req`)
- **Response object** (`res`) 
- **Next middleware function** (`next`)

```javascript
// Basic middleware structure
function middleware(req, res, next) {
  // Do something with req/res
  console.log('Processing request...');
  
  // Call next() to pass control to next middleware
  next();
}
```

## How the Middleware Stack Works

```javascript
const express = require('express');
const app = express();

// Middleware executes in the order it's defined
app.use((req, res, next) => {
  console.log('1. First middleware');
  next();
});

app.use((req, res, next) => {
  console.log('2. Second middleware');
  next();
});

app.get('/', (req, res, next) => {
  console.log('3. Route handler');
  res.send('Hello World');
  // Note: No next() call here - response is sent
});

app.use((req, res, next) => {
  console.log('4. This won\'t execute for GET /');
  next();
});
```

**Output for GET /:**
```
1. First middleware
2. Second middleware  
3. Route handler
```

## Types of Middleware

### 1. Application-Level Middleware

**Global Middleware (runs for all routes):**
```javascript
const express = require('express');
const app = express();

// Runs for every request
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Runs for all POST requests
app.use('/api', (req, res, next) => {
  console.log('API request received');
  next();
});
```

**Path-Specific Middleware:**
```javascript
// Only runs for /admin routes
app.use('/admin', (req, res, next) => {
  console.log('Admin area accessed');
  next();
});

// Multiple middleware for specific path
app.use('/api', 
  authenticateUser,
  validateInput,
  (req, res, next) => {
    console.log('All validations passed');
    next();
  }
);
```

### 2. Router-Level Middleware

```javascript
const express = require('express');
const router = express.Router();

// Middleware specific to this router
router.use((req, res, next) => {
  console.log('Router middleware');
  next();
});

// Route with multiple middleware
router.get('/users/:id', 
  validateUserId,
  checkPermissions,
  getUserHandler
);

function validateUserId(req, res, next) {
  const userId = req.params.id;
  if (!userId || isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  next();
}

function checkPermissions(req, res, next) {
  // Check if user has permission to view this user
  if (!req.user || req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function getUserHandler(req, res) {
  res.json({ user: `User ${req.params.id}` });
}

app.use('/api', router);
```

### 3. Built-in Middleware

```javascript
const express = require('express');
const path = require('path');
const app = express();

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// Raw body parser
app.use('/webhook', express.raw({ type: 'application/json' }));

// Text body parser
app.use('/text', express.text());
```

### 4. Third-Party Middleware

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api', limiter);
```

## Custom Middleware Examples

### 1. Authentication Middleware

```javascript
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user; // Attach user to request
    next();
  });
}

// Usage
app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: `Hello ${req.user.username}` });
});
```

### 2. Request Logging Middleware

```javascript
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    console.log({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    originalEnd.apply(this, args);
  };
  
  next();
}

app.use(requestLogger);
```

### 3. Input Validation Middleware

```javascript
const { body, param, validationResult } = require('express-validator');

// Validation rules
const userValidationRules = () => {
  return [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    body('name').trim().isLength({ min: 2, max: 50 }),
    body('age').optional().isInt({ min: 18, max: 120 })
  ];
};

// Validation error handler
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Usage
app.post('/users', 
  userValidationRules(),
  validateInput,
  (req, res) => {
    // Input is guaranteed to be valid here
    res.json({ message: 'User created', user: req.body });
  }
);
```

### 4. Caching Middleware

```javascript
const cache = new Map();

function cacheMiddleware(duration = 300) { // 5 minutes default
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = req.originalUrl;
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < duration * 1000) {
      console.log('Cache hit:', key);
      return res.json(cached.data);
    }
    
    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data) {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
      console.log('Cache set:', key);
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Usage
app.get('/api/users', cacheMiddleware(600), getUsersHandler);
```

### 5. Request ID Middleware

```javascript
const { v4: uuidv4 } = require('uuid');

function requestId(req, res, next) {
  req.id = uuidv4();
  res.set('X-Request-ID', req.id);
  next();
}

function contextLogger(req, res, next) {
  const originalLog = console.log;
  console.log = (...args) => {
    originalLog(`[${req.id}]`, ...args);
  };
  
  next();
}

app.use(requestId);
app.use(contextLogger);
```

## Error Handling Middleware

Error handling middleware has **4 parameters** and must be defined **after** other middleware:

```javascript
// Regular middleware (3 parameters)
app.use((req, res, next) => {
  // Some operation that might throw
  if (Math.random() > 0.5) {
    const error = new Error('Random error occurred');
    error.status = 500;
    return next(error); // Pass error to error handler
  }
  next();
});

// Error handling middleware (4 parameters)
app.use((err, req, res, next) => {
  console.error('Error occurred:', err.message);
  
  // Set default error status
  const status = err.status || 500;
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
  res.status(status).json({
    error: message,
    requestId: req.id
  });
});

// Custom error classes
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

class NotFoundError extends Error {
  constructor(resource) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage with async functions
app.get('/users/:id', asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User');
  }
  res.json(user);
}));
```

## Advanced Middleware Patterns

### 1. Conditional Middleware

```javascript
function conditionalMiddleware(condition, middleware) {
  return (req, res, next) => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    next();
  };
}

// Usage
app.use(conditionalMiddleware(
  req => req.path.startsWith('/api'),
  authenticateToken
));

// Environment-specific middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
```

### 2. Middleware Factory Pattern

```javascript
function createAuthMiddleware(options = {}) {
  const { 
    secretKey = process.env.JWT_SECRET,
    algorithms = ['HS256'],
    optional = false 
  } = options;
  
  return (req, res, next) => {
    const token = extractToken(req);
    
    if (!token && optional) {
      return next();
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }
    
    jwt.verify(token, secretKey, { algorithms }, (err, decoded) => {
      if (err && !optional) {
        return res.status(403).json({ error: 'Invalid token' });
      }
      
      req.user = decoded;
      next();
    });
  };
}

// Usage
app.use('/api/public', createAuthMiddleware({ optional: true }));
app.use('/api/private', createAuthMiddleware({ optional: false }));
```

### 3. Middleware Composition

```javascript
function compose(...middlewares) {
  return (req, res, next) => {
    function dispatch(i) {
      if (i >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[i];
      middleware(req, res, () => dispatch(i + 1));
    }
    
    dispatch(0);
  };
}

// Usage
const apiMiddleware = compose(
  cors(),
  helmet(),
  express.json(),
  authenticateToken,
  validateInput
);

app.use('/api', apiMiddleware);
```

## Real-World Middleware Stack

```javascript
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// 1. Security first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// 2. CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true
}));

// 3. Compression
app.use(compression());

// 4. Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// 5. Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
app.use(limiter);

// 6. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 7. Request ID
app.use((req, res, next) => {
  req.id = require('uuid').v4();
  res.set('X-Request-ID', req.id);
  next();
});

// 8. Static files
app.use('/static', express.static('public'));

// 9. API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/admin', authenticateToken, requireAdmin, adminRoutes);

// 10. 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// 11. Error handler (must be last)
app.use((err, req, res, next) => {
  console.error(`[${req.id}] Error:`, err);
  
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
    
  res.status(status).json({
    error: message,
    requestId: req.id
  });
});
```

## Testing Middleware

```javascript
const request = require('supertest');
const express = require('express');

describe('Authentication Middleware', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/protected', authenticateToken);
    app.get('/protected/test', (req, res) => {
      res.json({ user: req.user });
    });
  });
  
  it('should reject requests without token', async () => {
    const response = await request(app)
      .get('/protected/test')
      .expect(401);
      
    expect(response.body.error).toContain('token required');
  });
  
  it('should accept valid tokens', async () => {
    const token = jwt.sign({ id: 1, username: 'test' }, process.env.JWT_SECRET);
    
    const response = await request(app)
      .get('/protected/test')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
      
    expect(response.body.user.username).toBe('test');
  });
});
```

## Common Pitfalls and Best Practices

### ❌ Common Mistakes:

```javascript
// 1. Forgetting to call next()
app.use((req, res, next) => {
  console.log('This middleware blocks everything!');
  // Missing next() - request hangs forever
});

// 2. Calling next() after sending response
app.use((req, res, next) => {
  res.json({ message: 'Hello' });
  next(); // ❌ Error: Cannot set headers after they are sent
});

// 3. Wrong error handler signature
app.use((err, req, res) => { // ❌ Missing 'next' parameter
  res.status(500).json({ error: err.message });
});

// 4. Error handler in wrong position
app.use(errorHandler); // ❌ Should be after all other middleware
app.use('/api', routes);
```

### ✅ Best Practices:

```javascript
// 1. Always call next() or send response
app.use((req, res, next) => {
  if (someCondition) {
    return res.status(400).json({ error: 'Bad request' });
  }
  next(); // Continue to next middleware
});

// 2. Handle async errors properly
app.use(asyncHandler(async (req, res, next) => {
  await someAsyncOperation();
  next();
}));

// 3. Use middleware factories for reusability
const createValidator = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

// 4. Order matters - put error handlers last
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler); // Always last
```

Middleware is the foundation of Express.js applications and understanding it deeply is crucial for building robust, maintainable Node.js web applications!