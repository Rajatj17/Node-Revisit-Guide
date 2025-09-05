# Node.js Streams Knowledge Quiz

## Question 1: Multiple Choice
What are the four types of streams in Node.js?

A) Input, Output, Process, Memory  
B) Readable, Writable, Transform, Duplex  
C) Source, Destination, Filter, Buffer  
D) Read, Write, Modify, Combine  

**Answer: B**

---

## Question 2: True/False
The `.pipe()` method automatically handles backpressure between streams.

**Answer: True** - The pipe method pauses the source stream when the destination cannot keep up.

---

## Question 3: Code Analysis
```javascript
const fs = require('fs');
const readable = fs.createReadStream('large-file.txt');
const writable = fs.createWriteStream('output.txt');

readable.on('data', chunk => {
  writable.write(chunk);
});
```

What problem does this code have?

**Answer:** This code doesn't handle backpressure. If the writable stream can't keep up with the readable stream, chunks will accumulate in memory. Should use `readable.pipe(writable)` or check `writable.write()` return value.

---

## Question 4: Fill in the Blank
In a custom Readable stream, you implement the _______ method to define how data is generated.

**Answer: `_read()`**

---

## Question 5: Short Answer
What is the difference between object mode and regular streams?

**Answer:** Regular streams work with Buffers and strings, while object mode streams (`objectMode: true`) can work with any JavaScript object. Object mode is useful for processing structured data like JSON objects or database records.

---

## Question 6: Code Output
```javascript
const { Readable } = require('stream');

class Counter extends Readable {
  constructor() {
    super();
    this.count = 0;
  }
  
  _read() {
    if (this.count < 3) {
      this.push(`${this.count++}\n`);
    } else {
      this.push(null);
    }
  }
}

const counter = new Counter();
counter.on('data', chunk => console.log(chunk.toString().trim()));
```

What will be logged?

**Answer: 0, 1, 2** - The stream generates numbers 0-2 and then ends by pushing null.

---

## Question 7: Best Practices
Why should you use `pipeline()` instead of manually chaining `.pipe()` calls?

**Answer:** `pipeline()` provides better error handling by automatically cleaning up all streams in the chain if any stream errors. It also properly handles stream destruction and prevents memory leaks.

---

## Question 8: Advanced Scenario
You need to process a 10GB log file. Compare the memory usage between using `fs.readFile()` vs `fs.createReadStream()`.

**Answer:** 
- `fs.readFile()`: Loads entire 10GB into memory at once (high memory usage)
- `fs.createReadStream()`: Processes file in small chunks (typically 64KB), keeping memory usage minimal and constant regardless of file size

---

## Question 9: Transform Stream Implementation
Complete this Transform stream that adds line numbers:

```javascript
class LineNumberer extends Transform {
  constructor() {
    super();
    this.lineNumber = 0;
  }
  
  _transform(chunk, encoding, callback) {
    // Complete this implementation
  }
}
```

**Answer:**
```javascript
_transform(chunk, encoding, callback) {
  const lines = chunk.toString().split('\n');
  const numberedLines = lines.map(line => {
    if (line.length > 0) {
      return `${++this.lineNumber}: ${line}`;
    }
    return line;
  });
  this.push(numberedLines.join('\n'));
  callback();
}
```

---

## Question 10: Error Handling
What happens if a stream in the middle of a pipe chain throws an error?

**Answer:** The error event is emitted on the stream that errored, but other streams in the chain continue running, potentially causing memory leaks. This is why `pipeline()` is preferred - it properly handles errors and cleans up all streams.

---

## Practical Challenge Questions

### Challenge 1: Backpressure Problem
```javascript
const readable = fs.createReadStream('huge-file.txt');
const writable = fs.createWriteStream('output.txt');

readable.on('data', chunk => {
  writable.write(chunk); // Problem here
});
```

Fix this code to handle backpressure properly.

**Solution:**
```javascript
readable.on('data', chunk => {
  const canWriteMore = writable.write(chunk);
  if (!canWriteMore) {
    readable.pause();
    writable.once('drain', () => readable.resume());
  }
});
```

### Challenge 2: Memory Leak
```javascript
function processFiles(files) {
  files.forEach(file => {
    const stream = fs.createReadStream(file);
    stream.on('data', processData);
    stream.on('end', () => {
      console.log('File processed');
    });
  });
}
```

What's wrong with this code and how to fix it?

### Challenge 3: Stream Performance
You need to process 1 million JSON objects from a file. Design a streaming solution that:
1. Parses JSON objects one by one
2. Filters based on criteria
3. Transforms the data
4. Writes to output file

### Challenge 4: Custom Duplex Stream
Create a duplex stream that:
- Accepts data on the writable side
- Buffers it internally
- Outputs the data in reverse order on the readable side

### Challenge 5: Error Recovery
Design a Transform stream that can recover from JSON parsing errors and continue processing the next valid JSON object.

**Solutions:**

**Challenge 2 Issue:** No error handling and potential resource leaks. Event listeners aren't cleaned up.
```javascript
function processFiles(files) {
  files.forEach(file => {
    const stream = fs.createReadStream(file);
    stream.on('data', processData);
    stream.on('end', () => {
      stream.removeAllListeners();
      console.log('File processed');
    });
    stream.on('error', err => {
      stream.removeAllListeners();
      console.error('Error:', err);
    });
  });
}
```

**Challenge 3 Solution:**
```javascript
const { pipeline } = require('stream');

class JSONObjectParser extends Transform {
  constructor() {
    super({ objectMode: true });
    this.buffer = '';
  }
  
  _transform(chunk, encoding, callback) {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    lines.forEach(line => {
      if (line.trim()) {
        try {
          this.push(JSON.parse(line));
        } catch (err) {
          // Skip invalid JSON
        }
      }
    });
    callback();
  }
}

pipeline(
  fs.createReadStream('input.jsonl'),
  new JSONObjectParser(),
  new Transform({
    objectMode: true,
    transform(obj, encoding, callback) {
      if (obj.active) { // Filter
        obj.processed = true; // Transform
        callback(null, JSON.stringify(obj) + '\n');
      } else {
        callback();
      }
    }
  }),
  fs.createWriteStream('output.jsonl'),
  (err) => console.log(err ? 'Error:' : 'Complete:', err)
);
```