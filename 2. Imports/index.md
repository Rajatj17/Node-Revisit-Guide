# CommonJS vs ES Modules in Node.js

This is one of the most important Node.js concepts as it affects how you structure and organize your entire application.

## CommonJS (Traditional Node.js)

### Basic Syntax

**Exporting:**
```javascript
// math.js - CommonJS
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

// Method 1: module.exports
module.exports = {
  add,
  subtract
};

// Method 2: exports shorthand
exports.multiply = (a, b) => a * b;

// Method 3: Single export
module.exports = add;
```

**Importing:**
```javascript
// app.js - CommonJS
const math = require('./math');
const { add, subtract } = require('./math');
const fs = require('fs'); // Built-in module
const express = require('express'); // npm package

console.log(math.add(2, 3)); // 5
console.log(add(2, 3)); // 5 (destructured)
```

### Key Characteristics of CommonJS:

1. **Synchronous Loading**
```javascript
console.log('Before require');
const math = require('./math'); // Blocks until loaded
console.log('After require');
```

2. **Dynamic Require**
```javascript
// Conditional loading
if (process.env.NODE_ENV === 'development') {
  const debugTools = require('./debug-tools');
}

// Dynamic path
const moduleName = 'lodash';
const _ = require(moduleName);
```

3. **Runtime Resolution**
```javascript
// This works in CommonJS
const modules = ['fs', 'path', 'os'];
modules.forEach(mod => {
  const module = require(mod);
  console.log(module);
});
```

## ES Modules (Modern JavaScript)

### Basic Syntax

**Exporting:**
```javascript
// math.mjs - ES Modules
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// Named exports
export const PI = 3.14159;

// Default export
export default function multiply(a, b) {
  return a * b;
}

// Alternative syntax
const divide = (a, b) => a / b;
export { divide, add as addition };
```

**Importing:**
```javascript
// app.mjs - ES Modules
import multiply from './math.mjs'; // Default import
import { add, subtract, PI } from './math.mjs'; // Named imports
import * as math from './math.mjs'; // Namespace import
import { add as addition } from './math.mjs'; // Renamed import

// Mixed imports
import multiply, { add, PI } from './math.mjs';

console.log(multiply(2, 3)); // 6
console.log(add(2, 3)); // 5
console.log(math.PI); // 3.14159
```

### Key Characteristics of ES Modules:

1. **Static Analysis**
```javascript
// These are determined at compile time
import { readFile } from 'fs/promises';
import express from 'express';

// This won't work - must be at top level
if (condition) {
  import something from './module'; // ❌ SyntaxError
}
```

2. **Asynchronous Loading**
```javascript
// Dynamic imports (async)
async function loadModule() {
  const { default: chalk } = await import('chalk');
  console.log(chalk.blue('Hello World'));
}

// Or with .then()
import('./math.mjs').then(math => {
  console.log(math.add(2, 3));
});
```

3. **Live Bindings**
```javascript
// counter.mjs
export let count = 0;
export function increment() {
  count++;
}

// app.mjs
import { count, increment } from './counter.mjs';
console.log(count); // 0
increment();
console.log(count); // 1 (live binding - updates!)
```

## Configuration and File Extensions

### Using ES Modules in Node.js

**Method 1: File Extensions**
```javascript
// Use .mjs extension
// math.mjs
export const add = (a, b) => a + b;

// app.mjs
import { add } from './math.mjs';
```

**Method 2: package.json Configuration**
```json
{
  "name": "my-app",
  "type": "module",
  "main": "app.js"
}
```

```javascript
// Now .js files are treated as ES modules
// math.js
export const add = (a, b) => a + b;

// app.js
import { add } from './math.js';
```

**Method 3: Mixing Both Systems**
```json
{
  "type": "module"
}
```

```javascript
// commonjs-module.cjs (CommonJS)
module.exports = {
  legacy: 'function'
};

// es-module.js (ES Module)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const legacy = require('./commonjs-module.cjs');
```

## Key Differences Summary

| Feature | CommonJS | ES Modules |
|---------|----------|------------|
| **Syntax** | `require()` / `module.exports` | `import` / `export` |
| **Loading** | Synchronous | Asynchronous |
| **When Resolved** | Runtime | Compile time |
| **Dynamic Imports** | Always dynamic | Static + dynamic |
| **File Extension** | `.js` (default) | `.mjs` or `.js` with `"type": "module"` |
| **Top-level await** | ❌ Not supported | ✅ Supported |
| **Tree Shaking** | ❌ Limited | ✅ Excellent |
| **Circular Dependencies** | Partially works | Better handling |

## Practical Examples

### CommonJS Example - Express Server
```javascript
// server.js (CommonJS)
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Conditional loading
if (process.env.NODE_ENV === 'development') {
  const morgan = require('morgan');
  app.use(morgan('dev'));
}

app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).send('Error reading file');
      return;
    }
    res.send(data);
  });
});

module.exports = app;
```

### ES Modules Example - Modern Server
```javascript
// server.js (ES Module)
import express from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const app = express();

// Dynamic import for conditional loading
if (process.env.NODE_ENV === 'development') {
  const { default: morgan } = await import('morgan');
  app.use(morgan('dev'));
}

app.get('/', async (req, res) => {
  try {
    const filePath = join(__dirname, 'public', 'index.html');
    const data = await readFile(filePath, 'utf8');
    res.send(data);
  } catch (err) {
    res.status(500).send('Error reading file');
  }
});

export default app;
```

## Interoperability Between Systems

### Using CommonJS in ES Modules
```javascript
// ES Module importing CommonJS
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import CommonJS module
const lodash = require('lodash');

// Or use default import (if module supports it)
import express from 'express'; // express is CommonJS but works
```

### Using ES Modules in CommonJS
```javascript
// CommonJS importing ES Module (async required)
async function loadESModule() {
  const { add } = await import('./math.mjs');
  console.log(add(2, 3));
}

loadESModule();
```

## Best Practices and When to Use Each

### Use CommonJS When:
- Working with older Node.js versions (< 12)
- Need synchronous loading
- Working with legacy codebases
- Need extensive dynamic require patterns

### Use ES Modules When:
- Building new applications
- Want better tree shaking and bundling
- Need top-level await
- Want better static analysis
- Building for modern environments

## Common Pitfalls

### 1. **Missing File Extensions in ES Modules**
```javascript
// ❌ Won't work in ES modules
import { add } from './math';

// ✅ Must include extension
import { add } from './math.js';
```

### 2. **__dirname and __filename in ES Modules**
```javascript
// ❌ Not available in ES modules
console.log(__dirname);

// ✅ ES module equivalent
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### 3. **Module.exports vs exports**
```javascript
// ❌ This breaks the reference
exports = { add: () => {} };

// ✅ Correct ways
exports.add = () => {};
module.exports = { add: () => {} };
```

## Performance Implications

**CommonJS:**
- Synchronous loading can block
- Runtime resolution overhead
- Better for server-side where modules are cached

**ES Modules:**
- Better tree shaking (smaller bundles)
- Static analysis enables optimizations
- Async loading doesn't block main thread

This module system choice fundamentally affects how you structure your Node.js applications and is crucial for modern JavaScript development!