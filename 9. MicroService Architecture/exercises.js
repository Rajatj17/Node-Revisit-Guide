// Node.js Microservices Architecture Exercises

const http = require('http');
const { EventEmitter } = require('events');

console.log('=== NODE.JS MICROSERVICES ARCHITECTURE EXERCISES ===\n');

// EXERCISE 1: Service Discovery and Registry
console.log('Exercise 1: Service Discovery and Registry Implementation');

class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.healthChecks = new Map();
    this.eventEmitter = new EventEmitter();
  }
  
  // Register a service
  register(serviceName, serviceInstance) {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, new Set());
    }
    
    const serviceId = `${serviceName}-${serviceInstance.id || Date.now()}`;
    const serviceEntry = {
      id: serviceId,
      name: serviceName,
      host: serviceInstance.host,
      port: serviceInstance.port,
      metadata: serviceInstance.metadata || {},
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      healthy: true
    };
    
    this.services.get(serviceName).add(serviceEntry);
    
    // Set up health check
    this.setupHealthCheck(serviceEntry);
    
    console.log(`✅ Registered service: ${serviceId} at ${serviceEntry.host}:${serviceEntry.port}`);
    this.eventEmitter.emit('serviceRegistered', serviceEntry);
    
    return serviceId;
  }
  
  // Deregister a service
  deregister(serviceName, serviceId) {
    const serviceSet = this.services.get(serviceName);
    if (!serviceSet) return false;
    
    const service = Array.from(serviceSet).find(s => s.id === serviceId);
    if (service) {
      serviceSet.delete(service);
      this.clearHealthCheck(serviceId);
      console.log(`❌ Deregistered service: ${serviceId}`);
      this.eventEmitter.emit('serviceDeregistered', service);
      return true;
    }
    return false;
  }
  
  // Discover services by name
  discover(serviceName) {
    const serviceSet = this.services.get(serviceName);
    if (!serviceSet) return [];
    
    // Return only healthy services
    return Array.from(serviceSet).filter(service => service.healthy);
  }
  
  // Get a service instance using load balancing
  getServiceInstance(serviceName, strategy = 'round-robin') {
    const availableServices = this.discover(serviceName);
    if (availableServices.length === 0) {
      throw new Error(`No healthy instances found for service: ${serviceName}`);
    }
    
    switch (strategy) {
      case 'round-robin':
        return this.roundRobinSelection(serviceName, availableServices);
      case 'random':
        return availableServices[Math.floor(Math.random() * availableServices.length)];
      case 'least-connections':
        return availableServices.reduce((least, current) => 
          (current.connections || 0) < (least.connections || 0) ? current : least
        );
      default:
        return availableServices[0];
    }
  }
  
  roundRobinSelection(serviceName, services) {
    if (!this.roundRobinIndex) {
      this.roundRobinIndex = new Map();
    }
    
    const currentIndex = this.roundRobinIndex.get(serviceName) || 0;
    const nextIndex = (currentIndex + 1) % services.length;
    this.roundRobinIndex.set(serviceName, nextIndex);
    
    return services[currentIndex];
  }
  
  // Health check setup
  setupHealthCheck(service) {
    const healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.performHealthCheck(service);
        service.healthy = isHealthy;
        service.lastHeartbeat = new Date();
        
        if (!isHealthy) {
          console.log(`⚠️  Service ${service.id} failed health check`);
          this.eventEmitter.emit('serviceUnhealthy', service);
        }
      } catch (error) {
        service.healthy = false;
        console.log(`❌ Health check error for ${service.id}:`, error.message);
      }
    }, 5000); // Check every 5 seconds
    
    this.healthChecks.set(service.id, healthCheckInterval);
  }
  
  async performHealthCheck(service) {
    // Simulate health check HTTP request
    return new Promise((resolve) => {
      // Simulate random health check results
      const isHealthy = Math.random() > 0.1; // 90% success rate
      setTimeout(() => resolve(isHealthy), 100);
    });
  }
  
  clearHealthCheck(serviceId) {
    const interval = this.healthChecks.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(serviceId);
    }
  }
  
  // Get registry status
  getStatus() {
    const status = {};
    for (const [serviceName, serviceSet] of this.services) {
      const services = Array.from(serviceSet);
      status[serviceName] = {
        totalInstances: services.length,
        healthyInstances: services.filter(s => s.healthy).length,
        instances: services.map(s => ({
          id: s.id,
          host: s.host,
          port: s.port,
          healthy: s.healthy,
          lastHeartbeat: s.lastHeartbeat
        }))
      };
    }
    return status;
  }
}

// Test service registry
function testServiceRegistry() {
  const registry = new ServiceRegistry();
  
  // Register services
  console.log('--- Registering Services ---');
  
  // User service instances
  registry.register('user-service', {
    id: 'user-1',
    host: '192.168.1.10',
    port: 3001,
    metadata: { version: '1.0.0', region: 'us-west' }
  });
  
  registry.register('user-service', {
    id: 'user-2', 
    host: '192.168.1.11',
    port: 3001,
    metadata: { version: '1.0.0', region: 'us-east' }
  });
  
  // Order service instances
  registry.register('order-service', {
    id: 'order-1',
    host: '192.168.1.20',
    port: 3002,
    metadata: { version: '2.1.0' }
  });
  
  registry.register('order-service', {
    id: 'order-2',
    host: '192.168.1.21', 
    port: 3002,
    metadata: { version: '2.1.0' }
  });
  
  // Test service discovery
  console.log('\n--- Service Discovery ---');
  const userServices = registry.discover('user-service');
  console.log('Available user services:', userServices.length);
  
  // Test load balancing
  console.log('\n--- Load Balancing Test ---');
  for (let i = 0; i < 4; i++) {
    const service = registry.getServiceInstance('user-service', 'round-robin');
    console.log(`Request ${i + 1} routed to: ${service.id} (${service.host}:${service.port})`);
  }
  
  // Show registry status
  setTimeout(() => {
    console.log('\n--- Registry Status ---');
    console.table(registry.getStatus());
  }, 1000);
  
  // Listen for service events
  registry.eventEmitter.on('serviceUnhealthy', (service) => {
    console.log(`🚨 Service ${service.id} is unhealthy - implementing failover...`);
  });
  
  return registry;
}

const registry = testServiceRegistry();

setTimeout(() => {
  console.log('\n--- Separator ---\n');
  exerciseTwo();
}, 3000);

// EXERCISE 2: Inter-Service Communication Patterns
function exerciseTwo() {
  console.log('Exercise 2: Inter-Service Communication Patterns');
  
  // HTTP-based synchronous communication
  class HTTPServiceClient {
    constructor(serviceName, registry) {
      this.serviceName = serviceName;
      this.registry = registry;
      this.circuitBreaker = new CircuitBreaker();
    }
    
    async request(method, path, data = null) {
      // Get service instance from registry
      const service = this.registry.getServiceInstance(this.serviceName);
      const url = `http://${service.host}:${service.port}${path}`;
      
      return await this.circuitBreaker.execute(async () => {
        console.log(`📡 ${method} request to ${this.serviceName}: ${url}`);
        
        // Simulate HTTP request
        const response = await this.simulateHTTPRequest(method, url, data);
        
        console.log(`📨 Response from ${this.serviceName}:`, response.status, response.data);
        return response;
      });
    }
    
    async simulateHTTPRequest(method, url, data) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      // Simulate occasional failures
      if (Math.random() < 0.1) {
        throw new Error('Service temporarily unavailable');
      }
      
      return {
        status: 200,
        data: { 
          message: 'Success',
          service: this.serviceName,
          timestamp: Date.now(),
          requestData: data 
        }
      };
    }
  }
  
  // Circuit Breaker Pattern
  class CircuitBreaker {
    constructor(threshold = 3, timeout = 10000) {
      this.threshold = threshold;
      this.timeout = timeout;
      this.failureCount = 0;
      this.lastFailureTime = null;
      this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }
    
    async execute(fn) {
      if (this.state === 'OPEN') {
        if (Date.now() - this.lastFailureTime > this.timeout) {
          this.state = 'HALF_OPEN';
          console.log('🔄 Circuit breaker: HALF_OPEN - trying request');
        } else {
          throw new Error('Circuit breaker is OPEN - request rejected');
        }
      }
      
      try {
        const result = await fn();
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
      if (this.state === 'HALF_OPEN') {
        console.log('✅ Circuit breaker: CLOSED - service recovered');
      }
    }
    
    onFailure() {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN';
        console.log(`🔴 Circuit breaker: OPEN - too many failures (${this.failureCount})`);
      }
    }
  }
  
  // Message Queue for asynchronous communication
  class MessageQueue extends EventEmitter {
    constructor() {
      super();
      this.queues = new Map();
      this.subscribers = new Map();
    }
    
    // Publish message to queue
    publish(queueName, message) {
      if (!this.queues.has(queueName)) {
        this.queues.set(queueName, []);
      }
      
      const enrichedMessage = {
        ...message,
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        queueName
      };
      
      this.queues.get(queueName).push(enrichedMessage);
      console.log(`📤 Published message to ${queueName}:`, enrichedMessage.type || 'message');
      
      // Notify subscribers
      this.emit('message', queueName, enrichedMessage);
      
      return enrichedMessage.id;
    }
    
    // Subscribe to queue
    subscribe(queueName, callback) {
      if (!this.subscribers.has(queueName)) {
        this.subscribers.set(queueName, new Set());
      }
      
      this.subscribers.get(queueName).add(callback);
      console.log(`📥 Subscribed to queue: ${queueName}`);
      
      // Process existing messages
      const existingMessages = this.queues.get(queueName) || [];
      existingMessages.forEach(message => {
        try {
          callback(message);
        } catch (error) {
          console.error(`Error processing message:`, error.message);
        }
      });
      
      // Listen for new messages
      this.on('message', (targetQueue, message) => {
        if (targetQueue === queueName) {
          try {
            callback(message);
          } catch (error) {
            console.error(`Error processing message:`, error.message);
          }
        }
      });
    }
    
    // Get queue status
    getQueueStatus(queueName) {
      const messages = this.queues.get(queueName) || [];
      const subscriberCount = this.subscribers.get(queueName)?.size || 0;
      
      return {
        queueName,
        messageCount: messages.length,
        subscriberCount,
        oldestMessage: messages[0]?.timestamp,
        newestMessage: messages[messages.length - 1]?.timestamp
      };
    }
  }
  
  // Test inter-service communication
  async function testInterServiceCommunication() {
    console.log('--- Testing HTTP Communication ---');
    
    const userServiceClient = new HTTPServiceClient('user-service', registry);
    const orderServiceClient = new HTTPServiceClient('order-service', registry);
    
    try {
      // Test successful requests
      await userServiceClient.request('GET', '/api/users/123');
      await orderServiceClient.request('POST', '/api/orders', { 
        userId: 123, 
        items: ['item1', 'item2'] 
      });
      
      // Test circuit breaker with multiple failures
      console.log('\n--- Testing Circuit Breaker ---');
      for (let i = 0; i < 5; i++) {
        try {
          // This will eventually trigger circuit breaker
          await userServiceClient.request('GET', '/api/users/error');
        } catch (error) {
          console.log(`Request ${i + 1} failed:`, error.message);
        }
      }
      
    } catch (error) {
      console.log('Communication error:', error.message);
    }
    
    console.log('\n--- Testing Asynchronous Communication ---');
    
    const messageQueue = new MessageQueue();
    
    // Set up subscribers
    messageQueue.subscribe('user.events', (message) => {
      console.log(`👤 User service received: ${message.type} for user ${message.userId}`);
    });
    
    messageQueue.subscribe('order.events', (message) => {
      console.log(`📦 Order service received: ${message.type} for order ${message.orderId}`);
    });
    
    messageQueue.subscribe('notification.events', (message) => {
      console.log(`📧 Notification service received: ${message.type} - ${message.message}`);
    });
    
    // Simulate event-driven communication
    setTimeout(() => {
      messageQueue.publish('user.events', {
        type: 'user.created',
        userId: 123,
        userData: { name: 'John Doe', email: 'john@example.com' }
      });
    }, 500);
    
    setTimeout(() => {
      messageQueue.publish('order.events', {
        type: 'order.placed',
        orderId: 456,
        userId: 123,
        orderData: { total: 99.99, items: ['item1', 'item2'] }
      });
    }, 1000);
    
    setTimeout(() => {
      messageQueue.publish('notification.events', {
        type: 'email.send',
        userId: 123,
        message: 'Your order has been placed successfully'
      });
    }, 1500);
    
    // Show queue status
    setTimeout(() => {
      console.log('\n--- Queue Status ---');
      console.table([
        messageQueue.getQueueStatus('user.events'),
        messageQueue.getQueueStatus('order.events'),
        messageQueue.getQueueStatus('notification.events')
      ]);
    }, 2000);
  }
  
  testInterServiceCommunication().then(() => {
    setTimeout(() => exerciseThree(), 3000);
  });
}

// EXERCISE 3: API Gateway Implementation
function exerciseThree() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 3: API Gateway Implementation');
  
  class APIGateway {
    constructor(serviceRegistry) {
      this.serviceRegistry = serviceRegistry;
      this.routes = new Map();
      this.middleware = [];
      this.rateLimiter = new Map(); // clientId -> request counts
      this.authCache = new Map(); // token -> user info
    }
    
    // Define route mappings
    addRoute(pattern, serviceName, options = {}) {
      this.routes.set(pattern, {
        serviceName,
        transformRequest: options.transformRequest,
        transformResponse: options.transformResponse,
        requireAuth: options.requireAuth || false,
        rateLimit: options.rateLimit || { requests: 100, window: 60000 }
      });
      
      console.log(`📍 Route added: ${pattern} -> ${serviceName}`);
    }
    
    // Add middleware
    use(middleware) {
      this.middleware.push(middleware);
    }
    
    // Handle incoming requests
    async handleRequest(request) {
      const startTime = Date.now();
      
      try {
        // Apply middleware
        for (const middleware of this.middleware) {
          request = await middleware(request);
        }
        
        // Find matching route
        const route = this.findRoute(request.path);
        if (!route) {
          return this.createErrorResponse(404, 'Route not found');
        }
        
        // Check authentication
        if (route.requireAuth && !await this.authenticate(request)) {
          return this.createErrorResponse(401, 'Authentication required');
        }
        
        // Check rate limiting
        if (!this.checkRateLimit(request.clientId, route.rateLimit)) {
          return this.createErrorResponse(429, 'Rate limit exceeded');
        }
        
        // Transform request if needed
        if (route.transformRequest) {
          request = await route.transformRequest(request);
        }
        
        // Forward to service
        const response = await this.forwardToService(route.serviceName, request);
        
        // Transform response if needed
        const finalResponse = route.transformResponse 
          ? await route.transformResponse(response)
          : response;
        
        // Add gateway metadata
        finalResponse.metadata = {
          gateway: 'api-gateway-v1',
          processingTime: Date.now() - startTime,
          service: route.serviceName,
          timestamp: new Date()
        };
        
        console.log(`✅ Request processed in ${Date.now() - startTime}ms: ${request.method} ${request.path}`);
        return finalResponse;
        
      } catch (error) {
        console.error(`❌ Request failed: ${error.message}`);
        return this.createErrorResponse(500, 'Internal server error', error.message);
      }
    }
    
    findRoute(path) {
      for (const [pattern, route] of this.routes) {
        if (this.matchPattern(pattern, path)) {
          return route;
        }
      }
      return null;
    }
    
    matchPattern(pattern, path) {
      // Simple pattern matching (could be more sophisticated)
      const patternRegex = pattern.replace(/\*/g, '.*').replace(/:\w+/g, '[^/]+');
      return new RegExp(`^${patternRegex}$`).test(path);
    }
    
    async authenticate(request) {
      const token = request.headers?.authorization?.replace('Bearer ', '');
      if (!token) return false;
      
      // Check auth cache first
      if (this.authCache.has(token)) {
        request.user = this.authCache.get(token);
        return true;
      }
      
      // Simulate authentication service call
      try {
        const user = await this.validateToken(token);
        this.authCache.set(token, user);
        request.user = user;
        return true;
      } catch (error) {
        return false;
      }
    }
    
    async validateToken(token) {
      // Simulate token validation
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (token === 'valid-token') {
        return { id: 123, name: 'John Doe', role: 'user' };
      }
      throw new Error('Invalid token');
    }
    
    checkRateLimit(clientId, rateLimit) {
      const now = Date.now();
      const windowStart = now - rateLimit.window;
      
      if (!this.rateLimiter.has(clientId)) {
        this.rateLimiter.set(clientId, []);
      }
      
      const requests = this.rateLimiter.get(clientId);
      
      // Remove old requests outside the window
      const validRequests = requests.filter(time => time > windowStart);
      
      if (validRequests.length >= rateLimit.requests) {
        return false;
      }
      
      // Add current request
      validRequests.push(now);
      this.rateLimiter.set(clientId, validRequests);
      
      return true;
    }
    
    async forwardToService(serviceName, request) {
      const service = this.serviceRegistry.getServiceInstance(serviceName);
      
      console.log(`🔀 Forwarding to ${serviceName} at ${service.host}:${service.port}`);
      
      // Simulate service call
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
      
      return {
        status: 200,
        data: {
          message: `Response from ${serviceName}`,
          requestId: Date.now(),
          service: serviceName,
          processedAt: service.host + ':' + service.port
        }
      };
    }
    
    createErrorResponse(status, message, details = null) {
      return {
        status,
        error: {
          message,
          details,
          timestamp: new Date(),
          gateway: 'api-gateway-v1'
        }
      };
    }
  }
  
  // Test API Gateway
  async function testAPIGateway() {
    const gateway = new APIGateway(registry);
    
    console.log('--- Setting up API Gateway ---');
    
    // Add routes
    gateway.addRoute('/api/users/*', 'user-service', {
      requireAuth: true,
      rateLimit: { requests: 10, window: 60000 },
      transformResponse: async (response) => {
        response.data.enhanced = true;
        return response;
      }
    });
    
    gateway.addRoute('/api/orders/*', 'order-service', {
      requireAuth: true,
      rateLimit: { requests: 20, window: 60000 }
    });
    
    gateway.addRoute('/api/health', 'user-service', {
      requireAuth: false,
      rateLimit: { requests: 100, window: 60000 }
    });
    
    // Add logging middleware
    gateway.use(async (request) => {
      console.log(`📨 Incoming request: ${request.method} ${request.path}`);
      return request;
    });
    
    // Test requests
    const testRequests = [
      {
        method: 'GET',
        path: '/api/users/123',
        clientId: 'client-1',
        headers: { authorization: 'Bearer valid-token' }
      },
      {
        method: 'GET',
        path: '/api/users/456',
        clientId: 'client-1',
        headers: { authorization: 'Bearer invalid-token' }
      },
      {
        method: 'POST',
        path: '/api/orders',
        clientId: 'client-2',
        headers: { authorization: 'Bearer valid-token' },
        body: { items: ['item1', 'item2'] }
      },
      {
        method: 'GET',
        path: '/api/health',
        clientId: 'client-3'
      },
      {
        method: 'GET',
        path: '/api/nonexistent',
        clientId: 'client-1',
        headers: { authorization: 'Bearer valid-token' }
      }
    ];
    
    console.log('\n--- Processing Requests ---');
    
    for (const request of testRequests) {
      const response = await gateway.handleRequest(request);
      console.log(`Response: ${response.status} - ${response.data?.message || response.error?.message}\n`);
    }
    
    // Test rate limiting
    console.log('--- Testing Rate Limiting ---');
    const rapidRequests = Array(12).fill().map(() => ({
      method: 'GET',
      path: '/api/users/123',
      clientId: 'rate-limit-test',
      headers: { authorization: 'Bearer valid-token' }
    }));
    
    for (let i = 0; i < rapidRequests.length; i++) {
      const response = await gateway.handleRequest(rapidRequests[i]);
      console.log(`Request ${i + 1}: ${response.status} - ${response.data?.message || response.error?.message}`);
    }
  }
  
  testAPIGateway().then(() => {
    setTimeout(() => practicalChallenges(), 2000);
  });
}

// PRACTICAL CHALLENGES
function practicalChallenges() {
  console.log('\n=== PRACTICAL CHALLENGES ===\n');
  
  console.log('Challenge 1: Distributed Transaction Management (Saga Pattern)');
  console.log('Challenge 2: Service Mesh Communication');
  console.log('Challenge 3: Event Sourcing and CQRS');
  console.log('Challenge 4: Microservice Monitoring and Observability');
  console.log('Challenge 5: Auto-scaling and Load Balancing');
  
  // Challenge 1: Saga Pattern Implementation
  console.log('\n--- Challenge 1: Saga Pattern for Distributed Transactions ---');
  
  class SagaOrchestrator {
    constructor() {
      this.sagas = new Map();
      this.sagaId = 0;
    }
    
    // Execute saga with compensation logic
    async executeSaga(sagaDefinition) {
      const sagaId = ++this.sagaId;
      const sagaInstance = {
        id: sagaId,
        definition: sagaDefinition,
        completedSteps: [],
        currentStep: 0,
        status: 'RUNNING',
        startTime: Date.now()
      };
      
      this.sagas.set(sagaId, sagaInstance);
      
      console.log(`🏃 Starting saga ${sagaId}: ${sagaDefinition.name}`);
      
      try {
        // Execute each step
        for (let i = 0; i < sagaDefinition.steps.length; i++) {
          const step = sagaDefinition.steps[i];
          sagaInstance.currentStep = i;
          
          console.log(`  Step ${i + 1}: ${step.name}`);
          
          try {
            const result = await step.execute();
            sagaInstance.completedSteps.push({
              stepIndex: i,
              stepName: step.name,
              result,
              completedAt: Date.now()
            });
            
            console.log(`  ✅ Step ${i + 1} completed`);
            
          } catch (stepError) {
            console.log(`  ❌ Step ${i + 1} failed: ${stepError.message}`);
            
            // Execute compensations in reverse order
            await this.compensate(sagaInstance, i - 1);
            
            sagaInstance.status = 'COMPENSATED';
            throw new Error(`Saga ${sagaId} failed at step ${i + 1}: ${stepError.message}`);
          }
        }
        
        sagaInstance.status = 'COMPLETED';
        console.log(`✅ Saga ${sagaId} completed successfully in ${Date.now() - sagaInstance.startTime}ms`);
        
        return sagaInstance;
        
      } catch (error) {
        console.log(`❌ Saga ${sagaId} failed: ${error.message}`);
        throw error;
      }
    }
    
    async compensate(sagaInstance, fromStepIndex) {
      console.log(`🔄 Starting compensation from step ${fromStepIndex + 1}`);
      
      for (let i = fromStepIndex; i >= 0; i--) {
        const step = sagaInstance.definition.steps[i];
        const completedStep = sagaInstance.completedSteps.find(cs => cs.stepIndex === i);
        
        if (completedStep && step.compensate) {
          try {
            console.log(`  Compensating step ${i + 1}: ${step.name}`);
            await step.compensate(completedStep.result);
            console.log(`  ✅ Step ${i + 1} compensated`);
          } catch (compensationError) {
            console.log(`  ⚠️  Compensation failed for step ${i + 1}: ${compensationError.message}`);
          }
        }
      }
    }
    
    getSagaStatus(sagaId) {
      return this.sagas.get(sagaId);
    }
  }
  
  // Test Saga Pattern with Order Processing Example
  async function testSagaPattern() {
    const sagaOrchestrator = new SagaOrchestrator();
    
    // Define order processing saga
    const orderProcessingSaga = {
      name: 'Order Processing',
      steps: [
        {
          name: 'Reserve Inventory',
          async execute() {
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log('    📦 Inventory reserved for items: item1, item2');
            return { reservationId: 'res-123', items: ['item1', 'item2'] };
          },
          async compensate(result) {
            await new Promise(resolve => setTimeout(resolve, 50));
            console.log(`    🔄 Inventory reservation ${result.reservationId} released`);
          }
        },
        {
          name: 'Process Payment',
          async execute() {
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Simulate payment failure sometimes
            if (Math.random() < 0.3) {
              throw new Error('Payment processing failed');
            }
            
            console.log('    💳 Payment processed: $99.99');
            return { paymentId: 'pay-456', amount: 99.99 };
          },
          async compensate(result) {
            await new Promise(resolve => setTimeout(resolve, 100));
            console.log(`    🔄 Payment ${result.paymentId} refunded: $${result.amount}`);
          }
        },
        {
          name: 'Update Order Status',
          async execute() {
            await new Promise(resolve => setTimeout(resolve, 50));
            console.log('    📋 Order status updated to CONFIRMED');
            return { orderId: 'order-789', status: 'CONFIRMED' };
          },
          async compensate(result) {
            await new Promise(resolve => setTimeout(resolve, 30));
            console.log(`    🔄 Order ${result.orderId} status reverted to CANCELLED`);
          }
        },
        {
          name: 'Send Confirmation Email',
          async execute() {
            await new Promise(resolve => setTimeout(resolve, 80));
            console.log('    📧 Confirmation email sent to customer');
            return { emailId: 'email-101' };
          },
          async compensate(result) {
            await new Promise(resolve => setTimeout(resolve, 40));
            console.log(`    🔄 Cancellation email sent (ref: ${result.emailId})`);
          }
        }
      ]
    };
    
    // Execute saga multiple times to demonstrate both success and failure
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`\n--- Saga Execution ${i} ---`);
        await sagaOrchestrator.executeSaga(orderProcessingSaga);
      } catch (error) {
        console.log(`Saga execution ${i} failed and was compensated`);
      }
    }
  }
  
  testSagaPattern().then(() => {
    setTimeout(() => {
      console.log('\n=== END EXERCISES ===');
      console.log('\n🏗️  Microservices Architecture Best Practices:');
      console.log('• Implement proper service discovery and registration');
      console.log('• Use circuit breakers to handle service failures gracefully');
      console.log('• Design for eventual consistency and handle distributed transactions');
      console.log('• Implement comprehensive monitoring and distributed tracing');
      console.log('• Use API gateways for centralized cross-cutting concerns');
      console.log('• Design services around business capabilities, not data');
      console.log('• Implement proper error handling and retry mechanisms');
      console.log('• Use asynchronous communication for loose coupling');
      console.log('• Design for failure - assume services will go down');
      console.log('• Implement proper security boundaries between services');
    }, 2000);
  });
}

console.log('Starting microservices exercises...\n');