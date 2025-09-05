// CommonJS vs ES Modules Exercises

console.log('=== COMMONJS VS ES MODULES EXERCISES ===\n');

// EXERCISE 1: CommonJS Module Creation
console.log('Exercise 1: Create a CommonJS calculator module');

// calculator.js (CommonJS style)
const calculator = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => b !== 0 ? a / b : 'Cannot divide by zero'
};

// Export using module.exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = calculator;
}

// Usage
if (typeof require !== 'undefined') {
  // const calc = require('./calculator');
  console.log('Calculator loaded via CommonJS');
}

console.log('\n--- Separator ---\n');

// EXERCISE 2: Dynamic Imports in CommonJS
console.log('Exercise 2: Dynamic CommonJS loading');

function loadModuleBasedOnCondition(useFS = true) {
  if (useFS) {
    const fs = require('fs');
    console.log('Loaded fs module:', typeof fs.readFile);
  } else {
    const path = require('path');
    console.log('Loaded path module:', typeof path.join);
  }
}

loadModuleBasedOnCondition(true);
loadModuleBasedOnCondition(false);

console.log('\n--- Separator ---\n');

// EXERCISE 3: Module Caching Demonstration
console.log('Exercise 3: Module caching behavior');

// Create a counter module simulation
const createCounter = () => {
  let count = 0;
  return {
    increment: () => ++count,
    getCount: () => count,
    reset: () => count = 0
  };
};

// In CommonJS, modules are cached
const counter1 = createCounter();
const counter2 = createCounter(); // This would be the same instance in real modules

console.log('Counter 1 initial:', counter1.getCount());
console.log('Counter 2 initial:', counter2.getCount());

counter1.increment();
counter1.increment();

console.log('After incrementing counter1:');
console.log('Counter 1:', counter1.getCount());
console.log('Counter 2:', counter2.getCount());

console.log('\n--- Separator ---\n');

// EXERCISE 4: Circular Dependency Simulation
console.log('Exercise 4: Circular dependencies');

// Simulate moduleA.js
const moduleA = {
  name: 'Module A',
  getValue: () => 'Value from A',
  useModuleB: () => {
    // In real scenario: const moduleB = require('./moduleB');
    return 'Would use Module B';
  }
};

// Simulate moduleB.js
const moduleB = {
  name: 'Module B',
  getValue: () => 'Value from B',
  useModuleA: () => {
    // In real scenario: const moduleA = require('./moduleA');
    return 'Would use Module A';
  }
};

console.log(moduleA.name, '->', moduleA.useModuleB());
console.log(moduleB.name, '->', moduleB.useModuleA());

console.log('\n--- Separator ---\n');

// EXERCISE 5: ES Modules Simulation (since we can't actually use import/export in Node without setup)
console.log('Exercise 5: ES Modules concepts');

// Simulate named exports
const namedExports = {
  add: (a, b) => a + b,
  PI: 3.14159,
  utils: {
    format: (str) => str.toUpperCase()
  }
};

// Simulate default export
const defaultExport = (message) => console.log(`Default: ${message}`);

// Simulate imports
const { add, PI } = namedExports;
const format = namedExports.utils.format;
const defaultFunc = defaultExport;

console.log('Named import add(2, 3):', add(2, 3));
console.log('Named import PI:', PI);
console.log('Utility function:', format('hello world'));
defaultFunc('This simulates default import');

console.log('\n--- Separator ---\n');

// EXERCISE 6: Module Resolution
console.log('Exercise 6: Module resolution patterns');

const modulePatterns = [
  './local-file',           // Relative path
  '../parent-dir/file',     // Parent directory
  'lodash',                 // npm package
  'fs',                     // Built-in module
  '/absolute/path/module'   // Absolute path
];

modulePatterns.forEach(pattern => {
  console.log(`Pattern: ${pattern}`);
  if (pattern.startsWith('.')) {
    console.log('  -> Relative module');
  } else if (pattern.startsWith('/')) {
    console.log('  -> Absolute path');
  } else if (['fs', 'path', 'http', 'crypto'].includes(pattern)) {
    console.log('  -> Built-in Node.js module');
  } else {
    console.log('  -> npm package or global module');
  }
});

console.log('\n=== END EXERCISES ===\n');

// PRACTICE CHALLENGES:

console.log('PRACTICE CHALLENGES:\n');

console.log('Challenge 1: Create both CommonJS and ES Module versions of a user management system');
console.log('Challenge 2: Implement dynamic module loading with error handling');
console.log('Challenge 3: Demonstrate the difference between CommonJS and ES Module live bindings');
console.log('Challenge 4: Create a plugin system using dynamic imports');
console.log('Challenge 5: Handle circular dependencies properly in both systems');

// Challenge implementations (commented out):

/*
// CHALLENGE 1: User Management Module

// CommonJS Version (userManager.js)
class UserManager {
  constructor() {
    this.users = [];
  }
  
  addUser(user) {
    this.users.push(user);
  }
  
  getUser(id) {
    return this.users.find(u => u.id === id);
  }
  
  getAllUsers() {
    return this.users;
  }
}

module.exports = UserManager;
module.exports.createUser = (id, name) => ({ id, name, createdAt: Date.now() });

// ES Module Version (userManager.mjs)
export class UserManager {
  constructor() {
    this.users = [];
  }
  
  addUser(user) {
    this.users.push(user);
  }
  
  getUser(id) {
    return this.users.find(u => u.id === id);
  }
  
  getAllUsers() {
    return this.users;
  }
}

export const createUser = (id, name) => ({ id, name, createdAt: Date.now() });

export default UserManager;
*/

/*
// CHALLENGE 2: Dynamic Module Loader

async function loadModuleSafely(modulePath) {
  try {
    if (modulePath.endsWith('.mjs')) {
      // ES Module
      const module = await import(modulePath);
      return module;
    } else {
      // CommonJS
      const module = require(modulePath);
      return module;
    }
  } catch (error) {
    console.error(`Failed to load module ${modulePath}:`, error.message);
    return null;
  }
}
*/

/*
// CHALLENGE 3: Live Bindings Demo

// CommonJS - No live bindings
let commonJSCounter = 0;
const incrementCommonJS = () => commonJSCounter++;
const getCommonJSCounter = () => commonJSCounter;

module.exports = { counter: commonJSCounter, increment: incrementCommonJS, getCounter: getCommonJSCounter };

// ES Modules - Live bindings
export let esCounter = 0;
export const incrementES = () => esCounter++;
*/