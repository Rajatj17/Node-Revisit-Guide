const cluster = require('cluster');
const express = require('express');
const os = require('os');

if (cluster.isMaster) {
  console.log(`Master ${process.pid} starting`);
  
  // Fork 4 workers
  for (let i = 0; i < 4; i++) {
    cluster.fork();
  }
  
  console.log('All workers listening on port 3000!');
  
} else {
  const app = express();
  
  app.get('/', (req, res) => {
    res.json({ 
      worker: process.pid,
      message: 'Hello from worker!'
    });
  });
  
  // All workers call listen(3000) - NO ERROR!
  app.listen(3000, () => {
    console.log(`Worker ${process.pid} ready`);
  });
}
