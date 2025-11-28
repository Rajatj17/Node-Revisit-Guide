const { Worker, isMainThread, threadId } = require('worker_threads');
const os = require('os');

if (isMainThread) {
  console.log(`System has ${os.cpus().length} CPU cores`);
  console.log('Creating 4 workers...\n');
  
  // Create 4 workers
  for (let i = 0; i < 4; i++) {
    new Worker(__filename);
  }
  
  // Main thread also does work
  console.log('Main thread: Starting heavy computation');
  heavyComputation('Main');
  
} else {
  // Worker thread
  console.log(`Worker ${threadId}: Starting heavy computation`);
  heavyComputation(`Worker ${threadId}`);
}

function heavyComputation(name) {
  let result = 0;
  const start = Date.now();
  
  // CPU-intensive loop (runs for ~5 seconds)
  for (let i = 0; i < 5_000_000_000; i++) {
    result += Math.sqrt(i);
  }
  
  const duration = Date.now() - start;
  console.log(`${name}: Completed in ${duration}ms`);
}