Great question! Here are common interview questions about heaps, stacks, and memory leaks in Node.js:

## 1. **Stack vs Heap - Fundamentals**

### Question: "Explain the difference between Stack and Heap memory in Node.js"

**Expected Answer:**

```
STACK:
- Stores primitive values (numbers, booleans, undefined, null)
- Stores function call frames and local variables
- Fixed size, limited (typically 1-2 MB)
- LIFO (Last In First Out)
- Automatic memory management
- Very fast access
- Stack overflow if too deep recursion

HEAP:
- Stores objects, arrays, functions (reference types)
- Dynamic size, much larger (can be GBs)
- Managed by Garbage Collector
- Slower access than stack
- Memory leaks happen here
```

**Visual Example:**

```javascript
function foo() {
  let x = 5;              // Stack
  let obj = { a: 10 };    // obj reference on stack, object on heap
}
```

```
STACK:                    HEAP:
┌──────────────┐         ┌──────────────┐
│  x = 5       │         │ { a: 10 }    │◄───┐
├──────────────┤         └──────────────┘    │
│  obj = ref ──│─────────────────────────────┘
└──────────────┘
```

---

## 2. **Stack Overflow**

### Question: "What causes a stack overflow? How would you fix it?"

**Expected Answer:**

**Causes:**
- Deep/infinite recursion
- Very large local variables
- Too many function calls without returning

**Example - Problem:**
```javascript
function recursiveFunction(n) {
  if (n === 0) return;
  recursiveFunction(n - 1);  // Deep recursion
}

recursiveFunction(100000);  // RangeError: Maximum call stack size exceeded
```

**Solutions:**

```javascript
// Solution 1: Convert to iteration
function iterativeFunction(n) {
  for (let i = n; i > 0; i--) {
    // Do work
  }
}

// Solution 2: Tail call optimization (not fully supported in Node.js)
function tailRecursive(n, acc = 0) {
  if (n === 0) return acc;
  return tailRecursive(n - 1, acc + n);
}

// Solution 3: Trampoline pattern
function trampoline(fn) {
  while (typeof fn === 'function') {
    fn = fn();
  }
  return fn;
}

function recursiveTrampoline(n) {
  if (n === 0) return 'done';
  return () => recursiveTrampoline(n - 1);
}

trampoline(recursiveTrampoline(100000));
```

---

## 3. **Memory Leaks - Common Causes**

### Question: "What are common causes of memory leaks in Node.js? Give examples."

**Expected Answer with Code:**

### **Cause 1: Global Variables**

```javascript
// BAD - Leaks memory
function processData() {
  globalData = [];  // No 'let/const' - becomes global
  for (let i = 0; i < 1000000; i++) {
    globalData.push(i);
  }
}

// GOOD - Properly scoped
function processData() {
  let localData = [];  // Garbage collected when function exits
  for (let i = 0; i < 1000000; i++) {
    localData.push(i);
  }
}
```

### **Cause 2: Event Listeners Not Removed**

```javascript
// BAD - Leaks memory
const EventEmitter = require('events');
const emitter = new EventEmitter();

function createUser() {
  const userData = new Array(10000).fill('data');  // Large object
  
  emitter.on('event', () => {
    console.log(userData);  // Closure keeps userData in memory
  });
}

for (let i = 0; i < 1000; i++) {
  createUser();  // Each call adds listener, userData never freed!
}

// GOOD - Remove listeners
function createUser() {
  const userData = new Array(10000).fill('data');
  
  const handler = () => console.log(userData);
  emitter.on('event', handler);
  
  // Cleanup
  setTimeout(() => {
    emitter.removeListener('event', handler);
  }, 5000);
}

// BETTER - Use once()
emitter.once('event', () => {
  console.log('Automatically removed after first call');
});
```

### **Cause 3: Timers Not Cleared**

```javascript
// BAD - Leaks memory
function startProcess() {
  const largeData = new Array(1000000).fill('data');
  
  setInterval(() => {
    console.log(largeData[0]);  // Closure keeps largeData alive
  }, 1000);
  
  // Timer never cleared, largeData never freed!
}

// GOOD - Clear timers
function startProcess() {
  const largeData = new Array(1000000).fill('data');
  
  const timerId = setInterval(() => {
    console.log(largeData[0]);
  }, 1000);
  
  // Cleanup when done
  setTimeout(() => {
    clearInterval(timerId);
  }, 10000);
}
```

### **Cause 4: Closures Holding References**

```javascript
// BAD - Leaks memory
function createClosure() {
  const largeArray = new Array(1000000).fill('data');
  
  return function() {
    console.log('Hello');
    // largeArray is in scope but never used
    // But closure keeps entire scope alive!
  };
}

const closures = [];
for (let i = 0; i < 1000; i++) {
  closures.push(createClosure());  // Each closure holds 1M array!
}

// GOOD - Don't capture unnecessary variables
function createClosure() {
  const largeArray = new Array(1000000).fill('data');
  const neededValue = largeArray[0];  // Extract what you need
  
  // largeArray goes out of scope here
  
  return function() {
    console.log(neededValue);  // Only captures neededValue
  };
}
```

### **Cause 5: Caches Without Limits**

```javascript
// BAD - Unbounded cache
const cache = {};

function getData(key) {
  if (cache[key]) return cache[key];
  
  const data = fetchExpensiveData(key);
  cache[key] = data;  // Cache grows forever!
  return data;
}

// GOOD - LRU cache with max size
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    this.cache.set(key, value);
    
    // Remove oldest if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

const cache = new LRUCache(1000);
```

### **Cause 6: Detached DOM Nodes (in browser-like environments)**

```javascript
// BAD - Detached DOM references
let elements = [];

function createElements() {
  const div = document.createElement('div');
  elements.push(div);  // Reference kept
  document.body.appendChild(div);
}

function removeElements() {
  document.body.innerHTML = '';  // DOM cleared
  // But elements array still references them - LEAK!
}

// GOOD - Clear references
function removeElements() {
  document.body.innerHTML = '';
  elements = [];  // Clear references
}
```

---

## 4. **Detecting Memory Leaks**

### Question: "How would you detect and debug a memory leak in production?"

**Expected Answer:**

```
TOOLS AND TECHNIQUES:

1. Process Memory Monitoring:
   - process.memoryUsage()
   - Monitor RSS (Resident Set Size)
   - Monitor heapUsed over time

2. Heap Snapshots:
   - Chrome DevTools (--inspect)
   - Take snapshots at different times
   - Compare to find growing objects

3. Heap Profiling:
   - node --inspect
   - Chrome DevTools Memory tab
   - Allocation timeline

4. Third-party tools:
   - clinic.js (npm i -g clinic)
   - memwatch-next
   - heapdump
   - node-report

5. Metrics:
   - If heap keeps growing without stabilizing
   - If GC cannot reclaim memory
   - If old space keeps growing
```

**Code Example - Monitoring:**

```javascript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  
  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(usage.external / 1024 / 1024)} MB`
  });
}, 5000);

// Alert if heap grows continuously
let lastHeapUsed = 0;
let growthCount = 0;

setInterval(() => {
  const currentHeapUsed = process.memoryUsage().heapUsed;
  
  if (currentHeapUsed > lastHeapUsed * 1.1) {  // 10% growth
    growthCount++;
    
    if (growthCount > 5) {
      console.error('POTENTIAL MEMORY LEAK DETECTED!');
      // Take heap snapshot
      // Alert ops team
    }
  } else {
    growthCount = 0;  // Reset if heap stabilizes
  }
  
  lastHeapUsed = currentHeapUsed;
}, 10000);
```

**Taking Heap Snapshots:**

```javascript
const v8 = require('v8');
const fs = require('fs');

function takeHeapSnapshot(filename) {
  const snapshotStream = v8.writeHeapSnapshot(filename);
  console.log(`Heap snapshot written to ${snapshotStream}`);
}

// Take snapshots at different points
takeHeapSnapshot('./heap-start.heapsnapshot');

// ... run your application ...

takeHeapSnapshot('./heap-after-load.heapsnapshot');

// Compare in Chrome DevTools to see what grew
```

---

## 5. **Heap Memory Questions**

### Question: "What happens when heap memory is full?"

**Expected Answer:**

```
WHEN HEAP IS FULL:

1. GC tries to free memory (Major GC)
2. If GC cannot free enough:
   - JavaScript allocation fails
   - Throws: "FATAL ERROR: Reached heap limit"
   - Process crashes

3. Increase heap size:
   node --max-old-space-size=4096 app.js  // 4GB

4. But this is NOT a solution to memory leaks!
   - Only delays the crash
   - Find and fix the leak
```

**Memory Limit Example:**

```javascript
// This will crash with default heap size (~1.4GB on 64-bit)
const arrays = [];

try {
  while (true) {
    arrays.push(new Array(1000000).fill('data'));
    console.log(`Arrays: ${arrays.length}, Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
  }
} catch (err) {
  console.error('Out of memory!', err);
}
```

---

## 6. **Garbage Collection Questions**

### Question: "How can you force garbage collection? When should you?"

**Expected Answer:**

```javascript
// Run node with --expose-gc flag
// node --expose-gc app.js

if (global.gc) {
  global.gc();  // Force GC
  console.log('GC executed');
} else {
  console.log('Run with --expose-gc flag');
}

WHEN TO FORCE GC:
- Testing/debugging memory leaks
- Before taking heap snapshots
- NEVER in production (GC knows best)
- Forcing GC can hurt performance
```

---

## 7. **WeakMap/WeakSet for Memory Management**

### Question: "What are WeakMap and WeakSet? When would you use them?"

**Expected Answer:**

```javascript
// PROBLEM: Regular Map prevents GC
const cache = new Map();

let user = { name: 'John' };
cache.set(user, 'some metadata');

user = null;  // User still in memory because Map holds reference!

// SOLUTION: WeakMap allows GC
const weakCache = new WeakMap();

let user2 = { name: 'Jane' };
weakCache.set(user2, 'some metadata');

user2 = null;  // user2 can be garbage collected!
// WeakMap doesn't prevent GC

// USE CASES:
// 1. Storing metadata about objects you don't own
// 2. Private data in classes
// 3. Caching where automatic cleanup is desired

class Person {
  constructor(name) {
    this.name = name;
  }
}

const privateData = new WeakMap();

function setPrivate(obj, data) {
  privateData.set(obj, data);
}

function getPrivate(obj) {
  return privateData.get(obj);
}

let person = new Person('Alice');
setPrivate(person, { ssn: '123-45-6789' });

person = null;  // Private data automatically cleaned up
```

---

## 8. **Real Interview Scenario**

### Question: "Debug this code - it has a memory leak"

```javascript
const express = require('express');
const app = express();

const users = [];

app.get('/user/:id', (req, res) => {
  const user = {
    id: req.params.id,
    timestamp: Date.now(),
    data: new Array(10000).fill('data')
  };
  
  users.push(user);
  
  res.json({ message: 'User processed' });
});

app.listen(3000);
```

**Expected Answer:**

```
PROBLEMS:
1. users array grows infinitely
2. Each request adds 10000 items to memory
3. Nothing ever removes old users

FIXES:

// Fix 1: Limit array size
const MAX_USERS = 1000;

app.get('/user/:id', (req, res) => {
  const user = { /* ... */ };
  
  users.push(user);
  
  if (users.length > MAX_USERS) {
    users.shift();  // Remove oldest
  }
  
  res.json({ message: 'User processed' });
});

// Fix 2: Use TTL cache
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 min TTL

// Fix 3: Don't store if not needed
// Question: Why are we storing users at all?
```

---

## Quick Fire Questions

1. **"What's the difference between memory leak and memory bloat?"**
   - Leak: Unintentional retention, grows forever
   - Bloat: Intentional but excessive usage

2. **"How do you know if your app has a memory leak vs just high memory usage?"**
   - Leak: Memory grows continuously, never stabilizes
   - High usage: Memory stabilizes at a high level

3. **"What's the difference between shallow and retained size in heap snapshots?"**
   - Shallow: Object's own memory
   - Retained: Object + everything it keeps alive

4. **"What is a retaining path?"**
   - Chain of references preventing GC
   - From GC root to the leaked object

5. **"How does Node.js handle circular references?"**
   - Mark-and-sweep GC handles them
   - If unreachable from roots, both objects collected

---