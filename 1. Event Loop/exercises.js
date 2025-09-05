// Event Loop Exercises and Challenges

console.log('=== NODE.JS EVENT LOOP EXERCISES ===\n');

// EXERCISE 1: Predict the Output
console.log('Exercise 1: Predict the execution order');
console.log('1: Start');

setTimeout(() => console.log('2: Timer'), 0);
setImmediate(() => console.log('3: Immediate'));
process.nextTick(() => console.log('4: Next Tick'));

Promise.resolve().then(() => console.log('5: Promise'));

console.log('6: End');

// Challenge: What will be the output order? Write your prediction below:
/*
PREDICTION:
1: 
2: 
3: 
4: 
5: 
6: 
*/

console.log('\n--- Separator ---\n');

// EXERCISE 2: Nested Callbacks and Phases
setTimeout(() => {
  console.log('Exercise 2: Outer Timer');
  
  process.nextTick(() => console.log('Inner Next Tick'));
  
  Promise.resolve().then(() => console.log('Inner Promise'));
  
  setImmediate(() => console.log('Inner Immediate'));
  
  setTimeout(() => console.log('Inner Timer'), 0);
}, 0);

setImmediate(() => {
  console.log('Exercise 2: Outer Immediate');
  
  process.nextTick(() => console.log('Immediate -> Next Tick'));
  
  setTimeout(() => console.log('Immediate -> Timer'), 0);
});

console.log('\n--- Separator ---\n');

// EXERCISE 3: File I/O and Event Loop
const fs = require('fs');

console.log('Exercise 3: File I/O timing');

// Create a test file first
fs.writeFile('/tmp/test.txt', 'Hello Node.js', (err) => {
  if (err) return;
  
  console.log('File write complete');
  
  // Now read it
  fs.readFile('/tmp/test.txt', (err, data) => {
    if (err) return;
    console.log('File read complete:', data.toString());
    
    setTimeout(() => console.log('Timer after file operations'), 0);
    setImmediate(() => console.log('Immediate after file operations'));
  });
});

setTimeout(() => console.log('Timer before file operations'), 0);
setImmediate(() => console.log('Immediate before file operations'));

console.log('\n--- Separator ---\n');

// EXERCISE 4: Process.nextTick Starvation
console.log('Exercise 4: NextTick behavior');

let counter = 0;

function recursiveNextTick() {
  process.nextTick(() => {
    counter++;
    console.log(`NextTick recursion: ${counter}`);
    
    if (counter < 5) {
      recursiveNextTick();
    }
  });
}

setTimeout(() => console.log('Timer should run after all nextTicks'), 0);
recursiveNextTick();
console.log('Synchronous after recursiveNextTick call');

console.log('\n=== END EXERCISES ===\n');

// PRACTICE CHALLENGES (Uncomment to try):

/* 
CHALLENGE 1: Fix the Event Loop Blocking
Identify what's wrong with this code and fix it:

function blockingOperation() {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    // Simulate 5 second blocking operation
  }
  console.log('Blocking operation complete');
}

setTimeout(() => console.log('This should run after 1 second'), 1000);
blockingOperation();
*/

/*
CHALLENGE 2: Implement a Non-blocking Fibonacci
Create a non-blocking version of fibonacci calculation:

function fibonacci(n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// This blocks the event loop for large numbers
console.log(fibonacci(40));
*/

/*
CHALLENGE 3: Event Loop Performance
Write code to measure how long different async operations take
and understand their impact on the event loop.
*/