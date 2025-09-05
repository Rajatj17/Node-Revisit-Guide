// Node.js Streams Exercises

const fs = require('fs');
const { Readable, Writable, Transform, Duplex } = require('stream');
const { pipeline } = require('stream');

console.log('=== NODE.JS STREAMS EXERCISES ===\n');

// EXERCISE 1: Custom Readable Stream
console.log('Exercise 1: Creating a Custom Readable Stream');

class NumberGenerator extends Readable {
  constructor(options) {
    super(options);
    this.current = 0;
    this.max = 10;
  }
  
  _read() {
    if (this.current < this.max) {
      // Push data to the stream
      this.push(`Number: ${this.current++}\n`);
    } else {
      // End the stream
      this.push(null);
    }
  }
}

const numberStream = new NumberGenerator();
numberStream.on('data', (chunk) => {
  process.stdout.write(`Readable: ${chunk}`);
});

numberStream.on('end', () => {
  console.log('Number stream ended\n');
});

console.log('--- Separator ---\n');

// EXERCISE 2: Custom Writable Stream
console.log('Exercise 2: Creating a Custom Writable Stream');

class UpperCaseWriter extends Writable {
  _write(chunk, encoding, callback) {
    const upperData = chunk.toString().toUpperCase();
    process.stdout.write(`WRITABLE OUTPUT: ${upperData}`);
    callback(); // Signal completion
  }
}

const upperWriter = new UpperCaseWriter();
upperWriter.write('hello world\n');
upperWriter.write('node.js streams\n');
upperWriter.end();

setTimeout(() => {
  console.log('--- Separator ---\n');
  
  // EXERCISE 3: Transform Stream
  console.log('Exercise 3: Creating a Transform Stream');
  
  class JSONLineTransform extends Transform {
    constructor() {
      super({ objectMode: true });
      this.lineCount = 0;
    }
    
    _transform(chunk, encoding, callback) {
      try {
        const obj = {
          line: ++this.lineCount,
          data: chunk.toString().trim(),
          timestamp: Date.now()
        };
        
        this.push(JSON.stringify(obj) + '\n');
        callback();
      } catch (err) {
        callback(err);
      }
    }
  }
  
  const jsonTransform = new JSONLineTransform();
  
  jsonTransform.write('First line');
  jsonTransform.write('Second line');
  jsonTransform.write('Third line');
  jsonTransform.end();
  
  jsonTransform.on('data', (chunk) => {
    console.log('Transformed:', chunk.toString());
  });
  
  jsonTransform.on('end', () => {
    console.log('Transform stream ended\n');
    setTimeout(() => exerciseFour(), 1000);
  });
}, 1000);

// EXERCISE 4: Duplex Stream
function exerciseFour() {
  console.log('--- Separator ---\n');
  console.log('Exercise 4: Creating a Duplex Stream');
  
  class EchoBuffer extends Duplex {
    constructor() {
      super();
      this.buffer = [];
      this.readIndex = 0;
    }
    
    _write(chunk, encoding, callback) {
      this.buffer.push(chunk.toString().trim());
      console.log(`Buffered: ${chunk.toString().trim()}`);
      callback();
    }
    
    _read() {
      if (this.readIndex < this.buffer.length) {
        this.push(`Echo: ${this.buffer[this.readIndex++]}\n`);
      } else {
        this.push(null); // End reading
      }
    }
  }
  
  const echoBuffer = new EchoBuffer();
  
  // Write data
  echoBuffer.write('Hello');
  echoBuffer.write('World');
  echoBuffer.write('Duplex');
  echoBuffer.end();
  
  // Read data
  echoBuffer.on('data', (chunk) => {
    process.stdout.write(`Read: ${chunk}`);
  });
  
  echoBuffer.on('end', () => {
    console.log('Duplex stream ended\n');
    setTimeout(() => exerciseFive(), 1000);
  });
}

// EXERCISE 5: Stream Piping and Error Handling
function exerciseFive() {
  console.log('--- Separator ---\n');
  console.log('Exercise 5: Stream Piping with Error Handling');
  
  // Create temporary files for demonstration
  const inputData = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n';
  
  fs.writeFile('/tmp/input.txt', inputData, (err) => {
    if (err) {
      console.error('Error creating input file:', err);
      return;
    }
    
    class LineCounter extends Transform {
      constructor() {
        super();
        this.lineCount = 0;
      }
      
      _transform(chunk, encoding, callback) {
        const lines = chunk.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            this.lineCount++;
            this.push(`${this.lineCount}: ${line}\n`);
          }
        });
        callback();
      }
      
      _flush(callback) {
        this.push(`\nTotal lines processed: ${this.lineCount}\n`);
        callback();
      }
    }
    
    const lineCounter = new LineCounter();
    
    // Using pipeline for better error handling
    pipeline(
      fs.createReadStream('/tmp/input.txt'),
      lineCounter,
      fs.createWriteStream('/tmp/output.txt'),
      (err) => {
        if (err) {
          console.error('Pipeline error:', err);
        } else {
          console.log('File processing completed successfully');
          
          // Read the output to show results
          fs.readFile('/tmp/output.txt', 'utf8', (err, data) => {
            if (!err) {
              console.log('Output file contents:');
              console.log(data);
            }
            setTimeout(() => exerciseSix(), 1000);
          });
        }
      }
    );
  });
}

// EXERCISE 6: Object Mode Streams
function exerciseSix() {
  console.log('--- Separator ---\n');
  console.log('Exercise 6: Object Mode Streams');
  
  class ObjectGenerator extends Readable {
    constructor() {
      super({ objectMode: true });
      this.currentId = 1;
      this.maxObjects = 5;
    }
    
    _read() {
      if (this.currentId <= this.maxObjects) {
        const obj = {
          id: this.currentId++,
          name: `User ${this.currentId - 1}`,
          timestamp: Date.now(),
          active: Math.random() > 0.5
        };
        this.push(obj);
      } else {
        this.push(null);
      }
    }
  }
  
  class ObjectProcessor extends Transform {
    constructor() {
      super({ objectMode: true });
      this.processedCount = 0;
    }
    
    _transform(obj, encoding, callback) {
      // Process the object
      this.processedCount++;
      obj.processed = true;
      obj.processedAt = new Date().toISOString();
      obj.processOrder = this.processedCount;
      
      this.push(obj);
      callback();
    }
  }
  
  class ObjectLogger extends Writable {
    constructor() {
      super({ objectMode: true });
    }
    
    _write(obj, encoding, callback) {
      console.log('Processed Object:', JSON.stringify(obj, null, 2));
      callback();
    }
  }
  
  const objectGenerator = new ObjectGenerator();
  const objectProcessor = new ObjectProcessor();
  const objectLogger = new ObjectLogger();
  
  objectGenerator
    .pipe(objectProcessor)
    .pipe(objectLogger);
  
  objectLogger.on('finish', () => {
    console.log('Object processing completed\n');
    setTimeout(() => exerciseSeven(), 1000);
  });
}

// EXERCISE 7: Backpressure Demonstration
function exerciseSeven() {
  console.log('--- Separator ---\n');
  console.log('Exercise 7: Backpressure Handling');
  
  class FastProducer extends Readable {
    constructor() {
      super();
      this.count = 0;
      this.maxCount = 100;
    }
    
    _read() {
      if (this.count < this.maxCount) {
        // Produce data quickly
        this.push(`Data chunk ${++this.count}\n`);
      } else {
        this.push(null);
      }
    }
  }
  
  class SlowProcessor extends Transform {
    _transform(chunk, encoding, callback) {
      // Simulate slow processing
      setTimeout(() => {
        this.push(`Processed: ${chunk}`);
        callback();
      }, 10); // 10ms delay per chunk
    }
  }
  
  const fastProducer = new FastProducer();
  const slowProcessor = new SlowProcessor();
  
  console.log('Starting backpressure demonstration...');
  const startTime = Date.now();
  
  fastProducer
    .pipe(slowProcessor)
    .on('data', (chunk) => {
      // Just count, don't log everything
      if (chunk.toString().includes('Data chunk 1 ') || 
          chunk.toString().includes('Data chunk 50') || 
          chunk.toString().includes('Data chunk 100')) {
        process.stdout.write('.');
      }
    })
    .on('end', () => {
      const endTime = Date.now();
      console.log(`\nBackpressure demo completed in ${endTime - startTime}ms`);
      console.log('Notice how backpressure automatically regulates the flow\n');
      setTimeout(() => practicalChallenges(), 1000);
    });
}

// PRACTICAL CHALLENGES
function practicalChallenges() {
  console.log('=== PRACTICAL CHALLENGES ===\n');
  
  console.log('Challenge 1: CSV Parser Stream');
  console.log('Challenge 2: Log File Analyzer');
  console.log('Challenge 3: Data Compression Pipeline');
  console.log('Challenge 4: Real-time Data Processor');
  console.log('Challenge 5: Stream-based File Server');
  
  console.log('\n--- Challenge 1: CSV Parser Implementation ---');
  
  // Challenge 1: CSV Parser Stream
  class CSVParser extends Transform {
    constructor() {
      super({ objectMode: true });
      this.headers = null;
      this.buffer = '';
      this.lineCount = 0;
    }
    
    _transform(chunk, encoding, callback) {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      lines.forEach(line => {
        this.lineCount++;
        if (line.trim()) {
          if (!this.headers) {
            this.headers = line.split(',').map(h => h.trim());
          } else {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            this.headers.forEach((header, index) => {
              obj[header] = values[index] || '';
            });
            obj._lineNumber = this.lineCount;
            this.push(obj);
          }
        }
      });
      
      callback();
    }
    
    _flush(callback) {
      // Process any remaining data in buffer
      if (this.buffer.trim() && this.headers) {
        this.lineCount++;
        const values = this.buffer.split(',').map(v => v.trim());
        const obj = {};
        this.headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        obj._lineNumber = this.lineCount;
        this.push(obj);
      }
      callback();
    }
  }
  
  // Create sample CSV data
  const csvData = 'Name,Age,City\nJohn,30,New York\nJane,25,Los Angeles\nBob,35,Chicago\n';
  
  fs.writeFile('/tmp/sample.csv', csvData, (err) => {
    if (err) {
      console.error('Error creating CSV file:', err);
      return;
    }
    
    const csvParser = new CSVParser();
    
    fs.createReadStream('/tmp/sample.csv')
      .pipe(csvParser)
      .on('data', (record) => {
        console.log(`Record ${record._lineNumber}:`, record);
      })
      .on('end', () => {
        console.log('CSV parsing completed');
        console.log('\n=== END EXERCISES ===');
        
        // Cleanup
        fs.unlink('/tmp/input.txt', () => {});
        fs.unlink('/tmp/output.txt', () => {});
        fs.unlink('/tmp/sample.csv', () => {});
      })
      .on('error', (err) => {
        console.error('CSV parsing error:', err);
      });
  });
}

console.log('\nStarting stream exercises...\n');