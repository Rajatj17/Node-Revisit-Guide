# Node.js Streams - Complete Guide

Streams are one of the **most powerful features** in Node.js, enabling efficient processing of large amounts of data without loading everything into memory.

## What Are Streams?

Streams are **collections of data** that might not be available all at once and don't have to fit in memory. They allow you to process data piece by piece, making them perfect for handling large files, network communications, and real-time data.

### Traditional vs Stream Approach

**Traditional (Blocking) - Bad for Large Files:**
```javascript
const fs = require('fs');

// Loads entire file into memory at once
fs.readFile('huge-file.txt', (err, data) => {
  if (err) throw err;
  console.log(data); // Could be gigabytes in memory!
});
```

**Stream Approach - Memory Efficient:**
```javascript
const fs = require('fs');

// Processes file chunk by chunk
const stream = fs.createReadStream('huge-file.txt');
stream.on('data', (chunk) => {
  console.log(`Received ${chunk.length} bytes`);
  // Process each chunk without loading entire file
});
```

## The Four Types of Streams

### 1. Readable Streams
**Data you can read from (sources)**

```javascript
const fs = require('fs');
const { Readable } = require('stream');

// File reading stream
const readableStream = fs.createReadStream('input.txt');

readableStream.on('data', (chunk) => {
  console.log(`Received: ${chunk}`);
});

readableStream.on('end', () => {
  console.log('No more data');
});

readableStream.on('error', (err) => {
  console.error('Error:', err);
});
```

**Custom Readable Stream:**
```javascript
class NumberStream extends Readable {
  constructor(max) {
    super();
    this.current = 0;
    this.max = max;
  }
  
  _read() {
    if (this.current < this.max) {
      this.push(`Number: ${this.current++}\n`);
    } else {
      this.push(null); // End the stream
    }
  }
}

const numberStream = new NumberStream(5);
numberStream.on('data', (chunk) => {
  console.log(chunk.toString());
});
```

### 2. Writable Streams
**Data you can write to (destinations)**

```javascript
const fs = require('fs');
const { Writable } = require('stream');

// File writing stream
const writableStream = fs.createWriteStream('output.txt');

writableStream.write('Hello ');
writableStream.write('World!');
writableStream.end(); // Close the stream

writableStream.on('finish', () => {
  console.log('Write completed');
});
```

**Custom Writable Stream:**
```javascript
class ConsoleStream extends Writable {
  _write(chunk, encoding, callback) {
    console.log(`Writing: ${chunk.toString().toUpperCase()}`);
    callback(); // Signal completion
  }
}

const consoleStream = new ConsoleStream();
consoleStream.write('hello');
consoleStream.write('world');
consoleStream.end();
```

### 3. Transform Streams
**Streams that modify data as it passes through**

```javascript
const { Transform } = require('stream');

class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    // Transform the data
    const upperCased = chunk.toString().toUpperCase();
    this.push(upperCased);
    callback();
  }
}

const upperCaseTransform = new UpperCaseTransform();

// Usage with pipes
process.stdin
  .pipe(upperCaseTransform)
  .pipe(process.stdout);
```

**JSON Transform Example:**
```javascript
class JSONStringify extends Transform {
  constructor() {
    super({ objectMode: true }); // Accept objects
  }
  
  _transform(chunk, encoding, callback) {
    try {
      const jsonString = JSON.stringify(chunk) + '\n';
      this.push(jsonString);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

const jsonTransform = new JSONStringify();
jsonTransform.write({ name: 'John', age: 30 });
jsonTransform.write({ name: 'Jane', age: 25 });
jsonTransform.end();

jsonTransform.on('data', (chunk) => {
  console.log(chunk.toString());
});
```

### 4. Duplex Streams
**Streams that are both readable and writable**

```javascript
const { Duplex } = require('stream');

class EchoStream extends Duplex {
  constructor() {
    super();
    this.data = [];
  }
  
  _write(chunk, encoding, callback) {
    this.data.push(chunk);
    callback();
  }
  
  _read() {
    if (this.data.length > 0) {
      this.push(this.data.shift());
    } else {
      this.push(null); // End reading
    }
  }
}

const echoStream = new EchoStream();

// Write to it
echoStream.write('Hello');
echoStream.write('World');
echoStream.end();

// Read from it
echoStream.on('data', (chunk) => {
  console.log(`Echo: ${chunk}`);
});
```

## Pipe Method - The Power of Streams

### Basic Piping
```javascript
const fs = require('fs');

// Copy file using streams
fs.createReadStream('input.txt')
  .pipe(fs.createWriteStream('output.txt'));

// With error handling
const readStream = fs.createReadStream('input.txt');
const writeStream = fs.createWriteStream('output.txt');

readStream.pipe(writeStream);

readStream.on('error', (err) => console.error('Read error:', err));
writeStream.on('error', (err) => console.error('Write error:', err));
writeStream.on('finish', () => console.log('Copy completed'));
```

### Pipeline - Better Error Handling
```javascript
const { pipeline } = require('stream');
const fs = require('fs');
const zlib = require('zlib');

// Compress file with proper error handling
pipeline(
  fs.createReadStream('input.txt'),
  zlib.createGzip(),
  fs.createWriteStream('output.txt.gz'),
  (err) => {
    if (err) {
      console.error('Pipeline error:', err);
    } else {
      console.log('Compression completed');
    }
  }
);
```

### Chain Multiple Transforms
```javascript
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

fs.createReadStream('input.txt')
  .pipe(zlib.createGzip())           // Compress
  .pipe(crypto.createCipher('aes192', 'secret')) // Encrypt
  .pipe(fs.createWriteStream('output.txt.gz.enc')); // Save
```

## Stream Events

### Readable Stream Events
```javascript
const readableStream = fs.createReadStream('file.txt');

readableStream.on('data', (chunk) => {
  console.log('Data received:', chunk.length);
});

readableStream.on('end', () => {
  console.log('Stream ended');
});

readableStream.on('error', (err) => {
  console.error('Stream error:', err);
});

readableStream.on('close', () => {
  console.log('Stream closed');
});

readableStream.on('readable', () => {
  let chunk;
  while ((chunk = readableStream.read()) !== null) {
    console.log('Read chunk:', chunk.length);
  }
});
```

### Writable Stream Events
```javascript
const writableStream = fs.createWriteStream('output.txt');

writableStream.on('drain', () => {
  console.log('Buffer drained, safe to write more');
});

writableStream.on('finish', () => {
  console.log('All writes completed');
});

writableStream.on('error', (err) => {
  console.error('Write error:', err);
});
```

## Backpressure - Critical Concept

**The Problem:**
```javascript
// ❌ This can overwhelm memory
const readableStream = fs.createReadStream('huge-file.txt');
const writableStream = fs.createWriteStream('output.txt');

readableStream.on('data', (chunk) => {
  // If writing is slower than reading, chunks accumulate in memory
  writableStream.write(chunk);
});
```

**The Solution - Proper Backpressure Handling:**
```javascript
// ✅ Handle backpressure correctly
const readableStream = fs.createReadStream('huge-file.txt');
const writableStream = fs.createWriteStream('output.txt');

readableStream.on('data', (chunk) => {
  const writeSuccess = writableStream.write(chunk);
  
  if (!writeSuccess) {
    // Pause reading until buffer drains
    readableStream.pause();
    
    writableStream.once('drain', () => {
      readableStream.resume();
    });
  }
});

// Or better yet, just use pipe() which handles this automatically
readableStream.pipe(writableStream);
```

## Real-World Examples

### 1. HTTP File Upload with Streams
```javascript
const express = require('express');
const fs = require('fs');
const app = express();

app.post('/upload', (req, res) => {
  const writeStream = fs.createWriteStream('uploaded-file.dat');
  
  // Stream request body directly to file
  req.pipe(writeStream);
  
  writeStream.on('finish', () => {
    res.json({ message: 'Upload completed' });
  });
  
  writeStream.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});
```

### 2. CSV Processing Stream
```javascript
const fs = require('fs');
const { Transform } = require('stream');

class CSVProcessor extends Transform {
  constructor() {
    super({ objectMode: true });
    this.headers = null;
    this.buffer = '';
  }
  
  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line
    
    lines.forEach((line, index) => {
      if (!this.headers) {
        this.headers = line.split(',');
      } else if (line.trim()) {
        const values = line.split(',');
        const obj = {};
        this.headers.forEach((header, i) => {
          obj[header.trim()] = values[i]?.trim();
        });
        this.push(obj);
      }
    });
    
    callback();
  }
  
  _flush(callback) {
    if (this.buffer.trim()) {
      // Process last line
      const values = this.buffer.split(',');
      const obj = {};
      this.headers.forEach((header, i) => {
        obj[header.trim()] = values[i]?.trim();
      });
      this.push(obj);
    }
    callback();
  }
}

// Usage
fs.createReadStream('data.csv')
  .pipe(new CSVProcessor())
  .on('data', (row) => {
    console.log('Processed row:', row);
    // Process each row without loading entire CSV
  })
  .on('end', () => {
    console.log('CSV processing completed');
  });
```

### 3. Real-time Log Processing
```javascript
const fs = require('fs');
const { Transform } = require('stream');

class LogAnalyzer extends Transform {
  constructor() {
    super();
    this.errorCount = 0;
    this.warningCount = 0;
  }
  
  _transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n');
    
    lines.forEach(line => {
      if (line.includes('ERROR')) {
        this.errorCount++;
        this.emit('error-detected', line);
      } else if (line.includes('WARN')) {
        this.warningCount++;
      }
    });
    
    // Pass through the data
    this.push(chunk);
    callback();
  }
  
  getStats() {
    return {
      errors: this.errorCount,
      warnings: this.warningCount
    };
  }
}

const logAnalyzer = new LogAnalyzer();

fs.createReadStream('app.log')
  .pipe(logAnalyzer)
  .pipe(fs.createWriteStream('processed.log'));

logAnalyzer.on('error-detected', (errorLine) => {
  console.log('Critical error found:', errorLine);
});

logAnalyzer.on('end', () => {
  console.log('Analysis complete:', logAnalyzer.getStats());
});
```

### 4. Stream-based Web Scraping
```javascript
const https = require('https');
const { Transform } = require('stream');

class HTMLLinkExtractor extends Transform {
  _transform(chunk, encoding, callback) {
    const html = chunk.toString();
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      this.push(`${match[2]}\n`);
    }
    
    callback();
  }
}

const url = 'https://example.com';
https.get(url, (response) => {
  response
    .pipe(new HTMLLinkExtractor())
    .pipe(process.stdout); // Output links to console
});
```

## Object Mode Streams

```javascript
const { Readable, Transform } = require('stream');

// Create stream that emits objects instead of buffers
class ObjectGenerator extends Readable {
  constructor() {
    super({ objectMode: true });
    this.current = 0;
  }
  
  _read() {
    if (this.current < 5) {
      this.push({
        id: this.current++,
        name: `User ${this.current}`,
        timestamp: Date.now()
      });
    } else {
      this.push(null);
    }
  }
}

class ObjectProcessor extends Transform {
  constructor() {
    super({ objectMode: true });
  }
  
  _transform(obj, encoding, callback) {
    // Process the object
    obj.processed = true;
    obj.processedAt = new Date().toISOString();
    
    this.push(obj);
    callback();
  }
}

// Usage
new ObjectGenerator()
  .pipe(new ObjectProcessor())
  .on('data', (obj) => {
    console.log('Processed object:', obj);
  });
```

## Stream Performance Benefits

### Memory Usage Comparison
```javascript
const fs = require('fs');

// ❌ Memory intensive - loads entire file
function copyFileTraditional(source, dest) {
  return new Promise((resolve, reject) => {
    fs.readFile(source, (err, data) => {
      if (err) return reject(err);
      
      fs.writeFile(dest, data, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

// ✅ Memory efficient - processes chunks
function copyFileStream(source, dest) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(source);
    const writeStream = fs.createWriteStream(dest);
    
    readStream.pipe(writeStream);
    
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    readStream.on('error', reject);
  });
}

// For a 1GB file:
// Traditional: Uses ~1GB RAM
// Stream: Uses ~64KB RAM (default chunk size)
```

## Best Practices

### 1. Always Handle Errors
```javascript
const { pipeline } = require('stream');

pipeline(
  fs.createReadStream('input.txt'),
  transform,
  fs.createWriteStream('output.txt'),
  (err) => {
    if (err) {
      console.error('Pipeline failed:', err);
    } else {
      console.log('Pipeline succeeded');
    }
  }
);
```

### 2. Use Pipeline for Complex Chains
```javascript
// ✅ Better error handling with pipeline
const { pipeline } = require('stream');

pipeline(
  source,
  transform1,
  transform2,
  destination,
  handleError
);

// ❌ Manual piping is error-prone
source.pipe(transform1).pipe(transform2).pipe(destination);
```

### 3. Monitor Stream Health
```javascript
function monitorStream(stream, name) {
  console.log(`${name} started`);
  
  stream.on('data', (chunk) => {
    console.log(`${name} processed ${chunk.length} bytes`);
  });
  
  stream.on('end', () => {
    console.log(`${name} ended`);
  });
  
  stream.on('error', (err) => {
    console.error(`${name} error:`, err);
  });
}
```

## Common Pitfalls

### 1. Not Handling Backpressure
```javascript
// ❌ Can cause memory issues
readable.on('data', chunk => {
  writable.write(chunk); // No backpressure handling
});

// ✅ Use pipe which handles backpressure
readable.pipe(writable);
```

### 2. Forgetting to End Streams
```javascript
// ❌ Stream never ends
writable.write('data');
// Missing: writable.end();

// ✅ Always end writable streams
writable.write('data');
writable.end();
```

### 3. Memory Leaks with Event Listeners
```javascript
// ❌ Potential memory leak
stream.on('data', handler);
// Missing cleanup

// ✅ Clean up listeners
stream.on('data', handler);
stream.on('end', () => {
  stream.removeListener('data', handler);
});
```

Streams are essential for building scalable Node.js applications, especially when dealing with large files, real-time data, or network communications. They're the foundation of many Node.js features and third-party libraries!