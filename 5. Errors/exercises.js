// Node.js Error Handling Exercises

const fs = require('fs');
const { EventEmitter } = require('events');

console.log('=== NODE.JS ERROR HANDLING EXERCISES ===\n');

// EXERCISE 1: Basic Error Handling Patterns
console.log('Exercise 1: Synchronous vs Asynchronous Error Handling');

// Synchronous error handling
function synchronousExample() {
  try {
    const data = JSON.parse('invalid json');
    console.log('Parsed:', data);
  } catch (error) {
    console.log('Sync Error caught:', error.message);
  }
}

// Asynchronous error handling with callbacks
function asyncCallbackExample() {
  fs.readFile('nonexistent-file.txt', 'utf8', (err, data) => {
    if (err) {
      console.log('Async Callback Error:', err.message);
      return;
    }
    console.log('File content:', data);
  });
}

// Asynchronous error handling with Promises
async function asyncPromiseExample() {
  try {
    const data = await fs.promises.readFile('nonexistent-file.txt', 'utf8');
    console.log('File content:', data);
  } catch (error) {
    console.log('Async Promise Error:', error.message);
  }
}

synchronousExample();
asyncCallbackExample();
asyncPromiseExample();

console.log('\n--- Separator ---\n');

// EXERCISE 2: Custom Error Classes
console.log('Exercise 2: Custom Error Classes');

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, ValidationError);
  }
}

class DatabaseError extends Error {
  constructor(message, query) {
    super(message);
    this.name = 'DatabaseError';
    this.query = query;
    this.statusCode = 500;
    
    Error.captureStackTrace(this, DatabaseError);
  }
}

function validateUser(user) {
  if (!user.email) {
    throw new ValidationError('Email is required', 'email');
  }
  if (!user.name) {
    throw new ValidationError('Name is required', 'name');
  }
  if (user.age < 0) {
    throw new ValidationError('Age must be positive', 'age');
  }
}

function simulateDatabaseQuery(query) {
  if (query.includes('DROP')) {
    throw new DatabaseError('Dangerous query detected', query);
  }
  return 'Query executed successfully';
}

try {
  validateUser({ name: 'John' }); // Missing email
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`Validation Error in field '${error.field}':`, error.message);
  }
}

try {
  simulateDatabaseQuery('DROP TABLE users');
} catch (error) {
  if (error instanceof DatabaseError) {
    console.log(`Database Error with query '${error.query}':`, error.message);
  }
}

console.log('\n--- Separator ---\n');

// EXERCISE 3: Error Handling with EventEmitters
console.log('Exercise 3: Error Handling with EventEmitters');

class DataProcessor extends EventEmitter {
  processData(data) {
    setTimeout(() => {
      try {
        if (!data) {
          throw new Error('No data provided');
        }
        
        if (typeof data !== 'string') {
          throw new Error('Data must be a string');
        }
        
        if (data.length === 0) {
          throw new Error('Empty data provided');
        }
        
        // Simulate processing
        const result = data.toUpperCase();
        this.emit('processed', result);
        
      } catch (error) {
        this.emit('error', error);
      }
    }, 100);
  }
}

const processor = new DataProcessor();

processor.on('processed', (result) => {
  console.log('Data processed successfully:', result);
});

processor.on('error', (error) => {
  console.log('Processing error:', error.message);
});

processor.processData('hello world'); // Success
processor.processData(null); // Error
processor.processData(''); // Error

setTimeout(() => {
  console.log('\n--- Separator ---\n');
  
  // EXERCISE 4: Promise Error Handling Patterns
  console.log('Exercise 4: Promise Error Handling Patterns');
  
  // Promise chain error handling
  function promiseChainExample() {
    return Promise.resolve('initial data')
      .then(data => {
        console.log('Step 1:', data);
        return data.toUpperCase();
      })
      .then(data => {
        console.log('Step 2:', data);
        throw new Error('Simulated error in step 2');
      })
      .then(data => {
        console.log('Step 3:', data); // This won't execute
        return data;
      })
      .catch(error => {
        console.log('Promise chain error caught:', error.message);
        return 'recovered data'; // Error recovery
      })
      .then(data => {
        console.log('Final step:', data);
      });
  }
  
  // Async/await with multiple try-catch blocks
  async function asyncAwaitExample() {
    try {
      const step1 = await new Promise(resolve => {
        setTimeout(() => resolve('async step 1'), 50);
      });
      console.log('Async Step 1:', step1);
      
      try {
        const step2 = await new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Async step 2 failed')), 50);
        });
        console.log('Async Step 2:', step2);
      } catch (innerError) {
        console.log('Inner error handled:', innerError.message);
        throw new Error('Rethrowing with context: ' + innerError.message);
      }
      
    } catch (outerError) {
      console.log('Outer error handled:', outerError.message);
    }
  }
  
  promiseChainExample().then(() => {
    return asyncAwaitExample();
  }).then(() => {
    setTimeout(() => exerciseFive(), 500);
  });
  
}, 500);

// EXERCISE 5: Error Handling in Express-like Middleware
function exerciseFive() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 5: Middleware Error Handling Pattern');
  
  // Simulate Express-like middleware
  const middlewareStack = [];
  
  function use(middleware) {
    middlewareStack.push(middleware);
  }
  
  async function runMiddleware(req, res) {
    let index = 0;
    
    async function next(error) {
      if (error) {
        // Find error handling middleware
        while (index < middlewareStack.length) {
          const middleware = middlewareStack[index++];
          if (middleware.length === 4) { // Error middleware has 4 params
            try {
              await middleware(error, req, res, next);
              return;
            } catch (err) {
              error = err;
            }
          }
        }
        console.log('Unhandled error:', error.message);
        return;
      }
      
      if (index >= middlewareStack.length) {
        console.log('All middleware completed');
        return;
      }
      
      const middleware = middlewareStack[index++];
      if (middleware.length !== 4) { // Regular middleware
        try {
          await middleware(req, res, next);
        } catch (err) {
          next(err);
        }
      } else {
        next(); // Skip error middleware
      }
    }
    
    await next();
  }
  
  // Regular middleware
  use(async (req, res, next) => {
    console.log('Middleware 1: Logging');
    req.timestamp = Date.now();
    next();
  });
  
  use(async (req, res, next) => {
    console.log('Middleware 2: Authentication');
    if (!req.user) {
      throw new Error('Unauthorized access');
    }
    next();
  });
  
  use(async (req, res, next) => {
    console.log('Middleware 3: Business logic');
    res.data = 'Success!';
    next();
  });
  
  // Error handling middleware
  use(async (error, req, res, next) => {
    console.log('Error Middleware: Caught error -', error.message);
    res.error = error.message;
    res.statusCode = 500;
    next(); // Continue to next error handler if needed
  });
  
  // Test with error
  console.log('--- Test 1: With error ---');
  runMiddleware({ user: null }, {}).then(() => {
    console.log('\n--- Test 2: Without error ---');
    return runMiddleware({ user: { id: 1, name: 'John' } }, {});
  }).then(() => {
    setTimeout(() => exerciseSix(), 500);
  });
}

// EXERCISE 6: Global Error Handling
function exerciseSix() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 6: Global Error Handling');
  
  // Store original handlers to restore later
  const originalUncaughtException = process.listeners('uncaughtException');
  const originalUnhandledRejection = process.listeners('unhandledRejection');
  
  // Remove existing handlers temporarily
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');
  
  // Global error handlers
  process.once('uncaughtException', (error) => {
    console.log('Global uncaught exception:', error.message);
    // In production, you'd log and gracefully shutdown
    
    // Restore original handlers
    originalUncaughtException.forEach(listener => {
      process.on('uncaughtException', listener);
    });
  });
  
  process.once('unhandledRejection', (reason, promise) => {
    console.log('Global unhandled promise rejection:', reason);
    console.log('Promise:', promise);
    
    // Restore original handlers
    originalUnhandledRejection.forEach(listener => {
      process.on('unhandledRejection', listener);
    });
  });
  
  // Simulate uncaught exception
  setTimeout(() => {
    throw new Error('This is an uncaught exception');
  }, 100);
  
  // Simulate unhandled promise rejection
  setTimeout(() => {
    Promise.reject(new Error('This is an unhandled promise rejection'));
  }, 200);
  
  setTimeout(() => {
    console.log('\n=== PRACTICAL CHALLENGES ===');
    practicalChallenges();
  }, 500);
}

// PRACTICAL CHALLENGES
function practicalChallenges() {
  console.log('\nChallenge 1: Circuit Breaker Pattern');
  console.log('Challenge 2: Retry Logic with Exponential Backoff');
  console.log('Challenge 3: Error Aggregation and Reporting');
  console.log('Challenge 4: Graceful Shutdown on Fatal Errors');
  console.log('Challenge 5: Error Context Preservation');
  
  // Challenge 1: Circuit Breaker Pattern
  class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
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
        } else {
          throw new Error('Circuit breaker is OPEN');
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
    }
    
    onFailure() {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN';
      }
    }
  }
  
  console.log('\n--- Challenge 1 Implementation ---');
  const circuitBreaker = new CircuitBreaker(2, 1000); // 2 failures, 1 second timeout
  
  // Simulate unreliable service
  let callCount = 0;
  async function unreliableService() {
    callCount++;
    if (callCount <= 3) {
      throw new Error(`Service failure ${callCount}`);
    }
    return `Service success on call ${callCount}`;
  }
  
  // Test circuit breaker
  async function testCircuitBreaker() {
    for (let i = 0; i < 6; i++) {
      try {
        const result = await circuitBreaker.execute(unreliableService);
        console.log(`Call ${i + 1}: ${result}`);
      } catch (error) {
        console.log(`Call ${i + 1}: Error - ${error.message} (Circuit: ${circuitBreaker.state})`);
      }
      
      // Wait between calls
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  testCircuitBreaker().then(() => {
    console.log('\n=== END EXERCISES ===');
  });
}

// Additional utility functions for error handling
function createErrorWithContext(message, context) {
  const error = new Error(message);
  error.context = context;
  return error;
}

function logErrorWithStack(error) {
  console.log('Error:', error.message);
  console.log('Stack:', error.stack);
  if (error.context) {
    console.log('Context:', error.context);
  }
}

console.log('Starting error handling exercises...\n');