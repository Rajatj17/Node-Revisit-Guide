# CommonJS vs ES Modules Quiz

## Question 1: Multiple Choice
What is the main difference between `require()` and `import`?

A) `require()` is faster than `import`  
B) `require()` is synchronous and runtime, `import` is asynchronous and compile-time  
C) `import` only works in browsers  
D) There is no significant difference  

**Answer: B**

---

## Question 2: True/False
In ES Modules, you must include file extensions when importing local modules.

**Answer: True** - ES Modules require explicit file extensions for relative imports.

---

## Question 3: Code Analysis
```javascript
// moduleA.js
exports.value = 5;
exports.getValue = () => exports.value;

// moduleB.js  
const { value, getValue } = require('./moduleA');
exports.value = 10;
console.log(value);      // ?
console.log(getValue()); // ?
```

What will be logged?

**Answer:** `5` and `5` - The destructured `value` is a copy, not a reference. `getValue()` accesses the original module's `exports.value`.

---

## Question 4: Fill in the Blank
To use CommonJS modules in an ES Module environment, you need to use _______ to create a require function.

**Answer: `createRequire` from the 'module' package**

---

## Question 5: Short Answer
Explain what "live bindings" means in ES Modules and how it differs from CommonJS.

**Answer:** Live bindings mean that imported values reflect changes made in the exporting module in real-time. In ES Modules, if you export a variable and change it, importers see the updated value. CommonJS creates copies/references at import time, so changes aren't automatically reflected.

---

## Question 6: Code Output
```javascript
// counter.mjs (ES Module)
export let count = 0;
export function increment() { count++; }

// main.mjs
import { count, increment } from './counter.mjs';
console.log(count); // ?
increment();
console.log(count); // ?
```

What is the output?

**Answer: 0, 1** - ES Modules provide live bindings, so the imported `count` reflects changes made by the `increment()` function.

---

## Question 7: Multiple Choice
Which file extension configuration makes `.js` files treated as ES Modules?

A) `"type": "commonjs"` in package.json  
B) `"type": "module"` in package.json  
C) `"module": true` in package.json  
D) Using `.mjs` extension only  

**Answer: B**

---

## Question 8: True/False
You can use `import` statements conditionally inside if blocks in ES Modules.

**Answer: False** - Static `import` statements must be at the top level. Dynamic imports using `import()` function can be conditional.

---

## Question 9: Code Completion
Complete the ES Module equivalent of this CommonJS code:

```javascript
// CommonJS
const fs = require('fs');
const { readFile, writeFile } = require('fs/promises');
module.exports = { processFile };
```

**Answer:**
```javascript
// ES Modules
import fs from 'fs';
import { readFile, writeFile } from 'fs/promises';
export { processFile };
```

---

## Question 10: Advanced Scenario
You have a Node.js application that needs to support both CommonJS and ES Modules. Describe the strategy you would use to make a dual-compatible package.

**Answer:** 
1. Use conditional exports in package.json with separate entry points for CommonJS and ES Modules
2. Create two build outputs: `.js` for CommonJS and `.mjs` for ES Modules
3. Use tools like Rollup or Webpack to generate both formats
4. Example package.json:
```json
{
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "exports": {
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"
  }
}
```

---

## Practical Challenges

### Challenge 1: Fix the Import
```javascript
// This doesn't work in ES Modules. Why and how to fix?
if (process.env.NODE_ENV === 'development') {
  import debug from 'debug';
}
```

### Challenge 2: Circular Dependencies
```javascript
// moduleA.js
const moduleB = require('./moduleB');
exports.name = 'A';
exports.getB = () => moduleB.name;

// moduleB.js  
const moduleA = require('./moduleA');
exports.name = 'B';
exports.getA = () => moduleA.name;
```
What happens and how would this differ in ES Modules?

### Challenge 3: Module Resolution
Explain the lookup process when you write:
```javascript
const express = require('express');
```

### Challenge 4: Performance Impact
Compare the bundle size and tree-shaking capabilities between:
```javascript
// CommonJS
const _ = require('lodash');

// ES Modules
import { debounce } from 'lodash';
```

### Challenge 5: __dirname Alternative
How do you get the current file directory in ES Modules since `__dirname` is not available?

**Answers:**

**Challenge 1:** Static imports must be at top level. Use dynamic import: `const debug = await import('debug');`

**Challenge 2:** CommonJS handles this by returning incomplete exports initially. ES Modules throw ReferenceError for uninitialized bindings.

**Challenge 3:** 1. Check if built-in module, 2. Check node_modules in current directory, 3. Walk up directory tree checking node_modules, 4. Check global modules.

**Challenge 4:** CommonJS imports entire library (larger bundle). ES Modules with named imports enable tree-shaking (smaller bundle).

**Challenge 5:** 
```javascript
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
```