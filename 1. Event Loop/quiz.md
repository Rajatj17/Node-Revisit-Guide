# Event Loop Knowledge Quiz

## Question 1: Multiple Choice
What are the 6 phases of the Node.js Event Loop in order?

A) Timers → Poll → Check → Close → Pending → Idle  
B) Timers → Pending Callbacks → Idle/Prepare → Poll → Check → Close Callbacks  
C) Poll → Timers → Check → Idle → Pending → Close  
D) Check → Timers → Poll → Pending → Idle → Close  

**Answer: B**

---

## Question 2: True/False
`process.nextTick()` callbacks are executed after `setImmediate()` callbacks.

**Answer: False** - `process.nextTick()` has higher priority and executes before any phase.

---

## Question 3: Code Output
```javascript
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
process.nextTick(() => console.log('D'));
console.log('E');
```

What is the output order?

**Answer: A, E, D, C, B**

---

## Question 4: Fill in the Blank
The _______ phase is where Node.js spends most of its time and handles I/O operations.

**Answer: Poll**

---

## Question 5: Short Answer
Why can `process.nextTick()` cause starvation of the event loop?

**Answer:** Because `process.nextTick()` callbacks are executed with the highest priority before any phase of the event loop. If used recursively, it can prevent the event loop from progressing to other phases, effectively starving them of execution time.

---

## Question 6: Code Analysis
```javascript
const fs = require('fs');

setTimeout(() => console.log('Timer'), 0);
setImmediate(() => console.log('Immediate'));

fs.readFile('file.txt', () => {
  setTimeout(() => console.log('File Timer'), 0);
  setImmediate(() => console.log('File Immediate'));
});
```

Explain why the order of "File Timer" and "File Immediate" is predictable while "Timer" and "Immediate" order may vary.

**Answer:** Inside the I/O callback (`fs.readFile`), we're in the poll phase. From the poll phase, `setImmediate()` (check phase) runs before `setTimeout()` (timers phase) in the next iteration. However, at the start of the program, whether we're in the poll phase or not depends on timing, making the initial order potentially variable.

---

## Question 7: Best Practices
What are 3 ways to avoid blocking the event loop?

**Answer:**
1. Use asynchronous operations instead of synchronous ones
2. Use Worker Threads for CPU-intensive tasks
3. Break down large synchronous operations into smaller chunks using `setImmediate()` or `setTimeout()`

---

## Question 8: Advanced Scenario
If you have a server handling 1000 concurrent requests and each request needs to read a file, explain how Node.js handles this efficiently.

**Answer:** Node.js uses its thread pool (via libuv) to handle file I/O operations. While 1000 requests come in on the single main thread, the actual file reading is delegated to worker threads. The main thread continues accepting new requests while file operations happen in parallel in the background. When file operations complete, their callbacks are queued and executed during the appropriate event loop phase.

---

## Practical Challenge Questions

### Challenge 1: Fix This Code
```javascript
function processData(data) {
  // This blocks the event loop
  for (let i = 0; i < data.length; i++) {
    heavyComputation(data[i]);
  }
  return 'Complete';
}
```

How would you modify this to be non-blocking?

### Challenge 2: Explain the Problem
```javascript
function infiniteNextTick() {
  process.nextTick(infiniteNextTick);
}

infiniteNextTick();
setTimeout(() => console.log('Will this ever run?'), 100);
```

What happens and why?

### Challenge 3: Performance Optimization
You have a web server that becomes unresponsive under high load. Investigations show that file reading operations are the bottleneck. How would you optimize this using event loop knowledge?