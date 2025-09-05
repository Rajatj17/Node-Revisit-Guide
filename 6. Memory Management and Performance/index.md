# Node.js Memory Management & Performance Optimization

Memory management and performance are **critical** for production Node.js applications. Understanding these concepts is what separates senior developers from juniors.

## V8 Memory Model

### Memory Structure

```javascript
// V8 Memory Layout
/*
┌─────────────────────────────────────┐
│            V8 Process               │
├─────────────────────────────────────┤
│  Stack Memory (Function calls)     │  ← Small, fast, automatic cleanup
├─────────────────────────────────────┤
│  Heap Memory                       │
│  ┌─────────────────────────────────┐│
│  │  New Space (Young Generation)  ││  ← Short-lived objects
│  │  - Eden Space                  ││
│  │  - From Space                  ││
│  │  - To Space                    ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  Old Space (Old Generation)    ││  ← Long-lived objects
│  │  - Old Pointer Space           ││
│  │  - Old Data Space              ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  Large Object Space            ││  ← Objects > 1MB
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
*/

// Check memory usage
function checkMemoryUsage() {
  const used = process.memoryUsage();
  console.log({
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,        // Resident Set Size
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`, // Total heap
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,   // Used heap
    external: `${Math.round(used.external / 1024 / 1024)} MB`,   // External memory
    arrayBuffers: `${Math.round(used.arrayBuffers / 1024 / 1024)} MB` // ArrayBuffers
  });
}

setInterval(checkMemoryUsage, 5000);
```

### Garbage Collection Algorithms

```javascript
// Force garbage collection (for debugging only)
// Start node with: node --expose-gc app.js
if (global.gc) {
  console.log('GC available');
  
  // Manual garbage collection
  global.gc();
  console.log('After GC:', process.memoryUsage());
}

// Monitor GC events
// Start with: node --trace-gc app.js
// This will log GC events to console

// Programmatic GC monitoring
const v8 = require('v8');

// Get heap statistics
function getHeapStats() {
  const stats = v8.getHeapStatistics();
  return {
    totalHeapSize: Math.round(stats.total_heap_size / 1024 / 1024),
    usedHeapSize: Math.round(stats.used_heap_size / 1024 / 1024),
    heapSizeLimit: Math.round(stats.heap_size_limit / 1024 / 1024),
    mallocedMemory: Math.round(stats.malloced_memory / 1024 / 1024),
    peakMallocedMemory: Math.round(stats.peak_malloced_memory / 1024 / 1024)
  };
}

console.log('Heap Statistics:', getHeapStats());
```

## Memory Leaks - Identification and Prevention

### Common Memory Leak Patterns

```javascript
// 1. ❌ Global Variables Accumulation
let users = []; // Global array that keeps growing

function addUser(user) {
  users.push(user); // Never cleaned up
}

// ✅ Better: Use local scope or implement cleanup
class UserManager {
  constructor() {
    this.users = new Map();
    this.maxUsers = 10000;
  }
  
  addUser(user) {
    if (this.users.size >= this.maxUsers) {
      // Remove oldest users
      const oldestKey = this.users.keys().next().value;
      this.users.delete(oldestKey);
    }
    this.users.set(user.id, user);
  }
  
  cleanup() {
    this.users.clear();
  }
}

// 2. ❌ Event Listener Leaks
const EventEmitter = require('events');
const emitter = new EventEmitter();

function createHandler() {
  const data = new Array(1000000).fill('data'); // Large data
  
  return function handler() {
    console.log('Event received');
    // data is still referenced, preventing GC
  };
}

// This creates memory leaks
for (let i = 0; i < 1000; i++) {
  emitter.on('event', createHandler());
}

// ✅ Better: Remove listeners and avoid closures over large data
class EventManager {
  constructor() {
    this.emitter = new EventEmitter();
    this.handlers = new Set();
  }
  
  addHandler(event, handler) {
    this.emitter.on(event, handler);
    this.handlers.add({ event, handler });
  }
  
  cleanup() {
    this.handlers.forEach(({ event, handler }) => {
      this.emitter.removeListener(event, handler);
    });
    this.handlers.clear();
  }
}

// 3. ❌ Timer Leaks
function createLeakyTimer() {
  const largeData = new Array(1000000).fill('data');
  
  setInterval(() => {
    console.log('Timer tick');
    // largeData is still referenced
  }, 1000);
}

// ✅ Better: Clear timers and avoid large closures
class TimerManager {
  constructor() {
    this.timers = new Set();
  }
  
  createTimer(callback, interval) {
    const timerId = setInterval(callback, interval);
    this.timers.add(timerId);
    return timerId;
  }
  
  clearTimer(timerId) {
    clearInterval(timerId);
    this.timers.delete(timerId);
  }
  
  cleanup() {
    this.timers.forEach(timerId => clearInterval(timerId));
    this.timers.clear();
  }
}

// 4. ❌ Closure Memory Leaks
function createClosureLeak() {
  const largeArray = new Array(1000000).fill('data');
  const smallData = 'small';
  
  return function() {
    return smallData; // Entire closure context is retained
  };
}

// ✅ Better: Minimize closure scope
function createOptimizedClosure() {
  const smallData = 'small';
  // Don't capture large objects in closure
  
  return function() {
    return smallData;
  };
}
```

### Memory Leak Detection

```javascript
// Memory leak detector
class MemoryLeakDetector {
  constructor() {
    this.samples = [];
    this.alertThreshold = 100; // MB
    this.isMonitoring = false;
  }
  
  startMonitoring(interval = 10000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.collectSample();
    }, interval);
    
    console.log('Memory leak detection started');
  }
  
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.isMonitoring = false;
      console.log('Memory leak detection stopped');
    }
  }
  
  collectSample() {
    const usage = process.memoryUsage();
    const sample = {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss
    };
    
    this.samples.push(sample);
    
    // Keep only last 100 samples
    if (this.samples.length > 100) {
      this.samples.shift();
    }
    
    this.analyzeMemoryTrend();
  }
  
  analyzeMemoryTrend() {
    if (this.samples.length < 10) return;
    
    const recentSamples = this.samples.slice(-10);
    const oldSamples = this.samples.slice(-20, -10);
    
    const recentAvg = recentSamples.reduce((sum, s) => sum + s.heapUsed, 0) / recentSamples.length;
    const oldAvg = oldSamples.reduce((sum, s) => sum + s.heapUsed, 0) / oldSamples.length;
    
    const growthRate = (recentAvg - oldAvg) / oldAvg;
    const currentMB = recentAvg / 1024 / 1024;
    
    if (growthRate > 0.1 && currentMB > this.alertThreshold) {
      console.warn(`⚠️  Memory leak detected! Growth rate: ${(growthRate * 100).toFixed(2)}%, Current usage: ${currentMB.toFixed(2)}MB`);
      this.generateReport();
    }
  }
  
  generateReport() {
    const latest = this.samples[this.samples.length - 1];
    const oldest = this.samples[0];
    
    console.log('📊 Memory Usage Report:');
    console.log(`Duration: ${(latest.timestamp - oldest.timestamp) / 1000}s`);
    console.log(`Heap growth: ${((latest.heapUsed - oldest.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Current heap: ${(latest.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`RSS growth: ${((latest.rss - oldest.rss) / 1024 / 1024).toFixed(2)}MB`);
  }
}

// Usage
const detector = new MemoryLeakDetector();
detector.startMonitoring(5000);

// Cleanup on exit
process.on('SIGINT', () => {
  detector.stopMonitoring();
  process.exit(0);
});
```

## Heap Snapshots and Profiling

```javascript
const v8 = require('v8');
const fs = require('fs');

// Generate heap snapshot
function takeHeapSnapshot(filename) {
  const snapshotStream = v8.getHeapSnapshot();
  const fileStream = fs.createWriteStream(filename);
  
  snapshotStream.pipe(fileStream);
  
  return new Promise((resolve, reject) => {
    fileStream.on('finish', () => {
      console.log(`Heap snapshot saved to ${filename}`);
      resolve(filename);
    });
    
    fileStream.on('error', reject);
  });
}

// Automated heap snapshot comparison
class HeapProfiler {
  constructor() {
    this.snapshots = [];
  }
  
  async captureBaseline() {
    const filename = `heap-baseline-${Date.now()}.heapsnapshot`;
    await takeHeapSnapshot(filename);
    this.snapshots.push({ type: 'baseline', filename, timestamp: Date.now() });
  }
  
  async captureAfterOperation(operationName) {
    // Force GC before snapshot
    if (global.gc) {
      global.gc();
      global.gc(); // Run twice for thorough cleanup
    }
    
    const filename = `heap-after-${operationName}-${Date.now()}.heapsnapshot`;
    await takeHeapSnapshot(filename);
    this.snapshots.push({ 
      type: 'after_operation', 
      operation: operationName,
      filename, 
      timestamp: Date.now() 
    });
  }
  
  generateReport() {
    console.log('📈 Heap Snapshot Report:');
    this.snapshots.forEach(snapshot => {
      console.log(`${snapshot.type}: ${snapshot.filename}`);
    });
    console.log('Import these files into Chrome DevTools > Memory tab for analysis');
  }
}

// Usage example
async function profileMemoryUsage() {
  const profiler = new HeapProfiler();
  
  // Take baseline
  await profiler.captureBaseline();
  
  // Perform operations
  const users = [];
  for (let i = 0; i < 100000; i++) {
    users.push({ id: i, name: `User ${i}`, data: new Array(100).fill(i) });
  }
  
  await profiler.captureAfterOperation('user-creation');
  
  // Clear users
  users.length = 0;
  
  await profiler.captureAfterOperation('user-cleanup');
  
  profiler.generateReport();
}

// Run profiling
// profileMemoryUsage();
```

## Event Loop Optimization

```javascript
// ❌ Blocking the event loop
function blockingOperation() {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    // Blocks for 5 seconds
  }
  return 'Done';
}

// ✅ Non-blocking with setImmediate
function nonBlockingOperation(callback) {
  let count = 0;
  const total = 1000000;
  
  function processChunk() {
    const chunkSize = 10000;
    const end = Math.min(count + chunkSize, total);
    
    while (count < end) {
      // Process individual item
      count++;
    }
    
    if (count < total) {
      setImmediate(processChunk); // Yield control back to event loop
    } else {
      callback('Done');
    }
  }
  
  processChunk();
}

// Event loop monitoring
class EventLoopMonitor {
  constructor() {
    this.samples = [];
    this.alertThreshold = 100; // ms
  }
  
  start() {
    this.measureEventLoopDelay();
  }
  
  measureEventLoopDelay() {
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      
      this.samples.push({ timestamp: Date.now(), delay });
      
      if (delay > this.alertThreshold) {
        console.warn(`⚠️  Event loop delay: ${delay.toFixed(2)}ms`);
      }
      
      // Keep only last 100 samples
      if (this.samples.length > 100) {
        this.samples.shift();
      }
      
      setTimeout(() => this.measureEventLoopDelay(), 1000);
    });
  }
  
  getAverageDelay() {
    if (this.samples.length === 0) return 0;
    
    const sum = this.samples.reduce((acc, sample) => acc + sample.delay, 0);
    return sum / this.samples.length;
  }
  
  getReport() {
    const avgDelay = this.getAverageDelay();
    const maxDelay = Math.max(...this.samples.map(s => s.delay));
    
    return {
      averageDelay: avgDelay.toFixed(2),
      maxDelay: maxDelay.toFixed(2),
      samplesCount: this.samples.length
    };
  }
}

const monitor = new EventLoopMonitor();
monitor.start();

// Report every 30 seconds
setInterval(() => {
  console.log('Event Loop Report:', monitor.getReport());
}, 30000);
```

## Worker Threads for CPU-Intensive Tasks

```javascript
// main.js
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

if (isMainThread) {
  // Main thread code
  class WorkerPool {
    constructor(workerScript, poolSize = os.cpus().length) {
      this.workerScript = workerScript;
      this.poolSize = poolSize;
      this.workers = [];
      this.taskQueue = [];
      this.createWorkers();
    }
    
    createWorkers() {
      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(__filename, {
          workerData: { isWorker: true }
        });
        
        worker.isReady = true;
        worker.on('message', (result) => {
          worker.isReady = true;
          worker.currentResolve(result);
          this.processQueue();
        });
        
        worker.on('error', (error) => {
          worker.isReady = true;
          worker.currentReject(error);
          this.processQueue();
        });
        
        this.workers.push(worker);
      }
    }
    
    async execute(data) {
      return new Promise((resolve, reject) => {
        this.taskQueue.push({ data, resolve, reject });
        this.processQueue();
      });
    }
    
    processQueue() {
      if (this.taskQueue.length === 0) return;
      
      const availableWorker = this.workers.find(w => w.isReady);
      if (!availableWorker) return;
      
      const task = this.taskQueue.shift();
      availableWorker.isReady = false;
      availableWorker.currentResolve = task.resolve;
      availableWorker.currentReject = task.reject;
      
      availableWorker.postMessage(task.data);
    }
    
    terminate() {
      this.workers.forEach(worker => worker.terminate());
    }
  }
  
  // Usage
  async function demo() {
    const pool = new WorkerPool(__filename, 4);
    
    console.log('Starting CPU-intensive tasks...');
    const start = Date.now();
    
    // Process multiple tasks in parallel
    const tasks = Array.from({ length: 8 }, (_, i) => 
      pool.execute({ numbers: Array.from({ length: 1000000 }, (_, j) => i * 1000000 + j) })
    );
    
    const results = await Promise.all(tasks);
    
    console.log(`Completed in ${Date.now() - start}ms`);
    console.log('Results:', results.map(r => r.sum));
    
    pool.terminate();
  }
  
  demo();
  
} else {
  // Worker thread code
  parentPort.on('message', (data) => {
    // CPU-intensive calculation
    const sum = data.numbers.reduce((acc, num) => acc + num, 0);
    const squares = data.numbers.map(num => num * num);
    const average = sum / data.numbers.length;
    
    parentPort.postMessage({
      sum,
      average,
      count: data.numbers.length
    });
  });
}
```

## Streaming for Large Data Processing

```javascript
const fs = require('fs');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

// ❌ Memory-intensive approach
async function processLargeFileInMemory(filename) {
  const data = await fs.promises.readFile(filename, 'utf8');
  const lines = data.split('\n');
  const processed = lines.map(line => line.toUpperCase());
  await fs.promises.writeFile('output.txt', processed.join('\n'));
}

// ✅ Memory-efficient streaming approach
class LineProcessor extends Transform {
  constructor() {
    super({ objectMode: true });
    this.buffer = '';
    this.processedCount = 0;
  }
  
  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line
    
    for (const line of lines) {
      if (line.trim()) {
        const processed = this.processLine(line);
        this.push(processed + '\n');
        this.processedCount++;
        
        // Report progress
        if (this.processedCount % 10000 === 0) {
          console.log(`Processed ${this.processedCount} lines`);
        }
      }
    }
    
    callback();
  }
  
  _flush(callback) {
    if (this.buffer.trim()) {
      const processed = this.processLine(this.buffer);
      this.push(processed + '\n');
    }
    console.log(`Total processed: ${this.processedCount} lines`);
    callback();
  }
  
  processLine(line) {
    // Complex processing logic
    return line.toUpperCase().split('').reverse().join('');
  }
}

async function processLargeFileWithStreams(inputFile, outputFile) {
  try {
    await pipeline(
      fs.createReadStream(inputFile),
      new LineProcessor(),
      fs.createWriteStream(outputFile)
    );
    
    console.log('File processing completed');
  } catch (error) {
    console.error('Processing failed:', error);
  }
}

// Memory usage comparison
function monitorMemoryDuringProcessing() {
  const interval = setInterval(() => {
    const usage = process.memoryUsage();
    console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
  }, 1000);
  
  return () => clearInterval(interval);
}

// Usage
async function demo() {
  const stopMonitoring = monitorMemoryDuringProcessing();
  
  try {
    await processLargeFileWithStreams('large-input.txt', 'processed-output.txt');
  } finally {
    stopMonitoring();
  }
}
```

## Caching Strategies

```javascript
// 1. In-Memory Cache with TTL
class MemoryCache {
  constructor(maxSize = 1000, defaultTTL = 300000) { // 5 minutes
    this.cache = new Map();
    this.timers = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.hits = 0;
    this.misses = 0;
  }
  
  set(key, value, ttl = this.defaultTTL) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }
    
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    this.cache.set(key, value);
    
    // Set expiration
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);
    
    this.timers.set(key, timer);
  }
  
  get(key) {
    if (this.cache.has(key)) {
      this.hits++;
      return this.cache.get(key);
    } else {
      this.misses++;
      return undefined;
    }
  }
  
  delete(key) {
    this.cache.delete(key);
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }
  
  clear() {
    this.cache.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
  
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  // Memory efficient serialization for monitoring
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, value] of this.cache) {
      totalSize += JSON.stringify({ key, value }).length * 2; // rough estimate
    }
    
    return Math.round(totalSize / 1024); // KB
  }
}

// 2. LRU Cache Implementation
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }
  
  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }
  
  size() {
    return this.cache.size;
  }
}

// 3. Cache with compression for large objects
const zlib = require('zlib');

class CompressedCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  async set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      const compressed = await new Promise((resolve, reject) => {
        zlib.gzip(serialized, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      this.cache.set(key, compressed);
    } catch (error) {
      console.error('Cache compression failed:', error);
    }
  }
  
  async get(key) {
    try {
      const compressed = this.cache.get(key);
      if (!compressed) return undefined;
      
      const decompressed = await new Promise((resolve, reject) => {
        zlib.gunzip(compressed, (err, result) => {
          if (err) reject(err);
          else resolve(result.toString());
        });
      });
      
      return JSON.parse(decompressed);
    } catch (error) {
      console.error('Cache decompression failed:', error);
      return undefined;
    }
  }
}

// Usage example
const cache = new MemoryCache(5000, 600000); // 5000 items, 10 minutes TTL

// Cache middleware for Express
function cacheMiddleware(ttl = 300000) {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cached = cache.get(key);
    
    if (cached) {
      console.log('Cache hit:', key);
      return res.json(cached);
    }
    
    // Override res.json to cache response
    const originalJson = res.json;
    res.json = function(data) {
      cache.set(key, data, ttl);
      console.log('Cache set:', key);
      return originalJson.call(this, data);
    };
    
    next();
  };
}
```

## Cluster Mode for Scalability

```javascript
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const express = require('express');

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  
  // Track worker performance
  const workerStats = new Map();
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    
    workerStats.set(worker.process.pid, {
      requests: 0,
      errors: 0,
      startTime: Date.now()
    });
    
    // Monitor worker messages
    worker.on('message', (msg) => {
      if (msg.type === 'request') {
        const stats = workerStats.get(worker.process.pid);
        stats.requests++;
      } else if (msg.type === 'error') {
        const stats = workerStats.get(worker.process.pid);
        stats.errors++;
      }
    });
  }
  
  // Handle worker death
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    workerStats.delete(worker.process.pid);
    
    // Restart worker
    const newWorker = cluster.fork();
    workerStats.set(newWorker.process.pid, {
      requests: 0,
      errors: 0,
      startTime: Date.now()
    });
  });
  
  // Report stats every 30 seconds
  setInterval(() => {
    console.log('\n📊 Cluster Stats:');
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const [pid, stats] of workerStats) {
      const uptime = (Date.now() - stats.startTime) / 1000;
      const rps = stats.requests / uptime;
      
      console.log(`Worker ${pid}: ${stats.requests} requests, ${stats.errors} errors, ${rps.toFixed(2)} req/s`);
      totalRequests += stats.requests;
      totalErrors += stats.errors;
    }
    
    console.log(`Total: ${totalRequests} requests, ${totalErrors} errors`);
  }, 30000);
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Master received SIGTERM, shutting down workers...');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });
  
} else {
  // Worker process
  const app = express();
  
  // Middleware to track requests
  app.use((req, res, next) => {
    process.send({ type: 'request' });
    next();
  });
  
  // Error handling
  app.use((err, req, res, next) => {
    process.send({ type: 'error' });
    next(err);
  });
  
  // Sample route
  app.get('/', (req, res) => {
    res.json({
      pid: process.pid,
      message: 'Hello from worker!'
    });
  });
  
  // CPU-intensive route
  app.get('/heavy', (req, res) => {
    const start = Date.now();
    let count = 0;
    
    // Non-blocking CPU work
    function work() {
      const end = Date.now() + 10; // Work for 10ms chunks
      while (Date.now() < end) {
        count++;
      }
      
      if (Date.now() - start < 1000) { // Work for 1 second total
        setImmediate(work);
      } else {
        res.json({
          pid: process.pid,
          count,
          duration: Date.now() - start
        });
      }
    }
    
    work();
  });
  
  const server = app.listen(3000, () => {
    console.log(`Worker```javascript
  const server = app.listen(3000, () => {
    console.log(`Worker ${process.pid} started on port 3000`);
  });
  
  // Graceful shutdown for workers
  process.on('SIGTERM', () => {
    console.log(`Worker ${process.pid} received SIGTERM`);
    
    server.close(() => {
      console.log(`Worker ${process.pid} closed server`);
      process.exit(0);
    });
  });
}
```

## Database Connection Pooling

```javascript
const mysql = require('mysql2/promise');

// Connection pool for better performance
class DatabasePool {
  constructor(config) {
    this.pool = mysql.createPool({
      ...config,
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true
    });
    
    this.stats = {
      totalQueries: 0,
      slowQueries: 0,
      errors: 0
    };
    
    this.monitorPool();
  }
  
  async query(sql, params = []) {
    const start = Date.now();
    
    try {
      const [rows] = await this.pool.execute(sql, params);
      
      const duration = Date.now() - start;
      this.stats.totalQueries++;
      
      if (duration > 1000) { // Slow query threshold
        this.stats.slowQueries++;
        console.warn(`Slow query (${duration}ms): ${sql.substring(0, 100)}...`);
      }
      
      return rows;
    } catch (error) {
      this.stats.errors++;
      console.error('Query failed:', error.message);
      throw error;
    }
  }
  
  async transaction(callback) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  monitorPool() {
    setInterval(() => {
      const poolStats = {
        totalConnections: this.pool.pool._allConnections.length,
        freeConnections: this.pool.pool._freeConnections.length,
        usedConnections: this.pool.pool._allConnections.length - this.pool.pool._freeConnections.length,
        pendingAcquires: this.pool.pool._acquiringConnections.length
      };
      
      console.log('🏊 Pool Stats:', {
        ...poolStats,
        queries: this.stats
      });
      
      // Alert if pool is getting full
      if (poolStats.usedConnections / poolStats.totalConnections > 0.8) {
        console.warn('⚠️  Database pool usage high:', poolStats);
      }
    }, 30000);
  }
  
  async close() {
    await this.pool.end();
  }
}

// Usage
const db = new DatabasePool({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'mydb'
});

// Example with connection pooling
async function getUsersEfficiently(limit = 100) {
  try {
    const users = await db.query(
      'SELECT id, name, email FROM users LIMIT ?',
      [limit]
    );
    return users;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}
```

## Performance Monitoring

```javascript
// Comprehensive performance monitor
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      responseTimes: [],
      memoryUsage: [],
      cpuUsage: [],
      eventLoopDelay: []
    };
    
    this.startTime = Date.now();
    this.isMonitoring = false;
  }
  
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.collectSystemMetrics();
    this.measureEventLoopDelay();
    
    console.log('📊 Performance monitoring started');
  }
  
  stop() {
    this.isMonitoring = false;
    console.log('📊 Performance monitoring stopped');
  }
  
  // Express middleware
  middleware() {
    return (req, res, next) => {
      const start = process.hrtime.bigint();
      this.metrics.requests++;
      
      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Number(process.hrtime.bigint() - start) / 1000000; // ms
        
        this.metrics.responses++;
        this.metrics.responseTimes.push(duration);
        
        // Keep only last 1000 response times
        if (this.metrics.responseTimes.length > 1000) {
          this.metrics.responseTimes.shift();
        }
        
        // Log slow requests
        if (duration > 1000) {
          console.warn(`🐌 Slow request: ${req.method} ${req.url} - ${duration.toFixed(2)}ms`);
        }
        
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }
  
  collectSystemMetrics() {
    if (!this.isMonitoring) return;
    
    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss
    });
    
    // CPU usage
    const cpuUsage = process.cpuUsage();
    this.metrics.cpuUsage.push({
      timestamp: Date.now(),
      user: cpuUsage.user,
      system: cpuUsage.system
    });
    
    // Keep only last 100 samples
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.shift();
    }
    if (this.metrics.cpuUsage.length > 100) {
      this.metrics.cpuUsage.shift();
    }
    
    setTimeout(() => this.collectSystemMetrics(), 5000);
  }
  
  measureEventLoopDelay() {
    if (!this.isMonitoring) return;
    
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // ms
      this.metrics.eventLoopDelay.push(delay);
      
      if (this.metrics.eventLoopDelay.length > 100) {
        this.metrics.eventLoopDelay.shift();
      }
      
      setTimeout(() => this.measureEventLoopDelay(), 1000);
    });
  }
  
  getReport() {
    const uptime = (Date.now() - this.startTime) / 1000;
    const responseTimes = this.metrics.responseTimes;
    const memUsage = this.metrics.memoryUsage;
    const eventLoopDelays = this.metrics.eventLoopDelay;
    
    // Calculate statistics
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    
    const p95ResponseTime = responseTimes.length > 0
      ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
      : 0;
    
    const avgMemory = memUsage.length > 0
      ? memUsage.reduce((a, b) => a + b.heapUsed, 0) / memUsage.length / 1024 / 1024
      : 0;
    
    const avgEventLoopDelay = eventLoopDelays.length > 0
      ? eventLoopDelays.reduce((a, b) => a + b, 0) / eventLoopDelays.length
      : 0;
    
    return {
      uptime: uptime.toFixed(2) + 's',
      requests: this.metrics.requests,
      responses: this.metrics.responses,
      errors: this.metrics.errors,
      requestsPerSecond: (this.metrics.requests / uptime).toFixed(2),
      averageResponseTime: avgResponseTime.toFixed(2) + 'ms',
      p95ResponseTime: p95ResponseTime.toFixed(2) + 'ms',
      averageMemoryUsage: avgMemory.toFixed(2) + 'MB',
      averageEventLoopDelay: avgEventLoopDelay.toFixed(2) + 'ms',
      currentMemory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + 'MB'
    };
  }
  
  // Export metrics for external monitoring systems
  getMetricsForPrometheus() {
    const report = this.getReport();
    
    return [
      `# HELP nodejs_requests_total Total number of requests`,
      `# TYPE nodejs_requests_total counter`,
      `nodejs_requests_total ${this.metrics.requests}`,
      
      `# HELP nodejs_response_time_seconds Response time in seconds`,
      `# TYPE nodejs_response_time_seconds histogram`,
      `nodejs_response_time_seconds_sum ${this.metrics.responseTimes.reduce((a, b) => a + b, 0) / 1000}`,
      `nodejs_response_time_seconds_count ${this.metrics.responseTimes.length}`,
      
      `# HELP nodejs_memory_usage_bytes Memory usage in bytes`,
      `# TYPE nodejs_memory_usage_bytes gauge`,
      `nodejs_memory_usage_bytes ${process.memoryUsage().heapUsed}`,
      
      `# HELP nodejs_event_loop_delay_seconds Event loop delay in seconds`,
      `# TYPE nodejs_event_loop_delay_seconds gauge`,
      `nodejs_event_loop_delay_seconds ${this.metrics.eventLoopDelay[this.metrics.eventLoopDelay.length - 1] / 1000 || 0}`
    ].join('\n');
  }
}

// Usage with Express
const express = require('express');
const app = express();

const monitor = new PerformanceMonitor();
monitor.start();

app.use(monitor.middleware());

// Performance endpoint
app.get('/metrics', (req, res) => {
  res.json(monitor.getReport());
});

// Prometheus metrics endpoint
app.get('/metrics/prometheus', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(monitor.getMetricsForPrometheus());
});

// Report every minute
setInterval(() => {
  console.log('📈 Performance Report:', monitor.getReport());
}, 60000);
```

## Best Practices Summary

### ✅ Memory Management Best Practices:

```javascript
// 1. Use WeakMap for temporary object associations
const weakCache = new WeakMap();

function attachMetadata(obj, metadata) {
  weakCache.set(obj, metadata); // Automatically GC'd when obj is GC'd
}

// 2. Implement object pooling for frequently created objects
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }
  
  acquire() {
    return this.pool.length > 0 ? this.pool.pop() : this.createFn();
  }
  
  release(obj) {
    this.resetFn(obj);
    this.pool.push(obj);
  }
}

// 3. Use Buffer.allocUnsafe() for performance (when safe)
function createBuffer(size) {
  // Faster but uninitialized memory
  const buffer = Buffer.allocUnsafe(size);
  buffer.fill(0); // Initialize if needed
  return buffer;
}

// 4. Implement graceful degradation under memory pressure
process.on('warning', (warning) => {
  if (warning.name === 'MaxListenersExceededWarning') {
    console.warn('Memory pressure detected, clearing caches...');
    cache.clear();
  }
});
```

### ❌ Common Performance Pitfalls:

```javascript
// 1. ❌ Creating objects in hot paths
function badPerformance(items) {
  return items.map(item => {
    return { // New object every time
      processed: item.value * 2,
      timestamp: new Date() // New Date every time
    };
  });
}

// ✅ Reuse objects and optimize allocations
const sharedResult = { processed: 0, timestamp: null };
function goodPerformance(items) {
  const now = Date.now();
  return items.map(item => {
    sharedResult.processed = item.value * 2;
    sharedResult.timestamp = now;
    return { ...sharedResult }; // Single spread per item
  });
}

// 2. ❌ Synchronous operations in request handlers
app.get('/bad', (req, res) => {
  const data = fs.readFileSync('large-file.txt'); // Blocks event loop
  res.send(data);
});

// ✅ Use asynchronous operations
app.get('/good', async (req, res) => {
  try {
    const data = await fs.promises.readFile('large-file.txt');
    res.send(data);
  } catch (error) {
    res.status(500).send('Error reading file');
  }
});
```

Understanding memory management and performance optimization is crucial for building Node.js applications that can handle production load efficiently and reliably!