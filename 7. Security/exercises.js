// Node.js Security Exercises

const crypto = require('crypto');
const fs = require('fs');

console.log('=== NODE.JS SECURITY EXERCISES ===\n');

// EXERCISE 1: Input Validation and Sanitization
console.log('Exercise 1: Input Validation and Sanitization');

class InputValidator {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string') {
      throw new Error('Email must be a non-empty string');
    }
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    return email.toLowerCase().trim();
  }
  
  static validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
      throw new Error('Password must contain uppercase, lowercase, number, and special character');
    }
    return password;
  }
  
  static sanitizeString(input, maxLength = 1000) {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>\"'&]/g, (char) => {
        const htmlEntities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return htmlEntities[char];
      });
  }
  
  static validateNumericId(id) {
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      throw new Error('ID must be a positive integer');
    }
    return numId;
  }
  
  static validateJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      
      // Prevent prototype pollution
      if (parsed && typeof parsed === 'object') {
        if ('__proto__' in parsed || 'constructor' in parsed || 'prototype' in parsed) {
          throw new Error('Potentially dangerous JSON structure detected');
        }
      }
      
      return parsed;
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }
}

// Test validation functions
console.log('--- Input Validation Tests ---');

const testCases = [
  { type: 'email', input: 'test@example.com', expected: 'valid' },
  { type: 'email', input: 'invalid-email', expected: 'invalid' },
  { type: 'password', input: 'Password123!', expected: 'valid' },
  { type: 'password', input: 'weak', expected: 'invalid' },
  { type: 'sanitize', input: '<script>alert("XSS")</script>', expected: 'sanitized' },
  { type: 'id', input: '123', expected: 'valid' },
  { type: 'id', input: '-1', expected: 'invalid' }
];

testCases.forEach(test => {
  try {
    let result;
    switch (test.type) {
      case 'email':
        result = InputValidator.validateEmail(test.input);
        console.log(`✅ Email validation: ${test.input} → ${result}`);
        break;
      case 'password':
        InputValidator.validatePassword(test.input);
        console.log(`✅ Password validation: ${test.input} → Valid`);
        break;
      case 'sanitize':
        result = InputValidator.sanitizeString(test.input);
        console.log(`✅ Sanitization: ${test.input} → ${result}`);
        break;
      case 'id':
        result = InputValidator.validateNumericId(test.input);
        console.log(`✅ ID validation: ${test.input} → ${result}`);
        break;
    }
  } catch (error) {
    console.log(`❌ ${test.type} validation: ${test.input} → ${error.message}`);
  }
});

setTimeout(() => {
  console.log('\n--- Separator ---\n');
  exerciseTwo();
}, 1000);

// EXERCISE 2: Authentication and Password Security
function exerciseTwo() {
  console.log('Exercise 2: Secure Authentication Implementation');
  
  class SecureAuth {
    constructor() {
      this.saltRounds = 12;
      this.jwtSecret = crypto.randomBytes(32).toString('hex');
      this.refreshTokens = new Set();
    }
    
    // Secure password hashing
    async hashPassword(password) {
      const salt = crypto.randomBytes(16).toString('hex');
      
      return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
          if (err) reject(err);
          resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
      });
    }
    
    // Verify password
    async verifyPassword(password, hash) {
      const [salt, key] = hash.split(':');
      
      return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
          if (err) reject(err);
          resolve(key === derivedKey.toString('hex'));
        });
      });
    }
    
    // Generate JWT (simplified implementation)
    generateJWT(payload, expiresIn = 3600) {
      const header = {
        alg: 'HS256',
        typ: 'JWT'
      };
      
      const tokenPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expiresIn
      };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
      
      const signature = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');
      
      return `${encodedHeader}.${encodedPayload}.${signature}`;
    }
    
    // Verify JWT
    verifyJWT(token) {
      try {
        const [encodedHeader, encodedPayload, signature] = token.split('.');
        
        // Verify signature
        const expectedSignature = crypto
          .createHmac('sha256', this.jwtSecret)
          .update(`${encodedHeader}.${encodedPayload}`)
          .digest('base64url');
        
        if (signature !== expectedSignature) {
          throw new Error('Invalid token signature');
        }
        
        // Decode payload
        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
        
        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          throw new Error('Token expired');
        }
        
        return payload;
      } catch (error) {
        throw new Error('Invalid token');
      }
    }
    
    // Generate secure refresh token
    generateRefreshToken() {
      const token = crypto.randomBytes(32).toString('hex');
      this.refreshTokens.add(token);
      return token;
    }
    
    // Revoke refresh token
    revokeRefreshToken(token) {
      return this.refreshTokens.delete(token);
    }
    
    // Validate refresh token
    isValidRefreshToken(token) {
      return this.refreshTokens.has(token);
    }
  }
  
  // Test authentication system
  async function testAuthSystem() {
    const auth = new SecureAuth();
    
    console.log('--- Password Hashing Test ---');
    const password = 'SecurePassword123!';
    const hashedPassword = await auth.hashPassword(password);
    console.log('Original password:', password);
    console.log('Hashed password:', hashedPassword.substring(0, 50) + '...');
    
    const isValid = await auth.verifyPassword(password, hashedPassword);
    const isInvalid = await auth.verifyPassword('WrongPassword', hashedPassword);
    console.log('Password verification (correct):', isValid);
    console.log('Password verification (incorrect):', isInvalid);
    
    console.log('\n--- JWT Token Test ---');
    const userPayload = { userId: 123, email: 'user@example.com', role: 'user' };
    const token = auth.generateJWT(userPayload, 3600);
    console.log('Generated JWT:', token.substring(0, 50) + '...');
    
    try {
      const decoded = auth.verifyJWT(token);
      console.log('Decoded token:', { userId: decoded.userId, email: decoded.email, role: decoded.role });
    } catch (error) {
      console.log('Token verification failed:', error.message);
    }
    
    console.log('\n--- Refresh Token Test ---');
    const refreshToken = auth.generateRefreshToken();
    console.log('Generated refresh token:', refreshToken.substring(0, 20) + '...');
    console.log('Is refresh token valid:', auth.isValidRefreshToken(refreshToken));
    
    auth.revokeRefreshToken(refreshToken);
    console.log('After revocation, is valid:', auth.isValidRefreshToken(refreshToken));
  }
  
  testAuthSystem().then(() => {
    setTimeout(() => exerciseThree(), 1000);
  });
}

// EXERCISE 3: Rate Limiting and DDoS Protection
function exerciseThree() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 3: Rate Limiting and DDoS Protection');
  
  class RateLimiter {
    constructor(windowMs = 60000, maxRequests = 100) {
      this.windowMs = windowMs;
      this.maxRequests = maxRequests;
      this.requests = new Map(); // clientId -> request times
    }
    
    isAllowed(clientId) {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      // Get or create request history for this client
      let clientRequests = this.requests.get(clientId) || [];
      
      // Remove old requests outside the window
      clientRequests = clientRequests.filter(time => time > windowStart);
      
      // Check if limit exceeded
      if (clientRequests.length >= this.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: Math.min(...clientRequests) + this.windowMs
        };
      }
      
      // Add current request
      clientRequests.push(now);
      this.requests.set(clientId, clientRequests);
      
      return {
        allowed: true,
        remaining: this.maxRequests - clientRequests.length,
        resetTime: windowStart + this.windowMs
      };
    }
    
    // Cleanup old entries periodically
    cleanup() {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      
      for (const [clientId, requests] of this.requests.entries()) {
        const validRequests = requests.filter(time => time > windowStart);
        if (validRequests.length === 0) {
          this.requests.delete(clientId);
        } else {
          this.requests.set(clientId, validRequests);
        }
      }
    }
  }
  
  class DDoSProtector {
    constructor() {
      this.suspiciousIPs = new Map(); // IP -> { requestCount, firstSeen }
      this.blockedIPs = new Set();
      this.requestPatterns = new Map(); // IP -> request patterns
      
      // Thresholds
      this.SUSPICIOUS_THRESHOLD = 200; // requests per minute
      this.BLOCK_THRESHOLD = 500;
      this.PATTERN_WINDOW = 10000; // 10 seconds
    }
    
    analyzeRequest(ip, userAgent, path) {
      const now = Date.now();
      
      // Check if IP is blocked
      if (this.blockedIPs.has(ip)) {
        return { blocked: true, reason: 'IP blocked for suspicious activity' };
      }
      
      // Track request patterns
      this.trackRequestPattern(ip, path, now);
      
      // Analyze for suspicious behavior
      const suspiciousScore = this.calculateSuspiciousScore(ip, userAgent, path);
      
      if (suspiciousScore > this.BLOCK_THRESHOLD) {
        this.blockedIPs.add(ip);
        console.log(`🚨 IP ${ip} blocked for DDoS-like behavior (score: ${suspiciousScore})`);
        return { blocked: true, reason: 'DDoS protection triggered' };
      }
      
      if (suspiciousScore > this.SUSPICIOUS_THRESHOLD) {
        console.log(`⚠️  IP ${ip} flagged as suspicious (score: ${suspiciousScore})`);
        return { blocked: false, suspicious: true, score: suspiciousScore };
      }
      
      return { blocked: false, suspicious: false, score: suspiciousScore };
    }
    
    trackRequestPattern(ip, path, timestamp) {
      if (!this.requestPatterns.has(ip)) {
        this.requestPatterns.set(ip, []);
      }
      
      const patterns = this.requestPatterns.get(ip);
      patterns.push({ path, timestamp });
      
      // Keep only recent patterns
      const cutoff = timestamp - this.PATTERN_WINDOW;
      this.requestPatterns.set(ip, patterns.filter(p => p.timestamp > cutoff));
    }
    
    calculateSuspiciousScore(ip, userAgent, path) {
      let score = 0;
      const now = Date.now();
      
      // Check request frequency
      const patterns = this.requestPatterns.get(ip) || [];
      const recentRequests = patterns.filter(p => p.timestamp > now - 60000);
      score += recentRequests.length;
      
      // Check for missing or suspicious user agent
      if (!userAgent || userAgent.length < 10) {
        score += 50;
      }
      
      // Check for automated patterns
      const uniquePaths = new Set(patterns.map(p => p.path)).size;
      const pathRepetition = patterns.length / Math.max(uniquePaths, 1);
      if (pathRepetition > 10) {
        score += 100;
      }
      
      // Check for rapid sequential requests
      let sequentialRequests = 0;
      for (let i = 1; i < patterns.length; i++) {
        if (patterns[i].timestamp - patterns[i-1].timestamp < 100) {
          sequentialRequests++;
        }
      }
      score += sequentialRequests * 5;
      
      return score;
    }
    
    unblockIP(ip) {
      return this.blockedIPs.delete(ip);
    }
    
    getBlockedIPs() {
      return Array.from(this.blockedIPs);
    }
  }
  
  // Test rate limiting and DDoS protection
  console.log('--- Rate Limiting Test ---');
  const rateLimiter = new RateLimiter(5000, 5); // 5 requests per 5 seconds
  
  // Simulate requests from same client
  for (let i = 1; i <= 8; i++) {
    const result = rateLimiter.isAllowed('client-123');
    console.log(`Request ${i}: ${result.allowed ? 'Allowed' : 'Blocked'}, Remaining: ${result.remaining}`);
  }
  
  console.log('\n--- DDoS Protection Test ---');
  const ddosProtector = new DDoSProtector();
  
  // Simulate normal requests
  console.log('Normal requests:');
  for (let i = 0; i < 3; i++) {
    const result = ddosProtector.analyzeRequest('192.168.1.100', 'Mozilla/5.0...', '/api/users');
    console.log(`Request ${i + 1}: ${result.suspicious ? 'Suspicious' : 'Normal'} (score: ${result.score})`);
  }
  
  // Simulate suspicious pattern
  console.log('\nSuspicious pattern (rapid requests):');
  for (let i = 0; i < 50; i++) {
    const result = ddosProtector.analyzeRequest('192.168.1.200', '', '/api/data');
    if (i % 10 === 0) {
      console.log(`Request ${i + 1}: ${result.blocked ? 'BLOCKED' : result.suspicious ? 'Suspicious' : 'Normal'} (score: ${result.score})`);
    }
    if (result.blocked) break;
  }
  
  setTimeout(() => exerciseFour(), 1000);
}

// EXERCISE 4: Data Encryption and Secure Storage
function exerciseFour() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 4: Data Encryption and Secure Storage');
  
  class SecureDataHandler {
    constructor() {
      this.encryptionKey = crypto.randomBytes(32); // 256-bit key
      this.algorithm = 'aes-256-gcm';
    }
    
    // Encrypt sensitive data
    encrypt(plaintext) {
      const iv = crypto.randomBytes(16); // 128-bit IV
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('additional-authenticated-data'));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    }
    
    // Decrypt data
    decrypt(encryptedData) {
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAAD(Buffer.from('additional-authenticated-data'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
    
    // Hash sensitive data (one-way)
    hash(data, salt = null) {
      const saltBuffer = salt || crypto.randomBytes(16);
      const hash = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha512');
      
      return {
        hash: hash.toString('hex'),
        salt: saltBuffer.toString('hex')
      };
    }
    
    // Verify hashed data
    verifyHash(data, storedHash, storedSalt) {
      const saltBuffer = Buffer.from(storedSalt, 'hex');
      const hash = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha512');
      return hash.toString('hex') === storedHash;
    }
    
    // Generate secure random tokens
    generateSecureToken(length = 32) {
      return crypto.randomBytes(length).toString('hex');
    }
    
    // Secure data sanitization (overwrite memory)
    secureErase(buffer) {
      if (Buffer.isBuffer(buffer)) {
        buffer.fill(0);
      }
    }
  }
  
  class SecureConfigManager {
    constructor() {
      this.config = new Map();
      this.sensitiveKeys = new Set(['password', 'apiKey', 'secret', 'token']);
    }
    
    set(key, value) {
      if (this.sensitiveKeys.has(key) || this.isSensitiveValue(value)) {
        // Encrypt sensitive values
        const encrypted = this.encryptValue(value);
        this.config.set(key, { encrypted: true, value: encrypted });
        console.log(`🔒 Stored encrypted value for key: ${key}`);
      } else {
        this.config.set(key, { encrypted: false, value: value });
        console.log(`📝 Stored plain value for key: ${key}`);
      }
    }
    
    get(key) {
      const stored = this.config.get(key);
      if (!stored) return undefined;
      
      if (stored.encrypted) {
        return this.decryptValue(stored.value);
      }
      return stored.value;
    }
    
    isSensitiveValue(value) {
      if (typeof value !== 'string') return false;
      
      // Check for patterns that might indicate sensitive data
      const sensitivePatterns = [
        /^[A-Za-z0-9+/]{20,}={0,2}$/, // Base64-like
        /^[a-f0-9]{32,}$/i,          // Hex tokens
        /password|secret|key|token/i  // Sensitive keywords
      ];
      
      return sensitivePatterns.some(pattern => pattern.test(value));
    }
    
    encryptValue(value) {
      // Simple encryption for demo (use proper key management in production)
      const key = crypto.scryptSync('config-encryption-key', 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', key);
      
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    }
    
    decryptValue(encryptedValue) {
      const [ivHex, encrypted] = encryptedValue.split(':');
      const key = crypto.scryptSync('config-encryption-key', 'salt', 32);
      const decipher = crypto.createDecipher('aes-256-cbc', key);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    }
  }
  
  // Test encryption and secure storage
  console.log('--- Data Encryption Test ---');
  const secureHandler = new SecureDataHandler();
  
  const sensitiveData = 'This is highly confidential information: user SSN 123-45-6789';
  console.log('Original data:', sensitiveData);
  
  const encrypted = secureHandler.encrypt(sensitiveData);
  console.log('Encrypted:', encrypted.encrypted.substring(0, 50) + '...');
  
  const decrypted = secureHandler.decrypt(encrypted);
  console.log('Decrypted:', decrypted);
  console.log('Encryption successful:', decrypted === sensitiveData);
  
  console.log('\n--- Hashing Test ---');
  const password = 'UserPassword123!';
  const hashed = secureHandler.hash(password);
  console.log('Password hash:', hashed.hash.substring(0, 20) + '...');
  
  const isValidPassword = secureHandler.verifyHash(password, hashed.hash, hashed.salt);
  const isInvalidPassword = secureHandler.verifyHash('WrongPassword', hashed.hash, hashed.salt);
  console.log('Password verification (correct):', isValidPassword);
  console.log('Password verification (incorrect):', isInvalidPassword);
  
  console.log('\n--- Secure Configuration Test ---');
  const configManager = new SecureConfigManager();
  
  configManager.set('appName', 'MyApplication');
  configManager.set('apiKey', 'sk_live_1234567890abcdef');
  configManager.set('dbPassword', 'super_secret_password');
  configManager.set('port', '3000');
  
  console.log('Retrieved app name:', configManager.get('appName'));
  console.log('Retrieved API key:', configManager.get('apiKey'));
  console.log('Retrieved DB password:', configManager.get('dbPassword'));
  
  setTimeout(() => practicalChallenges(), 1000);
}

// PRACTICAL CHALLENGES
function practicalChallenges() {
  console.log('\n=== PRACTICAL CHALLENGES ===\n');
  
  console.log('Challenge 1: CSRF Protection Implementation');
  console.log('Challenge 2: Content Security Policy (CSP) Middleware');
  console.log('Challenge 3: Secure Session Management');
  console.log('Challenge 4: API Security Framework');
  console.log('Challenge 5: Vulnerability Scanner');
  
  // Challenge 1: CSRF Protection
  console.log('\n--- Challenge 1: CSRF Protection Implementation ---');
  
  class CSRFProtection {
    constructor() {
      this.tokens = new Map(); // sessionId -> token
      this.tokenExpiry = 3600000; // 1 hour
    }
    
    generateToken(sessionId) {
      const token = crypto.randomBytes(32).toString('hex');
      this.tokens.set(sessionId, {
        token: token,
        createdAt: Date.now()
      });
      return token;
    }
    
    validateToken(sessionId, providedToken) {
      const storedToken = this.tokens.get(sessionId);
      
      if (!storedToken) {
        return { valid: false, reason: 'No CSRF token found for session' };
      }
      
      // Check expiry
      if (Date.now() - storedToken.createdAt > this.tokenExpiry) {
        this.tokens.delete(sessionId);
        return { valid: false, reason: 'CSRF token expired' };
      }
      
      // Validate token
      if (storedToken.token !== providedToken) {
        return { valid: false, reason: 'Invalid CSRF token' };
      }
      
      return { valid: true };
    }
    
    middleware() {
      return (req, res, next) => {
        // GET requests don't need CSRF protection
        if (req.method === 'GET') {
          return next();
        }
        
        const sessionId = req.sessionId || 'default-session';
        const providedToken = req.headers['x-csrf-token'] || req.body?._csrf;
        
        if (!providedToken) {
          res.statusCode = 403;
          res.end('CSRF token required');
          return;
        }
        
        const validation = this.validateToken(sessionId, providedToken);
        if (!validation.valid) {
          res.statusCode = 403;
          res.end(`CSRF protection: ${validation.reason}`);
          return;
        }
        
        next();
      };
    }
    
    cleanup() {
      const now = Date.now();
      for (const [sessionId, tokenData] of this.tokens.entries()) {
        if (now - tokenData.createdAt > this.tokenExpiry) {
          this.tokens.delete(sessionId);
        }
      }
    }
  }
  
  // Test CSRF protection
  const csrfProtection = new CSRFProtection();
  const sessionId = 'user-session-123';
  
  console.log('Generating CSRF token for session...');
  const csrfToken = csrfProtection.generateToken(sessionId);
  console.log('CSRF token:', csrfToken.substring(0, 20) + '...');
  
  // Test validation
  const validTest = csrfProtection.validateToken(sessionId, csrfToken);
  const invalidTest = csrfProtection.validateToken(sessionId, 'invalid-token');
  
  console.log('Valid token test:', validTest.valid ? 'PASSED' : `FAILED - ${validTest.reason}`);
  console.log('Invalid token test:', invalidTest.valid ? 'FAILED' : `PASSED - ${invalidTest.reason}`);
  
  console.log('\n--- Challenge 2: Security Headers Middleware ---');
  
  class SecurityHeaders {
    static create(options = {}) {
      const defaults = {
        contentSecurityPolicy: "default-src 'self'",
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        noSniff: true,
        frameguard: 'DENY',
        xssFilter: true,
        referrerPolicy: 'no-referrer'
      };
      
      const config = { ...defaults, ...options };
      
      return (req, res, next) => {
        // Content Security Policy
        if (config.contentSecurityPolicy) {
          res.setHeader('Content-Security-Policy', config.contentSecurityPolicy);
        }
        
        // HTTP Strict Transport Security
        if (config.hsts) {
          let hstsValue = `max-age=${config.hsts.maxAge}`;
          if (config.hsts.includeSubDomains) hstsValue += '; includeSubDomains';
          if (config.hsts.preload) hstsValue += '; preload';
          res.setHeader('Strict-Transport-Security', hstsValue);
        }
        
        // X-Content-Type-Options
        if (config.noSniff) {
          res.setHeader('X-Content-Type-Options', 'nosniff');
        }
        
        // X-Frame-Options
        if (config.frameguard) {
          res.setHeader('X-Frame-Options', config.frameguard);
        }
        
        // X-XSS-Protection
        if (config.xssFilter) {
          res.setHeader('X-XSS-Protection', '1; mode=block');
        }
        
        // Referrer Policy
        if (config.referrerPolicy) {
          res.setHeader('Referrer-Policy', config.referrerPolicy);
        }
        
        // Remove potentially dangerous headers
        res.removeHeader('X-Powered-By');
        res.removeHeader('Server');
        
        console.log('Security headers applied');
        next();
      };
    }
  }
  
  // Test security headers middleware
  const securityMiddleware = SecurityHeaders.create();
  const mockReq = { method: 'GET', url: '/' };
  const mockRes = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      console.log(`Header set: ${name}: ${value}`);
    },
    removeHeader(name) {
      delete this.headers[name];
      console.log(`Header removed: ${name}`);
    }
  };
  
  securityMiddleware(mockReq, mockRes, () => {
    console.log('Security middleware test completed');
  });
  
  setTimeout(() => {
    console.log('\n=== END EXERCISES ===');
    console.log('\n🔒 Security Best Practices Summary:');
    console.log('• Always validate and sanitize input');
    console.log('• Use parameterized queries to prevent SQL injection');
    console.log('• Implement proper authentication and authorization');
    console.log('• Use HTTPS everywhere');
    console.log('• Apply security headers (CSP, HSTS, etc.)');
    console.log('• Implement rate limiting and DDoS protection');
    console.log('• Encrypt sensitive data at rest and in transit');
    console.log('• Keep dependencies updated and audit regularly');
    console.log('• Follow principle of least privilege');
    console.log('• Log security events and monitor for threats');
  }, 2000);
}

console.log('Starting security exercises...\n');