// Node.js Memory Management and Performance Exercises

const fs = require('fs');
const { performance } = require('perf_hooks');

console.log('=== NODE.JS MEMORY MANAGEMENT & PERFORMANCE EXERCISES ===\n');

// EXERCISE 1: Memory Usage Monitoring
console.log('Exercise 1: Memory Usage Analysis');

function formatMemoryUsage(memUsage) {
  return {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`, // Resident Set Size
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
    arrayBuffers: `${Math.round(memUsage.arrayBuffers / 1024 / 1024)} MB`
  };
}

function memorySnapshot(label) {
  const memUsage = process.memoryUsage();
  console.log(`${label}:`, formatMemoryUsage(memUsage));
  return memUsage;
}

// Baseline memory measurement
const baseline = memorySnapshot('Baseline Memory');

// Memory-intensive operation
function memoryIntensiveOperation() {
  const largeArray = new Array(1000000);
  for (let i = 0; i < largeArray.length; i++) {
    largeArray[i] = {
      id: i,
      data: `Item ${i}`,
      timestamp: Date.now(),
      metadata: { processed: false, priority: Math.random() }
    };
  }
  return largeArray;
}

const afterOperation = memorySnapshot('After Large Array Creation');
const largeData = memoryIntensiveOperation();
const afterIntensive = memorySnapshot('After Memory Intensive Operation');

// Calculate memory increase
const memoryIncrease = afterIntensive.heapUsed - baseline.heapUsed;
console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)} MB\n`);

setTimeout(() => {
  console.log('--- Separator ---\n');
  exerciseTwo();
}, 1000);

// EXERCISE 2: Memory Leaks Detection and Prevention
function exerciseTwo() {
  console.log('Exercise 2: Memory Leaks Demonstration');
  
  // Memory leak example 1: Event listener accumulation
  class LeakyEventEmitter {
    constructor() {
      this.listeners = [];
    }
    
    addListener(event, callback) {
      this.listeners.push({ event, callback });
      console.log(`Added listener. Total: ${this.listeners.length}`);
    }
    
    // Missing removeListener method - causes memory leak
    
    emit(event, data) {
      this.listeners
        .filter(l => l.event === event)
        .forEach(l => l.callback(data));
    }
  }
  
  // Memory leak example 2: Closure variables
  function createLeakyClosure() {
    const largeData = new Array(100000).fill('leak');
    
    return function smallFunction() {
      return 'small result'; // Still holds reference to largeData
    };
  }
  
  // Memory leak example 3: Detached DOM-like objects
  class Node {
    constructor(data) {
      this.data = data;
      this.parent = null;
      this.children = [];
    }
    
    appendChild(child) {
      child.parent = this;
      this.children.push(child);
    }
    
    // Missing proper cleanup method
  }
  
  // Demonstrate leaky patterns
  console.log('--- Leaky Event Emitter ---');
  const leakyEmitter = new LeakyEventEmitter();
  
  // Adding multiple listeners without cleanup
  for (let i = 0; i < 5; i++) {
    leakyEmitter.addListener('test', (data) => {
      console.log(`Listener ${i}: ${data}`);
    });
  }
  
  console.log('\n--- Leaky Closures ---');
  const leakyFunctions = [];
  for (let i = 0; i < 3; i++) {
    leakyFunctions.push(createLeakyClosure());
    console.log(`Created leaky closure ${i + 1}`);
  }
  
  console.log('\n--- Circular References ---');
  const parentNode = new Node('parent');
  const childNode = new Node('child');
  parentNode.appendChild(childNode);
  console.log('Created circular reference: parent ↔ child');
  
  memorySnapshot('After Creating Memory Leaks');
  
  setTimeout(() => exerciseThree(), 1000);
}

// EXERCISE 3: Performance Optimization Techniques
function exerciseThree() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 3: Performance Optimization');
  
  // Performance measurement utility
  function measurePerformance(fn, label, iterations = 1) {
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    
    const end = performance.now();
    const duration = end - start;
    console.log(`${label}: ${duration.toFixed(3)}ms (${iterations} iterations)`);
    return duration;
  }
  
  // Optimization 1: Object creation patterns
  console.log('--- Object Creation Optimization ---');
  
  // Inefficient: Object literal in loop
  function inefficientObjectCreation() {
    const results = [];
    for (let i = 0; i < 10000; i++) {
      results.push({
        id: i,
        name: `User ${i}`,
        active: true,
        metadata: { created: Date.now() }
      });
    }
    return results;
  }
  
  // Efficient: Constructor function with prototype
  function User(id, name) {
    this.id = id;
    this.name = name;
    this.active = true;
    this.metadata = { created: Date.now() };
  }
  
  function efficientObjectCreation() {
    const results = [];
    for (let i = 0; i < 10000; i++) {
      results.push(new User(i, `User ${i}`));
    }
    return results;
  }
  
  measurePerformance(inefficientObjectCreation, 'Object Literals');
  measurePerformance(efficientObjectCreation, 'Constructor Functions');
  
  // Optimization 2: String concatenation
  console.log('\n--- String Concatenation Optimization ---');
  
  function inefficientStringConcat() {
    let result = '';
    for (let i = 0; i < 1000; i++) {
      result += `Item ${i}, `;
    }
    return result;
  }
  
  function efficientStringConcat() {
    const parts = [];
    for (let i = 0; i < 1000; i++) {
      parts.push(`Item ${i}`);
    }
    return parts.join(', ');
  }
  
  measurePerformance(inefficientStringConcat, 'String +=');
  measurePerformance(efficientStringConcat, 'Array join()');
  
  // Optimization 3: Array operations
  console.log('\n--- Array Operations Optimization ---');
  
  const largeArray = Array.from({ length: 100000 }, (_, i) => ({
    id: i,
    value: Math.random(),
    category: i % 3
  }));
  
  function inefficientFiltering() {
    return largeArray
      .filter(item => item.category === 1)
      .map(item => ({ ...item, processed: true }))
      .filter(item => item.value > 0.5);
  }
  
  function efficientFiltering() {
    const result = [];
    for (const item of largeArray) {
      if (item.category === 1 && item.value > 0.5) {
        result.push({ ...item, processed: true });
      }
    }
    return result;
  }
  
  measurePerformance(inefficientFiltering, 'Multiple Array Methods');
  measurePerformance(efficientFiltering, 'Single Loop');
  
  setTimeout(() => exerciseFour(), 1000);
}

// EXERCISE 4: Garbage Collection Monitoring
function exerciseFour() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 4: Garbage Collection Analysis');
  
  // GC monitoring (if --expose-gc flag is used)
  if (global.gc) {
    console.log('Garbage collection is available');
    
    function forceGCAndMeasure(label) {
      const beforeGC = process.memoryUsage();
      console.log(`${label} - Before GC:`, formatMemoryUsage(beforeGC));
      
      global.gc();
      
      const afterGC = process.memoryUsage();
      console.log(`${label} - After GC:`, formatMemoryUsage(afterGC));
      
      const freed = beforeGC.heapUsed - afterGC.heapUsed;
      console.log(`Memory freed: ${Math.round(freed / 1024 / 1024)} MB\n`);
    }
    
    // Create garbage
    let garbageArray = [];
    for (let i = 0; i < 100000; i++) {
      garbageArray.push({ id: i, data: new Array(100).fill('garbage') });
    }
    
    forceGCAndMeasure('After creating garbage');
    
    // Remove references
    garbageArray = null;
    
    forceGCAndMeasure('After removing references');
  } else {
    console.log('GC monitoring not available. Run with: node --expose-gc exercises.js');
  }
  
  // Weak references demonstration (Node.js 14+)
  if (typeof WeakRef !== 'undefined') {
    console.log('--- WeakRef Demonstration ---');
    
    class ExpensiveResource {
      constructor(id) {
        this.id = id;
        this.data = new Array(10000).fill(`Resource ${id}`);
      }
      
      process() {
        return `Processing resource ${this.id}`;
      }
    }
    
    class ResourceManager {
      constructor() {
        this.resources = new Map();
      }
      
      createResource(id) {
        const resource = new ExpensiveResource(id);
        this.resources.set(id, new WeakRef(resource));
        return resource;
      }
      
      getResource(id) {
        const weakRef = this.resources.get(id);
        if (weakRef) {
          const resource = weakRef.deref();
          if (resource) {
            return resource;
          } else {
            console.log(`Resource ${id} has been garbage collected`);
            this.resources.delete(id);
          }
        }
        return null;
      }
    }
    
    const manager = new ResourceManager();
    let resource1 = manager.createResource(1);
    let resource2 = manager.createResource(2);
    
    console.log('Created resources with WeakRef');
    console.log('Resource 1:', manager.getResource(1)?.process());
    console.log('Resource 2:', manager.getResource(2)?.process());
    
    // Remove strong references
    resource1 = null;
    resource2 = null;
    
    setTimeout(() => {
      console.log('\nAfter removing strong references:');
      console.log('Resource 1:', manager.getResource(1)?.process() || 'Not available');
      console.log('Resource 2:', manager.getResource(2)?.process() || 'Not available');
      
      setTimeout(() => exerciseFive(), 1000);
    }, 100);
  } else {
    setTimeout(() => exerciseFive(), 1000);
  }
}

// EXERCISE 5: Performance Profiling and Monitoring
function exerciseFive() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 5: Performance Profiling');
  
  // CPU-intensive function for profiling
  function cpuIntensiveTask(iterations = 1000000) {
    let result = 0;
    for (let i = 0; i < iterations; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    return result;
  }
  
  // Memory-intensive function
  function memoryIntensiveTask() {
    const data = [];
    for (let i = 0; i < 100000; i++) {
      data.push({
        id: i,
        payload: new Array(100).fill(`data-${i}`),
        timestamp: Date.now()
      });
    }
    return data;
  }
  
  // Performance monitoring class
  class PerformanceMonitor {
    constructor() {
      this.metrics = {
        cpuTimes: [],
        memoryUsages: [],
        gcEvents: []
      };
      this.startTime = Date.now();
    }
    
    recordCpuTime(label, duration) {
      this.metrics.cpuTimes.push({
        label,
        duration,
        timestamp: Date.now() - this.startTime
      });
    }
    
    recordMemoryUsage(label) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsages.push({
        label,
        usage,
        timestamp: Date.now() - this.startTime
      });
      return usage;
    }
    
    benchmark(fn, label, iterations = 1) {
      this.recordMemoryUsage(`${label} - Start`);
      
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        fn();
      }
      
      const end = performance.now();
      const duration = end - start;
      
      this.recordCpuTime(label, duration);
      this.recordMemoryUsage(`${label} - End`);
      
      console.log(`${label}: ${duration.toFixed(3)}ms`);
      return duration;
    }
    
    generateReport() {
      console.log('\n--- Performance Report ---');
      
      // CPU performance summary
      console.log('CPU Performance:');
      this.metrics.cpuTimes
        .sort((a, b) => b.duration - a.duration)
        .forEach(metric => {
          console.log(`  ${metric.label}: ${metric.duration.toFixed(3)}ms`);
        });
      
      // Memory usage summary
      console.log('\nMemory Usage:');
      this.metrics.memoryUsages.forEach(metric => {
        const formatted = formatMemoryUsage(metric.usage);
        console.log(`  ${metric.label}: Heap ${formatted.heapUsed}`);
      });
      
      // Peak memory usage
      const peakMemory = this.metrics.memoryUsages.reduce((peak, current) => {
        return current.usage.heapUsed > peak.usage.heapUsed ? current : peak;
      });
      
      console.log(`\nPeak Memory Usage: ${formatMemoryUsage(peakMemory.usage).heapUsed} at ${peakMemory.label}`);
    }
  }
  
  // Run performance tests
  const monitor = new PerformanceMonitor();
  
  console.log('Running performance benchmarks...');
  
  monitor.benchmark(() => cpuIntensiveTask(500000), 'CPU Intensive Task');
  monitor.benchmark(() => memoryIntensiveTask(), 'Memory Intensive Task');
  
  // Test different optimization techniques
  monitor.benchmark(() => {
    const arr = [];
    for (let i = 0; i < 50000; i++) {
      arr.push(i);
    }
    return arr;
  }, 'Array Push');
  
  monitor.benchmark(() => {
    return Array.from({ length: 50000 }, (_, i) => i);
  }, 'Array.from');
  
  monitor.benchmark(() => {
    return new Array(50000).fill(0).map((_, i) => i);
  }, 'Array fill + map');
  
  monitor.generateReport();
  
  setTimeout(() => practicalChallenges(), 1000);
}

// PRACTICAL CHALLENGES
function practicalChallenges() {
  console.log('\n=== PRACTICAL CHALLENGES ===\n');
  
  console.log('Challenge 1: Memory Leak Detector');
  console.log('Challenge 2: Performance Optimization Tool');
  console.log('Challenge 3: Garbage Collection Tuning');
  console.log('Challenge 4: Resource Pool Management');
  console.log('Challenge 5: Real-time Performance Dashboard');
  
  // Challenge 1: Memory Leak Detector
  console.log('\n--- Challenge 1: Memory Leak Detector Implementation ---');
  
  class MemoryLeakDetector {
    constructor(options = {}) {
      this.threshold = options.threshold || 50; // MB
      this.checkInterval = options.interval || 5000; // ms
      this.samples = [];
      this.maxSamples = options.maxSamples || 10;
      this.isMonitoring = false;
    }
    
    start() {
      if (this.isMonitoring) return;
      
      this.isMonitoring = true;
      console.log('Memory leak detector started');
      
      this.intervalId = setInterval(() => {
        this.checkMemory();
      }, this.checkInterval);
    }
    
    stop() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.isMonitoring = false;
        console.log('Memory leak detector stopped');
      }
    }
    
    checkMemory() {
      const usage = process.memoryUsage();
      const sample = {
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss
      };
      
      this.samples.push(sample);
      
      // Keep only recent samples
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
      
      this.detectLeak();
    }
    
    detectLeak() {
      if (this.samples.length < 3) return;
      
      const recent = this.samples.slice(-3);
      const isIncreasing = recent.every((sample, index) => {
        if (index === 0) return true;
        return sample.heapUsed > recent[index - 1].heapUsed;
      });
      
      const totalIncrease = recent[recent.length - 1].heapUsed - recent[0].heapUsed;
      const increaseMB = totalIncrease / 1024 / 1024;
      
      if (isIncreasing && increaseMB > this.threshold) {
        console.log(`🚨 POTENTIAL MEMORY LEAK DETECTED!`);
        console.log(`Memory increased by ${increaseMB.toFixed(2)}MB in last ${recent.length} samples`);
        this.generateLeakReport();
      }
    }
    
    generateLeakReport() {
      console.log('\n--- Memory Leak Report ---');
      console.log('Recent memory usage:');
      
      this.samples.slice(-5).forEach((sample, index) => {
        const heapMB = (sample.heapUsed / 1024 / 1024).toFixed(2);
        const time = new Date(sample.timestamp).toISOString();
        console.log(`  ${index + 1}. ${time}: ${heapMB} MB`);
      });
      
      if (this.samples.length >= 2) {
        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        const growth = (last.heapUsed - first.heapUsed) / 1024 / 1024;
        const timeSpan = (last.timestamp - first.timestamp) / 1000;
        const growthRate = growth / timeSpan * 60; // MB per minute
        
        console.log(`\nGrowth rate: ${growthRate.toFixed(3)} MB/minute`);
      }
    }
  }
  
  // Test the memory leak detector
  const detector = new MemoryLeakDetector({
    threshold: 10, // Lower threshold for demo
    interval: 1000,
    maxSamples: 5
  });
  
  detector.start();
  
  // Simulate memory leak
  let leakyData = [];
  const leakInterval = setInterval(() => {
    // Add data that won't be cleaned up
    for (let i = 0; i < 10000; i++) {
      leakyData.push({
        id: Date.now() + i,
        data: new Array(100).fill('leak'),
        timestamp: new Date()
      });
    }
  }, 1500);
  
  // Stop the leak and detector after demo
  setTimeout(() => {
    clearInterval(leakInterval);
    detector.stop();
    leakyData = null; // Clean up
    console.log('\nDemo completed - leak stopped and detector stopped');
    
    setTimeout(() => {
      console.log('\n=== END EXERCISES ===');
      console.log('\n💡 Advanced Tips:');
      console.log('• Use --inspect flag to debug memory issues');
      console.log('• Use --max-old-space-size to increase heap limit');
      console.log('• Monitor production apps with clinic.js or 0x');
      console.log('• Consider using Worker Threads for CPU-intensive tasks');
    }, 2000);
  }, 8000);
}

// Additional utility functions
function simulateMemoryPressure() {
  const data = [];
  for (let i = 0; i < 1000000; i++) {
    data.push({ id: i, payload: Math.random() });
  }
  return data;
}

function simulateCpuPressure(duration = 1000) {
  const start = Date.now();
  let result = 0;
  while (Date.now() - start < duration) {
    result += Math.random();
  }
  return result;
}

console.log('Starting memory management exercises...\n');