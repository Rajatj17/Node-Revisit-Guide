# Memory Management & Performance Quiz

## Question 1: Multiple Choice
What are the main memory areas in the V8 heap?

A) Stack, Heap, Cache  
B) New Space, Old Space, Large Object Space  
C) Young Generation, Middle Generation, Old Generation  
D) Eden, Survivor, Tenured  

**Answer: B**

---

## Question 2: True/False
Objects larger than 1MB are stored in the Large Object Space and are not moved during garbage collection.

**Answer: True** - Large objects (>1MB) are allocated directly to Large Object Space to avoid expensive copying operations.

---

## Question 3: Code Analysis
```javascript
function createLeakyFunction() {
  const largeArray = new Array(1000000).fill('data');
  
  return function() {
    return 'small result';
  };
}

const functions = [];
for (let i = 0; i < 100; i++) {
  functions.push(createLeakyFunction());
}
```

Why does this create a memory leak?

**Answer:** Each returned function maintains a closure that references `largeArray`, preventing it from being garbage collected. Even though the function doesn't use the array, the closure keeps the entire scope alive.

---

## Question 4: Fill in the Blank
The _______ generation contains short-lived objects and is collected more frequently, while the _______ generation contains long-lived objects.

**Answer: Young (New Space), Old**

---

## Question 5: Short Answer
Explain the difference between `rss`, `heapTotal`, `heapUsed`, and `external` in `process.memoryUsage()`.

**Answer:**
- **rss**: Resident Set Size - total memory allocated for the process
- **heapTotal**: Total heap memory allocated by V8
- **heapUsed**: Amount of heap memory currently used
- **external**: Memory used by C++ objects bound to JavaScript objects

---

## Question 6: Code Output
```javascript
const obj = { data: new Array(1000000).fill('test') };
const weakRef = new WeakRef(obj);

console.log(weakRef.deref() ? 'exists' : 'gone'); // ?

obj = null;
// ... some time passes and GC runs

console.log(weakRef.deref() ? 'exists' : 'gone'); // ?
```

What might be logged and why?

**Answer:** First log: 'exists' - strong reference keeps object alive. Second log: 'gone' - after removing strong reference and GC runs, WeakRef may return undefined since object can be collected.

---

## Question 7: Best Practices
List 5 techniques to prevent memory leaks in Node.js applications.

**Answer:**
1. Remove event listeners when no longer needed
2. Clear intervals and timeouts properly
3. Avoid global variables for temporary data
4. Use WeakMap/WeakSet for object associations
5. Properly close streams and database connections

---

## Question 8: Performance Analysis
Which approach is more memory efficient for processing a large dataset and why?

```javascript
// Approach A
const results = data.filter(x => x.active).map(x => x.value);

// Approach B  
const results = [];
for (const item of data) {
  if (item.active) {
    results.push(item.value);
  }
}
```

**Answer:** Approach B is more memory efficient because it uses a single pass and doesn't create intermediate arrays. Approach A creates a temporary filtered array before mapping, using more memory.

---

## Question 9: Garbage Collection
Explain the generational hypothesis and how V8's garbage collection takes advantage of it.

**Answer:** The generational hypothesis states that most objects die young. V8 separates objects into New Space (young generation) and Old Space (old generation). New Space is collected frequently with fast algorithms, while Old Space is collected less often since objects there are likely to be long-lived.

---

## Question 10: Advanced Scenario
Your Node.js application's memory usage keeps growing in production. Describe your debugging approach.

**Answer:**
1. Monitor memory usage with `process.memoryUsage()` and heap snapshots
2. Use profiling tools like clinic.js or --inspect with Chrome DevTools
3. Take heap snapshots at different intervals to compare
4. Look for:
   - Uncleaned event listeners
   - Global variable accumulation
   - Unclosed connections/streams
   - Large objects in closures
5. Use WeakRef/WeakMap where appropriate
6. Implement memory monitoring and alerting

---

## Practical Challenge Questions

### Challenge 1: Memory Leak Detection
```javascript
class DataCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }
  
  set(key, value, ttl = 300000) {
    this.cache.set(key, value);
    
    const timer = setTimeout(() => {
      this.cache.delete(key);
    }, ttl);
    
    this.timers.set(key, timer);
  }
  
  get(key) {
    return this.cache.get(key);
  }
  
  delete(key) {
    this.cache.delete(key);
    clearTimeout(this.timers.get(key));
  }
}
```

What memory leak exists in this code?

### Challenge 2: Performance Optimization
You need to process 1 million records. Compare these approaches:

```javascript
// Option 1
const results = records
  .filter(r => r.status === 'active')
  .map(r => ({ id: r.id, value: r.value * 2 }))
  .sort((a, b) => b.value - a.value);

// Option 2
const results = [];
for (const record of records) {
  if (record.status === 'active') {
    results.push({ id: record.id, value: record.value * 2 });
  }
}
results.sort((a, b) => b.value - a.value);

// Option 3 - Your optimized version
```

Design the most memory and CPU efficient version.

### Challenge 3: WeakMap Usage
When would you use WeakMap instead of Map? Provide a practical example.

### Challenge 4: Heap Analysis
```javascript
function analyzeHeapGrowth() {
  const samples = [];
  const interval = setInterval(() => {
    samples.push(process.memoryUsage().heapUsed);
    if (samples.length > 10) samples.shift();
    
    // Detect concerning growth pattern
    // Your implementation here
    
  }, 1000);
  
  return () => clearInterval(interval);
}
```

Complete the heap growth analysis logic.

### Challenge 5: Resource Pool
Design a connection pool that automatically manages memory by:
- Limiting maximum connections
- Cleaning up idle connections
- Monitoring memory usage
- Handling connection leaks

**Solutions:**

**Challenge 1:** The timer isn't cleared from the `timers` Map when it expires, creating a memory leak. Also, if `set()` is called with the same key multiple times, old timers aren't cleared.

**Challenge 2:** Most efficient approach:
```javascript
const activeRecords = [];
for (const record of records) {
  if (record.status === 'active') {
    activeRecords.push({ id: record.id, value: record.value * 2 });
  }
}
// Sort in place
activeRecords.sort((a, b) => b.value - a.value);
```

**Challenge 3:** Use WeakMap when you need to associate data with objects without preventing garbage collection:
```javascript
const metadata = new WeakMap();
class Component {
  constructor() {
    metadata.set(this, { created: Date.now(), events: [] });
  }
}
// When Component instances are GC'd, metadata entries are automatically removed
```