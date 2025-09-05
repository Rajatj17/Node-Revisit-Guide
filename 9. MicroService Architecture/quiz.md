# Microservices Architecture Quiz

## Question 1: Multiple Choice
What is the primary advantage of microservices architecture over monolithic architecture?

A) Easier to develop initially  
B) Independent scaling and deployment of services  
C) Simpler data management  
D) Lower infrastructure costs  

**Answer: B** - Microservices allow each service to be scaled and deployed independently based on its specific needs and load patterns.

---

## Question 2: True/False
In microservices architecture, services should share databases to maintain data consistency.

**Answer: False** - Each microservice should have its own database to ensure loose coupling and independent evolution. Shared databases create tight coupling and dependencies.

---

## Question 3: Code Analysis
```javascript
// Service A calling Service B
const response = await fetch(`http://service-b:3000/api/users/${userId}`);
const userData = await response.json();

if (userData.status === 'active') {
  // Process user
}
```

What problems does this direct service-to-service communication have?

**Answer:** Several issues:
1. **Hard-coded URL** - No service discovery
2. **No fault tolerance** - No circuit breaker or retry logic
3. **No error handling** - Fetch could fail
4. **Tight coupling** - Direct dependency on Service B's API
5. **No load balancing** - Single endpoint

---

## Question 4: Fill in the Blank
The _______ pattern helps manage distributed transactions by coordinating a sequence of local transactions with compensation logic for failures.

**Answer: Saga**

---

## Question 5: Short Answer
Explain the difference between service orchestration and service choreography in microservices.

**Answer:**
- **Orchestration**: Central coordinator (orchestrator) controls the sequence of service calls and manages the workflow
- **Choreography**: Services communicate directly through events, each service knows what to do when it receives specific events

Orchestration is centralized and easier to monitor, while choreography is decentralized and more resilient.

---

## Question 6: Service Discovery
```javascript
class ServiceRegistry {
  register(serviceName, serviceInfo) {
    // Implementation needed
  }
  
  discover(serviceName) {
    // Implementation needed
  }
}
```

What key information should `serviceInfo` contain for effective service discovery?

**Answer:** Key information includes:
- **Host and Port**: Network location
- **Health endpoint**: For health checks
- **Version**: Service version
- **Metadata**: Tags, region, capabilities
- **Load balancer info**: Current load, capacity
- **Security info**: Authentication requirements

---

## Question 7: Multiple Choice
Which pattern is best for handling failures when calling multiple services in sequence?

A) Retry with exponential backoff  
B) Circuit Breaker  
C) Bulkhead  
D) All of the above  

**Answer: D** - A combination of all patterns provides comprehensive fault tolerance: Circuit breaker prevents cascading failures, retry handles transient failures, and bulkhead isolates failures.

---

## Question 8: API Gateway Benefits
List 4 key responsibilities of an API Gateway in microservices architecture.

**Answer:**
1. **Request Routing** - Direct requests to appropriate services
2. **Authentication/Authorization** - Centralized security
3. **Rate Limiting** - Protect services from abuse
4. **Response Transformation** - Aggregate/transform responses
5. **Load Balancing** - Distribute requests across service instances
6. **Monitoring/Logging** - Centralized observability

---

## Question 9: Data Consistency
In a distributed microservices system, how would you handle a scenario where an order service needs to update inventory and process payment atomically?

**Answer:** Use the **Saga pattern**:

1. **Orchestration approach**:
   - Order service acts as saga orchestrator
   - Calls inventory service to reserve items
   - Calls payment service to process payment
   - If payment fails, compensates by releasing inventory

2. **Choreography approach**:
   - Order service publishes "OrderPlaced" event
   - Inventory service reserves items, publishes "ItemsReserved"
   - Payment service processes payment
   - If payment fails, publishes "PaymentFailed" event
   - Inventory service listens and releases reservation

---

## Question 10: Advanced Scenario
Your microservices system is experiencing cascading failures. One slow service is causing timeout issues across the entire system. Design a resilience strategy.

**Answer:** Multi-layered resilience strategy:

1. **Circuit Breaker Pattern**:
   ```javascript
   class CircuitBreaker {
     constructor(threshold = 5, timeout = 60000) {
       this.failureThreshold = threshold;
       this.recoveryTimeout = timeout;
       this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
     }
   }
   ```

2. **Timeout Configuration**:
   - Set aggressive timeouts for service calls
   - Implement timeout at multiple levels (connection, request, total)

3. **Bulkhead Pattern**:
   - Isolate resources (separate thread pools per service)
   - Prevent one slow service from consuming all resources

4. **Retry with Backoff**:
   - Implement exponential backoff with jitter
   - Limit retry attempts

5. **Monitoring and Alerting**:
   - Track service health metrics
   - Implement automated recovery procedures

---

## Practical Challenge Questions

### Challenge 1: Service Mesh Implementation
Design a service mesh architecture that handles:
- Service-to-service authentication
- Traffic routing and load balancing  
- Observability (metrics, tracing, logging)
- Circuit breaking and retries

### Challenge 2: Event-Driven Architecture
```javascript
// Design an event-driven system for e-commerce
class EventBus {
  // Your implementation
}

class OrderService {
  async placeOrder(orderData) {
    // Emit events for other services
  }
}

class InventoryService {
  // Listen for order events and update inventory
}

class NotificationService {
  // Send notifications based on events
}
```

Complete this event-driven architecture.

### Challenge 3: Distributed Tracing
Implement a correlation ID system that tracks requests across multiple services:

```javascript
class CorrelationTracker {
  generateCorrelationId() {
    // Implementation
  }
  
  propagateCorrelationId(request) {
    // Add to headers
  }
  
  trackServiceCall(correlationId, serviceName, operation) {
    // Track the call
  }
}
```

### Challenge 4: Auto-scaling Strategy
Design an auto-scaling system for microservices that considers:
- CPU and memory usage
- Request queue length
- Response times
- Custom business metrics

### Challenge 5: Database per Service
You're migrating from a monolith with a shared database to microservices. How would you handle:
- Data migration strategy
- Referential integrity across services
- Distributed queries
- Event sourcing for audit trails

**Solutions:**

**Challenge 2:** Event-Driven E-commerce:
```javascript
class EventBus {
  constructor() {
    this.subscribers = new Map();
  }
  
  subscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push(handler);
  }
  
  async publish(eventType, eventData) {
    const handlers = this.subscribers.get(eventType) || [];
    await Promise.all(handlers.map(handler => handler(eventData)));
  }
}

class OrderService {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }
  
  async placeOrder(orderData) {
    // Create order
    const order = { id: Date.now(), ...orderData };
    
    // Emit events
    await this.eventBus.publish('order.placed', {
      orderId: order.id,
      userId: order.userId,
      items: order.items,
      timestamp: new Date()
    });
    
    return order;
  }
}

class InventoryService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.eventBus.subscribe('order.placed', async (event) => {
      await this.reserveItems(event.items);
      await this.eventBus.publish('inventory.reserved', {
        orderId: event.orderId,
        items: event.items
      });
    });
  }
  
  async reserveItems(items) {
    // Reserve inventory logic
    console.log('Reserved items:', items);
  }
}
```

**Challenge 3:** Correlation Tracking:
```javascript
class CorrelationTracker {
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  propagateCorrelationId(request) {
    if (!request.headers['x-correlation-id']) {
      request.headers['x-correlation-id'] = this.generateCorrelationId();
    }
    return request.headers['x-correlation-id'];
  }
  
  trackServiceCall(correlationId, serviceName, operation, duration) {
    console.log(`[${correlationId}] ${serviceName}.${operation} - ${duration}ms`);
    
    // Store in distributed tracing system
    this.sendToTracing({
      correlationId,
      serviceName,
      operation,
      duration,
      timestamp: new Date()
    });
  }
  
  sendToTracing(traceData) {
    // Send to Jaeger, Zipkin, or other tracing system
  }
}
```