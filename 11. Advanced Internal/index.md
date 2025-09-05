# Advanced Node.js Concepts - Deep Dive into Internals

This is **expert-level** Node.js knowledge that demonstrates mastery of the platform. Understanding these internals is crucial for debugging performance issues, optimizing applications, and making architectural decisions.

## V8 Engine Internals and Optimization

### V8 Compilation Pipeline

```javascript
// V8 compilation phases demonstration
function demonstrateV8Optimization() {
  // Phase 1: Ignition Interpreter (Bytecode)
  // Initial execution - V8 generates bytecode
  
  // Phase 2: TurboFan Compiler (Machine Code)
  // After multiple executions, V8 optimizes to machine code
  
  function addNumbers(a, b) {
    return a + b; // Simple function for optimization
  }
  
  // Cold function - first execution uses interpreter
  console.time('Cold execution');
  for (let i = 0; i < 1000; i++) {
    addNumbers(i, i + 1);
  }
  console.timeEnd('Cold execution');
  
  // Hot function - subsequent executions use optimized machine code
  console.time('Hot execution');
  for (let i = 0; i < 1000000; i++) {
    addNumbers(i, i + 1);
  }
  console.timeEnd('Hot execution');
}

// V8 Hidden Classes and Inline Caching
class OptimizedObject {
  constructor(x, y) {
    // V8 creates hidden class for this shape
    this.x = x; // Property 1
    this.y = y; // Property 2
    // Hidden class: Shape1 { x: offset_0, y: offset_1 }
  }
}

class NonOptimizedObject {
  constructor(x, y, shouldAddZ) {
    this.x = x;
    this.y = y;
    
    // Dynamic property addition causes shape changes
    if (shouldAddZ) {
      this.z = 0; // Creates new hidden class
    }
    // Multiple hidden classes: Shape1 { x, y }, Shape2 { x, y, z }
  }
}

// Demonstrating deoptimization
function optimizedFunction(obj) {
  // V8 assumes obj.x is always a number
  return obj.x + 1;
}

function demonstrateDeoptimization() {
  const obj1 = { x: 42 };
  const obj2 = { x: 43 };
  
  // These calls allow V8 to optimize
  optimizedFunction(obj1); // x is number
  optimizedFunction(obj2); // x is number
  
  // This causes deoptimization
  const obj3 = { x: "string" };
  optimizedFunction(obj3); // x is string - type change!
  
  // V8 must deoptimize and fall back to slower code
}

// V8 optimization flags demonstration
function checkOptimizationStatus() {
  // Start with --allow-natives-syntax flag
  // node --allow-natives-syntax app.js
  
  function testFunction(a, b) {
    return a + b;
  }
  
  // Warm up the function
  for (let i = 0; i < 10000; i++) {
    testFunction(i, i + 1);
  }
  
  // Check optimization status (requires --allow-natives-syntax)
  // console.log(%GetOptimizationStatus(testFunction));
  // console.log(%HaveSameMap(obj1, obj2));
}
```

### Memory Management in V8

```javascript
// V8 Memory Spaces
class MemorySpaceDemo {
  constructor() {
    this.demonstrations = [];
  }
  
  demonstrateGenerationalGC() {
    // Young Generation (Eden, From, To spaces)
    const youngObjects = [];
    
    console.log('Creating young generation objects...');
    for (let i = 0; i < 100000; i++) {
      // These objects start in Eden space
      youngObjects.push({
        id: i,
        data: `temp_data_${i}`,
        timestamp: Date.now()
      });
    }
    
    // Most of these will be garbage collected quickly
    // Survivors move to From space, then To space
    
    // Trigger garbage collection if available
    if (global.gc) {
      console.log('Before GC:', process.memoryUsage());
      global.gc();
      console.log('After GC:', process.memoryUsage());
    }
    
    // Clear references to allow GC
    youngObjects.length = 0;
  }
  
  demonstrateOldGeneration() {
    // Objects that survive multiple GC cycles move to Old Generation
    const longLivedObjects = [];
    
    for (let i = 0; i < 10; i++) {
      // Create objects and keep references
      const batch = Array.from({ length: 10000 }, (_, index) => ({
        id: i * 10000 + index,
        persistentData: `long_lived_${i}_${index}`,
        references: new Set()
      }));
      
      longLivedObjects.push(...batch);
      
      // Force multiple GC cycles
      if (global.gc) {
        global.gc();
      }
    }
    
    // These objects should now be in Old Generation
    console.log('Old generation objects created:', longLivedObjects.length);
    return longLivedObjects;
  }
  
  demonstrateCodeSpace() {
    // Code space stores compiled JavaScript and bytecode
    const functions = [];
    
    for (let i = 0; i < 1000; i++) {
      // Dynamically create functions (stored in Code space)
      const func = new Function('x', `return x * ${i} + ${i * 2};`);
      functions.push(func);
    }
    
    console.log('Dynamic functions created:', functions.length);
    
    // Execute functions to trigger compilation
    functions.forEach((func, index) => {
      for (let j = 0; j < 100; j++) {
        func(j);
      }
    });
    
    return functions;
  }
  
  demonstrateLargeObjectSpace() {
    // Objects larger than ~500KB go to Large Object Space
    const largeObjects = [];
    
    for (let i = 0; i < 5; i++) {
      // Create large arrays (>500KB)
      const largeArray = new Array(100000).fill(0).map((_, index) => ({
        index,
        data: `large_object_data_${i}_${index}`,
        buffer: Buffer.alloc(64) // 64 bytes per item
      }));
      
      largeObjects.push(largeArray);
    }
    
    console.log('Large objects created:', largeObjects.length);
    return largeObjects;
  }
  
  monitorMemoryUsage() {
    const usage = process.memoryUsage();
    const v8Stats = v8.getHeapStatistics();
    
    return {
      process: {
        rss: Math.round(usage.rss / 1024 / 1024), // Resident Set Size
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
      },
      v8: {
        totalHeapSize: Math.round(v8Stats.total_heap_size / 1024 / 1024),
        totalHeapSizeExecutable: Math.round(v8Stats.total_heap_size_executable / 1024 / 1024),
        totalPhysicalSize: Math.round(v8Stats.total_physical_size / 1024 / 1024),
        totalAvailableSize: Math.round(v8Stats.total_available_size / 1024 / 1024),
        usedHeapSize: Math.round(v8Stats.used_heap_size / 1024 / 1024),
        heapSizeLimit: Math.round(v8Stats.heap_size_limit / 1024 / 1024)
      }
    };
  }
}

// Usage
const memoryDemo = new MemorySpaceDemo();

console.log('Initial memory:', memoryDemo.monitorMemoryUsage());

memoryDemo.demonstrateGenerationalGC();
console.log('After young generation demo:', memoryDemo.monitorMemoryUsage());

const oldGenObjects = memoryDemo.demonstrateOldGeneration();
console.log('After old generation demo:', memoryDemo.monitorMemoryUsage());

const largObjects = memoryDemo.demonstrateLargeObjectSpace();
console.log('After large object demo:', memoryDemo.monitorMemoryUsage());
```

## Event Loop Deep Dive

### Event Loop Phases Detailed Analysis

```javascript
const fs = require('fs');

// Comprehensive Event Loop Phase Analysis
class EventLoopAnalyzer {
  constructor() {
    this.phaseTimings = new Map();
    this.executionOrder = [];
  }
  
  demonstrateAllPhases() {
    console.log('=== Event Loop Phases Demonstration ===\n');
    
    // Phase tracking
    this.trackExecution('Script Start', 'MAIN');
    
    // Timer Phase
    this.setupTimerPhase();
    
    // Pending Callbacks Phase
    this.setupPendingCallbacks();
    
    // Poll Phase
    this.setupPollPhase();
    
    // Check Phase
    this.setupCheckPhase();
    
    // Close Callbacks Phase
    this.setupCloseCallbacks();
    
    // Process.nextTick and Microtasks (between phases)
    this.setupMicrotasks();
    
    this.trackExecution('Script End', 'MAIN');
    
    // Print results after all phases complete
    setTimeout(() => {
      this.printExecutionOrder();
    }, 100);
  }
  
  setupTimerPhase() {
    // Timer Phase - setTimeout and setInterval callbacks
    
    setTimeout(() => {
      this.trackExecution('setTimeout 0ms', 'TIMER_PHASE');
    }, 0);
    
    setTimeout(() => {
      this.trackExecution('setTimeout 1ms', 'TIMER_PHASE');
    }, 1);
    
    setInterval(() => {
      this.trackExecution('setInterval 50ms (first)', 'TIMER_PHASE');
    }, 50);
  }
  
  setupPendingCallbacks() {
    // Pending Callbacks Phase - I/O callbacks from previous iterations
    // This is harder to demonstrate directly, but includes:
    // - TCP error callbacks
    // - UDP error callbacks
    
    const net = require('net');
    const server = net.createServer();
    
    server.on('error', (err) => {
      this.trackExecution('Server error callback', 'PENDING_CALLBACKS');
    });
    
    // This will trigger an error callback
    server.listen(99999, '256.256.256.256'); // Invalid IP
  }
  
  setupPollPhase() {
    // Poll Phase - New I/O events, executing I/O callbacks
    
    // File system I/O
    fs.readFile(__filename, (err, data) => {
      this.trackExecution('fs.readFile callback', 'POLL_PHASE');
      
      // Nested I/O in poll phase
      fs.stat(__filename, (err, stats) => {
        this.trackExecution('fs.stat callback (nested)', 'POLL_PHASE');
      });
    });
    
    // Network I/O
    const https = require('https');
    https.get('https://httpbin.org/delay/0', (res) => {
      this.trackExecution('HTTPS request callback', 'POLL_PHASE');
      res.on('data', () => {
        this.trackExecution('HTTP data chunk', 'POLL_PHASE');
      });
    }).on('error', (err) => {
      this.trackExecution('HTTPS error callback', 'POLL_PHASE');
    });
  }
  
  setupCheckPhase() {
    // Check Phase - setImmediate callbacks
    
    setImmediate(() => {
      this.trackExecution('setImmediate 1', 'CHECK_PHASE');
      
      // Nested setImmediate
      setImmediate(() => {
        this.trackExecution('setImmediate nested', 'CHECK_PHASE');
      });
    });
    
    setImmediate(() => {
      this.trackExecution('setImmediate 2', 'CHECK_PHASE');
    });
  }
  
  setupCloseCallbacks() {
    // Close Callbacks Phase - close event callbacks
    
    const net = require('net');
    const socket = new net.Socket();
    
    socket.on('close', () => {
      this.trackExecution('Socket close callback', 'CLOSE_CALLBACKS');
    });
    
    // Connect and immediately destroy
    socket.connect(80, 'google.com', () => {
      socket.destroy();
    });
  }
  
  setupMicrotasks() {
    // Microtasks execute between each phase
    
    // Process.nextTick - highest priority
    process.nextTick(() => {
      this.trackExecution('process.nextTick 1', 'MICROTASK');
      
      // Nested nextTick
      process.nextTick(() => {
        this.trackExecution('process.nextTick nested', 'MICROTASK');
      });
    });
    
    process.nextTick(() => {
      this.trackExecution('process.nextTick 2', 'MICROTASK');
    });
    
    // Promise microtasks - lower priority than nextTick
    Promise.resolve().then(() => {
      this.trackExecution('Promise.resolve 1', 'MICROTASK');
      
      return Promise.resolve();
    }).then(() => {
      this.trackExecution('Promise.resolve chained', 'MICROTASK');
    });
    
    Promise.resolve().then(() => {
      this.trackExecution('Promise.resolve 2', 'MICROTASK');
    });
    
    // queueMicrotask
    queueMicrotask(() => {
      this.trackExecution('queueMicrotask', 'MICROTASK');
    });
  }
  
  trackExecution(description, phase) {
    const timestamp = process.hrtime.bigint();
    this.executionOrder.push({
      description,
      phase,
      timestamp,
      order: this.executionOrder.length
    });
    
    console.log(`[${phase}] ${description} - ${timestamp}`);
  }
  
  printExecutionOrder() {
    console.log('\n=== Execution Order Summary ===');
    
    const phaseGroups = {};
    this.executionOrder.forEach(item => {
      if (!phaseGroups[item.phase]) {
        phaseGroups[item.phase] = [];
      }
      phaseGroups[item.phase].push(item);
    });
    
    Object.entries(phaseGroups).forEach(([phase, items]) => {
      console.log(`\n${phase}:`);
      items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.description}`);
      });
    });
  }
}

// Event Loop Blocking Detection
class EventLoopBlockingDetector {
  constructor() {
    this.measurements = [];
    this.isMonitoring = false;
    this.blockingThreshold = 10; // milliseconds
  }
  
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.scheduleCheck();
    console.log('Event loop blocking detection started');
  }
  
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('Event loop blocking detection stopped');
  }
  
  scheduleCheck() {
    if (!this.isMonitoring) return;
    
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      
      this.measurements.push({
        delay,
        timestamp: new Date(),
        blocked: delay > this.blockingThreshold
      });
      
      if (delay > this.blockingThreshold) {
        console.warn(`⚠️ Event loop blocked for ${delay.toFixed(2)}ms`);
        
        // Capture stack trace for debugging
        const stack = new Error().stack;
        console.warn('Stack trace:', stack);
      }
      
      // Keep only last 100 measurements
      if (this.measurements.length > 100) {
        this.measurements.shift();
      }
      
      // Schedule next check
      this.scheduleCheck();
    });
  }
  
  getStats() {
    if (this.measurements.length === 0) return null;
    
    const delays = this.measurements.map(m => m.delay);
    const blockedCount = this.measurements.filter(m => m.blocked).length;
    
    return {
      totalMeasurements: this.measurements.length,
      blockedEvents: blockedCount,
      blockingPercentage: (blockedCount / this.measurements.length * 100).toFixed(2),
      averageDelay: (delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(2),
      maxDelay: Math.max(...delays).toFixed(2),
      minDelay: Math.min(...delays).toFixed(2)
    };
  }
  
  simulateBlocking(durationMs) {
    console.log(`Simulating ${durationMs}ms blocking operation...`);
    const start = Date.now();
    while (Date.now() - start < durationMs) {
      // Blocking operation
    }
  }
}

// Usage examples
const analyzer = new EventLoopAnalyzer();
analyzer.demonstrateAllPhases();

const blockingDetector = new EventLoopBlockingDetector();
blockingDetector.startMonitoring();

// Simulate some blocking after a delay
setTimeout(() => {
  blockingDetector.simulateBlocking(50); // 50ms blocking
  
  setTimeout(() => {
    console.log('\nEvent Loop Blocking Stats:', blockingDetector.getStats());
  }, 1000);
}, 2000);
```

### Advanced Event Loop Patterns

```javascript
// Event Loop Performance Optimization Patterns
class EventLoopOptimizer {
  constructor() {
    this.taskQueue = [];
    this.isProcessing = false;
  }
  
  // Pattern 1: Task Chunking to Prevent Blocking
  async processLargeDataset(data, chunkSize = 1000) {
    console.log(`Processing ${data.length} items in chunks of ${chunkSize}`);
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      
      // Process chunk synchronously
      const result = this.processChunk(chunk);
      
      // Yield control back to event loop
      await this.yieldToEventLoop();
      
      console.log(`Processed chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(data.length / chunkSize)}`);
    }
    
    console.log('Large dataset processing completed');
  }
  
  processChunk(chunk) {
    // Simulate CPU-intensive work
    return chunk.map(item => {
      let result = 0;
      for (let i = 0; i < 1000; i++) {
        result += Math.sqrt(item * i);
      }
      return result;
    });
  }
  
  yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
  }
  
  // Pattern 2: Priority-based Task Scheduling
  scheduleTask(task, priority = 0) {
    this.taskQueue.push({ task, priority, id: Date.now() });
    this.taskQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
    
    if (!this.isProcessing) {
      this.processTaskQueue();
    }
  }
  
  async processTaskQueue() {
    this.isProcessing = true;
    
    while (this.taskQueue.length > 0) {
      const { task, priority, id } = this.taskQueue.shift();
      
      try {
        console.log(`Executing task ${id} with priority ${priority}`);
        await task();
      } catch (error) {
        console.error(`Task ${id} failed:`, error);
      }
      
      // Yield to allow other operations
      await this.yieldToEventLoop();
    }
    
    this.isProcessing = false;
  }
  
  // Pattern 3: Adaptive Scheduling Based on Event Loop Lag
  async adaptiveProcessing(data, maxLagMs = 5) {
    let chunkSize = 100;
    const maxChunkSize = 10000;
    const minChunkSize = 10;
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const start = process.hrtime.bigint();
      
      const chunk = data.slice(i, i + chunkSize);
      this.processChunk(chunk);
      
      // Measure event loop lag
      const lagStart = process.hrtime.bigint();
      await this.yieldToEventLoop();
      const lag = Number(process.hrtime.bigint() - lagStart) / 1000000; // ms
      
      // Adapt chunk size based on lag
      if (lag > maxLagMs && chunkSize > minChunkSize) {
        chunkSize = Math.max(minChunkSize, Math.floor(chunkSize * 0.8));
        console.log(`High lag detected (${lag.toFixed(2)}ms), reducing chunk size to ${chunkSize}`);
      } else if (lag < maxLagMs / 2 && chunkSize < maxChunkSize) {
        chunkSize = Math.min(maxChunkSize, Math.floor(chunkSize * 1.2));
        console.log(`Low lag detected (${lag.toFixed(2)}ms), increasing chunk size to ${chunkSize}`);
      }
    }
  }
  
  // Pattern 4: Event Loop Monitoring and Alerts
  createEventLoopMonitor() {
    const monitor = {
      samples: [],
      alertThreshold: 50, // milliseconds
      
      start() {
        this.interval = setInterval(() => {
          const start = process.hrtime.bigint();
          
          setImmediate(() => {
            const lag = Number(process.hrtime.bigint() - start) / 1000000;
            
            this.samples.push({
              lag,
              timestamp: Date.now(),
              memoryUsage: process.memoryUsage()
            });
            
            // Keep last 100 samples
            if (this.samples.length > 100) {
              this.samples.shift();
            }
            
            if (lag > this.alertThreshold) {
              this.onHighLag(lag);
            }
          });
        }, 1000);
      },
      
      stop() {
        if (this.interval) {
          clearInterval(this.interval);
        }
      },
      
      onHighLag(lag) {
        console.warn(`🚨 High event loop lag detected: ${lag.toFixed(2)}ms`);
        
        // Could trigger alerting system in production
        this.sendAlert({
          type: 'event_loop_lag',
          lag,
          timestamp: new Date(),
          process: {
            pid: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage()
          }
        });
      },
      
      sendAlert(alertData) {
        // In production, send to monitoring system
        console.log('Alert data:', JSON.stringify(alertData, null, 2));
      },
      
      getStats() {
        if (this.samples.length === 0) return null;
        
        const lags = this.samples.map(s => s.lag);
        return {
          averageLag: (lags.reduce((a, b) => a + b, 0) / lags.length).toFixed(2),
          maxLag: Math.max(...lags).toFixed(2),
          minLag: Math.min(...lags).toFixed(2),
          samplesCount: this.samples.length,
          highLagEvents: this.samples.filter(s => s.lag > this.alertThreshold).length
        };
      }
    };
    
    return monitor;
  }
}

// Usage examples
const optimizer = new EventLoopOptimizer();

// Example 1: Process large dataset
const largeData = Array.from({ length: 50000 }, (_, i) => i);
optimizer.processLargeDataset(largeData, 5000);

// Example 2: Priority task scheduling
optimizer.scheduleTask(async () => {
  console.log('High priority task executed');
  await new Promise(resolve => setTimeout(resolve, 100));
}, 10);

optimizer.scheduleTask(async () => {
  console.log('Low priority task executed');
}, 1);

optimizer.scheduleTask(async () => {
  console.log('Medium priority task executed');
}, 5);

// Example 3: Event loop monitoring
const monitor = optimizer.createEventLoopMonitor();
monitor.start();

// Stop monitoring after 30 seconds
setTimeout(() => {
  monitor.stop();
  console.log('Event Loop Monitor Stats:', monitor.getStats());
}, 30000);
```

## Worker Threads vs Child Processes vs Cluster

### Worker Threads Implementation

```javascript
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

// Worker Threads for CPU-intensive tasks
class WorkerThreadPool {
  constructor(workerScript, poolSize = os.cpus().length) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    this.workers = [];
    this.taskQueue = [];
    this.busyWorkers = new Set();
    this.taskId = 0;
    
    this.createWorkers();
  }
  
  createWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker();
    }
  }
  
  createWorker() {
    const worker = new Worker(this.workerScript);
    
    worker.on('message', (result) => {
      this.handleWorkerMessage(worker, result);
    });
    
    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.handleWorkerError(worker, error);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
      this.removeWorker(worker);
    });
    
    this.workers.push(worker);
  }
  
  handleWorkerMessage(worker, result) {
    const task = worker.currentTask;
    if (task) {
      if (result.error) {
        task.reject(new Error(result.error));
      } else {
        task.resolve(result.data);
      }
      
      delete worker.currentTask;
      this.busyWorkers.delete(worker);
      this.processQueue();
    }
  }
  
  handleWorkerError(worker, error) {
    const task = worker.currentTask;
    if (task) {
      task.reject(error);
      delete worker.currentTask;
      this.busyWorkers.delete(worker);
    }
    
    // Restart worker
    this.removeWorker(worker);
    this.createWorker();
    this.processQueue();
  }
  
  removeWorker(worker) {
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
    }
    this.busyWorkers.delete(worker);
  }
  
  execute(data) {
    return new Promise((resolve, reject) => {
      const task = {
        id: ++this.taskId,
        data,
        resolve,
        reject,
        createdAt: Date.now()
      };
      
      this.taskQueue.push(task);
      this.processQueue();
    });
  }
  
  processQueue() {
    while (this.taskQueue.length > 0 && this.hasAvailableWorker()) {
      const task = this.taskQueue.shift();
      const worker = this.getAvailableWorker();
      
      if (worker) {
        worker.currentTask = task;
        this.busyWorkers.add(worker);
        
        worker.postMessage({
          taskId: task.id,
          data: task.data
        });
      }
    }
  }
  
  hasAvailableWorker() {
    return this.workers.length > this.busyWorkers.size;
  }
  
  getAvailableWorker() {
    return this.workers.find(worker => !this.busyWorkers.has(worker));
  }
  
  getStats() {
    return {
      totalWorkers: this.workers.length,
      busyWorkers: this.busyWorkers.size,
      queuedTasks: this.taskQueue.length,
      availableWorkers: this.workers.length - this.busyWorkers.size
    };
  }
  
  async terminate() {
    const terminationPromises = this.workers.map(worker => worker.terminate());
    await Promise.all(terminationPromises);
    this.workers = [];
    this.busyWorkers.clear();
    this.taskQueue = [];
  }
}

// Worker script (cpu-intensive-worker.js)
if (!isMainThread) {
  parentPort.on('message', (message) => {
    try {
      const { taskId, data } = message;
      
      // Simulate CPU-intensive work
      const result = performCPUIntensiveTask(data);
      
      parentPort.postMessage({
        taskId,
        data: result
      });
    } catch (error) {
      parentPort.postMessage({
        taskId: message.taskId,
        error: error.message
      });
    }
  });
  
  function performCPUIntensiveTask(data) {
    const { numbers, operation } = data;
    
    switch (operation) {
      case 'fibonacci':
        return numbers.map(n => fibonacci(n));
      case 'prime':
        return numbers.map(n => isPrime(n));
      case 'factorial':
        return numbers.map(n => factorial(n));
      default:
        throw new Error('Unknown operation');
    }
  }
  
  function fibonacci(n) {
    if (n < 2) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }
  
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false;
    }
    return true;
  }
  
  function factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }
}
```

### Child Processes for Different Tasks

```javascript
const { spawn, exec, execFile, fork } = require('child_process');
const path = require('path');

```javascript
class ChildProcessManager {
  constructor() {
    this.processes = new Map();
    this.processId = 0;
  }
  
  // Spawn for running system commands with streaming
  spawnProcess(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const processId = ++this.processId;
      
      console.log(`Spawning process ${processId}: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });
      
      this.processes.set(processId, child);
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.log(`[${processId}] STDOUT: ${chunk}`);
      });
      
      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.error(`[${processId}] STDERR: ${chunk}`);
      });
      
      child.on('close', (code) => {
        this.processes.delete(processId);
        console.log(`Process ${processId} exited with code ${code}`);
        
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Process failed with code ${code}: ${stderr}`));
        }
      });
      
      child.on('error', (error) => {
        this.processes.delete(processId);
        reject(error);
      });
    });
  }
  
  // Exec for simple command execution
  execCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const processId = ++this.processId;
      console.log(`Executing command ${processId}: ${command}`);
      
      const child = exec(command, {
        maxBuffer: 1024 * 1024, // 1MB buffer
        timeout: 30000, // 30 second timeout
        ...options
      }, (error, stdout, stderr) => {
        this.processes.delete(processId);
        
        if (error) {
          console.error(`Command ${processId} failed:`, error);
          reject(error);
        } else {
          console.log(`Command ${processId} completed successfully`);
          resolve({ stdout, stderr });
        }
      });
      
      this.processes.set(processId, child);
    });
  }
  
  // Fork for Node.js child processes with IPC
  forkNodeProcess(scriptPath, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const processId = ++this.processId;
      console.log(`Forking Node.js process ${processId}: ${scriptPath}`);
      
      const child = fork(scriptPath, args, {
        silent: false,
        ...options
      });
      
      this.processes.set(processId, child);
      
      const processInterface = {
        id: processId,
        send: (message) => {
          return new Promise((sendResolve, sendReject) => {
            child.send(message, (error) => {
              if (error) sendReject(error);
              else sendResolve();
            });
          });
        },
        
        on: (event, handler) => {
          child.on(event, handler);
        },
        
        kill: (signal = 'SIGTERM') => {
          child.kill(signal);
        },
        
        disconnect: () => {
          child.disconnect();
        }
      };
      
      child.on('message', (message) => {
        console.log(`[${processId}] Message from child:`, message);
      });
      
      child.on('error', (error) => {
        console.error(`[${processId}] Child process error:`, error);
        this.processes.delete(processId);
        reject(error);
      });
      
      child.on('exit', (code, signal) => {
        console.log(`[${processId}] Child process exited with code ${code}, signal ${signal}`);
        this.processes.delete(processId);
      });
      
      child.on('spawn', () => {
        console.log(`[${processId}] Child process spawned successfully`);
        resolve(processInterface);
      });
    });
  }
  
  // Execute file directly
  execFileProcess(file, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const processId = ++this.processId;
      console.log(`Executing file ${processId}: ${file} ${args.join(' ')}`);
      
      const child = execFile(file, args, {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        ...options
      }, (error, stdout, stderr) => {
        this.processes.delete(processId);
        
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
      
      this.processes.set(processId, child);
    });
  }
  
  // Kill all running processes
  killAllProcesses(signal = 'SIGTERM') {
    console.log(`Killing ${this.processes.size} processes with signal ${signal}`);
    
    for (const [processId, child] of this.processes) {
      try {
        child.kill(signal);
        console.log(`Killed process ${processId}`);
      } catch (error) {
        console.error(`Failed to kill process ${processId}:`, error);
      }
    }
    
    this.processes.clear();
  }
  
  getProcessStats() {
    return {
      totalProcesses: this.processes.size,
      processes: Array.from(this.processes.entries()).map(([id, process]) => ({
        id,
        pid: process.pid,
        killed: process.killed,
        connected: process.connected
      }))
    };
  }
}

// Example child process script (data-processor.js)
if (require.main === module) {
  // This script runs as a child process
  
  process.on('message', async (message) => {
    try {
      const { type, data, requestId } = message;
      
      switch (type) {
        case 'process_data':
          const result = await processLargeDataset(data);
          process.send({
            type: 'result',
            requestId,
            data: result
          });
          break;
          
        case 'health_check':
          process.send({
            type: 'health_response',
            requestId,
            data: {
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              pid: process.pid
            }
          });
          break;
          
        default:
          process.send({
            type: 'error',
            requestId,
            error: `Unknown message type: ${type}`
          });
      }
    } catch (error) {
      process.send({
        type: 'error',
        requestId: message.requestId,
        error: error.message
      });
    }
  });
  
  async function processLargeDataset(data) {
    // Simulate heavy data processing
    const results = [];
    
    for (let i = 0; i < data.length; i++) {
      // CPU-intensive work
      let processed = 0;
      for (let j = 0; j < 10000; j++) {
        processed += Math.sqrt(data[i] * j);
      }
      results.push(processed);
      
      // Report progress
      if (i % 1000 === 0) {
        process.send({
          type: 'progress',
          processed: i,
          total: data.length,
          percentage: Math.round((i / data.length) * 100)
        });
      }
    }
    
    return results;
  }
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Child process received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('Child process received SIGINT, shutting down gracefully...');
    process.exit(0);
  });
  
  console.log(`Child process ${process.pid} started and ready`);
}
```

### Cluster Module for Load Distribution

```javascript
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const express = require('express');

class ClusterManager {
  constructor(workerScript, options = {}) {
    this.workerScript = workerScript;
    this.options = {
      workers: options.workers || numCPUs,
      respawnDelay: options.respawnDelay || 1000,
      maxRespawns: options.maxRespawns || 10,
      gracefulTimeout: options.gracefulTimeout || 30000,
      ...options
    };
    
    this.workerStats = new Map();
    this.respawnCounts = new Map();
    this.isShuttingDown = false;
  }
  
  start() {
    if (cluster.isMaster) {
      this.startMaster();
    } else {
      this.startWorker();
    }
  }
  
  startMaster() {
    console.log(`Master ${process.pid} is running`);
    console.log(`Starting ${this.options.workers} workers...`);
    
    // Fork workers
    for (let i = 0; i < this.options.workers; i++) {
      this.forkWorker();
    }
    
    // Setup master event handlers
    this.setupMasterEventHandlers();
    
    // Setup monitoring
    this.setupMonitoring();
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }
  
  forkWorker() {
    const worker = cluster.fork();
    const workerId = worker.id;
    
    this.workerStats.set(workerId, {
      pid: worker.process.pid,
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      memory: 0,
      cpu: 0
    });
    
    if (!this.respawnCounts.has(workerId)) {
      this.respawnCounts.set(workerId, 0);
    }
    
    console.log(`Worker ${workerId} started with PID ${worker.process.pid}`);
    
    // Setup worker message handling
    worker.on('message', (message) => {
      this.handleWorkerMessage(workerId, message);
    });
    
    return worker;
  }
  
  setupMasterEventHandlers() {
    cluster.on('exit', (worker, code, signal) => {
      const workerId = worker.id;
      console.log(`Worker ${workerId} died (${signal || code}). Restarting...`);
      
      this.workerStats.delete(workerId);
      
      if (!this.isShuttingDown) {
        this.respawnWorker(workerId);
      }
    });
    
    cluster.on('online', (worker) => {
      console.log(`Worker ${worker.id} is online`);
    });
    
    cluster.on('listening', (worker, address) => {
      console.log(`Worker ${worker.id} listening on ${address.address}:${address.port}`);
    });
    
    cluster.on('disconnect', (worker) => {
      console.log(`Worker ${worker.id} disconnected`);
    });
  }
  
  respawnWorker(workerId) {
    const respawnCount = this.respawnCounts.get(workerId) || 0;
    
    if (respawnCount >= this.options.maxRespawns) {
      console.error(`Worker ${workerId} exceeded max respawn limit (${this.options.maxRespawns})`);
      return;
    }
    
    this.respawnCounts.set(workerId, respawnCount + 1);
    
    setTimeout(() => {
      if (!this.isShuttingDown) {
        this.forkWorker();
      }
    }, this.options.respawnDelay);
  }
  
  handleWorkerMessage(workerId, message) {
    const stats = this.workerStats.get(workerId);
    if (!stats) return;
    
    switch (message.type) {
      case 'request':
        stats.requests++;
        break;
        
      case 'error':
        stats.errors++;
        break;
        
      case 'stats':
        stats.memory = message.data.memory;
        stats.cpu = message.data.cpu;
        break;
        
      default:
        console.log(`Unknown message from worker ${workerId}:`, message);
    }
  }
  
  setupMonitoring() {
    setInterval(() => {
      this.collectWorkerStats();
      this.printClusterStats();
    }, 30000); // Every 30 seconds
  }
  
  collectWorkerStats() {
    for (const worker of Object.values(cluster.workers)) {
      if (worker) {
        worker.send({ type: 'get_stats' });
      }
    }
  }
  
  printClusterStats() {
    console.log('\n📊 Cluster Statistics:');
    console.log(`Master PID: ${process.pid}`);
    console.log(`Active Workers: ${Object.keys(cluster.workers).length}`);
    
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const [workerId, stats] of this.workerStats) {
      console.log(`Worker ${workerId}: ${stats.requests} requests, ${stats.errors} errors, ${stats.memory}MB memory`);
      totalRequests += stats.requests;
      totalErrors += stats.errors;
    }
    
    console.log(`Total: ${totalRequests} requests, ${totalErrors} errors`);
    console.log('---');
  }
  
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      this.isShuttingDown = true;
      
      const workers = Object.values(cluster.workers);
      let disconnectedWorkers = 0;
      
      if (workers.length === 0) {
        process.exit(0);
      }
      
      // Disconnect all workers
      workers.forEach((worker) => {
        if (worker) {
          worker.disconnect();
          
          worker.on('disconnect', () => {
            disconnectedWorkers++;
            if (disconnectedWorkers === workers.length) {
              console.log('All workers disconnected. Exiting...');
              process.exit(0);
            }
          });
        }
      });
      
      // Force exit after timeout
      setTimeout(() => {
        console.log('Forcing exit due to timeout...');
        workers.forEach((worker) => {
          if (worker) {
            worker.kill();
          }
        });
        process.exit(1);
      }, this.options.gracefulTimeout);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
  
  startWorker() {
    // Worker process code
    const app = express();
    
    // Middleware to track requests
    app.use((req, res, next) => {
      process.send({ type: 'request' });
      
      res.on('finish', () => {
        if (res.statusCode >= 400) {
          process.send({ type: 'error' });
        }
      });
      
      next();
    });
    
    // Sample routes
    app.get('/', (req, res) => {
      res.json({
        worker: process.pid,
        message: 'Hello from worker!',
        uptime: process.uptime()
      });
    });
    
    app.get('/heavy', (req, res) => {
      // Simulate CPU-intensive work
      const start = Date.now();
      let count = 0;
      
      const work = () => {
        const end = Date.now() + 10; // Work for 10ms chunks
        while (Date.now() < end) {
          count++;
        }
        
        if (Date.now() - start < 1000) { // Work for 1 second total
          setImmediate(work);
        } else {
          res.json({
            worker: process.pid,
            count,
            duration: Date.now() - start
          });
        }
      };
      
      work();
    });
    
    app.get('/memory', (req, res) => {
      const usage = process.memoryUsage();
      res.json({
        worker: process.pid,
        memory: {
          rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
          heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
        }
      });
    });
    
    // Handle stats requests from master
    process.on('message', (message) => {
      if (message.type === 'get_stats') {
        const usage = process.memoryUsage();
        process.send({
          type: 'stats',
          data: {
            memory: Math.round(usage.heapUsed / 1024 / 1024),
            uptime: process.uptime()
          }
        });
      }
    });
    
    const server = app.listen(process.env.PORT || 3000, () => {
      console.log(`Worker ${process.pid} started on port ${server.address().port}`);
    });
    
    // Graceful shutdown for worker
    process.on('SIGTERM', () => {
      console.log(`Worker ${process.pid} received SIGTERM, shutting down gracefully...`);
      
      server.close(() => {
        console.log(`Worker ${process.pid} closed server`);
        process.exit(0);
      });
    });
  }
}

// Usage
const clusterManager = new ClusterManager(__filename, {
  workers: 4,
  respawnDelay: 2000,
  maxRespawns: 5
});

clusterManager.start();
```

## Buffer and Stream Internals

```javascript
// Advanced Buffer Operations and Internals
class BufferInternalsDemo {
  constructor() {
    this.demonstrations = [];
  }
  
  demonstrateBufferAllocation() {
    console.log('=== Buffer Allocation Strategies ===\n');
    
    // 1. Buffer.alloc() - Safe, initialized with zeros
    const safeBuffer = Buffer.alloc(1024);
    console.log('Safe buffer (zeros):', safeBuffer.slice(0, 16));
    
    // 2. Buffer.allocUnsafe() - Fast but uninitialized
    const unsafeBuffer = Buffer.allocUnsafe(1024);
    console.log('Unsafe buffer (random):', unsafeBuffer.slice(0, 16));
    
    // 3. Buffer.allocUnsafeSlow() - Not pooled
    const slowBuffer = Buffer.allocUnsafeSlow(1024);
    console.log('Slow unsafe buffer:', slowBuffer.slice(0, 16));
    
    // 4. Buffer pooling demonstration
    this.demonstrateBufferPooling();
  }
  
  demonstrateBufferPooling() {
    console.log('\n=== Buffer Pooling ===');
    
    // Small buffers (<= 4KB) use internal pooling
    const smallBuffers = [];
    for (let i = 0; i < 10; i++) {
      const buf = Buffer.allocUnsafe(100); // Small buffer - pooled
      smallBuffers.push(buf);
    }
    
    // Large buffers (> 4KB) are allocated individually
    const largeBuffers = [];
    for (let i = 0; i < 3; i++) {
      const buf = Buffer.allocUnsafe(8192); // Large buffer - not pooled
      largeBuffers.push(buf);
    }
    
    console.log('Small buffers created (pooled):', smallBuffers.length);
    console.log('Large buffers created (individual):', largeBuffers.length);
  }
  
  demonstrateBufferOperations() {
    console.log('\n=== Advanced Buffer Operations ===');
    
    // Binary data manipulation
    const buffer = Buffer.alloc(16);
    
    // Writing different data types
    buffer.writeUInt32BE(0x12345678, 0);  // Big-endian 32-bit unsigned int
    buffer.writeUInt32LE(0x12345678, 4);  // Little-endian 32-bit unsigned int
    buffer.writeFloatBE(3.14159, 8);      // Big-endian float
    buffer.writeDoubleBE(2.718281828, 12); // Big-endian double (only 4 bytes left, will overflow)
    
    console.log('Buffer after writes:', buffer);
    
    // Reading data back
    console.log('UInt32BE:', buffer.readUInt32BE(0).toString(16));
    console.log('UInt32LE:', buffer.readUInt32LE(4).toString(16));
    console.log('FloatBE:', buffer.readFloatBE(8));
    
    // Buffer comparison and search
    const buf1 = Buffer.from('hello world');
    const buf2 = Buffer.from('hello world');
    const buf3 = Buffer.from('hello node');
    
    console.log('buf1 equals buf2:', buf1.equals(buf2));
    console.log('buf1 compare buf3:', buf1.compare(buf3));
    console.log('Index of "world":', buf1.indexOf('world'));
  }
  
  demonstrateBufferPerformance() {
    console.log('\n=== Buffer Performance Comparison ===');
    
    const iterations = 1000000;
    
    // String concatenation
    console.time('String concatenation');
    let str = '';
    for (let i = 0; i < iterations; i++) {
      str += 'x';
    }
    console.timeEnd('String concatenation');
    
    // Array join
    console.time('Array join');
    const arr = [];
    for (let i = 0; i < iterations; i++) {
      arr.push('x');
    }
    const joined = arr.join('');
    console.timeEnd('Array join');
    
    // Buffer allocation and write
    console.time('Buffer operations');
    const buffers = [];
    for (let i = 0; i < iterations / 1000; i++) {
      const buf = Buffer.alloc(1000);
      buf.fill('x');
      buffers.push(buf);
    }
    const concatenated = Buffer.concat(buffers);
    console.timeEnd('Buffer operations');
    
    console.log('Results length check:');
    console.log('String:', str.length);
    console.log('Array join:', joined.length);
    console.log('Buffer:', concatenated.length);
  }
  
  demonstrateStreamInternals() {
    console.log('\n=== Stream Internals ===');
    
    const { Readable, Writable, Transform } = require('stream');
    
    // Custom readable stream with detailed logging
    class DetailedReadable extends Readable {
      constructor(options) {
        super(options);
        this.counter = 0;
        this.maxCount = 5;
        
        console.log('Readable stream created with options:', {
          highWaterMark: this.readableHighWaterMark,
          objectMode: this.readableObjectMode
        });
      }
      
      _read(size) {
        console.log(`_read called with size: ${size}`);
        console.log(`Current buffer length: ${this.readableBuffer.length}`);
        
        if (this.counter < this.maxCount) {
          const data = `data-${this.counter++}`;
          console.log(`Pushing data: ${data}`);
          this.push(data);
        } else {
          console.log('Pushing null (end of stream)');
          this.push(null);
        }
      }
    }
    
    // Custom writable stream with detailed logging
    class DetailedWritable extends Writable {
      constructor(options) {
        super(options);
        this.chunks = [];
        
        console.log('Writable stream created with options:', {
          highWaterMark: this.writableHighWaterMark,
          objectMode: this.writableObjectMode
        });
      }
      
      _write(chunk, encoding, callback) {
        console.log(`_write called with chunk: ${chunk} (${encoding})`);
        console.log(`Current buffer length: ${this.writableBuffer.length}`);
        
        this.chunks.push(chunk.toString());
        
        // Simulate async processing
        setImmediate(() => {
          console.log('Write completed');
          callback();
        });
      }
      
      _final(callback) {
        console.log('_final called, all chunks:', this.chunks);
        callback();
      }
    }
    
    // Demonstrate stream flow control
    const readable = new DetailedReadable({ highWaterMark: 16 });
    const writable = new DetailedWritable({ highWaterMark: 16 });
    
    readable.pipe(writable);
    
    writable.on('finish', () => {
      console.log('Writable stream finished');
    });
  }
  
  demonstrateAdvancedStreamPatterns() {
    console.log('\n=== Advanced Stream Patterns ===');
    
    const { Readable, Transform, pipeline } = require('stream');
    
    // Backpressure-aware transform stream
    class BackpressureAwareTransform extends Transform {
      constructor(options) {
        super(options);
        this.processedCount = 0;
        this.maxBuffer = 10;
      }
      
      _transform(chunk, encoding, callback) {
        const input = chunk.toString();
        
        // Check if we should apply backpressure
        if (this.writableBuffer.length > this.maxBuffer) {
          console.log('⚠️ Applying backpressure - buffer too full');
          return callback();
        }
        
        // Simulate processing time
        setTimeout(() => {
          const output = input.toUpperCase();
          this.processedCount++;
          
          console.log(`Processed (${this.processedCount}): ${input} -> ${output}`);
          callback(null, output);
        }, Math.random() * 100);
      }
    }
    
    // Object mode transform stream
    class ObjectTransform extends Transform {
      constructor() {
        super({ objectMode: true });
      }
      
      _transform(obj, encoding, callback) {
        const enhanced = {
          ...obj,
          processed: true,
          timestamp: Date.now(),
          id: Math.random().toString(36).substr(2, 9)
        };
        
        callback(null, enhanced);
      }
    }
    
    // Demonstrate object mode
    const objectStream = new Readable({ objectMode: true });
    const objects = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 }
    ];
    
    let objectIndex = 0;
    objectStream._read = () => {
      if (objectIndex < objects.length) {
        objectStream.push(objects[objectIndex++]);
      } else {
        objectStream.push(null);
      }
    };
    
    const objectTransform = new ObjectTransform();
    
    objectStream
      .pipe(objectTransform)
      .on('data', (obj) => {
        console.log('Enhanced object:', obj);
      })
      .on('end', () => {
        console.log('Object stream processing completed');
      });
  }
}

// Usage and demonstration
const demo = new BufferInternalsDemo();

demo.demonstrateBufferAllocation();
demo.demonstrateBufferOperations();
demo.demonstrateBufferPerformance();
demo.demonstrateStreamInternals();

setTimeout(() => {
  demo.demonstrateAdvancedStreamPatterns();
}, 2000);
```

## Performance Profiling and Optimization

```javascript
// V8 Performance Profiling Tools
class PerformanceProfiler {
  constructor() {
    this.profileData = new Map();
    this.isProfilerAvailable = false;
    
    // Check if profiler flags are available
    try {
      // Requires --allow-natives-syntax flag
      this.isProfilerAvailable = typeof %GetOptimizationStatus === 'function';
    } catch (e) {
      console.log('Native profiler functions not available. Start with --allow-natives-syntax for detailed profiling.');
    }
  }
  
  profileFunction(fn, name, iterations = 10000) {
    console.log(`\n=== Profiling ${name} ===`);
    
    // Warm up phase
    console.log('Warming up...');
    for (let i = 0; i < 1000; i++) {
      fn();
    }
    
    // Check optimization status before profiling
    if (this.isProfilerAvailable) {
      try {
        console.log(`Optimization status before: ${%GetOptimizationStatus(fn)}`);
      } catch (e) {
        // Silently handle if not available
      }
    }
    
    // Actual profiling
    const startTime = process.hrtime.bigint();
    const startCPU = process.cpuUsage();
    
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    
    const endTime = process.hrtime.bigint();
    const endCPU = process.cpuUsage(startCPU);
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const avgTime = duration / iterations;
    
    // Check optimization status after profiling
    if (this.isProfilerAvailable) {
      try {
        console.log(`Optimization status after: ${%GetOptimizationStatus(fn)}`);
      } catch (e) {
        // Silently handle if not available
      }
    }
    
    const results = {
      name,
      iterations,
      totalTime: duration.toFixed(3) + 'ms',
      avgTime: avgTime.toFixed(6) + 'ms',
      cpuUser: endCPU.user,
      cpuSystem: endCPU.system,
      opsPerSecond: Math.round(iterations / (duration / 1000))
    };
    
    this.profileData.set(name, results);
    
    console.log('Results:', results);
    return results;
  }
  
  compareOptimizationStrategies() {
    console.log('\n=== Optimization Strategy Comparison ===');
    
    // Monomorphic vs Polymorphic function calls
    this.compareMonomorphicVsPolymorphic();
    
    // Array access patterns
    this.compareArrayAccessPatterns();
    
    // Object property access
    this.compareObjectPropertyAccess();
    
    // Function inlining
    this.compareFunctionInlining();
  }
  
  compareMonomorphicVsPolymorphic() {
    console.log('\n--- Monomorphic vs Polymorphic ---');
    
    // Monomorphic - always same type
    function monomorphicAdd(a, b) {
      return a + b;
    }
    
    // Polymorphic - different types
    function polymorphicAdd(a, b) {
      return a + b;
    }
    
    // Profile monomorphic function
    const monomorphicTest = () => {
      monomorphicAdd(1, 2); // Always numbers
    };
    
    // Profile polymorphic function
    const polymorphicTest = () => {
      const types = [
        () => polymorphicAdd(1, 2),           // numbers
        () => polymorphicAdd("a", "b"),       // strings
        () => polymorphicAdd(1.5, 2.7),      // floats
        () => polymorphicAdd(BigInt(1), BigInt(2)) // bigints
      ];
      types[Math.floor(Math.random() * types.length)]();
    };
    
    this.profileFunction(monomorphicTest, 'Monomorphic Add', 100000);
    this.profileFunction(polymorphicTest, 'Polymorphic Add', 100000);
  }
  
  compareArrayAccessPatterns() {
    console.log('\n--- Array Access Patterns ---');
    
    const largeArray = new Array(10000).fill(0).map((_, i) => i);
    
    // Sequential access (cache-friendly)
    const sequentialAccess = () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += largeArray[i];
      }
      return sum;
    };
    
    // Random access (cache-unfriendly)
    const randomAccess = () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        const index = Math.floor(Math.random() * largeArray.length);
        sum += largeArray[index];
      }
      return sum;
    };
    
    // Strided access
    const stridedAccess = () => {
      let sum = 0;
      for (let i = 0; i < largeArray.length; i += 100) {
        sum += largeArray[i];
      }
      return sum;
    };
    
    this.profileFunction(sequentialAccess, 'Sequential Array Access', 10000);
    this.profileFunction(randomAccess, 'Random Array Access', 10000);
    this.profileFunction(stridedAccess, 'Strided Array Access', 10000);
  }
  
  compareObjectPropertyAccess() {
    console.log('\n--- Object Property Access ---');
    
    // Objects with consistent shape (hidden class optimization)
    const consistentObjects = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `item${i}`,
      value: i * 2
    }));
    
    // Objects with inconsistent shape (deoptimization)
    const inconsistentObjects = Array.from({ length: 1000 }, (_, i) => {
      const obj = { id: i, name: `item${i}` };
      if (i % 2 === 0) obj.value = i * 2;
      if (i % 3 === 0) obj.extra = 'extra';
      if (i % 5 === 0) obj.timestamp = Date.now();
      return obj;
    });
    
    // Access consistent objects
    const consistentAccess = () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        const obj = consistentObjects[i];
        sum += obj.id + obj.value;
      }
      return sum;
    };
    
    // Access inconsistent objects
    const inconsistentAccess = () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        const obj = inconsistentObjects[i];
        sum += obj.id + (obj.value || 0);
      }
      return sum;
    };
    
    this.profileFunction(consistentAccess, 'Consistent Object Access', 10000);
    this.profileFunction(inconsistentAccess, 'Inconsistent Object Access', 10000);
  }
  
  compareFunctionInlining() {
    console.log('\n--- Function Inlining ---');
    
    // Small function (likely to be inlined)
    function smallFunction(x) {
      return x * 2;
    }
    
    // Large function (unlikely to be inlined)
    function largeFunction(x) {
      let result = x;
      for (let i = 0; i < 10; i++) {
        result = Math.sqrt(result + i);
        result = Math.sin(result);
        result = Math.cos(result);
        result = Math.tan(result);
        result = Math.abs(result);
      }
      return result;
    }
    
    // Test with inline-able function
    const inlinableTest = () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += smallFunction(i);
      }
      return sum;
    };
    
    // Test with non-inline-able function
    const nonInlinableTest = () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += largeFunction(i);
      }
      return sum;
    };
    
    this.profileFunction(inlinableTest, 'Inlinable Function Calls', 10000);
    this.profileFunction(nonInlinableTest, 'Non-inlinable Function Calls', 1000);
  }
  
  profileMemoryAllocations() {
    console.log('\n=== Memory Allocation Patterns ===');
    
    // Object allocation
    const objectAllocation = () => {
      const objects = [];
      for (let i = 0; i < 1000; i++) {
        objects.push({ id: i, data: `item${i}` });
      }
      return objects.length;
    };
    
    // Array allocation
    const arrayAllocation = () => {
      const arrays = [];
      for (let i = 0; i < 1000; i++) {
        arrays.push([i, i * 2, i * 3]);
      }
      return arrays.length;
    };
    
    // Buffer allocation
    const bufferAllocation = () => {
      const buffers = [];
      for (let i = 0; i < 1000; i++) {
        buffers.push(Buffer.alloc(100));
      }
      return buffers.length;
    };
    
    // String allocation
    const stringAllocation = () => {
      const strings = [];
      for (let i = 0; i < 1000; i++) {
        strings.push(`string_${i}_${'x'.repeat(10)}`);
      }
      return strings.length;
    };
    
    this.profileFunction(objectAllocation, 'Object Allocation', 1000);
    this.profileFunction(arrayAllocation, 'Array Allocation', 1000);
    this.profileFunction(bufferAllocation, 'Buffer Allocation', 1000);
    this.profileFunction(stringAllocation, 'String Allocation', 1000);
  }
  
  generateReport() {
    console.log('\n=== Performance Report ===');
    
    const results = Array.from(this.profileData.values());
    results.sort((a, b) => parseFloat(b.avgTime) - parseFloat(a.avgTime));
    
    console.log('\nFunctions ranked by average execution time (slowest first):');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name}`);
      console.log(`   Avg Time: ${result.avgTime}`);
      console.log(`   Ops/sec: ${result.opsPerSecond.toLocaleString()}`);
      console.log('');
    });
  }
}

// CPU Profiling with built-in profiler
class CPUProfiler {
  constructor() {
    this.profiles = new Map();
  }
  
  async startProfiling(name, duration = 10000) {
    console.log(`Starting CPU profile: ${name}`);
    
    // Use the inspector module for CPU profiling
    const inspector = require('inspector');
    const session = new inspector.Session();
    
    return new Promise((resolve, reject) => {
      session.connect();
      
      session.post('Profiler.enable', (err) => {
        if (err) return reject(err);
        
        session.post('Profiler.start', (err) => {
          if (err) return reject(err);
          
          setTimeout(() => {
            session.post('Profiler.stop', (err, { profile }) => {
              if (err) return reject(err);
              
              this.profiles.set(name, profile);
              session.disconnect();
              
              console.log(`CPU profile completed: ${name}`);
              resolve(profile);
            });
          }, duration);
        });
      });
    });
  }
  
  analyzeProfile(name) {
    const profile = this.profiles.get(name);
    if (!profile) {
      console.log(`Profile ${name} not found`);
      return;
    }
    
    console.log(`\n=== CPU Profile Analysis: ${name} ===`);
    
    // Find the most expensive functions
    const nodes = profile.nodes;
    const samples = profile.samples;
    
    // Count samples per function
    const sampleCounts = new Map();
    samples.forEach(sampleId => {
      const node = nodes.find(n => n.id === sampleId);
      if (node && node.callFrame) {
        const functionName = node.callFrame.functionName || '(anonymous)';
        const fileName = node.callFrame.url || '(unknown)';
        const key = `${functionName} (${fileName})`;
        
        sampleCounts.set(key, (sampleCounts.get(key) || 0) + 1);
      }
    });
    
    // Sort by sample count
    const sortedFunctions = Array.from(sampleCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('Top 10 functions by CPU usage:');
    sortedFunctions.forEach(([functionName, count], index) => {
      const percentage = ((count / samples.length) * 100).toFixed(2);
      console.log(`${index + 1}. ${functionName}: ${count} samples (${percentage}%)`);
    });
  }
  
  saveProfile(name, filename) {
    const profile = this.profiles.get(name);
    if (!profile) {
      console.log(`Profile ${name} not found`);
      return;
    }
    
    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(profile, null, 2));
    console.log(`Profile saved to ${filename}`);
    console.log('Load this file in Chrome DevTools > Sources > Profiler');
  }
}

// Heap Memory Analysis
class HeapAnalyzer {
  constructor() {
    this.snapshots = [];
  }
  
  takeSnapshot(name) {
    const v8 = require('v8');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const heapStats = v8.getHeapStatistics();
    const heapSpaceStats = v8.getHeapSpaceStatistics();
    
    const snapshot = {
      name,
      timestamp: new Date(),
      heapStats,
      heapSpaceStats,
      memoryUsage: process.memoryUsage()
    };
    
    this.snapshots.push(snapshot);
    console.log(`Heap snapshot taken: ${name}`);
    
    return snapshot;
  }
  
  compareSnapshots(name1, name2) {
    const snapshot1 = this.snapshots.find(s => s.name === name1);
    const snapshot2 = this.snapshots.find(s => s.name === name2);
    
    if (!snapshot1 || !snapshot2) {
      console.log('One or both snapshots not found');
      return;
    }
    
    console.log(`\n=== Heap Comparison: ${name1} vs ${name2} ===`);
    
    const memDiff = {
      rss: snapshot2.memoryUsage.rss - snapshot1.memoryUsage.rss,
      heapTotal: snapshot2.memoryUsage.heapTotal - snapshot1.memoryUsage.heapTotal,
      heapUsed: snapshot2.memoryUsage.heapUsed - snapshot1.memoryUsage.heapUsed,
      external: snapshot2.memoryUsage.external - snapshot1.memoryUsage.external
    };
    
    console.log('Memory Usage Difference:');
    Object.entries(memDiff).forEach(([key, value]) => {
      const mb = (value / 1024 / 1024).toFixed(2);
      const sign = value >= 0 ? '+' : '';
      console.log(`  ${key}: ${sign}${mb} MB`);
    });
    
    // Heap space analysis
    console.log('\nHeap Space Analysis:');
    snapshot2.heapSpaceStats.forEach((space, index) => {
      const oldSpace = snapshot1.heapSpaceStats[index];
      const sizeDiff = space.space_used_size - oldSpace.space_used_size;
      const sizeMB = (sizeDiff / 1024 / 1024).toFixed(2);
      const sign = sizeDiff >= 0 ? '+' : '';
      
      console.log(`  ${space.space_name}: ${sign}${sizeMB} MB`);
    });
  }
  
  detectMemoryLeaks() {
    if (this.snapshots.length < 2) {
      console.log('Need at least 2 snapshots to detect leaks');
      return;
    }
    
    console.log('\n=== Memory Leak Detection ===');
    
    const recent = this.snapshots.slice(-3); // Last 3 snapshots
    let isLeaking = true;
    
    for (let i = 1; i < recent.length; i++) {
      const current = recent[i];
      const previous = recent[i - 1];
      
      const heapGrowth = current.memoryUsage.heapUsed - previous.memoryUsage.heapUsed;
      const timeDiff = current.timestamp - previous.timestamp;
      
      console.log(`${previous.name} -> ${current.name}:`);
      console.log(`  Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Time difference: ${timeDiff}ms`);
      
      // If heap didn't grow significantly, probably not leaking
      if (heapGrowth < 1024 * 1024) { // Less than 1MB growth
        isLeaking = false;
      }
    }
    
    if (isLeaking) {
      console.log('⚠️  Potential memory leak detected!');
    } else {
      console.log('✅ No obvious memory leaks detected');
    }
  }
}

// Usage examples
console.log('🚀 Starting Advanced Node.js Performance Analysis\n');

// Performance profiling
const profiler = new PerformanceProfiler();
profiler.compareOptimizationStrategies();
profiler.profileMemoryAllocations();
profiler.generateReport();

// Heap analysis
const heapAnalyzer = new HeapAnalyzer();
heapAnalyzer.takeSnapshot('initial');

// Simulate some memory-intensive operations
const largeArray = [];
for (let i = 0; i < 100000; i++) {
  largeArray.push({ id: i, data: `data_${i}` });
}

heapAnalyzer.takeSnapshot('after_allocation');

// Clear some memory
largeArray.length = 50000;

heapAnalyzer.takeSnapshot('after_cleanup');
heapAnalyzer.compareSnapshots('initial', 'after_allocation');
heapAnalyzer.compareSnapshots('after_allocation', 'after_cleanup');
heapAnalyzer.detectMemoryLeaks();

// CPU profiling example
// const cpuProfiler = new CPUProfiler();
// cpuProfiler.startProfiling('cpu_intensive_task', 5000).then(() => {
//   cpuProfiler.analyzeProfile('cpu_intensive_task');
//   cpuProfiler.saveProfile('cpu_intensive_task', 'cpu_profile.cpuprofile');
// });
```

## Best Practices Summary

### ✅ Advanced Node.js Best Practices:

```javascript
// 1. Optimize for V8 hidden classes
class OptimizedUser {
  constructor(id, name, email) {
    // Always initialize properties in the same order
    this.id = id;
    this.name = name;
    this.email = email;
    // Don't add properties dynamically after construction
  }
}

// 2. Use monomorphic functions
function add(a, b) {
  // Always call with same types for optimization
  return a + b;
}

// 3. Avoid memory leaks
class EventManager {
  constructor() {
    this.listeners = new Map();
  }
  
  addListener(event, handler) {
    // Use WeakMap or proper cleanup
    this.listeners.set(event, handler);
  }
  
  cleanup() {
    this.listeners.clear(); // Always clean up references
  }
}

// 4. Use Buffer for binary data
const data = Buffer.from('binary data', 'utf8');
// More efficient than string manipulation for binary data

// 5. Implement proper backpressure
stream.on('data', (chunk) => {
  const writeSuccess = destination.write(chunk);
  if (!writeSuccess) {
    stream.pause();
    destination.once('drain', () => stream.resume());
  }
});
```

### ❌ Performance Anti-patterns:

```javascript
// 1. ❌ Dynamic property addition
const obj = { x: 1 };
obj.y = 2; // Creates new hidden class

// 2. ❌ Polymorphic function calls
function badAdd(a, b) {
  return a + b; // Called with different types
}
badAdd(1, 2);      // numbers
badAdd("a", "b");  // strings - causes deoptimization

// 3. ❌ Memory leaks
const cache = new Map();
setInterval(() => {
  cache.set(Date.now(), data); // Never cleaned up
}, 1000);

// 4. ❌ Blocking the event loop
function blockingOperation() {
  while (Date.now() < Date.now() + 5000) {
    // Blocks for 5 seconds
  }
}

// 5. ❌ Inefficient string operations
let result = '';
for (let i = 0; i < 100000; i++) {
  result += 'x'; // Creates new string each time
}
```

Understanding these advanced Node.js concepts enables you to:
- **Debug performance issues** at the engine level
- **Optimize critical code paths** for maximum performance
- **Prevent memory leaks** and manage resources efficiently
- **Choose the right concurrency model** for your use case
- **Write code that works optimally** with V8's optimization strategies

This knowledge is essential for **senior developers and architects** who need to build high-performance, scalable Node.js applications!
