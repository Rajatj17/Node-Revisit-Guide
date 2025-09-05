# Microservices Architecture with Node.js - Complete Guide

Microservices architecture is a **distributed system design pattern** that structures applications as a collection of loosely coupled, independently deployable services. Understanding this is crucial for building scalable enterprise applications.

## Microservices vs Monolithic Architecture

### Monolithic Architecture
```javascript
// Traditional monolithic Express.js app
const express = require('express');
const app = express();

// All modules in one application
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const inventoryRoutes = require('./routes/inventory');

// Single database connection
const db = require('./database');

// All routes in one app
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);

// Single deployment unit
app.listen(3000, () => {
  console.log('Monolithic app running on port 3000');
});

// Challenges:
// - All services scale together
// - Single point of failure
// - Technology lock-in
// - Large codebase becomes hard to maintain
// - Deployment of one feature affects entire system
```

### Microservices Architecture
```javascript
// Microservices - Each service is independent

// User Service (users-service/app.js)
const express = require('express');
const app = express();

class UserService {
  constructor() {
    this.db = require('./user-database');
    this.setupRoutes();
  }
  
  setupRoutes() {
    app.get('/users/:id', this.getUser.bind(this));
    app.post('/users', this.createUser.bind(this));
    app.put('/users/:id', this.updateUser.bind(this));
  }
  
  async getUser(req, res) {
    try {
      const user = await this.db.findById(req.params.id);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async createUser(req, res) {
    try {
      const user = await this.db.create(req.body);
      
      // Publish event for other services
      await this.publishEvent('user.created', {
        userId: user.id,
        email: user.email,
        timestamp: new Date()
      });
      
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  async publishEvent(eventType, data) {
    // Event publishing logic
    const eventBus = require('./event-bus');
    await eventBus.publish(eventType, data);
  }
}

const userService = new UserService();
app.listen(3001, () => {
  console.log('User Service running on port 3001');
});

// Order Service (orders-service/app.js)
const express = require('express');
const app = express();

class OrderService {
  constructor() {
    this.db = require('./order-database');
    this.userServiceClient = require('./clients/user-service-client');
    this.paymentServiceClient = require('./clients/payment-service-client');
    this.setupRoutes();
    this.subscribeToEvents();
  }
  
  async createOrder(req, res) {
    try {
      const { userId, items, totalAmount } = req.body;
      
      // Validate user exists (inter-service call)
      const user = await this.userServiceClient.getUser(userId);
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }
      
      // Create order
      const order = await this.db.create({
        userId,
        items,
        totalAmount,
        status: 'pending'
      });
      
      // Process payment (async)
      this.processPaymentAsync(order);
      
      res.status(201).json(order);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  async processPaymentAsync(order) {
    try {
      const payment = await this.paymentServiceClient.processPayment({
        orderId: order.id,
        amount: order.totalAmount,
        userId: order.userId
      });
      
      if (payment.success) {
        await this.db.updateStatus(order.id, 'confirmed');
        await this.publishEvent('order.confirmed', order);
      } else {
        await this.db.updateStatus(order.id, 'failed');
        await this.publishEvent('order.failed', order);
      }
    } catch (error) {
      console.error('Payment processing failed:', error);
      await this.db.updateStatus(order.id, 'failed');
    }
  }
  
  subscribeToEvents() {
    const eventBus = require('./event-bus');
    
    eventBus.subscribe('user.deleted', async (data) => {
      // Handle user deletion - cancel pending orders
      await this.db.cancelOrdersByUserId(data.userId);
    });
  }
}

app.listen(3002, () => {
  console.log('Order Service running on port 3002');
});
```

## Service Communication Patterns

### 1. Synchronous Communication (REST/HTTP)

```javascript
// Service Client for HTTP communication
class ServiceClient {
  constructor(baseURL, options = {}) {
    this.baseURL = baseURL;
    this.timeout = options.timeout || 5000;
    this.retries = options.retries || 3;
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
  }
  
  async request(method, path, data = null) {
    const url = `${this.baseURL}${path}`;
    
    return await this.circuitBreaker.execute(async () => {
      return await this.executeWithRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'X-Service-Name': process.env.SERVICE_NAME,
              'X-Request-ID': this.generateRequestId()
            },
            body: data ? JSON.stringify(data) : null,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new ServiceError(`HTTP ${response.status}: ${response.statusText}`, response.status);
          }
          
          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          
          if (error.name === 'AbortError') {
            throw new ServiceError('Request timeout', 408);
          }
          
          throw error;
        }
      });
    });
  }
  
  async executeWithRetry(operation) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        if (attempt < this.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  generateRequestId() {
    return require('crypto').randomUUID();
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
class UserServiceClient extends ServiceClient {
  constructor() {
    super(process.env.USER_SERVICE_URL, {
      timeout: 3000,
      retries: 3,
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 30000
      }
    });
  }
  
  async getUser(userId) {
    return await this.request('GET', `/users/${userId}`);
  }
  
  async createUser(userData) {
    return await this.request('POST', '/users', userData);
  }
  
  async updateUser(userId, userData) {
    return await this.request('PUT', `/users/${userId}`, userData);
  }
}
```

### 2. Asynchronous Communication (Message Queues)

```javascript
// Event Bus with Redis/RabbitMQ
const Redis = require('ioredis');

class EventBus {
  constructor() {
    this.publisher = new Redis(process.env.REDIS_URL);
    this.subscriber = new Redis(process.env.REDIS_URL);
    this.handlers = new Map();
  }
  
  async publish(eventType, data) {
    const event = {
      id: require('crypto').randomUUID(),
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
      source: process.env.SERVICE_NAME
    };
    
    try {
      await this.publisher.publish(eventType, JSON.stringify(event));
      console.log(`Event published: ${eventType}`, event.id);
    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }
  
  subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
      
      // Subscribe to Redis channel
      this.subscriber.subscribe(eventType);
    }
    
    this.handlers.get(eventType).push(handler);
  }
  
  start() {
    this.subscriber.on('message', async (channel, message) => {
      try {
        const event = JSON.parse(message);
        const handlers = this.handlers.get(channel) || [];
        
        // Process handlers in parallel
        await Promise.all(
          handlers.map(handler => this.executeHandler(handler, event))
        );
      } catch (error) {
        console.error('Error processing event:', error);
      }
    });
  }
  
  async executeHandler(handler, event) {
    try {
      await handler(event.data, event);
    } catch (error) {
      console.error(`Handler failed for event ${event.type}:`, error);
      
      // Implement dead letter queue or retry logic
      await this.handleFailedEvent(event, error);
    }
  }
  
  async handleFailedEvent(event, error) {
    // Send to dead letter queue for manual inspection
    await this.publisher.lpush('failed_events', JSON.stringify({
      event,
      error: error.message,
      failedAt: new Date().toISOString()
    }));
  }
}

// RabbitMQ implementation
const amqp = require('amqplib');

class RabbitMQEventBus {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.handlers = new Map();
  }
  
  async connect() {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      
      // Setup exchange
      await this.channel.assertExchange('events', 'topic', { durable: true });
      
      console.log('Connected to RabbitMQ');
    } catch (error) {
      console.error('RabbitMQ connection failed:', error);
      throw error;
    }
  }
  
  async publish(eventType, data) {
    const event = {
      id: require('crypto').randomUUID(),
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
      source: process.env.SERVICE_NAME
    };
    
    try {
      const message = Buffer.from(JSON.stringify(event));
      await this.channel.publish('events', eventType, message, {
        persistent: true,
        messageId: event.id,
        timestamp: Date.now()
      });
      
      console.log(`Event published: ${eventType}`, event.id);
    } catch (error) {
      console.error('Failed to publish event:', error);
      throw error;
    }
  }
  
  async subscribe(eventPattern, handler) {
    try {
      // Create queue for this service
      const queueName = `${process.env.SERVICE_NAME}.${eventPattern}`;
      await this.channel.assertQueue(queueName, { durable: true });
      
      // Bind queue to exchange with pattern
      await this.channel.bindQueue(queueName, 'events', eventPattern);
      
      // Consume messages
      await this.channel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            const event = JSON.parse(msg.content.toString());
            await handler(event.data, event);
            
            // Acknowledge message
            this.channel.ack(msg);
          } catch (error) {
            console.error('Handler failed:', error);
            
            // Reject and requeue with limit
            if (msg.properties.headers['x-retry-count'] < 3) {
              msg.properties.headers['x-retry-count'] = 
                (msg.properties.headers['x-retry-count'] || 0) + 1;
              
              this.channel.nack(msg, false, true);
            } else {
              // Send to dead letter queue
              this.channel.nack(msg, false, false);
            }
          }
        }
      });
      
      console.log(`Subscribed to pattern: ${eventPattern}`);
    } catch (error) {
      console.error('Subscription failed:', error);
      throw error;
    }
  }
}
```

### 3. gRPC Communication

```javascript
// Protocol Buffer definition (user.proto)
/*
syntax = "proto3";

package user;

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc CreateUser (CreateUserRequest) returns (User);
  rpc UpdateUser (UpdateUserRequest) returns (User);
  rpc DeleteUser (DeleteUserRequest) returns (DeleteUserResponse);
}

message User {
  string id = 1;
  string email = 2;
  string name = 3;
  string status = 4;
  int64 created_at = 5;
  int64 updated_at = 6;
}

message GetUserRequest {
  string id = 1;
}

message CreateUserRequest {
  string email = 1;
  string name = 2;
  string password = 3;
}

message UpdateUserRequest {
  string id = 1;
  string email = 2;
  string name = 3;
}

message DeleteUserRequest {
  string id = 1;
}

message DeleteUserResponse {
  bool success = 1;
}
*/

// gRPC Server implementation
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

class UserGRPCService {
  constructor(userRepository) {
    this.userRepository = userRepository;
    this.setupServer();
  }
  
  setupServer() {
    const packageDefinition = protoLoader.loadSync('./protos/user.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    
    const userProto = grpc.loadPackageDefinition(packageDefinition).user;
    
    this.server = new grpc.Server();
    this.server.addService(userProto.UserService.service, {
      getUser: this.getUser.bind(this),
      createUser: this.createUser.bind(this),
      updateUser: this.updateUser.bind(this),
      deleteUser: this.deleteUser.bind(this)
    });
  }
  
  async getUser(call, callback) {
    try {
      const { id } = call.request;
      const user = await this.userRepository.findById(id);
      
      if (!user) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'User not found'
        });
      }
      
      callback(null, {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        created_at: user.createdAt.getTime(),
        updated_at: user.updatedAt.getTime()
      });
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }
  
  async createUser(call, callback) {
    try {
      const { email, name, password } = call.request;
      
      const user = await this.userRepository.create({
        email,
        name,
        password
      });
      
      callback(null, {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        created_at: user.createdAt.getTime(),
        updated_at: user.updatedAt.getTime()
      });
    } catch (error) {
      callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: error.message
      });
    }
  }
  
  start(port) {
    this.server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          console.error('Failed to start gRPC server:', error);
          return;
        }
        
        console.log(`gRPC User Service running on port ${port}`);
        this.server.start();
      }
    );
  }
}

// gRPC Client
class UserGRPCClient {
  constructor(serviceUrl) {
    const packageDefinition = protoLoader.loadSync('./protos/user.proto');
    const userProto = grpc.loadPackageDefinition(packageDefinition).user;
    
    this.client = new userProto.UserService(
      serviceUrl,
      grpc.credentials.createInsecure()
    );
  }
  
  async getUser(id) {
    return new Promise((resolve, reject) => {
      this.client.getUser({ id }, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
  
  async createUser(userData) {
    return new Promise((resolve, reject) => {
      this.client.createUser(userData, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
}
```

## Service Discovery and Load Balancing

```javascript
// Service Registry
class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.startHealthChecks();
  }
  
  register(serviceName, instance) {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, new Map());
    }
    
    const instanceId = `${instance.host}:${instance.port}`;
    this.services.get(serviceName).set(instanceId, {
      ...instance,
      id: instanceId,
      registeredAt: new Date(),
      lastHealthCheck: new Date(),
      healthy: true
    });
    
    console.log(`Service registered: ${serviceName} - ${instanceId}`);
  }
  
  unregister(serviceName, instanceId) {
    if (this.services.has(serviceName)) {
      this.services.get(serviceName).delete(instanceId);
      console.log(`Service unregistered: ${serviceName} - ${instanceId}`);
    }
  }
  
  discover(serviceName) {
    const instances = this.services.get(serviceName);
    if (!instances) return [];
    
    // Return only healthy instances
    return Array.from(instances.values()).filter(instance => instance.healthy);
  }
  
  async startHealthChecks() {
    setInterval(async () => {
      for (const [serviceName, instances] of this.services) {
        for (const [instanceId, instance] of instances) {
          try {
            await this.checkHealth(instance);
            instance.healthy = true;
            instance.lastHealthCheck = new Date();
          } catch (error) {
            console.warn(`Health check failed for ${serviceName}:${instanceId}`, error.message);
            instance.healthy = false;
            
            // Remove instance after 3 failed checks
            if (Date.now() - instance.lastHealthCheck.getTime() > 90000) {
              this.unregister(serviceName, instanceId);
            }
          }
        }
      }
    }, this.healthCheckInterval);
  }
  
  async checkHealth(instance) {
    const response = await fetch(`http://${instance.host}:${instance.port}/health`, {
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    return true;
  }
}

// Load Balancer
class LoadBalancer {
  constructor(serviceRegistry) {
    this.serviceRegistry = serviceRegistry;
    this.roundRobinCounters = new Map();
  }
  
  getServiceInstance(serviceName, strategy = 'round-robin') {
    const instances = this.serviceRegistry.discover(serviceName);
    
    if (instances.length === 0) {
      throw new Error(`No healthy instances found for service: ${serviceName}`);
    }
    
    switch (strategy) {
      case 'round-robin':
        return this.roundRobin(serviceName, instances);
      case 'random':
        return this.random(instances);
      case 'least-connections':
        return this.leastConnections(instances);
      default:
        return this.roundRobin(serviceName, instances);
    }
  }
  
  roundRobin(serviceName, instances) {
    const counter = this.roundRobinCounters.get(serviceName) || 0;
    const instance = instances[counter % instances.length];
    this.roundRobinCounters.set(serviceName, counter + 1);
    return instance;
  }
  
  random(instances) {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }
  
  leastConnections(instances) {
    // Sort by connection count (assuming instances track this)
    return instances.sort((a, b) => 
      (a.activeConnections || 0) - (b.activeConnections || 0)
    )[0];
  }
}

// Service Discovery Client
class ServiceDiscoveryClient {
  constructor(registryUrl) {
    this.registryUrl = registryUrl;
    this.cache = new Map();
    this.cacheTTL = 30000; // 30 seconds
  }
  
  async discover(serviceName) {
    const cacheKey = serviceName;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.instances;
    }
    
    try {
      const response = await fetch(`${this.registryUrl}/services/${serviceName}`);
      const instances = await response.json();
      
      this.cache.set(cacheKey, {
        instances,
        timestamp: Date.now()
      });
      
      return instances;
    } catch (error) {
      console.error('Service discovery failed:', error);
      
      // Return cached instances if available
      if (cached) {
        return cached.instances;
      }
      
      throw error;
    }
  }
  
  async registerSelf(serviceName, instance) {
    try {
      await fetch(`${this.registryUrl}/services/${serviceName}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(instance)
      });
      
      console.log(`Registered with service discovery: ${serviceName}`);
    } catch (error) {
      console.error('Service registration failed:', error);
    }
  }
}
```

## API Gateway

```javascript
const express = require('express');
const httpProxy = require('http-proxy-middleware');

class APIGateway {
  constructor() {
    this.app = express();
    this.serviceRegistry = new ServiceRegistry();
    this.loadBalancer = new LoadBalancer(this.serviceRegistry);
    this.rateLimiters = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  setupMiddleware() {
    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
    
    // Authentication
    this.app.use('/api', this.authenticate.bind(this));
    
    // Rate limiting
    this.app.use('/api', this.rateLimit.bind(this));
  }
  
  async authenticate(req, res, next) {
    // Skip authentication for health checks
    if (req.path === '/health') {
      return next();
    }
    
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    
    try {
      // Validate token with auth service
      const authServiceInstance = this.loadBalancer.getServiceInstance('auth-service');
      const response = await fetch(`http://${authServiceInstance.host}:${authServiceInstance.port}/validate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      const user = await response.json();
      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication failed:', error);
      res.status(500).json({ error: 'Authentication service unavailable' });
    }
  }
  
  async rateLimit(req, res, next) {
    const key = req.user?.id || req.ip;
    const limiter = this.getRateLimiter(key);
    
    if (!limiter.isAllowed()) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    next();
  }
  
  getRateLimiter(key) {
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, new RateLimiter({
        windowMs: 60000, // 1 minute
        maxRequests: 100
      }));
    }
    
    return this.rateLimiters.get(key);
  }
  
  setupRoutes() {
    // Dynamic proxy routes
    this.app.use('/api/users', this.createProxy('user-service'));
    this.app.use('/api/orders', this.createProxy('order-service'));
    this.app.use('/api/payments', this.createProxy('payment-service'));
    this.app.use('/api/inventory', this.createProxy('inventory-service'));
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date() });
    });
    
    // Service discovery endpoint
    this.app.get('/services/:serviceName', (req, res) => {
      const instances = this.serviceRegistry.discover(req.params.serviceName);
      res.json(instances);
    });
  }
  
  createProxy(serviceName) {
    return httpProxy({
      target: 'http://placeholder', // Will be overridden
      changeOrigin: true,
      pathRewrite: {
        [`^/api/${serviceName.replace('-service', '')}`]: ''
      },
      router: (req) => {
        try {
          const instance = this.loadBalancer.getServiceInstance(serviceName);
          return `http://${instance.host}:${instance.port}`;
        } catch (error) {
          console.error(`Service ${serviceName} not available:`, error);
          return null;
        }
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(503).json({ 
          error: 'Service temporarily unavailable',
          service: serviceName 
        });
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add headers for tracing
        proxyReq.setHeader('X-Gateway-Request-ID', this.generateRequestId());
        proxyReq.setHeader('X-User-ID', req.user?.id || 'anonymous');
      },
      onProxyRes: (proxyRes, req, res) => {
        // Add response headers
        proxyRes.headers['X-Gateway'] = 'api-gateway';
        proxyRes.headers['X-Service'] = serviceName;
      }
    });
  }
  
  generateRequestId() {
    return require('crypto').randomUUID();
  }
  
  start(port) {
    this.app.listen(port, () => {
      console.log(`API Gateway running on port ${port}`);
    });
  }
}

// Rate limiter implementation
class RateLimiter {
  constructor(options) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.requests = [];
  }
  
  isAllowed() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove old requests
    this.requests = this.requests.filter(time => time > windowStart);
    
    // Check if under limit
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }
}
```

## Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 30000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    
    this.startMonitoring();
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log('Circuit breaker moved to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result