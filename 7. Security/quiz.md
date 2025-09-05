# Node.js Security Quiz

## Question 1: Multiple Choice
Which of the following is the most secure way to store passwords in a database?

A) Plain text  
B) MD5 hash  
C) bcrypt with salt  
D) SHA-256 hash  

**Answer: C** - bcrypt is designed for password hashing and includes salt automatically. It's also slow, making brute force attacks impractical.

---

## Question 2: True/False
Using `eval()` on user input is safe as long as you sanitize the input first.

**Answer: False** - `eval()` should never be used with any user input, regardless of sanitization. Use `JSON.parse()` for JSON data or other safe alternatives.

---

## Question 3: Code Analysis
```javascript
app.get('/user/:id', (req, res) => {
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  db.query(query, (err, results) => {
    res.json(results);
  });
});
```

What security vulnerability does this code have and how would you fix it?

**Answer:** SQL Injection vulnerability. The user ID is directly interpolated into the query. Fix with parameterized queries:
```javascript
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [req.params.id], (err, results) => {
  res.json(results);
});
```

---

## Question 4: Fill in the Blank
The _______ header prevents browsers from MIME-sniffing a response away from the declared content-type.

**Answer: X-Content-Type-Options: nosniff**

---

## Question 5: Short Answer
Explain what CSRF attacks are and name two ways to prevent them.

**Answer:** CSRF (Cross-Site Request Forgery) attacks trick users into making unwanted requests to a site where they're authenticated. Prevention methods:
1. **CSRF tokens** - Include unique tokens in forms/requests
2. **SameSite cookies** - Restrict cookie sending in cross-site requests
3. **Check Referer header** - Verify request origin
4. **Double submit cookies** - Compare cookie and request parameter

---

## Question 6: Code Security Review
```javascript
const userInput = req.body.data;
const result = JSON.parse(userInput);
result.isAdmin = false;
User.create(result);
```

What security issue exists here?

**Answer:** **Prototype pollution** vulnerability. Malicious JSON like `{"__proto__": {"isAdmin": true}}` can pollute the Object prototype. Always validate JSON structure and use libraries like `flatted` or implement proper validation.

---

## Question 7: Multiple Choice
Which HTTP status code should you return when authentication fails?

A) 400 Bad Request  
B) 401 Unauthorized  
C) 403 Forbidden  
D) 404 Not Found  

**Answer: B** - 401 Unauthorized indicates authentication is required or has failed.

---

## Question 8: Security Headers
Match each security header with its purpose:

Headers:
1. Content-Security-Policy
2. Strict-Transport-Security  
3. X-Frame-Options
4. X-XSS-Protection

Purposes:
A. Prevents clickjacking attacks
B. Forces HTTPS connections
C. Prevents XSS attacks by controlling resource loading
D. Enables browser XSS filtering

**Answer:** 1-C, 2-B, 3-A, 4-D

---

## Question 9: Rate Limiting
Implement a simple rate limiter that allows 10 requests per minute per IP:

```javascript
class RateLimiter {
  constructor() {
    // Your implementation here
  }
  
  isAllowed(ip) {
    // Your implementation here
  }
}
```

**Answer:**
```javascript
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.limit = 10;
    this.windowMs = 60000; // 1 minute
  }
  
  isAllowed(ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let ipRequests = this.requests.get(ip) || [];
    ipRequests = ipRequests.filter(time => time > windowStart);
    
    if (ipRequests.length >= this.limit) {
      return false;
    }
    
    ipRequests.push(now);
    this.requests.set(ip, ipRequests);
    return true;
  }
}
```

---

## Question 10: Advanced Scenario
Your API is receiving suspicious traffic patterns. Design a multi-layered security approach to protect against various attacks.

**Answer:** Multi-layered security approach:

1. **Network Layer:**
   - DDoS protection (Cloudflare, AWS Shield)
   - IP whitelisting/blacklisting
   - Geographic blocking

2. **Application Layer:**
   - Rate limiting per IP/user
   - Input validation and sanitization
   - Authentication and authorization
   - CSRF protection

3. **Data Layer:**
   - Parameterized queries
   - Data encryption at rest
   - Access logging and monitoring

4. **Monitoring:**
   - Real-time threat detection
   - Anomaly detection
   - Security event logging
   - Automated incident response

---

## Practical Challenge Questions

### Challenge 1: JWT Security
```javascript
const jwt = require('jsonwebtoken');

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
```

What security improvements would you make to this JWT verification?

### Challenge 2: File Upload Security
You need to implement secure file upload. What security measures would you implement?

### Challenge 3: API Key Management
Design a secure API key system with the following requirements:
- Key rotation capability
- Usage tracking
- Rate limiting per key
- Secure storage

### Challenge 4: Vulnerability Assessment
```javascript
app.post('/search', (req, res) => {
  const { query, type } = req.body;
  
  if (type === 'user') {
    const sql = `SELECT * FROM users WHERE name LIKE '%${query}%'`;
    db.query(sql, (err, results) => {
      res.json(results);
    });
  } else if (type === 'admin') {
    eval(`searchAdmin('${query}')`);
  }
});
```

Identify all security vulnerabilities in this code.

### Challenge 5: Security Middleware Stack
Design a comprehensive security middleware stack for an Express application that handles:
- Authentication
- Authorization  
- Rate limiting
- Input validation
- Security headers
- Logging

**Solutions:**

**Challenge 1:** JWT Security improvements:
```javascript
function verifyToken(token) {
  try {
    // Add algorithm specification to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'your-app',
      audience: 'your-users'
    });
    
    // Check token blacklist
    if (isTokenBlacklisted(token)) {
      throw new Error('Token revoked');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

**Challenge 2:** File Upload Security:
- File type validation (whitelist)
- File size limits
- Scan for malware
- Store outside web root
- Generate unique filenames
- Validate file headers, not just extensions
- Use Content-Type validation
- Implement rate limiting for uploads

**Challenge 4:** Vulnerabilities identified:
1. **SQL Injection** - Direct string interpolation in SQL query
2. **Code Injection** - Using `eval()` with user input
3. **Missing Input Validation** - No validation on `query` or `type`
4. **Missing Authentication** - No user verification
5. **Information Disclosure** - Returning raw database results
6. **Missing Rate Limiting** - No protection against abuse