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
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      // Require multiple successes to fully recover
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        console.log('Circuit breaker moved to CLOSED state');
      }
    }
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log('Circuit breaker moved to OPEN state');
    }
  }
  
  startMonitoring() {
    setInterval(() => {
      console.log(`Circuit Breaker Status: ${this.state}, Failures: ${this.failureCount}`);
    }, this.monitoringPeriod);
  }
  
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

// Enhanced service client with circuit breaker
class ResilientServiceClient {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.serviceDiscovery = new ServiceDiscoveryClient(options.registryUrl);
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.retryPolicy = options.retryPolicy || { maxRetries: 3, backoffMs: 1000 };
    this.timeout = options.timeout || 5000;
  }
  
  async request(method, path, data = null) {
    return await this.circuitBreaker.execute(async () => {
      return await this.executeWithRetry(async () => {
        const instance = await this.getServiceInstance();
        return await this.makeRequest(instance, method, path, data);
      });
    });
  }
  
  async getServiceInstance() {
    const instances = await this.serviceDiscovery.discover(this.serviceName);
    
    if (instances.length === 0) {
      throw new Error(`No instances available for service: ${this.serviceName}`);
    }
    
    // Simple round-robin selection
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }
  
  async executeWithRetry(operation) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryPolicy.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        if (attempt < this.retryPolicy.maxRetries) {
          const delay = this.retryPolicy.backoffMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  async makeRequest(instance, method, path, data) {
    const url = `http://${instance.host}:${instance.port}${path}`;
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
        throw new ServiceError(`HTTP ${response.status}`, response.status);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new ServiceError('Request timeout', 408);
      }
      
      throw error;
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  generateRequestId() {
    return require('crypto').randomUUID();
  }
}
```

## Data Management in Microservices

### Database per Service Pattern

```javascript
// User Service Database
class UserDatabase {
  constructor() {
    this.pool = new Pool({
      host: process.env.USER_DB_HOST,
      database: 'users_db',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
  }
  
  async createUser(userData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create user
      const userResult = await client.query(
        'INSERT INTO users (email, name, password) VALUES ($1, $2, $3) RETURNING *',
        [userData.email, userData.name, userData.password]
      );
      
      const user = userResult.rows[0];
      
      // Create user profile
      await client.query(
        'INSERT INTO user_profiles (user_id, bio, avatar) VALUES ($1, $2, $3)',
        [user.id, userData.bio || '', userData.avatar || '']
      );
      
      await client.query('COMMIT');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Order Service Database
class OrderDatabase {
  constructor() {
    this.pool = new Pool({
      host: process.env.ORDER_DB_HOST,
      database: 'orders_db',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
  }
  
  async createOrder(orderData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create order
      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING *',
        [orderData.userId, orderData.totalAmount, 'pending']
      );
      
      const order = orderResult.rows[0];
      
      // Create order items
      for (const item of orderData.items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
          [order.id, item.productId, item.quantity, item.price]
        );
      }
      
      await client.query('COMMIT');
      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

### Saga Pattern for Distributed Transactions

```javascript
// Saga Orchestrator
class OrderSaga {
  constructor(services, eventBus) {
    this.userService = services.userService;
    this.inventoryService = services.inventoryService;
    this.paymentService = services.paymentService;
    this.orderService = services.orderService;
    this.eventBus = eventBus;
  }
  
  async processOrder(orderData) {
    const sagaId = require('crypto').randomUUID();
    const steps = [];
    
    try {
      // Step 1: Validate user
      console.log(`[${sagaId}] Step 1: Validating user`);
      const user = await this.userService.getUser(orderData.userId);
      steps.push({ step: 'validate_user', success: true, data: user });
      
      // Step 2: Reserve inventory
      console.log(`[${sagaId}] Step 2: Reserving inventory`);
      const reservation = await this.inventoryService.reserveItems(orderData.items);
      steps.push({ step: 'reserve_inventory', success: true, data: reservation });
      
      // Step 3: Process payment
      console.log(`[${sagaId}] Step 3: Processing payment`);
      const payment = await this.paymentService.processPayment({
        userId: orderData.userId,
        amount: orderData.totalAmount,
        orderId: sagaId
      });
      steps.push({ step: 'process_payment', success: true, data: payment });
      
      // Step 4: Create order
      console.log(`[${sagaId}] Step 4: Creating order`);
      const order = await this.orderService.createOrder({
        ...orderData,
        sagaId,
        paymentId: payment.id,
        reservationId: reservation.id
      });
      steps.push({ step: 'create_order', success: true, data: order });
      
      // Step 5: Confirm inventory reservation
      console.log(`[${sagaId}] Step 5: Confirming inventory`);
      await this.inventoryService.confirmReservation(reservation.id);
      steps.push({ step: 'confirm_inventory', success: true });
      
      // Publish success event
      await this.eventBus.publish('order.saga.completed', {
        sagaId,
        orderId: order.id,
        steps
      });
      
      return order;
      
    } catch (error) {
      console.error(`[${sagaId}] Saga failed at step ${steps.length + 1}:`, error);
      
      // Compensate (rollback) completed steps
      await this.compensate(sagaId, steps);
      
      // Publish failure event
      await this.eventBus.publish('order.saga.failed', {
        sagaId,
        error: error.message,
        steps
      });
      
      throw error;
    }
  }
  
  async compensate(sagaId, completedSteps) {
    console.log(`[${sagaId}] Starting compensation for ${completedSteps.length} steps`);
    
    // Compensate in reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const step = completedSteps[i];
      
      try {
        await this.compensateStep(sagaId, step);
        console.log(`[${sagaId}] Compensated step: ${step.step}`);
      } catch (error) {
        console.error(`[${sagaId}] Compensation failed for step ${step.step}:`, error);
        // Continue with other compensations
      }
    }
  }
  
  async compensateStep(sagaId, step) {
    switch (step.step) {
      case 'reserve_inventory':
        await this.inventoryService.cancelReservation(step.data.id);
        break;
        
      case 'process_payment':
        await this.paymentService.refundPayment(step.data.id);
        break;
        
      case 'create_order':
        await this.orderService.cancelOrder(step.data.id);
        break;
        
      case 'confirm_inventory':
        // This is complex - may need to create new reservation to cancel
        await this.inventoryService.restoreItems(step.data.items);
        break;
        
      default:
        console.log(`No compensation needed for step: ${step.step}`);
    }
  }
}

// Event-driven Saga (Choreography)
class EventDrivenSaga {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.sagaStates = new Map(); // In production, use persistent storage
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.eventBus.subscribe('order.created', this.handleOrderCreated.bind(this));
    this.eventBus.subscribe('inventory.reserved', this.handleInventoryReserved.bind(this));
    this.eventBus.subscribe('inventory.reservation.failed', this.handleInventoryFailed.bind(this));
    this.eventBus.subscribe('payment.processed', this.handlePaymentProcessed.bind(this));
    this.eventBus.subscribe('payment.failed', this.handlePaymentFailed.bind(this));
  }
  
  async handleOrderCreated(orderData) {
    const sagaId = orderData.orderId;
    
    this.sagaStates.set(sagaId, {
      orderId: orderData.orderId,
      userId: orderData.userId,
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      step: 'order_created',
      createdAt: new Date()
    });
    
    // Trigger inventory reservation
    await this.eventBus.publish('inventory.reserve', {
      sagaId,
      orderId: orderData.orderId,
      items: orderData.items
    });
  }
  
  async handleInventoryReserved(data) {
    const saga = this.sagaStates.get(data.sagaId);
    if (!saga) return;
    
    saga.step = 'inventory_reserved';
    saga.reservationId = data.reservationId;
    
    // Trigger payment processing
    await this.eventBus.publish('payment.process', {
      sagaId: data.sagaId,
      orderId: saga.orderId,
      userId: saga.userId,
      amount: saga.totalAmount
    });
  }
  
  async handleInventoryFailed(data) {
    const saga = this.sagaStates.get(data.sagaId);
    if (!saga) return;
    
    // Cancel order
    await this.eventBus.publish('order.cancel', {
      orderId: saga.orderId,
      reason: 'Inventory not available'
    });
    
    this.sagaStates.delete(data.sagaId);
  }
  
  async handlePaymentProcessed(data) {
    const saga = this.sagaStates.get(data.sagaId);
    if (!saga) return;
    
    saga.step = 'payment_processed';
    saga.paymentId = data.paymentId;
    
    // Confirm order and inventory
    await this.eventBus.publish('order.confirm', {
      orderId: saga.orderId,
      paymentId: data.paymentId
    });
    
    await this.eventBus.publish('inventory.confirm', {
      reservationId: saga.reservationId
    });
    
    this.sagaStates.delete(data.sagaId);
  }
  
  async handlePaymentFailed(data) {
    const saga = this.sagaStates.get(data.sagaId);
    if (!saga) return;
    
    // Cancel reservation and order
    await this.eventBus.publish('inventory.cancel', {
      reservationId: saga.reservationId
    });
    
    await this.eventBus.publish('order.cancel', {
      orderId: saga.orderId,
      reason: 'Payment failed'
    });
    
    this.sagaStates.delete(data.sagaId);
  }
}
```

## Monitoring and Observability

```javascript
// Distributed Tracing
const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

class DistributedTracing {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.setupTracing();
  }
  
  setupTracing() {
    const provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
      }),
    });
    
    provider.register();
    this.tracer = opentelemetry.trace.getTracer(this.serviceName);
  }
  
  traceRequest(operationName, req, res, next) {
    const span = this.tracer.startSpan(operationName, {
      kind: opentelemetry.SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.user_agent': req.get('User-Agent'),
        'user.id': req.user?.id
      }
    });
    
    // Add span to request context
    req.span = span;
    
    // Override res.end to finish span
    const originalEnd = res.end;
    res.end = function(...args) {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_size': res.get('content-length') || 0
      });
      
      if (res.statusCode >= 400) {
        span.recordException(new Error(`HTTP ${res.statusCode}`));
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`
        });
      }
      
      span.end();
      originalEnd.apply(this, args);
    };
    
    next();
  }
  
  traceServiceCall(serviceName, operation, fn) {
    return async (...args) => {
      const span = this.tracer.startSpan(`${serviceName}.${operation}`, {
        kind: opentelemetry.SpanKind.CLIENT,
        attributes: {
          'service.name': serviceName,
          'operation.name': operation
        }
      });
      
      try {
        const result = await fn(...args);
        span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    };
  }
}

// Metrics Collection
class MetricsCollector {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.metrics = {
      requestCount: 0,
      responseTime: [],
      errorCount: 0,
      activeConnections: 0
    };
    
    this.startCollection();
  }
  
  recordRequest(req, res, responseTime) {
    this.metrics.requestCount++;
    this.metrics.responseTime.push(responseTime);
    
    // Keep only last 1000 response times
    if (this.metrics.responseTime.length > 1000) {
      this.metrics.responseTime.shift();
    }
    
    if (res.statusCode >= 400) {
      this.metrics.errorCount++;
    }
  }
  
  incrementConnections() {
    this.metrics.activeConnections++;
  }
  
  decrementConnections() {
    this.metrics.activeConnections--;
  }
  
  getMetrics() {
    const responseTime = this.metrics.responseTime;
    const avgResponseTime = responseTime.length > 0 
      ? responseTime.reduce((a, b) => a + b, 0) / responseTime.length 
      : 0;
    
    const p95ResponseTime = responseTime.length > 0
      ? responseTime.sort((a, b) => a - b)[Math.floor(responseTime.length * 0.95)]
      : 0;
    
    return {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      requests: {
        total: this.metrics.requestCount,
        errors: this.metrics.errorCount,
        errorRate: this.metrics.requestCount > 0 
          ? (this.metrics.errorCount / this.metrics.requestCount * 100).toFixed(2) + '%' 
          : '0%'
      },
      responseTime: {
        average: avgResponseTime.toFixed(2) + 'ms',
        p95: p95ResponseTime.toFixed(2) + 'ms'
      },
      connections: this.metrics.activeConnections
    };
  }
  
  startCollection() {
    // Export metrics every 30 seconds
    setInterval(() => {
      const metrics = this.getMetrics();
      console.log('📊 Metrics:', metrics);
      
      // Send to metrics aggregation service
      this.exportMetrics(metrics);
    }, 30000);
  }
  
  async exportMetrics(metrics) {
    try {
      // Send to Prometheus, DataDog, or other monitoring system
      await fetch(process.env.METRICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
    } catch (error) {
      console.error('Failed to export metrics:', error);
    }
  }
  
  // Middleware for Express
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      this.incrementConnections();
      
      res.on('finish', () => {
        const responseTime = Date.now() - start;
        this.recordRequest(req, res, responseTime);
        this.decrementConnections();
      });
      
      next();
    };
  }
}

// Health Check System
class HealthCheckManager {
  constructor() {
    this.checks = new Map();
    this.dependencies = [];
  }
  
  addCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      check: checkFunction,
      timeout: options.timeout || 5000,
      critical: options.critical !== false
    });
  }
  
  addDependency(serviceName, healthUrl) {
    this.dependencies.push({ serviceName, healthUrl });
  }
  
  async runHealthChecks() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
      dependencies: {}
    };
    
    // Run internal health checks
    for (const [name, config] of this.checks) {
      try {
        const checkPromise = config.check();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), config.timeout)
        );
        
        await Promise.race([checkPromise, timeoutPromise]);
        
        results.checks[name] = {
          status: 'healthy',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        results.checks[name] = {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        if (config.critical) {
          results.status = 'unhealthy';
        }
      }
    }
    
    // Check dependencies
    await Promise.all(
      this.dependencies.map(async (dep) => {
        try {
          const response = await fetch(dep.healthUrl, { timeout: 3000 });
          
          results.dependencies[dep.serviceName] = {
            status: response.ok ? 'healthy' : 'unhealthy',
            statusCode: response.status,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          results.dependencies[dep.serviceName] = {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      })
    );
    
    return results;
  }
  
  createHealthEndpoint() {
    return async (req, res) => {
      try {
        const health = await this.runHealthChecks();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }
}
```

## Container Orchestration with Docker and Kubernetes

```dockerfile
# Dockerfile for Node.js microservice
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["node", "app.js"]
```

```yaml
# Kubernetes deployment manifest
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: user-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: user-service-secrets
              key: db-host
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: user-service-secrets
              key: db-password
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: user-service-config
data:
  LOG_LEVEL: "info"
  CACHE_TTL: "3600"
  MAX_CONNECTIONS: "100"

---
apiVersion: v1
kind: Secret
metadata:
  name: user-service-secrets
type: Opaque
data:
  db-host: <base64-encoded-host>
  db-password: <base64-encoded-password>
  jwt-secret: <base64-encoded-jwt-secret>
```

## Best Practices Summary

### ✅ Microservices Best Practices:

```javascript
// 1. Single Responsibility Principle
class UserService {
  // Only handles user-related operations
  async createUser(userData) { /* ... */ }
  async getUser(id) { /* ... */ }
  async updateUser(id, data) { /* ... */ }
}

// 2. Database per Service
// Each service has its own database
const userDb = new UserDatabase();
const orderDb = new OrderDatabase();

// 3. API Versioning
app.use('/api/v1/users', userRoutesV1);
app.use('/api/v2/users', userRoutesV2);

// 4. Circuit Breaker Pattern
const userServiceClient = new ResilientServiceClient('user-service', {
  circuitBreaker: { failureThreshold: 5, recoveryTimeout: 30000 }
});

// 5. Event-Driven Communication
eventBus.publish('user.created', userData);
eventBus.subscribe('order.created', handleOrderCreated);
```

### ❌ Common Pitfalls:

```javascript
// 1. ❌ Distributed Monolith
// Services that are too tightly coupled
await userService.createUser(data);
await profileService.createProfile(data); // Direct coupling
await notificationService.sendWelcome(data); // Chain of dependencies

// 2. ❌ Shared Database
// Multiple services accessing the same database
const sharedDb = new Database(); // AVOID THIS

// 3. ❌ Synchronous Communication Everywhere
// Over-reliance on synchronous calls
const user = await userService.getUser(id); // Can create cascade failures
const orders = await orderService.getUserOrders(id);
const payments = await paymentService.getUserPayments(id);

// 4. ❌ No Error Handling
await externalService.call(); // What if it fails?

// 5. ❌ Missing Monitoring
// No observability into system behavior
```

Microservices architecture enables scalability and maintainability but requires careful design, robust error handling, and comprehensive monitoring to be successful in production environments!