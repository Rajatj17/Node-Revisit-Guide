# Event Loop Scheduling and Microtask Queue Management - Deep Dive

This is **expert-level** Node.js knowledge that demonstrates deep understanding of JavaScript runtime internals and asynchronous execution models.

## Event Loop Architecture and Phases

### Complete Event Loop Implementation Understanding

```javascript
// Event Loop Phase Simulation and Analysis
class EventLoopSimulator {
  constructor() {
    this.phases = {
      timers: [],
      pendingCallbacks: [],
      idle: [],
      poll: [],
      check: [],
      close: []
    };
    
    this.microtaskQueue = {
      nextTick: [],
      promises: []
    };
    
    this.isRunning = false;
    this.currentPhase = null;
    this.phaseIndex = 0;
    this.iterationCount = 0;
  }
  
  // Simulate how Node.js schedules different types of callbacks
  scheduleTimer(callback, delay = 0) {
    const timer = {
      callback,
      executeAt: Date.now() + delay,
      id: Math.random().toString(36),
      type: 'setTimeout'
    };
    
    this.phases.timers.push(timer);
    console.log(`⏰ Timer scheduled: ${timer.id} (delay: ${delay}ms)`);
    return timer.id;
  }
  
  scheduleImmediate(callback) {
    const immediate = {
      callback,
      id: Math.random().toString(36),
      type: 'setImmediate'
    };
    
    this.phases.check.push(immediate);
    console.log(`⚡ Immediate scheduled: ${immediate.id}`);
    return immediate.id;
  }
  
  scheduleNextTick(callback) {
    const nextTick = {
      callback,
      id: Math.random().toString(36),
      type: 'process.nextTick'
    };
    
    this.microtaskQueue.nextTick.push(nextTick);
    console.log(`🔄 NextTick scheduled: ${nextTick.id}`);
    return nextTick.id;
  }
  
  schedulePromise(callback) {
    const promise = {
      callback,
      id: Math.random().toString(36),
      type: 'Promise'
    };
    
    this.microtaskQueue.promises.push(promise);
    console.log(`🎯 Promise microtask scheduled: ${promise.id}`);
    return promise.id;
  }
  
  scheduleIO(callback, type = 'fs') {
    const io = {
      callback,
      id: Math.random().toString(36),
      type: `I/O (${type})`,
      completed: false
    };
    
    // Simulate I/O completion
    setTimeout(() => {
      io.completed = true;
      this.phases.poll.push(io);
      console.log(`💾 I/O completed: ${io.id}`);
    }, Math.random() * 100);
    
    return io.id;
  }
  
  // Process microtasks with correct priority
  processMicrotasks() {
    console.log('\n🧹 Processing Microtasks...');
    let processedCount = 0;
    
    // Process ALL nextTick callbacks first
    while (this.microtaskQueue.nextTick.length > 0) {
      const nextTick = this.microtaskQueue.nextTick.shift();
      console.log(`  ↳ Executing nextTick: ${nextTick.id}`);
      
      try {
        nextTick.callback();
        processedCount++;
      } catch (error) {
        console.error(`Error in nextTick ${nextTick.id}:`, error);
      }
    }
    
    // Then process Promise microtasks
    while (this.microtaskQueue.promises.length > 0) {
      const promise = this.microtaskQueue.promises.shift();
      console.log(`  ↳ Executing Promise microtask: ${promise.id}`);
      
      try {
        promise.callback();
        processedCount++;
      } catch (error) {
        console.error(`Error in Promise microtask ${promise.id}:`, error);
      }
    }
    
    console.log(`🧹 Processed ${processedCount} microtasks\n`);
    return processedCount;
  }
  
  // Execute specific event loop phase
  executePhase(phaseName) {
    const callbacks = this.phases[phaseName];
    if (callbacks.length === 0) return 0;
    
    console.log(`\n📍 Executing ${phaseName.toUpperCase()} phase`);
    let executedCount = 0;
    
    switch (phaseName) {
      case 'timers':
        executedCount = this.executeTimerPhase();
        break;
      case 'pendingCallbacks':
        executedCount = this.executePendingCallbacks();
        break;
      case 'poll':
        executedCount = this.executePollPhase();
        break;
      case 'check':
        executedCount = this.executeCheckPhase();
        break;
      case 'close':
        executedCount = this.executeClosePhase();
        break;
      default:
        console.log(`  ↳ Phase ${phaseName} - no callbacks`);
    }
    
    console.log(`📍 ${phaseName.toUpperCase()} phase completed (${executedCount} callbacks)\n`);
    return executedCount;
  }
  
  executeTimerPhase() {
    const now = Date.now();
    const readyTimers = [];
    
    // Find expired timers
    this.phases.timers = this.phases.timers.filter(timer => {
      if (timer.executeAt <= now) {
        readyTimers.push(timer);
        return false;
      }
      return true;
    });
    
    // Execute expired timers
    readyTimers.forEach(timer => {
      console.log(`  ↳ Executing timer: ${timer.id}`);
      try {
        timer.callback();
      } catch (error) {
        console.error(`Error in timer ${timer.id}:`, error);
      }
    });
    
    return readyTimers.length;
  }
  
  executePendingCallbacks() {
    const callbacks = this.phases.pendingCallbacks.splice(0);
    
    callbacks.forEach(callback => {
      console.log(`  ↳ Executing pending callback: ${callback.id}`);
      try {
        callback.callback();
      } catch (error) {
        console.error(`Error in pending callback ${callback.id}:`, error);
      }
    });
    
    return callbacks.length;
  }
  
  executePollPhase() {
    const readyIO = this.phases.poll.splice(0);
    
    readyIO.forEach(io => {
      console.log(`  ↳ Executing I/O callback: ${io.id}`);
      try {
        io.callback();
      } catch (error) {
        console.error(`Error in I/O callback ${io.id}:`, error);
      }
    });
    
    return readyIO.length;
  }
  
  executeCheckPhase() {
    const immediates = this.phases.check.splice(0);
    
    immediates.forEach(immediate => {
      console.log(`  ↳ Executing immediate: ${immediate.id}`);
      try {
        immediate.callback();
      } catch (error) {
        console.error(`Error in immediate ${immediate.id}:`, error);
      }
    });
    
    return immediates.length;
  }
  
  executeClosePhase() {
    const closeCallbacks = this.phases.close.splice(0);
    
    closeCallbacks.forEach(closeCallback => {
      console.log(`  ↳ Executing close callback: ${closeCallback.id}`);
      try {
        closeCallback.callback();
      } catch (error) {
        console.error(`Error in close callback ${closeCallback.id}:`, error);
      }
    });
    
    return closeCallbacks.length;
  }
  
  // Run one complete event loop iteration
  runSingleIteration() {
    this.iterationCount++;
    console.log(`\n🔄 === Event Loop Iteration ${this.iterationCount} ===`);
    
    const phaseOrder = ['timers', 'pendingCallbacks', 'idle', 'poll', 'check', 'close'];
    let totalCallbacks = 0;
    
    for (const phase of phaseOrder) {
      totalCallbacks += this.executePhase(phase);
      
      // Process microtasks between each phase
      const microtaskCount = this.processMicrotasks();
      totalCallbacks += microtaskCount;
    }
    
    console.log(`🔄 Iteration ${this.iterationCount} completed (${totalCallbacks} total callbacks)`);
    return totalCallbacks > 0;
  }
  
  // Check if event loop should continue
  hasWork() {
    const hasTimers = this.phases.timers.length > 0;
    const hasPending = this.phases.pendingCallbacks.length > 0;
    const hasPoll = this.phases.poll.length > 0;
    const hasCheck = this.phases.check.length > 0;
    const hasClose = this.phases.close.length > 0;
    const hasMicrotasks = this.microtaskQueue.nextTick.length > 0 || 
                         this.microtaskQueue.promises.length > 0;
    
    return hasTimers || hasPending || hasPoll || hasCheck || hasClose || hasMicrotasks;
  }
  
  // Start the event loop simulation
  start() {
    if (this.isRunning) {
      console.log('Event loop is already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 Starting Event Loop Simulation\n');
    
    const runLoop = () => {
      if (!this.hasWork()) {
        console.log('\n✅ Event loop finished - no more work to do');
        this.isRunning = false;
        return;
      }
      
      const hadWork = this.runSingleIteration();
      
      if (this.isRunning && hadWork) {
        // Use setImmediate to yield control
        setImmediate(runLoop);
      } else {
        this.isRunning = false;
        console.log('\n✅ Event loop simulation completed');
      }
    };
    
    runLoop();
  }
  
  // Get current state
  getState() {
    return {
      isRunning: this.isRunning,
      iterationCount: this.iterationCount,
      pendingWork: {
        timers: this.phases.timers.length,
        pendingCallbacks: this.phases.pendingCallbacks.length,
        poll: this.phases.poll.length,
        check: this.phases.check.length,
        close: this.phases.close.length,
        nextTick: this.microtaskQueue.nextTick.length,
        promises: this.microtaskQueue.promises.length
      }
    };
  }
}

// Demonstration of complex scheduling scenarios
function demonstrateEventLoopScheduling() {
  const simulator = new EventLoopSimulator();
  
  console.log('🎭 Setting up complex scheduling scenario...\n');
  
  // Schedule various types of callbacks
  simulator.scheduleNextTick(() => {
    console.log('  → NextTick 1 executed');
    simulator.schedulePromise(() => console.log('    → Promise from NextTick 1'));
  });
  
  simulator.schedulePromise(() => {
    console.log('  → Promise 1 executed');
    simulator.scheduleNextTick(() => console.log('    → NextTick from Promise 1'));
  });
  
  simulator.scheduleTimer(() => {
    console.log('  → Timer 1 executed');
    simulator.scheduleImmediate(() => console.log('    → Immediate from Timer 1'));
  }, 0);
  
  simulator.scheduleImmediate(() => {
    console.log('  → Immediate 1 executed');
    simulator.scheduleNextTick(() => console.log('    → NextTick from Immediate 1'));
  });
  
  simulator.scheduleIO(() => {
    console.log('  → I/O callback executed');
    simulator.schedulePromise(() => console.log('    → Promise from I/O'));
  });
  
  // Start the simulation
  simulator.start();
}

// Real-world event loop analysis
class EventLoopAnalyzer {
  constructor() {
    this.measurements = [];
    this.isAnalyzing = false;
  }
  
  startAnalysis() {
    if (this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    this.measurements = [];
    
    console.log('🔬 Starting real event loop analysis...\n');
    this.measureEventLoopDelay();
  }
  
  measureEventLoopDelay() {
    if (!this.isAnalyzing) return;
    
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      
      this.measurements.push({
        delay,
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage(),
        activeHandles: process._getActiveHandles().length,
        activeRequests: process._getActiveRequests().length
      });
      
      if (delay > 10) {
        console.log(`⚠️  High event loop delay detected: ${delay.toFixed(2)}ms`);
      }
      
      // Continue measuring
      setTimeout(() => this.measureEventLoopDelay(), 100);
    });
  }
  
  stopAnalysis() {
    this.isAnalyzing = false;
    console.log('\n📊 Event loop analysis completed');
    this.generateReport();
  }
  
  generateReport() {
    if (this.measurements.length === 0) return;
    
    const delays = this.measurements.map(m => m.delay);
    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
    const maxDelay = Math.max(...delays);
    const minDelay = Math.min(...delays);
    const p95Delay = delays.sort((a, b) => a - b)[Math.floor(delays.length * 0.95)];
    
    console.log('📈 Event Loop Performance Report:');
    console.log(`  Average delay: ${avgDelay.toFixed(3)}ms`);
    console.log(`  Min delay: ${minDelay.toFixed(3)}ms`);
    console.log(`  Max delay: ${maxDelay.toFixed(3)}ms`);
    console.log(`  95th percentile: ${p95Delay.toFixed(3)}ms`);
    console.log(`  Total measurements: ${this.measurements.length}`);
    
    const highDelayCount = delays.filter(d => d > 10).length;
    console.log(`  High delay events (>10ms): ${highDelayCount} (${(highDelayCount / delays.length * 100).toFixed(2)}%)`);
  }
  
  simulateEventLoopBlocking(durationMs) {
    console.log(`🚫 Simulating ${durationMs}ms blocking operation...`);
    const start = Date.now();
    while (Date.now() - start < durationMs) {
      // Intentionally block the event loop
    }
    console.log(`🚫 Blocking operation completed`);
  }
}
```

## Microtask Queue Deep Dive

### Microtask Priority and Execution Order

```javascript
// Comprehensive microtask queue analysis
class MicrotaskAnalyzer {
  constructor() {
    this.executionOrder = [];
    this.microtaskTypes = new Map();
  }
  
  demonstrateMicrotaskPriority() {
    console.log('🎯 Demonstrating Microtask Priority Order\n');
    
    this.resetTracking();
    
    // Schedule various types of microtasks and macrotasks
    this.scheduleNextTick('NextTick-1', () => {
      this.logExecution('NextTick-1');
      this.scheduleNextTick('Nested-NextTick', () => {
        this.logExecution('Nested-NextTick');
      });
    });
    
    this.schedulePromise('Promise-1', () => {
      this.logExecution('Promise-1');
      this.schedulePromise('Nested-Promise', () => {
        this.logExecution('Nested-Promise');
      });
    });
    
    this.scheduleQueueMicrotask('QueueMicrotask-1', () => {
      this.logExecution('QueueMicrotask-1');
    });
    
    setTimeout(() => {
      this.logExecution('Timer-1');
      this.scheduleNextTick('Timer-NextTick', () => {
        this.logExecution('Timer-NextTick');
      });
    }, 0);
    
    setImmediate(() => {
      this.logExecution('Immediate-1');
    });
    
    this.scheduleNextTick('NextTick-2', () => {
      this.logExecution('NextTick-2');
    });
    
    this.schedulePromise('Promise-2', () => {
      this.logExecution('Promise-2');
    });
    
    this.logExecution('Synchronous-1');
    
    // Print results after all execution
    setTimeout(() => {
      this.printExecutionOrder();
    }, 50);
  }
  
  scheduleNextTick(id, callback) {
    process.nextTick(() => {
      callback();
    });
    this.microtaskTypes.set(id, 'process.nextTick');
  }
  
  schedulePromise(id, callback) {
    Promise.resolve().then(() => {
      callback();
    });
    this.microtaskTypes.set(id, 'Promise');
  }
  
  scheduleQueueMicrotask(id, callback) {
    queueMicrotask(() => {
      callback();
    });
    this.microtaskTypes.set(id, 'queueMicrotask');
  }
  
  logExecution(id) {
    const timestamp = process.hrtime.bigint();
    const type = this.microtaskTypes.get(id) || 'Synchronous';
    
    this.executionOrder.push({
      id,
      type,
      timestamp,
      order: this.executionOrder.length
    });
    
    console.log(`[${type}] ${id} - executed at ${timestamp}`);
  }
  
  resetTracking() {
    this.executionOrder = [];
    this.microtaskTypes.clear();
  }
  
  printExecutionOrder() {
    console.log('\n📋 Execution Order Summary:');
    console.log('=' .repeat(50));
    
    const grouped = {};
    this.executionOrder.forEach(item => {
      if (!grouped[item.type]) {
        grouped[item.type] = [];
      }
      grouped[item.type].push(item);
    });
    
    // Print in execution order
    this.executionOrder.forEach((item, index) => {
      console.log(`${index + 1}. [${item.type}] ${item.id}`);
    });
    
    console.log('\n📊 Execution Summary by Type:');
    Object.entries(grouped).forEach(([type, items]) => {
      console.log(`${type}: ${items.map(i => i.id).join(', ')}`);
    });
  }
  
  // Demonstrate microtask starvation
  demonstrateMicrotaskStarvation() {
    console.log('\n⚠️  Demonstrating Microtask Starvation\n');
    
    let microtaskCount = 0;
    const maxMicrotasks = 1000000;
    
    function recursiveMicrotask() {
      if (microtaskCount < maxMicrotasks) {
        microtaskCount++;
        
        if (microtaskCount % 100000 === 0) {
          console.log(`Microtask ${microtaskCount} - timer callbacks are starved`);
        }
        
        // This creates infinite microtask recursion
        queueMicrotask(recursiveMicrotask);
      } else {
        console.log('✅ Microtask starvation demo completed');
      }
    }
    
    // This timer will be starved by the recursive microtasks
    setTimeout(() => {
      console.log('🎯 Timer callback executed (should be delayed)');
    }, 1);
    
    console.log('Starting recursive microtasks...');
    recursiveMicrotask();
  }
  
  // Demonstrate proper microtask management
  demonstrateProperMicrotaskManagement() {
    console.log('\n✅ Demonstrating Proper Microtask Management\n');
    
    let taskCount = 0;
    const maxTasks = 1000000;
    const batchSize = 1000;
    
    function processTaskBatch() {
      const batchEnd = Math.min(taskCount + batchSize, maxTasks);
      
      while (taskCount < batchEnd) {
        taskCount++;
        // Process individual task
      }
      
      if (taskCount % 100000 === 0) {
        console.log(`Processed ${taskCount} tasks - event loop remains responsive`);
      }
      
      if (taskCount < maxTasks) {
        // Yield control back to event loop
        setImmediate(processTaskBatch);
      } else {
        console.log('✅ All tasks processed without starving the event loop');
      }
    }
    
    // This timer should execute promptly
    setTimeout(() => {
      console.log('🎯 Timer callback executed on time');
    }, 10);
    
    console.log('Starting batch processing...');
    processTaskBatch();
  }
}

// Advanced microtask queue introspection
class MicrotaskIntrospector {
  constructor() {
    this.hooks = [];
    this.isHooked = false;
  }
  
  // Hook into microtask execution
  hookMicrotasks() {
    if (this.isHooked) return;
    
    // Override Promise.prototype.then to track promise microtasks
    const originalThen = Promise.prototype.then;
    Promise.prototype.then = function(...args) {
      console.log('🔍 Promise.then microtask queued');
      return originalThen.apply(this, args);
    };
    
    // Override process.nextTick
    const originalNextTick = process.nextTick;
    process.nextTick = function(callback, ...args) {
      console.log('🔍 process.nextTick queued');
      return originalNextTick.call(this, callback, ...args);
    };
    
    // Override queueMicrotask
    const originalQueueMicrotask = globalThis.queueMicrotask;
    globalThis.queueMicrotask = function(callback) {
      console.log('🔍 queueMicrotask queued');
      return originalQueueMicrotask.call(this, callback);
    };
    
    this.isHooked = true;
    console.log('🪝 Microtask hooks installed\n');
  }
  
  // Analyze microtask queue depth
  analyzeMicrotaskDepth() {
    console.log('📏 Analyzing Microtask Queue Depth\n');
    
    let depth = 0;
    const maxDepth = 10;
    
    function deepMicrotask() {
      depth++;
      console.log(`  Microtask depth: ${depth}`);
      
      if (depth < maxDepth) {
        queueMicrotask(deepMicrotask);
      } else {
        console.log(`📏 Maximum depth reached: ${depth}\n`);
      }
    }
    
    queueMicrotask(deepMicrotask);
  }
  
  // Measure microtask execution time
  measureMicrotaskPerformance() {
    console.log('⏱️  Measuring Microtask Performance\n');
    
    const iterations = 100000;
    
    // Measure process.nextTick
    console.time('process.nextTick performance');
    let nextTickCount = 0;
    
    function nextTickTest() {
      nextTickCount++;
      if (nextTickCount < iterations) {
        process.nextTick(nextTickTest);
      } else {
        console.timeEnd('process.nextTick performance');
        
        // Measure Promise microtasks
        console.time('Promise microtask performance');
        let promiseCount = 0;
        
        function promiseTest() {
          promiseCount++;
          if (promiseCount < iterations) {
            Promise.resolve().then(promiseTest);
          } else {
            console.timeEnd('Promise microtask performance');
            
            // Measure queueMicrotask
            console.time('queueMicrotask performance');
            let queueCount = 0;
            
            function queueTest() {
              queueCount++;
              if (queueCount < iterations) {
                queueMicrotask(queueTest);
              } else {
                console.timeEnd('queueMicrotask performance');
                console.log('⏱️  Performance measurement completed\n');
              }
            }
            
            queueMicrotask(queueTest);
          }
        }
        
        Promise.resolve().then(promiseTest);
      }
    }
    
    process.nextTick(nextTickTest);
  }
}
```

## Advanced Scheduling Patterns

### Custom Scheduler Implementation

```javascript
// Custom priority-based scheduler
class PriorityScheduler {
  constructor() {
    this.queues = new Map([
      ['immediate', []],    // Highest priority
      ['high', []],
      ['normal', []],
      ['low', []],
      ['background', []]    // Lowest priority
    ]);
    
    this.isProcessing = false;
    this.stats = {
      tasksExecuted: 0,
      totalExecutionTime: 0,
      queueStats: new Map()
    };
    
    this.maxBatchSize = 100;
    this.maxExecutionTime = 16; // Target 60fps (16ms per frame)
  }
  
  schedule(task, priority = 'normal') {
    if (!this.queues.has(priority)) {
      throw new Error(`Invalid priority: ${priority}`);
    }
    
    const wrappedTask = {
      id: Math.random().toString(36),
      task,
      priority,
      scheduledAt: Date.now(),
      executedAt: null
    };
    
    this.queues.get(priority).push(wrappedTask);
    
    if (!this.isProcessing) {
      this.startProcessing();
    }
    
    return wrappedTask.id;
  }
  
  startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processQueues();
  }
  
  processQueues() {
    const frameStart = performance.now();
    let tasksProcessed = 0;
    
    // Process queues in priority order
    for (const [priority, queue] of this.queues) {
      if (queue.length === 0) continue;
      
      while (queue.length > 0 && 
             tasksProcessed < this.maxBatchSize &&
             (performance.now() - frameStart) < this.maxExecutionTime) {
        
        const wrappedTask = queue.shift();
        this.executeTask(wrappedTask);
        tasksProcessed++;
      }
      
      // Stop if we've used up our time budget
      if ((performance.now() - frameStart) >= this.maxExecutionTime) {
        break;
      }
    }
    
    // Schedule next processing cycle
    if (this.hasWork()) {
      // Use MessageChannel for better scheduling
      if (typeof MessageChannel !== 'undefined') {
        const channel = new MessageChannel();
        channel.port2.onmessage = () => this.processQueues();
        channel.port1.postMessage(null);
      } else {
        setImmediate(() => this.processQueues());
      }
    } else {
      this.isProcessing = false;
    }
  }
  
  executeTask(wrappedTask) {
    const start = performance.now();
    wrappedTask.executedAt = Date.now();
    
    try {
      wrappedTask.task();
      
      const executionTime = performance.now() - start;
      this.updateStats(wrappedTask.priority, executionTime);
      
    } catch (error) {
      console.error(`Task ${wrappedTask.id} failed:`, error);
    }
  }
  
  updateStats(priority, executionTime) {
    this.stats.tasksExecuted++;
    this.stats.totalExecutionTime += executionTime;
    
    if (!this.stats.queueStats.has(priority)) {
      this.stats.queueStats.set(priority, {
        count: 0,
        totalTime: 0,
        avgTime: 0
      });
    }
    
    const queueStat = this.stats.queueStats.get(priority);
    queueStat.count++;
    queueStat.totalTime += executionTime;
    queueStat.avgTime = queueStat.totalTime / queueStat.count;
  }
  
  hasWork() {
    for (const queue of this.queues.values()) {
      if (queue.length > 0) return true;
    }
    return false;
  }
  
  getStats() {
    return {
      ...this.stats,
      averageExecutionTime: this.stats.totalExecutionTime / this.stats.tasksExecuted,
      queueLengths: Object.fromEntries(
        Array.from(this.queues.entries()).map(([priority, queue]) => [priority, queue.length])
      )
    };
  }
  
  // Cancel all tasks of a specific priority
  cancelTasks(priority) {
    if (this.queues.has(priority)) {
      const canceledCount = this.queues.get(priority).length;
      this.queues.get(priority).length = 0;
      return canceledCount;
    }
    return 0;
  }
}

// Time-slicing scheduler for long-running tasks
class TimeSlicingScheduler {
  constructor() {
    this.timeSlice = 5; // 5ms time slices
    this.tasks = [];
    this.isRunning = false;
  }
  
  scheduleTask(task, estimatedDuration) {
    const slicedTask = {
      id: Math.random().toString(36),
      task,
      estimatedDuration,
      completed: false,
      progress: 0
    };
    
    this.tasks.push(slicedTask);
    
    if (!this.isRunning) {
      this.startProcessing();
    }
    
    return slicedTask.id;
  }
  
  startProcessing() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.processTimeSlice();
  }
  
  processTimeSlice() {
    const sliceStart = performance.now();
    
    while (this.tasks.length > 0 && (performance.now() - sliceStart) < this.timeSlice) {
      
      const task = this.tasks[0];
      
      if (task.completed) {
        this.tasks.shift();
        continue;
      }
      
      try {
        // Execute task for a portion of the time slice
        const taskStart = performance.now();
        const maxTaskTime = this.timeSlice - (performance.now() - sliceStart);
        
        if (maxTaskTime <= 0) break;
        
        const result = task.task(task.progress, maxTaskTime);
        
        if (result && result.completed) {
          task.completed = true;
          task.progress = 1;
          console.log(`✅ Task ${task.id} completed`);
        } else if (result && result.progress !== undefined) {
          task.progress = result.progress;
          console.log(`⏳ Task ${task.id} progress: ${(task.progress * 100).toFixed(1)}%`);
        }
        
        const taskDuration = performance.now() - taskStart;
        
        // If task took too long, move it to the end of queue
        if (taskDuration > this.timeSlice * 2) {
          console.warn(`⚠️ Task ${task.id} exceeded time slice`);
          this.tasks.push(this.tasks.shift());
        } else if (task.completed) {
          this.tasks.shift();
        }
        
      } catch (error) {
        console.error(`❌ Task ${task.id} failed:`, error);
        this.tasks.shift();
      }
    }
    
    // Schedule next time slice
    if (this.tasks.length > 0) {
      setImmediate(() => this.processTimeSlice());
    } else {
      this.isRunning = false;
      console.log('🏁 All time-sliced tasks completed');
    }
  }
  
  // Create a time-sliceable task from a regular function
  static createSliceableTask(heavyFunction, data) {
    let currentIndex = 0;
    const totalItems = data.length;
    
    return function timeSlicedTask(progress, maxTime) {
      const startTime = performance.now();
      const startIndex = currentIndex;
      
      while (currentIndex < totalItems && 
             (performance.now() - startTime) < maxTime * 0.8) { // Leave some buffer
        
        heavyFunction(data[currentIndex]);
        currentIndex++;
      }
      
      const newProgress = currentIndex / totalItems;
      const completed = currentIndex >= totalItems;
      
      console.log(`  Processed items ${startIndex}-${currentIndex-1} of ${totalItems}`);
      
      return { progress: newProgress, completed };
    };
  }
}

// Cooperative multitasking scheduler
class CooperativeScheduler {
  constructor() {
    this.tasks = new Map();
    this.runningTask = null;
    this.isSchedulerRunning = false;
    this.yieldRequests = 0;
  }
  
  addTask(id, taskGenerator) {
    const task = {
      id,
      generator: taskGenerator,
      iterator: null,
      status: 'pending',
      startTime: null,
      lastYield: null
    };
    
    this.tasks.set(id, task);
    
    if (!this.isSchedulerRunning) {
      this.startScheduler();
    }
    
    return id;
  }
  
  startScheduler() {
    if (this.isSchedulerRunning) return;
    
    this.isSchedulerRunning = true;
    this.scheduleNextTask();
  }
  
  scheduleNextTask() {
    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'pending' || task.status === 'yielded');
    
    if (pendingTasks.length === 0) {
      this.isSchedulerRunning = false;
      console.log('🏁 All cooperative tasks completed');
      return;
    }
    
    // Round-robin scheduling
    const task = pendingTasks[0];
    this.executeTask(task);
  }
  
  executeTask(task) {
    this.runningTask = task;
    
    if (!task.iterator) {
      task.iterator = task.generator();
      task.status = 'running';
      task.startTime = Date.now();
    }
    
    task.lastYield = Date.now();
    
    try {
      const result = task.iterator.next();
      
      if (result.done) {
        task.status = 'completed';
        this.tasks.delete(task.id);
        console.log(`✅ Task ${task.id} completed`);
      } else {
        task.status = 'yielded';
        this.yieldRequests++;
        console.log(`⏸️ Task ${task.id} yielded (${this.yieldRequests} total yields)`);
      }
    } catch (error) {
      task.status = 'error';
      this.tasks.delete(task.id);
      console.error(`❌ Task ${task.id} failed:`, error);
    }
    
    this.runningTask = null;
    
    // Schedule next task
    setImmediate(() => this.scheduleNextTask());
  }
  
  // Helper function for tasks to yield
  static *createCooperativeTask(workFunction, data, batchSize = 100) {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      console.log(`  Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)}`);
      
      for (const item of batch) {
        workFunction(item);
      }
      
      // Yield control back to scheduler
      yield;
    }
  }
  
  getCurrentTask() {
    return this.runningTask;
  }
  
  getStatus() {
    const tasks = Array.from(this.tasks.values());
    return {
      totalTasks: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      yielded: tasks.filter(t => t.status === 'yielded').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      totalYields: this.yieldRequests
    };
  }
}
```

## Advanced Event Loop Debugging and Optimization

```javascript
// Event loop diagnostics and optimization tool
class EventLoopDiagnostics {
  constructor() {
    this.activeTimers = new Set();
    this.activeImmediates = new Set();
    this.activePromises = new Set();
    this.activeIO = new Set();
    
    this.lagHistory = [];
    this.blockingThreshold = 10; // ms
    this.isMonitoring = false;
    
    this.setupHooks();
  }
  
  setupHooks() {
    // Hook setTimeout
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (...args) => {
      const timer = originalSetTimeout(...args);
      this.activeTimers.add(timer);
      
      const originalClear = timer._onTimeout;
      timer._onTimeout = (...clearArgs) => {
        this.activeTimers.delete(timer);
        return originalClear?.(...clearArgs);
      };
      
      return timer;
    };
    
    // Hook setImmediate
    const originalSetImmediate = global.setImmediate;
    global.setImmediate = (...args) => {
      const immediate = originalSetImmediate(...args);
      this.activeImmediates.add(immediate);
      
      // Note: There's no easy way to hook immediate completion
      // This is a simplified implementation
      
      return immediate;
    };
    
    console.log('🔧 Event loop hooks installed');
  }
  
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lagHistory = [];
    
    console.log('🔍 Starting event loop monitoring...\n');
    this.measureLag();
  }
  
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('🔍 Event loop monitoring stopped');
    this.generateDiagnosticReport();
  }
  
  measureLag() {
    if (!this.isMonitoring) return;
    
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // ms
      
      const measurement = {
        lag,
        timestamp: Date.now(),
        activeHandles: process._getActiveHandles().length,
        activeRequests: process._getActiveRequests().length,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      };
      
      this.lagHistory.push(measurement);
      
      if (lag > this.blockingThreshold) {
        this.reportBlocking(measurement);
      }
      
      // Continue monitoring
      setTimeout(() => this.measureLag(), 10);
    });
  }
  
  reportBlocking(measurement) {
    console.warn(`🚨 Event loop blocking detected:`);
    console.warn(`  Lag: ${measurement.lag.toFixed(2)}ms`);
    console.warn(`  Active handles: ${measurement.activeHandles}`);
    console.warn(`  Active requests: ${measurement.activeRequests}`);
    console.warn(`  Memory: ${Math.round(measurement.memoryUsage.heapUsed / 1024 / 1024)}MB`);
    
    // Capture stack trace
    const stack = new Error().stack;
    console.warn(`  Stack trace: ${stack.split('\n').slice(2, 5).join('\n')}`);
  }
  
  generateDiagnosticReport() {
    if (this.lagHistory.length === 0) return;
    
    const lags = this.lagHistory.map(h => h.lag);
    const avgLag = lags.reduce((a, b) => a + b, 0) / lags.length;
    const maxLag = Math.max(...lags);
    const p95Lag = lags.sort((a, b) => a - b)[Math.floor(lags.length * 0.95)];
    const blockingEvents = lags.filter(lag => lag > this.blockingThreshold).length;
    
    console.log('\n📊 Event Loop Diagnostic Report:');
    console.log('=' .repeat(50));
    console.log(`Total measurements: ${this.lagHistory.length}`);
    console.log(`Average lag: ${avgLag.toFixed(3)}ms`);
    console.log(`Maximum lag: ${maxLag.toFixed(3)}ms`);
    console.log(`95th percentile lag: ${p95Lag.toFixed(3)}ms`);
    console.log(`Blocking events (>${this.blockingThreshold}ms): ${blockingEvents} (${(blockingEvents/lags.length*100).toFixed(1)}%)`);
    
    // Memory analysis
    const avgMemory = this.lagHistory.reduce((sum, h) => sum + h.memoryUsage.heapUsed, 0) / this.lagHistory.length;
    const maxMemory = Math.max(...this.lagHistory.map(h => h.memoryUsage.heapUsed));
    
    console.log(`\n💾 Memory Analysis:`);
    console.log(`Average heap usage: ${Math.round(avgMemory / 1024 / 1024)}MB`);
    console.log(`Peak heap usage: ${Math.round(maxMemory / 1024 / 1024)}MB`);
    
    // Handle analysis
    const avgHandles = this.lagHistory.reduce((sum, h) => sum + h.activeHandles, 0) / this.lagHistory.length;
    const maxHandles = Math.max(...this.lagHistory.map(h => h.activeHandles));
    
    console.log(`\n🎛️ Handle Analysis:`);
    console.log(`Average active handles: ${Math.round(avgHandles)}`);
    console.log(`Peak active handles: ${maxHandles}`);
    
    this.suggestOptimizations();
  }
  
  suggestOptimizations() {
    console.log(`\n💡 Optimization Suggestions:`);
    
    const lags = this.lagHistory.map(h => h.lag);
    const avgLag = lags.reduce((a, b) => a + b, 0) / lags.length;
    const blockingEvents = lags.filter(lag => lag > this.blockingThreshold).length;
    
    if (avgLag > 5) {
      console.log(`  • High average lag (${avgLag.toFixed(2)}ms) - consider:`);
      console.log(`    - Breaking large synchronous operations into smaller chunks`);
      console.log(`    - Using worker threads for CPU-intensive tasks`);
      console.log(`    - Implementing time-slicing for long-running operations`);
    }
    
    if (blockingEvents > this.lagHistory.length * 0.1) {
      console.log(`  • Frequent blocking events (${blockingEvents}) - consider:`);
      console.log(`    - Profiling with --inspect to identify blocking code`);
      console.log(`    - Using async/await instead of synchronous operations`);
      console.log(`    - Implementing cooperative multitasking`);
    }
    
    const avgHandles = this.lagHistory.reduce((sum, h) => sum + h.activeHandles, 0) / this.lagHistory.length;
    if (avgHandles > 100) {
      console.log(`  • High handle count (${Math.round(avgHandles)}) - consider:`);
      console.log(`    - Closing unused connections and handles`);
      console.log(`    - Implementing connection pooling`);
      console.log(`    - Using keep-alive for HTTP connections`);
    }
    
    const memoryGrowth = this.analyzeMemoryGrowth();
    if (memoryGrowth > 1024 * 1024) { // 1MB growth
      console.log(`  • Memory growth detected (${Math.round(memoryGrowth/1024/1024)}MB) - consider:`);
      console.log(`    - Checking for memory leaks`);
      console.log(`    - Implementing proper cleanup for event listeners`);
      console.log(`    - Using WeakMap/WeakSet for caching`);
    }
  }
  
  analyzeMemoryGrowth() {
    if (this.lagHistory.length < 10) return 0;
    
    const early = this.lagHistory.slice(0, 5);
    const late = this.lagHistory.slice(-5);
    
    const earlyAvg = early.reduce((sum, h) => sum + h.memoryUsage.heapUsed, 0) / early.length;
    const lateAvg = late.reduce((sum, h) => sum + h.memoryUsage.heapUsed, 0) / late.length;
    
    return lateAvg - earlyAvg;
  }
  
  getCurrentEventLoopInfo() {
    return {
      activeTimers: this.activeTimers.size,
      activeImmediates: this.activeImmediates.size,
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
  
  // Force garbage collection and measure impact
  measureGCImpact() {
    if (!global.gc) {
      console.log('⚠️ GC not available. Start with --expose-gc flag');
      return;
    }
    
    console.log('🗑️ Measuring garbage collection impact...');
    
    const beforeGC = {
      memory: process.memoryUsage(),
      time: process.hrtime.bigint()
    };
    
    // Force garbage collection
    global.gc();
    
    const afterGC = {
      memory: process.memoryUsage(),
      time: process.hrtime.bigint()
    };
    
    const gcTime = Number(afterGC.time - beforeGC.time) / 1000000; // ms
    const memoryFreed = beforeGC.memory.heapUsed - afterGC.memory.heapUsed;
    
    console.log(`  GC duration: ${gcTime.toFixed(2)}ms`);
    console.log(`  Memory freed: ${Math.round(memoryFreed / 1024 / 1024)}MB`);
    console.log(`  Heap before: ${Math.round(beforeGC.memory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Heap after: ${Math.round(afterGC.memory.heapUsed / 1024 / 1024)}MB`);
  }
}

// Usage demonstrations
console.log('🚀 Advanced Event Loop and Microtask Analysis\n');

// 1. Event loop scheduling demonstration
console.log('1️⃣ Event Loop Scheduling Demonstration');
demonstrateEventLoopScheduling();

setTimeout(() => {
  // 2. Microtask priority demonstration
  console.log('\n2️⃣ Microtask Priority Demonstration');
  const microtaskAnalyzer = new MicrotaskAnalyzer();
  microtaskAnalyzer.demonstrateMicrotaskPriority();
  
  setTimeout(() => {
    // 3. Priority scheduler demonstration
    console.log('\n3️⃣ Priority Scheduler Demonstration');
    const priorityScheduler = new PriorityScheduler();
    
    // Schedule tasks with different priorities
    priorityScheduler.schedule(() => console.log('🔥 Immediate priority task'), 'immediate');
    priorityScheduler.schedule(() => console.log('⚡ High priority task'), 'high');
    priorityScheduler.schedule(() => console.log('📝 Normal priority task'), 'normal');
    priorityScheduler.schedule(() => console.log('🐌 Low priority task'), 'low');
    
    setTimeout(() => {
      console.log('Priority Scheduler Stats:', priorityScheduler.getStats());
    }, 100);
    
  }, 2000);
  
}, 1000);

// 4. Time-slicing demonstration
setTimeout(() => {
  console.log('\n4️⃣ Time-Slicing Demonstration');
  const timeSlicingScheduler = new TimeSlicingScheduler();
  
  // Create heavy computation task
  const heavyData = Array.from({ length: 100000 }, (_, i) => i);
  const heavyTask = TimeSlicingScheduler.createSliceableTask(
    (item) => Math.sqrt(item * Math.random()), // Heavy computation
    heavyData
  );
  
  timeSlicingScheduler.scheduleTask(heavyTask, 5000);
  
}, 5000);

// 5. Event loop diagnostics
setTimeout(() => {
  console.log('\n5️⃣ Event Loop Diagnostics');
  const diagnostics = new EventLoopDiagnostics();
  diagnostics.startMonitoring();
  
  // Simulate some event loop blocking
  setTimeout(() => {
    const start = Date.now();
    while (Date.now() - start < 50) {
      // Block for 50ms
    }
  }, 1000);
  
  // Stop monitoring after 5 seconds
  setTimeout(() => {
    diagnostics.stopMonitoring();
  }, 5000);
  
}, 8000);

// Real-world event loop analyzer
setTimeout(() => {
  console.log('\n6️⃣ Real Event Loop Analysis');
  const analyzer = new EventLoopAnalyzer();
  analyzer.startAnalysis();
  
  // Stop analysis after 10 seconds
  setTimeout(() => {
    analyzer.stopAnalysis();
  }, 10000);
  
}, 10000);
```

## Best Practices Summary

### ✅ Event Loop Optimization Best Practices:

```javascript
// 1. Avoid blocking the event loop
function processLargeDataset(data) {
  return new Promise((resolve) => {
    let index = 0;
    const batchSize = 1000;
    
    function processBatch() {
      const end = Math.min(index + batchSize, data.length);
      while (index < end) {
        // Process item
        processItem(data[index++]);
      }
      
      if (index < data.length) {
        setImmediate(processBatch); // Yield control
      } else {
        resolve();
      }
    }
    
    processBatch();
  });
}

// 2. Use microtasks appropriately
function flushUpdates() {
  if (!this.updateScheduled) {
    this.updateScheduled = true;
    queueMicrotask(() => {
      this.performUpdates();
      this.updateScheduled = false;
    });
  }
}

// 3. Implement proper priority scheduling
const scheduler = new PriorityScheduler();
scheduler.schedule(userInteractionHandler, 'immediate');
scheduler.schedule(backgroundTask, 'background');

// 4. Monitor event loop health
const monitor = new EventLoopDiagnostics();
monitor.startMonitoring();
```

### ❌ Event Loop Anti-patterns:

```javascript
// 1. ❌ Blocking synchronous operations
while (condition) {
  // Blocks event loop indefinitely
}

// 2. ❌ Microtask starvation
function recursiveMicrotask() {
  queueMicrotask(recursiveMicrotask); // Infinite recursion
}

// 3. ❌ Not yielding in long operations
for (let i = 0; i < 1000000; i++) {
  processItem(i); // No yielding
}

// 4. ❌ Ignoring event loop lag
// No monitoring or optimization for performance
```

Understanding event loop scheduling and microtask queue management at this level enables you to:
- **Build highly responsive applications** that never block
- **Implement sophisticated scheduling systems** for complex UIs
- **Debug performance issues** at the runtime level
- **Optimize critical code paths** for maximum efficiency
- **Design systems that scale** under high load

This knowledge is essential for **senior developers and performance engineers** who need to build applications that remain responsive under any load!