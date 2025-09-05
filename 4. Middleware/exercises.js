// Node.js Middleware Exercises

const http = require('http');
const url = require('url');

console.log('=== NODE.JS MIDDLEWARE EXERCISES ===\n');

// EXERCISE 1: Basic Middleware Pattern
console.log('Exercise 1: Understanding Middleware Pattern');

// Simple middleware system
class SimpleApp {
  constructor() {
    this.middlewares = [];
  }
  
  use(middleware) {
    this.middlewares.push(middleware);
    return this; // Allow chaining
  }
  
  async handle(req, res) {
    let index = 0;
    
    const next = async (error) => {
      if (error) {
        console.log('Error in middleware:', error.message);
        res.statusCode = 500;
        res.end('Internal Server Error');
        return;
      }
      
      if (index >= this.middlewares.length) {
        // No more middleware, send default response
        if (!res.headersSent) {
          res.end('No response set');
        }
        return;
      }
      
      const middleware = this.middlewares[index++];
      try {
        await middleware(req, res, next);
      } catch (err) {
        next(err);
      }
    };
    
    await next();
  }
}

const app = new SimpleApp();

// Middleware 1: Logger
app.use(async (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  req.timestamp = Date.now();
  next();
});

// Middleware 2: CORS Headers
app.use(async (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  console.log('CORS headers set');
  next();
});

// Middleware 3: Body Parser (simplified)
app.use(async (req, res, next) => {
  if (req.method === 'POST' && req.headers['content-type'] === 'application/json') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
        console.log('Body parsed:', req.body);
        next();
      } catch (error) {
        next(new Error('Invalid JSON'));
      }
    });
  } else {
    next();
  }
});

// Middleware 4: Route Handler
app.use(async (req, res, next) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/api/users' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ]));
  } else if (parsedUrl.pathname === '/api/users' && req.method === 'POST') {
    if (!req.body) {
      res.statusCode = 400;
      res.end('Body required');
      return;
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      message: 'User created', 
      user: req.body,
      processingTime: Date.now() - req.timestamp
    }));
  } else {
    next();
  }
});

// Middleware 5: 404 Handler
app.use(async (req, res, next) => {
  res.statusCode = 404;
  res.end('Not Found');
});

console.log('--- Basic Middleware Demo ---');
// Simulate requests
const mockReq = {
  method: 'GET',
  url: '/api/users',
  headers: {}
};

const mockRes = {
  statusCode: 200,
  headers: {},
  headersSent: false,
  setHeader(name, value) {
    this.headers[name] = value;
  },
  end(data) {
    this.headersSent = true;
    console.log('Response:', { statusCode: this.statusCode, data });
  }
};

app.handle(mockReq, mockRes).then(() => {
  console.log('\n--- Separator ---\n');
  exerciseTwo();
});

// EXERCISE 2: Express-like Middleware with Router
function exerciseTwo() {
  console.log('Exercise 2: Router Middleware Pattern');
  
  class Router {
    constructor() {
      this.routes = [];
    }
    
    get(path, ...handlers) {
      this.routes.push({ method: 'GET', path, handlers });
    }
    
    post(path, ...handlers) {
      this.routes.push({ method: 'POST', path, handlers });
    }
    
    put(path, ...handlers) {
      this.routes.push({ method: 'PUT', path, handlers });
    }
    
    delete(path, ...handlers) {
      this.routes.push({ method: 'DELETE', path, handlers });
    }
    
    async handle(req, res, next) {
      const parsedUrl = url.parse(req.url, true);
      const route = this.routes.find(r => 
        r.method === req.method && this.matchPath(r.path, parsedUrl.pathname)
      );
      
      if (!route) {
        return next();
      }
      
      // Extract path parameters
      req.params = this.extractParams(route.path, parsedUrl.pathname);
      req.query = parsedUrl.query;
      
      // Execute route handlers
      let handlerIndex = 0;
      
      const nextHandler = async (error) => {
        if (error) return next(error);
        
        if (handlerIndex >= route.handlers.length) {
          return next();
        }
        
        const handler = route.handlers[handlerIndex++];
        try {
          await handler(req, res, nextHandler);
        } catch (err) {
          next(err);
        }
      };
      
      await nextHandler();
    }
    
    matchPath(routePath, actualPath) {
      const routeParts = routePath.split('/').filter(p => p);
      const actualParts = actualPath.split('/').filter(p => p);
      
      if (routeParts.length !== actualParts.length) {
        return false;
      }
      
      return routeParts.every((part, i) => {
        return part.startsWith(':') || part === actualParts[i];
      });
    }
    
    extractParams(routePath, actualPath) {
      const routeParts = routePath.split('/').filter(p => p);
      const actualParts = actualPath.split('/').filter(p => p);
      const params = {};
      
      routeParts.forEach((part, i) => {
        if (part.startsWith(':')) {
          params[part.substring(1)] = actualParts[i];
        }
      });
      
      return params;
    }
  }
  
  const router = new Router();
  
  // Middleware functions
  const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.end('Unauthorized');
      return;
    }
    
    req.user = { id: 1, name: 'John Doe' }; // Mock user
    console.log('User authenticated:', req.user.name);
    next();
  };
  
  const validateUser = async (req, res, next) => {
    if (!req.body || !req.body.name || !req.body.email) {
      res.statusCode = 400;
      res.end('Name and email required');
      return;
    }
    console.log('User data validated');
    next();
  };
  
  const rateLimit = async (req, res, next) => {
    // Simplified rate limiting
    console.log('Rate limit check passed');
    next();
  };
  
  // Define routes with middleware
  router.get('/users/:id', authenticate, async (req, res, next) => {
    const userId = req.params.id;
    console.log(`Fetching user ${userId} for ${req.user.name}`);
    
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      id: userId,
      name: 'User ' + userId,
      requestedBy: req.user.name
    }));
  });
  
  router.post('/users', rateLimit, authenticate, validateUser, async (req, res, next) => {
    console.log('Creating user:', req.body.name);
    
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 201;
    res.end(JSON.stringify({
      id: Date.now(),
      ...req.body,
      createdBy: req.user.name
    }));
  });
  
  // Test the router
  const routerApp = new SimpleApp();
  routerApp.use(async (req, res, next) => {
    console.log(`Router handling: ${req.method} ${req.url}`);
    next();
  });
  
  routerApp.use(router.handle.bind(router));
  
  // Simulate authenticated request
  const authReq = {
    method: 'GET',
    url: '/users/123',
    headers: { authorization: 'Bearer valid-token' }
  };
  
  const authRes = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    setHeader(name, value) { this.headers[name] = value; },
    end(data) {
      this.headersSent = true;
      console.log('Auth Response:', { statusCode: this.statusCode, data });
    }
  };
  
  routerApp.handle(authReq, authRes).then(() => {
    setTimeout(() => exerciseThree(), 500);
  });
}

// EXERCISE 3: Middleware Composition and Error Handling
function exerciseThree() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 3: Advanced Middleware Patterns');
  
  // Middleware composition utilities
  const compose = (...middlewares) => {
    return async (req, res, next) => {
      let index = 0;
      
      const dispatch = async (error) => {
        if (error) return next(error);
        
        if (index >= middlewares.length) {
          return next();
        }
        
        const middleware = middlewares[index++];
        try {
          await middleware(req, res, dispatch);
        } catch (err) {
          dispatch(err);
        }
      };
      
      await dispatch();
    };
  };
  
  // Conditional middleware
  const unless = (condition, middleware) => {
    return async (req, res, next) => {
      if (condition(req)) {
        next();
      } else {
        await middleware(req, res, next);
      }
    };
  };
  
  // Cache middleware
  const cache = (ttl = 60000) => {
    const cache = new Map();
    
    return async (req, res, next) => {
      const key = `${req.method}:${req.url}`;
      const cached = cache.get(key);
      
      if (cached && (Date.now() - cached.timestamp < ttl)) {
        console.log('Cache hit for:', key);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache', 'HIT');
        res.end(cached.data);
        return;
      }
      
      // Override res.end to cache response
      const originalEnd = res.end.bind(res);
      res.end = function(data) {
        if (res.statusCode === 200 && data) {
          cache.set(key, {
            data: data,
            timestamp: Date.now()
          });
          console.log('Cached response for:', key);
        }
        res.setHeader('X-Cache', 'MISS');
        originalEnd(data);
      };
      
      next();
    };
  };
  
  // Compression middleware (mock)
  const compress = () => {
    return async (req, res, next) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';
      
      if (acceptEncoding.includes('gzip')) {
        console.log('Would compress response with gzip');
        res.setHeader('Content-Encoding', 'gzip');
      }
      
      next();
    };
  };
  
  // Security headers middleware
  const securityHeaders = () => {
    return async (req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      console.log('Security headers applied');
      next();
    };
  };
  
  // Request timeout middleware
  const timeout = (ms = 5000) => {
    return async (req, res, next) => {
      const timer = setTimeout(() => {
        if (!res.headersSent) {
          res.statusCode = 408;
          res.end('Request Timeout');
        }
      }, ms);
      
      const originalEnd = res.end.bind(res);
      res.end = function(...args) {
        clearTimeout(timer);
        originalEnd(...args);
      };
      
      next();
    };
  };
  
  // Error handling middleware
  const errorHandler = () => {
    return async (error, req, res, next) => {
      console.log('Error caught by handler:', error.message);
      
      if (res.headersSent) {
        return;
      }
      
      const statusCode = error.statusCode || 500;
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: {
          message: error.message,
          status: statusCode,
          timestamp: new Date().toISOString()
        }
      }));
    };
  };
  
  // Create advanced app
  const advancedApp = new SimpleApp();
  
  // Global middleware stack
  advancedApp.use(timeout(3000));
  advancedApp.use(securityHeaders());
  advancedApp.use(compress());
  advancedApp.use(unless(req => req.url.includes('/health'), cache(30000)));
  
  // Route-specific middleware composition
  const apiMiddleware = compose(
    async (req, res, next) => {
      console.log('API middleware: Logging');
      next();
    },
    async (req, res, next) => {
      console.log('API middleware: Validation');
      next();
    },
    async (req, res, next) => {
      console.log('API middleware: Processing');
      if (req.url.includes('/error')) {
        throw new Error('Simulated API error');
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        message: 'API response',
        timestamp: Date.now(),
        url: req.url
      }));
    }
  );
  
  advancedApp.use(async (req, res, next) => {
    if (req.url.startsWith('/api')) {
      await apiMiddleware(req, res, next);
    } else {
      next();
    }
  });
  
  // Health check endpoint (uncached)
  advancedApp.use(async (req, res, next) => {
    if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: Date.now()
      }));
    } else {
      next();
    }
  });
  
  // Add error handler last
  advancedApp.use(errorHandler());
  
  // Test different scenarios
  async function testAdvancedMiddleware() {
    const scenarios = [
      { method: 'GET', url: '/api/users', headers: { 'accept-encoding': 'gzip' } },
      { method: 'GET', url: '/api/users', headers: { 'accept-encoding': 'gzip' } }, // Cache hit
      { method: 'GET', url: '/health', headers: {} },
      { method: 'GET', url: '/api/error', headers: {} } // Error case
    ];
    
    for (const scenario of scenarios) {
      console.log(`\n--- Testing: ${scenario.method} ${scenario.url} ---`);
      
      const req = { ...scenario };
      const res = {
        statusCode: 200,
        headers: {},
        headersSent: false,
        setHeader(name, value) { this.headers[name] = value; },
        end(data) {
          this.headersSent = true;
          console.log('Response:', {
            statusCode: this.statusCode,
            headers: this.headers,
            data: data ? data.substring(0, 100) + '...' : 'No data'
          });
        }
      };
      
      await advancedApp.handle(req, res);
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  testAdvancedMiddleware().then(() => {
    console.log('\n=== PRACTICAL CHALLENGES ===');
    practicalChallenges();
  });
}

// PRACTICAL CHALLENGES
function practicalChallenges() {
  console.log('\nChallenge 1: Session Management Middleware');
  console.log('Challenge 2: API Rate Limiting with Redis');
  console.log('Challenge 3: Request/Response Transformation Pipeline');
  console.log('Challenge 4: Multi-tenant Request Routing');
  console.log('Challenge 5: WebSocket Middleware System');
  
  console.log('\n--- Challenge 1: Session Management ---');
  
  // Challenge 1: Session Management Middleware
  class SessionManager {
    constructor() {
      this.sessions = new Map();
      this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    }
    
    generateSessionId() {
      return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    
    createSession(data = {}) {
      const sessionId = this.generateSessionId();
      const session = {
        id: sessionId,
        data: data,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      };
      
      this.sessions.set(sessionId, session);
      return session;
    }
    
    getSession(sessionId) {
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        return null;
      }
      
      // Check if session expired
      if (Date.now() - session.lastAccessed > this.sessionTimeout) {
        this.sessions.delete(sessionId);
        return null;
      }
      
      // Update last accessed time
      session.lastAccessed = Date.now();
      return session;
    }
    
    destroySession(sessionId) {
      return this.sessions.delete(sessionId);
    }
    
    middleware() {
      return async (req, res, next) => {
        // Extract session ID from cookie
        const cookies = this.parseCookies(req.headers.cookie || '');
        const sessionId = cookies.sessionId;
        
        if (sessionId) {
          req.session = this.getSession(sessionId);
        }
        
        if (!req.session) {
          req.session = this.createSession();
          
          // Set session cookie
          res.setHeader('Set-Cookie', `sessionId=${req.session.id}; HttpOnly; Path=/`);
        }
        
        // Add session helper methods
        req.session.set = (key, value) => {
          req.session.data[key] = value;
        };
        
        req.session.get = (key) => {
          return req.session.data[key];
        };
        
        req.session.destroy = () => {
          this.destroySession(req.session.id);
          res.setHeader('Set-Cookie', 'sessionId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/');
        };
        
        console.log(`Session: ${req.session.id} (Age: ${Date.now() - req.session.createdAt}ms)`);
        next();
      };
    }
    
    parseCookies(cookieHeader) {
      const cookies = {};
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies[name] = value;
        }
      });
      return cookies;
    }
  }
  
  // Test session middleware
  const sessionManager = new SessionManager();
  const sessionApp = new SimpleApp();
  
  sessionApp.use(sessionManager.middleware());
  
  sessionApp.use(async (req, res, next) => {
    if (req.url === '/login') {
      req.session.set('user', { id: 1, name: 'John Doe' });
      res.end('Logged in');
    } else if (req.url === '/profile') {
      const user = req.session.get('user');
      if (user) {
        res.end(`Profile: ${user.name}`);
      } else {
        res.statusCode = 401;
        res.end('Not logged in');
      }
    } else if (req.url === '/logout') {
      req.session.destroy();
      res.end('Logged out');
    } else {
      next();
    }
  });
  
  // Test session flow
  async function testSessions() {
    const scenarios = [
      { method: 'GET', url: '/profile', headers: {} }, // No session
      { method: 'POST', url: '/login', headers: {} },  // Login
      { method: 'GET', url: '/profile', headers: { cookie: 'sessionId=test' } }, // With session
      { method: 'POST', url: '/logout', headers: { cookie: 'sessionId=test' } }  // Logout
    ];
    
    for (const scenario of scenarios) {
      console.log(`Session test: ${scenario.method} ${scenario.url}`);
      
      const req = { ...scenario };
      const res = {
        statusCode: 200,
        headers: {},
        headersSent: false,
        setHeader(name, value) { 
          this.headers[name] = value;
          console.log(`Header set: ${name} = ${value}`);
        },
        end(data) {
          this.headersSent = true;
          console.log(`Response: ${this.statusCode} - ${data}\n`);
        }
      };
      
      await sessionApp.handle(req, res);
    }
  }
  
  testSessions().then(() => {
    console.log('=== END EXERCISES ===');
  });
}

console.log('Starting middleware exercises...\n');