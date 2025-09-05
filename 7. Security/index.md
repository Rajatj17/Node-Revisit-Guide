# Node.js Security - Complete Guide

Security is **non-negotiable** in production applications. A single vulnerability can compromise your entire system, data, and users' trust.

## Common Security Vulnerabilities (OWASP Top 10)

### 1. Injection Attacks

**SQL Injection Prevention:**
```javascript
const mysql = require('mysql2/promise');

// ❌ Vulnerable to SQL injection
async function getUserByIdVulnerable(userId) {
  const query = `SELECT * FROM users WHERE id = ${userId}`; // NEVER DO THIS
  return await db.query(query);
}

// ✅ Safe with parameterized queries
async function getUserByIdSafe(userId) {
  const query = 'SELECT * FROM users WHERE id = ?';
  const [rows] = await db.execute(query, [userId]);
  return rows;
}

// ✅ Using prepared statements
class UserRepository {
  constructor(db) {
    this.db = db;
    this.preparedStatements = new Map();
  }
  
  async prepareStatements() {
    const getUserStmt = await this.db.prepare('SELECT * FROM users WHERE id = ?');
    const updateUserStmt = await this.db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?');
    
    this.preparedStatements.set('getUser', getUserStmt);
    this.preparedStatements.set('updateUser', updateUserStmt);
  }
  
  async getUserById(userId) {
    const stmt = this.preparedStatements.get('getUser');
    const [rows] = await stmt.execute([userId]);
    return rows[0];
  }
  
  async updateUser(id, name, email) {
    const stmt = this.preparedStatements.get('updateUser');
    const [result] = await stmt.execute([name, email, id]);
    return result;
  }
}
```

**NoSQL Injection Prevention:**
```javascript
const mongoose = require('mongoose');

// ❌ Vulnerable to NoSQL injection
async function findUserVulnerable(userInput) {
  // userInput could be: { $ne: null } to bypass authentication
  return await User.findOne({ email: userInput });
}

// ✅ Safe with proper validation
const { body, validationResult } = require('express-validator');

const validateUserInput = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

async function findUserSafe(email) {
  // Ensure email is a string
  if (typeof email !== 'string') {
    throw new Error('Invalid email format');
  }
  
  return await User.findOne({ email: email });
}

// ✅ Using mongoose schema validation
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    validate: {
      validator: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Invalid email format'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  }
});
```

### 2. Cross-Site Scripting (XSS) Protection

```javascript
const express = require('express');
const helmet = require('helmet');
const xss = require('xss');
const DOMPurify = require('isomorphic-dompurify');

const app = express();

// ✅ Use helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Be careful with unsafe-inline
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// ✅ Input sanitization middleware
function sanitizeInput(req, res, next) {
  for (const key in req.body) {
    if (typeof req.body[key] === 'string') {
      req.body[key] = xss(req.body[key]);
    }
  }
  next();
}

// ✅ HTML sanitization for rich content
function sanitizeHTML(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });
}

// ✅ Safe template rendering
app.get('/user/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    
    // Never directly inject user data into templates
    res.render('user', {
      userName: escapeHtml(user.name), // Use template engine's built-in escaping
      userBio: sanitizeHTML(user.bio)
    });
  } catch (error) {
    res.status(500).send('Error loading user');
  }
});

// ✅ Escape function for HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ✅ API response sanitization
app.get('/api/comments', async (req, res) => {
  try {
    const comments = await getComments();
    
    // Sanitize all user-generated content
    const sanitizedComments = comments.map(comment => ({
      id: comment.id,
      content: xss(comment.content),
      author: escapeHtml(comment.author),
      createdAt: comment.createdAt
    }));
    
    res.json(sanitizedComments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load comments' });
  }
});
```

### 3. Cross-Site Request Forgery (CSRF) Protection

```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());

// ✅ CSRF protection middleware
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict'
  }
});

app.use(csrfProtection);

// ✅ Provide CSRF token to frontend
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// ✅ Custom CSRF implementation
class CSRFProtection {
  constructor() {
    this.tokens = new Map();
    this.tokenExpiry = 3600000; // 1 hour
  }
  
  generateToken(sessionId) {
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiry = Date.now() + this.tokenExpiry;
    
    this.tokens.set(sessionId, { token, expiry });
    
    // Cleanup expired tokens
    this.cleanupExpiredTokens();
    
    return token;
  }
  
  validateToken(sessionId, providedToken) {
    const stored = this.tokens.get(sessionId);
    
    if (!stored || stored.expiry < Date.now()) {
      this.tokens.delete(sessionId);
      return false;
    }
    
    return stored.token === providedToken;
  }
  
  cleanupExpiredTokens() {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens) {
      if (data.expiry < now) {
        this.tokens.delete(sessionId);
      }
    }
  }
  
  middleware() {
    return (req, res, next) => {
      if (req.method === 'GET') {
        return next();
      }
      
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      const sessionId = req.sessionID;
      
      if (!this.validateToken(sessionId, token)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
      
      next();
    };
  }
}

const csrfProtector = new CSRFProtection();
app.use(csrfProtector.middleware());
```

### 4. Authentication and Authorization

```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// ✅ Secure password hashing
class AuthService {
  static async hashPassword(password) {
    const saltRounds = 12; // Increase for better security (slower)
    return await bcrypt.hash(password, saltRounds);
  }
  
  static async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
  
  static generateAccessToken(user) {
    return jwt.sign(
      { 
        id: user.id,
        email: user.email,
        role: user.role 
      },
      process.env.JWT_ACCESS_SECRET,
      { 
        expiresIn: '15m',
        issuer: 'your-app',
        audience: 'your-app-users'
      }
    );
  }
  
  static generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn: '7d',
        issuer: 'your-app'
      }
    );
  }
  
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
        issuer: 'your-app',
        audience: 'your-app-users'
      });
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }
}

// ✅ Rate limiting for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || req.body.username || '');
  }
});

// ✅ Secure login endpoint
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // Find user (use constant-time lookup to prevent timing attacks)
    const user = await User.findOne({ email });
    
    // Always check password even if user doesn't exist (prevent timing attacks)
    const hashedDummyPassword = '$2a$12$dummy.hash.to.prevent.timing.attacks';
    const passwordToCheck = user ? user.password : hashedDummyPassword;
    
    const isValidPassword = await AuthService.verifyPassword(password, passwordToCheck);
    
    if (!user || !isValidPassword) {
      // Generic error message to prevent user enumeration
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is disabled' });
    }
    
    // Generate tokens
    const accessToken = AuthService.generateAccessToken(user);
    const refreshToken = AuthService.generateRefreshToken(user);
    
    // Store refresh token (in database or secure cache)
    await storeRefreshToken(user.id, refreshToken);
    
    // Set secure cookies
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = AuthService.verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// ✅ Authorization middleware
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// ✅ Resource-level authorization
function canAccessResource(resourceType) {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const userId = req.user.id;
      
      // Check if user owns the resource or has admin role
      if (req.user.role === 'admin') {
        return next();
      }
      
      const hasAccess = await checkResourceAccess(userId, resourceType, resourceId);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this resource' });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Error checking permissions' });
    }
  };
}
```

### 5. Input Validation and Sanitization

```javascript
const Joi = require('joi');
const validator = require('validator');

// ✅ Comprehensive input validation
const userValidationSchema = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2 })
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'string.min': 'Password must be at least 8 characters long'
    }),
  
  name: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z\s]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Name can only contain letters and spaces'
    }),
  
  age: Joi.number()
    .integer()
    .min(13)
    .max(120)
    .optional(),
  
  bio: Joi.string()
    .max(500)
    .optional()
});

// ✅ Validation middleware factory
function validateRequest(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Get all validation errors
      stripUnknown: true // Remove unknown fields
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    // Replace original data with validated/sanitized data
    req[property] = value;
    next();
  };
}

// ✅ File upload validation
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate safe filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeFileName = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    cb(null, safeFileName);
  }
});

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and GIF images are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Single file only
  },
  fileFilter: fileFilter
});

// ✅ Custom sanitization functions
class InputSanitizer {
  static sanitizeString(input, maxLength = 255) {
    if (typeof input !== 'string') {
      return '';
    }
    
    return validator.escape(
      validator.trim(input.substring(0, maxLength))
    );
  }
  
  static sanitizeEmail(email) {
    if (typeof email !== 'string') {
      return '';
    }
    
    const normalized = validator.normalizeEmail(email, {
      gmail_lowercase: true,
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_lowercase: true,
      outlookdotcom_remove_subaddress: false,
      yahoo_lowercase: true,
      yahoo_remove_subaddress: false,
      icloud_lowercase: true,
      icloud_remove_subaddress: false
    });
    
    return validator.isEmail(normalized) ? normalized : '';
  }
  
  static sanitizeHTML(html, allowedTags = []) {
    const cleanHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: allowedTags,
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true
    });
    
    return cleanHTML;
  }
  
  static sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9\-_.]/g, '') // Remove special characters
      .substring(0, 255); // Limit length
  }
}
```

### 6. Security Headers and Middleware

```javascript
const helmet = require('helmet');

// ✅ Comprehensive security headers
app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Avoid this in production
        "https://trusted-cdn.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.trusted-service.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: []
    },
    reportOnly: false
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // X-XSS-Protection
  xssFilter: true,
  
  // X-DNS-Prefetch-Control
  dnsPrefetchControl: {
    allow: false
  },
  
  // Expect-CT
  expectCt: {
    enforce: true,
    maxAge: 30
  }
}));

// ✅ Custom security middleware
function securityMiddleware(req, res, next) {
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Prevent caching of sensitive pages
  if (req.path.includes('/admin') || req.path.includes('/profile')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
}

app.use(securityMiddleware);
```

### 7. Rate Limiting and DDoS Protection

```javascript
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);

// ✅ General rate limiting
const generalLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: Math.round(15 * 60 * 1000 / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for whitelisted IPs
    const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
    return whitelist.includes(req.ip);
  }
});

// ✅ Strict rate limiting for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many attempts, please try again later'
  }
});

// ✅ Progressive delay for repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 5,
  delayMs: 500,
  maxDelayMs: 20000
});

// ✅ Custom rate limiter with different strategies
class AdvancedRateLimiter {
  constructor(redis) {
    this.redis = redis;
  }
  
  // Sliding window counter
  async checkSlidingWindow(key, limit, windowMs) {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const windowKey = `${key}:${window}`;
    
    const current = await this.redis.incr(windowKey);
    
    if (current === 1) {
      await this.redis.expire(windowKey, Math.ceil(windowMs / 1000));
    }
    
    return {
      allowed: current <= limit,
      count: current,
      resetTime: (window + 1) * windowMs
    };
  }
  
  // Token bucket algorithm
  async checkTokenBucket(key, capacity, refillRate, tokensRequested = 1) {
    const bucketKey = `bucket:${key}`;
    const now = Date.now();
    
    // Get current bucket state
    const bucket = await this.redis.hmget(bucketKey, 'tokens', 'lastRefill');
    let tokens = parseInt(bucket[0]) || capacity;
    let lastRefill = parseInt(bucket[1]) || now;
    
    // Refill tokens based on time passed
    const timePassed = now - lastRefill;
    const tokensToAdd = Math.floor(timePassed * refillRate / 1000);
    tokens = Math.min(capacity, tokens + tokensToAdd);
    
    // Check if request can be fulfilled
    if (tokens >= tokensRequested) {
      tokens -= tokensRequested;
      
      // Update bucket state
      await this.redis.hmset(bucketKey, 'tokens', tokens, 'lastRefill', now);
      await this.redis.expire(bucketKey, 3600); // 1 hour expiry
      
      return { allowed: true, tokens };
    } else {
      return { allowed: false, tokens };
    }
  }
  
  // Distributed rate limiter middleware
  createMiddleware(strategy, options) {
    return async (req, res, next) => {
      const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
      
      try {
        let result;
        
        switch (strategy) {
          case 'sliding':
            result = await this.checkSlidingWindow(
              key,
              options.limit,
              options.windowMs
            );
            break;
          case 'bucket':
            result = await this.checkTokenBucket(
              key,
              options.capacity,
              options.refillRate,
              options.tokensRequested
            );
            break;
          default:
            throw new Error('Unknown rate limiting strategy');
        }
        
        if (!result.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil(options.windowMs / 1000)
          });
        }
        
        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', options.limit || options.capacity);
        res.setHeader('X-RateLimit-Remaining', 
          options.limit ? options.limit - result.count : result.tokens);
        
        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // Fail open - allow request if rate limiter fails
        next();
      }
    };
  }
}

const advancedLimiter = new AdvancedRateLimiter(redis);

// Usage
app.use('/api', generalLimiter);
app.use('/auth', strictLimiter);
app.use('/api/heavy', advancedLimiter.createMiddleware('bucket', {
  capacity: 10,
  refillRate: 1, // 1 token per second
  tokensRequested: 1
}));
```

### 8. Secrets and Environment Management

```javascript
// ✅ Secure environment configuration
const crypto = require('crypto');

class SecretManager {
  constructor() {
    this.secrets = new Map();
    this.encryptionKey = this.deriveKey(process.env.MASTER_KEY);
  }
  
  deriveKey(masterKey) {
    return crypto.scryptSync(masterKey, 'salt', 32);
  }
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('additional-data'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('additional-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  storeSecret(key, value) {
    const encrypted = this.encrypt(value);
    this.secrets.set(key, encrypted);
  }
  
  getSecret(key) {
    const encrypted = this.secrets.get(key);
    if (!encrypted) return null;
    
    return this.decrypt(encrypted);
  }
}

// ✅ Environment validation
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().port().default(3000),
  
  // Database
  DATABASE_URL: Joi.string().uri().required(),
  DATABASE_SSL: Joi.boolean().default(false),
  
  // JWT secrets
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  
  // External services
  REDIS_URL: Joi.string().uri().required(),
  EMAIL_SERVICE_API_KEY: Joi.string().required(),
  
  // Security
  ENCRYPTION_KEY: Joi.string().min(32).required(),
  CORS_ORIGINS: Joi.string(),

  // Security
  ENCRYPTION_KEY: Joi.string().min(32).required(),
  CORS_ORIGINS: Joi.string().required(),
  
  // Rate limiting
  RATE_LIMIT_WHITELIST: Joi.string().optional(),
  
  // Monitoring
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  SENTRY_DSN: Joi.string().uri().optional()
});

function validateEnvironment() {
  const { error, value } = envSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: false
  });
  
  if (error) {
    console.error('Environment validation failed:');
    error.details.forEach(detail => {
      console.error(`- ${detail.message}`);
    });
    process.exit(1);
  }
  
  return value;
}

// Validate environment on startup
const config = validateEnvironment();
```

### 9. Dependency Security and Vulnerability Scanning

```javascript
// ✅ Automated dependency vulnerability checking
const { execSync } = require('child_process');

class SecurityScanner {
  static async auditDependencies() {
    try {
      console.log('🔍 Scanning dependencies for vulnerabilities...');
      
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      if (audit.metadata.vulnerabilities.total > 0) {
        console.warn('⚠️  Vulnerabilities found:');
        console.warn(`High: ${audit.metadata.vulnerabilities.high}`);
        console.warn(`Moderate: ${audit.metadata.vulnerabilities.moderate}`);
        console.warn(`Low: ${audit.metadata.vulnerabilities.low}`);
        
        // Exit if high severity vulnerabilities found
        if (audit.metadata.vulnerabilities.high > 0) {
          console.error('❌ High severity vulnerabilities found. Please fix before deployment.');
          process.exit(1);
        }
      } else {
        console.log('✅ No vulnerabilities found');
      }
    } catch (error) {
      console.error('Security audit failed:', error.message);
      
      // Don't fail in development
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
  
  static checkOutdatedPackages() {
    try {
      const outdated = execSync('npm outdated --json', { encoding: 'utf8' });
      if (outdated.trim()) {
        const packages = JSON.parse(outdated);
        console.warn('📦 Outdated packages found:');
        
        for (const [name, info] of Object.entries(packages)) {
          console.warn(`- ${name}: ${info.current} → ${info.latest}`);
        }
      }
    } catch (error) {
      // npm outdated exits with code 1 when outdated packages exist
      if (error.stdout) {
        const packages = JSON.parse(error.stdout);
        console.warn('📦 Outdated packages found:');
        
        for (const [name, info] of Object.entries(packages)) {
          console.warn(`- ${name}: ${info.current} → ${info.latest}`);
        }
      }
    }
  }
}

// Run security checks on startup
if (process.env.NODE_ENV === 'production') {
  SecurityScanner.auditDependencies();
}
```

### 10. Secure Session Management

```javascript
const session = require('express-session');
const MongoStore = require('connect-mongo');
const RedisStore = require('connect-redis')(session);

// ✅ Secure session configuration
const sessionConfig = {
  name: 'sessionId', // Don't use default session name
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on each request
  
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' // CSRF protection
  },
  
  // Use Redis for session store in production
  store: process.env.NODE_ENV === 'production' 
    ? new RedisStore({ client: redis })
    : new MongoStore({ mongoUrl: process.env.DATABASE_URL })
};

app.use(session(sessionConfig));

// ✅ Session security middleware
function sessionSecurity(req, res, next) {
  // Regenerate session ID on privilege escalation
  if (req.session && req.session.user && req.session.privilegeEscalated) {
    req.session.regenerate((err) => {
      if (err) {
        return next(err);
      }
      req.session.privilegeEscalated = false;
      next();
    });
  } else {
    next();
  }
}

// ✅ Session hijacking protection
function sessionProtection(req, res, next) {
  if (req.session && req.session.user) {
    // Check IP address consistency (optional, can break with mobile users)
    if (req.session.ipAddress && req.session.ipAddress !== req.ip) {
      console.warn(`Session IP mismatch for user ${req.session.user.id}: ${req.session.ipAddress} vs ${req.ip}`);
      // Optionally destroy session
      // return req.session.destroy(() => res.status(401).json({ error: 'Session invalid' }));
    }
    
    // Check User-Agent consistency
    if (req.session.userAgent && req.session.userAgent !== req.get('User-Agent')) {
      console.warn(`Session User-Agent mismatch for user ${req.session.user.id}`);
      // Optionally destroy session
    }
    
    // Update last activity
    req.session.lastActivity = Date.now();
  }
  
  next();
}

app.use(sessionSecurity);
app.use(sessionProtection);
```

### 11. API Security Best Practices

```javascript
// ✅ API versioning and deprecation
app.use('/api/v1', (req, res, next) => {
  res.setHeader('X-API-Version', 'v1');
  res.setHeader('X-API-Deprecation-Warning', 'This API version will be deprecated on 2024-12-31');
  next();
});

// ✅ Request size limiting
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook signature verification
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  limit: '10mb',
  extended: true 
}));

// ✅ API key authentication
function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // Hash the API key for comparison
  const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  
  // Check against stored hashed keys
  if (!isValidApiKey(hashedKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
}

// ✅ Request signature verification (for webhooks)
function verifySignature(secret) {
  return (req, res, next) => {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature or timestamp' });
    }
    
    // Check timestamp to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) { // 5 minutes tolerance
      return res.status(401).json({ error: 'Request too old' });
    }
    
    // Verify signature
    const payload = timestamp + '.' + req.rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
  };
}

// ✅ Response sanitization
function sanitizeResponse(req, res, next) {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Remove sensitive fields from responses
    const sanitized = removeSensitiveFields(data, [
      'password',
      'passwordHash',
      'ssn',
      'creditCard',
      'apiKey',
      'secret'
    ]);
    
    return originalJson.call(this, sanitized);
  };
  
  next();
}

function removeSensitiveFields(obj, sensitiveFields) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => removeSensitiveFields(item, sensitiveFields));
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!sensitiveFields.includes(key.toLowerCase())) {
      cleaned[key] = removeSensitiveFields(value, sensitiveFields);
    }
  }
  
  return cleaned;
}

app.use('/api', sanitizeResponse);
```

### 12. Security Monitoring and Logging

```javascript
const winston = require('winston');

// ✅ Security event logging
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'security' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/security.log',
      level: 'warn'
    }),
    new winston.transports.File({ 
      filename: 'logs/security-all.log' 
    })
  ]
});

class SecurityMonitor {
  static logSecurityEvent(event, req, details = {}) {
    const logData = {
      event,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      userId: req.user?.id,
      sessionId: req.sessionID,
      timestamp: new Date().toISOString(),
      ...details
    };
    
    securityLogger.warn('Security Event', logData);
    
    // Send alert for critical events
    if (this.isCriticalEvent(event)) {
      this.sendSecurityAlert(logData);
    }
  }
  
  static isCriticalEvent(event) {
    const criticalEvents = [
      'MULTIPLE_FAILED_LOGINS',
      'PRIVILEGE_ESCALATION_ATTEMPT',
      'SQL_INJECTION_ATTEMPT',
      'XSS_ATTEMPT',
      'SUSPICIOUS_FILE_UPLOAD',
      'RATE_LIMIT_EXCEEDED_SEVERE'
    ];
    
    return criticalEvents.includes(event);
  }
  
  static async sendSecurityAlert(logData) {
    // Implement your alerting mechanism
    // This could be email, Slack, PagerDuty, etc.
    console.error('🚨 SECURITY ALERT:', logData);
    
    // Example: Send to monitoring service
    try {
      await fetch(process.env.SECURITY_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Security Alert: ${logData.event}`,
          details: logData
        })
      });
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }
}

// ✅ Security monitoring middleware
function securityMonitoring(req, res, next) {
  // Track failed authentication attempts
  if (req.path === '/auth/login' && req.method === 'POST') {
    const originalEnd = res.end;
    res.end = function(...args) {
      if (res.statusCode === 401) {
        SecurityMonitor.logSecurityEvent('FAILED_LOGIN_ATTEMPT', req, {
          email: req.body.email
        });
      }
      originalEnd.apply(this, args);
    };
  }
  
  // Detect potential injection attempts
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi
  ];
  
  const checkForInjection = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };
  
  // Check all request parameters
  const allParams = { ...req.query, ...req.body, ...req.params };
  for (const [key, value] of Object.entries(allParams)) {
    if (checkForInjection(value)) {
      SecurityMonitor.logSecurityEvent('POTENTIAL_INJECTION_ATTEMPT', req, {
        parameter: key,
        value: value,
        type: 'SQL_INJECTION_OR_XSS'
      });
    }
  }
  
  next();
}

app.use(securityMonitoring);
```

### 13. Production Security Checklist

```javascript
// ✅ Production security validation
class SecurityChecklist {
  static validateProductionSecurity() {
    const issues = [];
    
    // Environment checks
    if (process.env.NODE_ENV !== 'production') {
      issues.push('NODE_ENV is not set to production');
    }
    
    if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
      issues.push('JWT_ACCESS_SECRET is too weak');
    }
    
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      issues.push('SESSION_SECRET is too weak');
    }
    
    // Check for debug modes
    if (process.env.DEBUG) {
      issues.push('DEBUG mode is enabled in production');
    }
    
    // Check HTTPS
    if (!process.env.FORCE_HTTPS) {
      issues.push('HTTPS enforcement is not configured');
    }
    
    // Check database connections
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('ssl=true')) {
      issues.push('Database connection is not using SSL');
    }
    
    if (issues.length > 0) {
      console.error('🚨 SECURITY ISSUES FOUND:');
      issues.forEach(issue => console.error(`- ${issue}`));
      
      if (process.env.STRICT_SECURITY === 'true') {
        process.exit(1);
      }
    } else {
      console.log('✅ Security checklist passed');
    }
  }
  
  static generateSecurityReport() {
    return {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      securityFeatures: {
        httpsEnforced: !!process.env.FORCE_HTTPS,
        helmetEnabled: true,
        rateLimitingEnabled: true,
        csrfProtectionEnabled: true,
        inputValidationEnabled: true,
        sessionSecurityEnabled: true,
        dependencyAuditPassed: true
      },
      lastSecurityAudit: process.env.LAST_SECURITY_AUDIT,
      nextAuditDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    };
  }
}

// Run security checks on startup
if (process.env.NODE_ENV === 'production') {
  SecurityChecklist.validateProductionSecurity();
}

// Security report endpoint (admin only)
app.get('/admin/security-report', 
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    res.json(SecurityChecklist.generateSecurityReport());
  }
);
```

### 14. Security Testing

```javascript
// ✅ Security test suite
const request = require('supertest');
const app = require('../app');

describe('Security Tests', () => {
  describe('Authentication Security', () => {
    it('should reject requests without authentication', async () => {
      await request(app)
        .get('/api/protected')
        .expect(401);
    });
    
    it('should reject invalid JWT tokens', async () => {
      await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);
    });
    
    it('should enforce rate limiting on login', async () => {
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/auth/login')
          .send({ email: 'test@test.com', password: 'wrong' })
      );
      
      const responses = await Promise.all(promises);
      const tooManyRequests = responses.filter(r => r.status === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
  
  describe('Input Validation', () => {
    it('should reject malicious SQL injection attempts', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/*",
        "1; DELETE FROM users WHERE 1=1; --"
      ];
      
      for (const input of maliciousInputs) {
        await request(app)
          .post('/api/users')
          .send({ email: input, password: 'test' })
          .expect(400);
      }
    });
    
    it('should sanitize XSS attempts', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src=x onerror=alert("xss")>',
        '<iframe src="javascript:alert(\'xss\')"></iframe>'
      ];
      
      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/comments')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ content: payload })
          .expect(201);
        
        expect(response.body.content).not.toContain('<script>');
        expect(response.body.content).not.toContain('javascript:');
      }
    });
  });
  
  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });
});
```

## Security Best Practices Summary

### ✅ Always Do:
- Use HTTPS everywhere in production
- Validate and sanitize all inputs
- Use parameterized queries for databases
- Implement proper authentication and authorization
- Keep dependencies updated and scan for vulnerabilities
- Use security headers (helmet.js)
- Implement rate limiting
- Log security events
- Use environment variables for secrets
- Implement CSRF protection

### ❌ Never Do:
- Store passwords in plain text
- Expose sensitive information in error messages
- Trust user input without validation
- Use weak session configurations
- Ignore security updates
- Use default secrets or keys
- Expose internal system information
- Skip input validation on the server side
- Use eval() or similar dynamic code execution
- Ignore security headers

### 🔍 Regular Security Tasks:
- Run dependency audits (`npm audit`)
- Review access logs for suspicious activity
- Update dependencies regularly
- Conduct penetration testing
- Review and rotate secrets/keys
- Monitor security advisories
- Test backup and disaster recovery procedures

Security is an ongoing process, not a one-time setup. Regular audits, monitoring, and staying informed about new threats are essential for maintaining a secure application!