// Node.js Database and ORM Exercises

const fs = require('fs');
const path = require('path');

console.log('=== NODE.JS DATABASE & ORM EXERCISES ===\n');

// EXERCISE 1: Connection Pooling and Management
console.log('Exercise 1: Database Connection Pool Implementation');

class DatabasePool {
  constructor(config = {}) {
    this.maxConnections = config.maxConnections || 10;
    this.idleTimeout = config.idleTimeout || 30000;
    this.connections = [];
    this.activeConnections = new Set();
    this.waitingQueue = [];
    this.connectionId = 0;
  }
  
  // Simulate database connection creation
  async createConnection() {
    const connectionId = ++this.connectionId;
    
    // Simulate connection creation delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const connection = {
      id: connectionId,
      connected: true,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      query: async (sql, params) => {
        // Simulate query execution
        await new Promise(resolve => setTimeout(resolve, 50));
        return { 
          rows: [{ id: 1, name: 'Test User', query: sql }], 
          rowCount: 1,
          executedAt: Date.now()
        };
      },
      close: () => {
        connection.connected = false;
        console.log(`Connection ${connectionId} closed`);
      }
    };
    
    console.log(`Created connection ${connectionId}`);
    return connection;
  }
  
  async getConnection() {
    // Check for available idle connections
    for (let i = 0; i < this.connections.length; i++) {
      const conn = this.connections[i];
      if (!this.activeConnections.has(conn)) {
        this.activeConnections.add(conn);
        conn.lastUsed = Date.now();
        console.log(`Reusing connection ${conn.id}`);
        return conn;
      }
    }
    
    // Create new connection if under limit
    if (this.connections.length < this.maxConnections) {
      const newConnection = await this.createConnection();
      this.connections.push(newConnection);
      this.activeConnections.add(newConnection);
      return newConnection;
    }
    
    // Wait for available connection
    console.log('Pool exhausted, waiting for available connection...');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection timeout'));
      }, 5000);
      
      this.waitingQueue.push({ resolve, reject, timeout });
    });
  }
  
  releaseConnection(connection) {
    if (this.activeConnections.has(connection)) {
      this.activeConnections.delete(connection);
      connection.lastUsed = Date.now();
      console.log(`Released connection ${connection.id}`);
      
      // Check if anyone is waiting
      if (this.waitingQueue.length > 0) {
        const { resolve, reject, timeout } = this.waitingQueue.shift();
        clearTimeout(timeout);
        this.activeConnections.add(connection);
        resolve(connection);
      }
    }
  }
  
  // Clean up idle connections
  cleanup() {
    const now = Date.now();
    const idleConnections = this.connections.filter(conn => 
      !this.activeConnections.has(conn) && 
      (now - conn.lastUsed) > this.idleTimeout
    );
    
    idleConnections.forEach(conn => {
      conn.close();
      const index = this.connections.indexOf(conn);
      if (index !== -1) {
        this.connections.splice(index, 1);
      }
    });
    
    if (idleConnections.length > 0) {
      console.log(`Cleaned up ${idleConnections.length} idle connections`);
    }
  }
  
  getStats() {
    return {
      totalConnections: this.connections.length,
      activeConnections: this.activeConnections.size,
      waitingRequests: this.waitingQueue.length,
      maxConnections: this.maxConnections
    };
  }
  
  async closeAll() {
    this.connections.forEach(conn => conn.close());
    this.connections = [];
    this.activeConnections.clear();
    console.log('All connections closed');
  }
}

// Test connection pool
async function testConnectionPool() {
  const pool = new DatabasePool({ maxConnections: 3, idleTimeout: 2000 });
  
  console.log('--- Testing Connection Pool ---');
  
  // Test basic connection usage
  const conn1 = await pool.getConnection();
  console.log('Pool stats:', pool.getStats());
  
  const result = await conn1.query('SELECT * FROM users WHERE id = $1', [1]);
  console.log('Query result:', result.rows[0]);
  
  pool.releaseConnection(conn1);
  console.log('Pool stats after release:', pool.getStats());
  
  // Test pool exhaustion
  const connections = [];
  try {
    for (let i = 0; i < 4; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);
      console.log(`Got connection ${i + 1}, pool stats:`, pool.getStats());
    }
  } catch (error) {
    console.log('Expected error:', error.message);
  }
  
  // Release connections
  connections.forEach(conn => pool.releaseConnection(conn));
  
  // Test cleanup
  setTimeout(() => {
    pool.cleanup();
    console.log('Pool stats after cleanup:', pool.getStats());
    pool.closeAll();
  }, 2500);
}

testConnectionPool().then(() => {
  setTimeout(() => {
    console.log('\n--- Separator ---\n');
    exerciseTwo();
  }, 3000);
});

// EXERCISE 2: Query Builder and ORM Pattern
function exerciseTwo() {
  console.log('Exercise 2: Query Builder Implementation');
  
  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.selectFields = ['*'];
      this.whereConditions = [];
      this.joinClauses = [];
      this.orderByFields = [];
      this.limitValue = null;
      this.offsetValue = null;
      this.params = [];
    }
    
    select(fields) {
      if (Array.isArray(fields)) {
        this.selectFields = fields;
      } else if (typeof fields === 'string') {
        this.selectFields = fields.split(',').map(f => f.trim());
      }
      return this;
    }
    
    where(field, operator, value) {
      if (arguments.length === 2) {
        // where(field, value) - assumes equals
        value = operator;
        operator = '=';
      }
      
      const paramIndex = this.params.length + 1;
      this.whereConditions.push(`${field} ${operator} $${paramIndex}`);
      this.params.push(value);
      return this;
    }
    
    whereIn(field, values) {
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error('whereIn requires a non-empty array');
      }
      
      const placeholders = values.map((_, index) => `$${this.params.length + index + 1}`).join(', ');
      this.whereConditions.push(`${field} IN (${placeholders})`);
      this.params.push(...values);
      return this;
    }
    
    whereLike(field, pattern) {
      const paramIndex = this.params.length + 1;
      this.whereConditions.push(`${field} LIKE $${paramIndex}`);
      this.params.push(pattern);
      return this;
    }
    
    join(table, condition) {
      this.joinClauses.push(`INNER JOIN ${table} ON ${condition}`);
      return this;
    }
    
    leftJoin(table, condition) {
      this.joinClauses.push(`LEFT JOIN ${table} ON ${condition}`);
      return this;
    }
    
    orderBy(field, direction = 'ASC') {
      this.orderByFields.push(`${field} ${direction.toUpperCase()}`);
      return this;
    }
    
    limit(count) {
      this.limitValue = count;
      return this;
    }
    
    offset(count) {
      this.offsetValue = count;
      return this;
    }
    
    toSQL() {
      let sql = `SELECT ${this.selectFields.join(', ')} FROM ${this.table}`;
      
      if (this.joinClauses.length > 0) {
        sql += ' ' + this.joinClauses.join(' ');
      }
      
      if (this.whereConditions.length > 0) {
        sql += ' WHERE ' + this.whereConditions.join(' AND ');
      }
      
      if (this.orderByFields.length > 0) {
        sql += ' ORDER BY ' + this.orderByFields.join(', ');
      }
      
      if (this.limitValue !== null) {
        sql += ` LIMIT ${this.limitValue}`;
      }
      
      if (this.offsetValue !== null) {
        sql += ` OFFSET ${this.offsetValue}`;
      }
      
      return { sql, params: this.params };
    }
    
    // Simulate query execution
    async execute() {
      const { sql, params } = this.toSQL();
      console.log('Executing SQL:', sql);
      console.log('Parameters:', params);
      
      // Simulate database execution
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return {
        rows: [
          { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'active' }
        ],
        rowCount: 2
      };
    }
  }
  
  // Simple ORM Model
  class Model {
    constructor(tableName) {
      this.tableName = tableName;
    }
    
    select(fields) {
      return new QueryBuilder(this.tableName).select(fields);
    }
    
    where(field, operator, value) {
      return new QueryBuilder(this.tableName).where(field, operator, value);
    }
    
    find(id) {
      return new QueryBuilder(this.tableName).where('id', id).limit(1);
    }
    
    create(data) {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      
      const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      
      console.log('Insert SQL:', sql);
      console.log('Values:', values);
      
      // Simulate insertion
      return {
        rows: [{ id: Date.now(), ...data, created_at: new Date() }],
        rowCount: 1
      };
    }
    
    update(id, data) {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`;
      
      console.log('Update SQL:', sql);
      console.log('Values:', [...values, id]);
      
      return {
        rows: [{ id, ...data, updated_at: new Date() }],
        rowCount: 1
      };
    }
    
    delete(id) {
      const sql = `DELETE FROM ${this.tableName} WHERE id = $1`;
      
      console.log('Delete SQL:', sql);
      console.log('ID:', id);
      
      return { rowCount: 1 };
    }
  }
  
  // Test Query Builder and ORM
  async function testQueryBuilderAndORM() {
    console.log('--- Testing Query Builder ---');
    
    // Basic select query
    const query1 = new QueryBuilder('users')
      .select(['id', 'name', 'email'])
      .where('status', 'active')
      .where('age', '>', 18)
      .orderBy('name')
      .limit(10);
    
    console.log('Query 1:', query1.toSQL());
    
    // Complex query with joins
    const query2 = new QueryBuilder('users')
      .select(['users.name', 'profiles.bio', 'roles.name as role'])
      .leftJoin('profiles', 'users.id = profiles.user_id')
      .join('roles', 'users.role_id = roles.id')
      .whereIn('users.status', ['active', 'pending'])
      .whereLike('users.name', '%john%')
      .orderBy('users.created_at', 'DESC')
      .limit(5)
      .offset(10);
    
    console.log('Query 2:', query2.toSQL());
    
    // Execute query
    const results = await query1.execute();
    console.log('Query results:', results);
    
    console.log('\n--- Testing ORM Model ---');
    
    const User = new Model('users');
    
    // Find user by ID
    const findQuery = User.find(123);
    console.log('Find query:', findQuery.toSQL());
    
    // Create user
    const createResult = User.create({
      name: 'New User',
      email: 'newuser@example.com',
      status: 'active'
    });
    console.log('Create result:', createResult);
    
    // Update user
    const updateResult = User.update(123, {
      name: 'Updated User',
      email: 'updated@example.com'
    });
    console.log('Update result:', updateResult);
    
    // Complex query using model
    const complexQuery = User
      .select(['id', 'name', 'email'])
      .where('status', 'active')
      .where('created_at', '>', '2023-01-01')
      .orderBy('created_at', 'DESC')
      .limit(20);
    
    console.log('Complex model query:', complexQuery.toSQL());
  }
  
  testQueryBuilderAndORM().then(() => {
    setTimeout(() => exerciseThree(), 1000);
  });
}

// EXERCISE 3: Transaction Management
function exerciseThree() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 3: Transaction Management');
  
  class TransactionManager {
    constructor() {
      this.transactions = new Map();
      this.transactionId = 0;
    }
    
    async beginTransaction() {
      const txId = ++this.transactionId;
      
      // Simulate getting connection from pool
      const connection = {
        id: txId,
        inTransaction: true,
        queries: [],
        rollback: false,
        
        async query(sql, params = []) {
          console.log(`[TX${txId}] Executing: ${sql}`);
          console.log(`[TX${txId}] Params:`, params);
          
          // Simulate query execution
          await new Promise(resolve => setTimeout(resolve, 30));
          
          const result = {
            rows: [{ id: 1, affected: true, query: sql }],
            rowCount: 1,
            transactionId: txId
          };
          
          this.queries.push({ sql, params, result, timestamp: Date.now() });
          return result;
        },
        
        async commit() {
          if (this.rollback) {
            throw new Error('Cannot commit a rolled back transaction');
          }
          
          console.log(`[TX${txId}] COMMIT - ${this.queries.length} queries executed`);
          this.inTransaction = false;
          
          // Simulate commit delay
          await new Promise(resolve => setTimeout(resolve, 50));
          
          return { committed: true, queryCount: this.queries.length };
        },
        
        async rollback() {
          console.log(`[TX${txId}] ROLLBACK - undoing ${this.queries.length} queries`);
          this.rollback = true;
          this.inTransaction = false;
          
          // Simulate rollback delay
          await new Promise(resolve => setTimeout(resolve, 30));
          
          return { rolledBack: true, queryCount: this.queries.length };
        }
      };
      
      this.transactions.set(txId, connection);
      console.log(`[TX${txId}] Transaction started`);
      
      return connection;
    }
    
    async withTransaction(callback) {
      const tx = await this.beginTransaction();
      
      try {
        const result = await callback(tx);
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        this.transactions.delete(tx.id);
      }
    }
    
    // Simulate distributed transaction (2-phase commit)
    async distributeTransaction(operations) {
      const transactions = [];
      
      try {
        // Phase 1: Prepare all transactions
        console.log('--- Phase 1: Preparing transactions ---');
        for (const operation of operations) {
          const tx = await this.beginTransaction();
          await operation.prepare(tx);
          transactions.push({ tx, operation });
        }
        
        // Phase 2: Commit all transactions
        console.log('--- Phase 2: Committing transactions ---');
        const results = [];
        for (const { tx, operation } of transactions) {
          await operation.commit(tx);
          const result = await tx.commit();
          results.push(result);
        }
        
        return results;
        
      } catch (error) {
        // Rollback all transactions on failure
        console.log('--- Error occurred, rolling back all transactions ---');
        for (const { tx } of transactions) {
          try {
            await tx.rollback();
          } catch (rollbackError) {
            console.error('Rollback error:', rollbackError.message);
          }
        }
        throw error;
      }
    }
  }
  
  // Test transaction management
  async function testTransactions() {
    const txManager = new TransactionManager();
    
    console.log('--- Testing Basic Transaction ---');
    
    // Successful transaction
    try {
      const result = await txManager.withTransaction(async (tx) => {
        await tx.query('INSERT INTO users (name, email) VALUES ($1, $2)', ['John Doe', 'john@example.com']);
        await tx.query('UPDATE user_stats SET total_users = total_users + 1');
        await tx.query('INSERT INTO audit_log (action, user_id) VALUES ($1, $2)', ['user_created', 1]);
        
        return { success: true, userId: 1 };
      });
      
      console.log('Transaction result:', result);
      
    } catch (error) {
      console.error('Transaction failed:', error.message);
    }
    
    console.log('\n--- Testing Failed Transaction ---');
    
    // Failed transaction
    try {
      await txManager.withTransaction(async (tx) => {
        await tx.query('INSERT INTO users (name, email) VALUES ($1, $2)', ['Jane Doe', 'jane@example.com']);
        await tx.query('UPDATE user_stats SET total_users = total_users + 1');
        
        // Simulate error
        throw new Error('Something went wrong during processing');
      });
      
    } catch (error) {
      console.log('Expected transaction failure:', error.message);
    }
    
    console.log('\n--- Testing Distributed Transaction ---');
    
    // Distributed transaction simulation
    const distributedOperations = [
      {
        name: 'UserService',
        prepare: async (tx) => {
          await tx.query('INSERT INTO users (name, email) VALUES ($1, $2)', ['Distributed User', 'dist@example.com']);
        },
        commit: async (tx) => {
          console.log('UserService: Committing user creation');
        }
      },
      {
        name: 'EmailService',
        prepare: async (tx) => {
          await tx.query('INSERT INTO email_queue (recipient, subject) VALUES ($1, $2)', ['dist@example.com', 'Welcome']);
        },
        commit: async (tx) => {
          console.log('EmailService: Committing email queue');
        }
      },
      {
        name: 'NotificationService',
        prepare: async (tx) => {
          await tx.query('INSERT INTO notifications (user_id, message) VALUES ($1, $2)', [1, 'Account created']);
        },
        commit: async (tx) => {
          console.log('NotificationService: Committing notification');
        }
      }
    ];
    
    try {
      const results = await txManager.distributeTransaction(distributedOperations);
      console.log('Distributed transaction completed:', results.length, 'services committed');
    } catch (error) {
      console.log('Distributed transaction failed:', error.message);
    }
  }
  
  testTransactions().then(() => {
    setTimeout(() => exerciseFour(), 1000);
  });
}

// EXERCISE 4: Database Migration System
function exerciseFour() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 4: Database Migration System');
  
  class MigrationManager {
    constructor() {
      this.migrations = [];
      this.appliedMigrations = new Set();
      this.migrationHistory = [];
    }
    
    addMigration(migration) {
      if (!migration.id || !migration.up || !migration.down) {
        throw new Error('Migration must have id, up, and down methods');
      }
      
      this.migrations.push(migration);
      this.migrations.sort((a, b) => a.id.localeCompare(b.id));
    }
    
    async runMigration(migration, direction = 'up') {
      console.log(`Running migration ${migration.id} (${direction})`);
      
      const startTime = Date.now();
      
      try {
        if (direction === 'up') {
          await migration.up();
          this.appliedMigrations.add(migration.id);
        } else {
          await migration.down();
          this.appliedMigrations.delete(migration.id);
        }
        
        const duration = Date.now() - startTime;
        const historyEntry = {
          migrationId: migration.id,
          direction,
          executedAt: new Date(),
          duration,
          success: true
        };
        
        this.migrationHistory.push(historyEntry);
        console.log(`Migration ${migration.id} completed in ${duration}ms`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        const historyEntry = {
          migrationId: migration.id,
          direction,
          executedAt: new Date(),
          duration,
          success: false,
          error: error.message
        };
        
        this.migrationHistory.push(historyEntry);
        console.error(`Migration ${migration.id} failed:`, error.message);
        throw error;
      }
    }
    
    async migrate() {
      console.log('Starting database migration...');
      
      const pendingMigrations = this.migrations.filter(m => !this.appliedMigrations.has(m.id));
      
      if (pendingMigrations.length === 0) {
        console.log('No pending migrations');
        return;
      }
      
      console.log(`Found ${pendingMigrations.length} pending migrations`);
      
      for (const migration of pendingMigrations) {
        await this.runMigration(migration, 'up');
      }
      
      console.log('All migrations completed successfully');
    }
    
    async rollback(steps = 1) {
      console.log(`Rolling back ${steps} migration(s)...`);
      
      const appliedMigrations = this.migrations
        .filter(m => this.appliedMigrations.has(m.id))
        .reverse()
        .slice(0, steps);
      
      if (appliedMigrations.length === 0) {
        console.log('No migrations to rollback');
        return;
      }
      
      for (const migration of appliedMigrations) {
        await this.runMigration(migration, 'down');
      }
      
      console.log(`Rolled back ${appliedMigrations.length} migration(s)`);
    }
    
    getStatus() {
      const total = this.migrations.length;
      const applied = this.appliedMigrations.size;
      const pending = total - applied;
      
      return {
        total,
        applied,
        pending,
        appliedMigrations: Array.from(this.appliedMigrations),
        pendingMigrations: this.migrations
          .filter(m => !this.appliedMigrations.has(m.id))
          .map(m => m.id)
      };
    }
    
    getHistory() {
      return this.migrationHistory.slice().reverse(); // Most recent first
    }
  }
  
  // Sample migrations
  const migrations = [
    {
      id: '001_create_users_table',
      description: 'Create users table',
      async up() {
        console.log('  Creating users table...');
        // Simulate table creation
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('  ✓ Users table created');
      },
      async down() {
        console.log('  Dropping users table...');
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log('  ✓ Users table dropped');
      }
    },
    {
      id: '002_add_email_index',
      description: 'Add index on email column',
      async up() {
        console.log('  Adding email index...');
        await new Promise(resolve => setTimeout(resolve, 80));
        console.log('  ✓ Email index created');
      },
      async down() {
        console.log('  Dropping email index...');
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log('  ✓ Email index dropped');
      }
    },
    {
      id: '003_create_posts_table',
      description: 'Create posts table',
      async up() {
        console.log('  Creating posts table...');
        await new Promise(resolve => setTimeout(resolve, 120));
        console.log('  ✓ Posts table created');
      },
      async down() {
        console.log('  Dropping posts table...');
        await new Promise(resolve => setTimeout(resolve, 60));
        console.log('  ✓ Posts table dropped');
      }
    },
    {
      id: '004_add_user_posts_relation',
      description: 'Add foreign key relation between users and posts',
      async up() {
        console.log('  Adding foreign key constraint...');
        await new Promise(resolve => setTimeout(resolve, 90));
        console.log('  ✓ Foreign key constraint added');
      },
      async down() {
        console.log('  Dropping foreign key constraint...');
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log('  ✓ Foreign key constraint dropped');
      }
    }
  ];
  
  // Test migration system
  async function testMigrations() {
    const migrationManager = new MigrationManager();
    
    // Add all migrations
    migrations.forEach(migration => {
      migrationManager.addMigration(migration);
    });
    
    console.log('--- Initial Status ---');
    console.log('Migration status:', migrationManager.getStatus());
    
    console.log('\n--- Running Migrations ---');
    await migrationManager.migrate();
    
    console.log('\n--- Status After Migration ---');
    console.log('Migration status:', migrationManager.getStatus());
    
    console.log('\n--- Rolling Back 2 Steps ---');
    await migrationManager.rollback(2);
    
    console.log('\n--- Status After Rollback ---');
    console.log('Migration status:', migrationManager.getStatus());
    
    console.log('\n--- Migration History ---');
    const history = migrationManager.getHistory();
    history.forEach(entry => {
      const status = entry.success ? '✓' : '✗';
      console.log(`${status} ${entry.migrationId} (${entry.direction}) - ${entry.duration}ms`);
    });
    
    console.log('\n--- Running Migrations Again ---');
    await migrationManager.migrate();
    
    console.log('\n--- Final Status ---');
    console.log('Migration status:', migrationManager.getStatus());
  }
  
  testMigrations().then(() => {
    setTimeout(() => practicalChallenges(), 1000);
  });
}

// PRACTICAL CHALLENGES
function practicalChallenges() {
  console.log('\n=== PRACTICAL CHALLENGES ===\n');
  
  console.log('Challenge 1: Database Sharding Strategy');
  console.log('Challenge 2: Read/Write Database Splitting');
  console.log('Challenge 3: Data Caching Layer');
  console.log('Challenge 4: Database Performance Monitoring');
  console.log('Challenge 5: Multi-Tenant Database Design');
  
  // Challenge 1: Database Sharding Implementation
  console.log('\n--- Challenge 1: Database Sharding Strategy ---');
  
  class DatabaseShardManager {
    constructor() {
      this.shards = new Map();
      this.shardCount = 4;
      this.algorithm = 'hash'; // hash, range, directory
    }
    
    addShard(shardId, config) {
      this.shards.set(shardId, {
        id: shardId,
        config,
        connected: true,
        load: 0,
        queries: []
      });
      console.log(`Shard ${shardId} added`);
    }
    
    // Hash-based sharding
    getShardByHash(key) {
      const hash = this.simpleHash(key.toString());
      const shardId = hash % this.shardCount;
      return this.shards.get(shardId) || this.shards.get(0); // fallback to shard 0
    }
    
    // Range-based sharding (e.g., by user ID ranges)
    getShardByRange(value) {
      const numValue = parseInt(value);
      if (numValue <= 1000) return this.shards.get(0);
      if (numValue <= 2000) return this.shards.get(1);
      if (numValue <= 3000) return this.shards.get(2);
      return this.shards.get(3);
    }
    
    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash);
    }
    
    async query(sql, params, shardingKey) {
      const shard = this.getShardByHash(shardingKey);
      shard.load++;
      shard.queries.push({
        sql,
        params,
        timestamp: Date.now(),
        shardingKey
      });
      
      console.log(`Query executed on shard ${shard.id}:`, sql);
      
      // Simulate query execution
      await new Promise(resolve => setTimeout(resolve, 30));
      
      return {
        shardId: shard.id,
        rows: [{ id: 1, result: 'success' }],
        executionTime: 30
      };
    }
    
    getShardStats() {
      const stats = {};
      for (const [shardId, shard] of this.shards) {
        stats[shardId] = {
          load: shard.load,
          queryCount: shard.queries.length,
          connected: shard.connected
        };
      }
      return stats;
    }
    
    // Cross-shard query (scatter-gather pattern)
    async crossShardQuery(sql, params) {
      console.log('Executing cross-shard query:', sql);
      const results = [];
      
      for (const [shardId, shard] of this.shards) {
        try {
          const result = await this.query(sql, params, `shard-${shardId}`);
          results.push({ shardId, ...result });
        } catch (error) {
          console.error(`Error in shard ${shardId}:`, error.message);
        }
      }
      
      return this.aggregateResults(results);
    }
    
    aggregateResults(shardResults) {
      // Simple aggregation - combine all rows
      const allRows = shardResults.flatMap(result => result.rows);
      return {
        totalShards: shardResults.length,
        totalRows: allRows.length,
        rows: allRows
      };
    }
  }
  
  // Test sharding
  async function testSharding() {
    const shardManager = new DatabaseShardManager();
    
    // Add shards
    for (let i = 0; i < 4; i++) {
      shardManager.addShard(i, { host: `shard${i}.db.com`, port: 5432 });
    }
    
    console.log('--- Testing Hash-Based Sharding ---');
    
    // Test queries with different sharding keys
    const testKeys = ['user123', 'user456', 'user789', 'user101', 'user202'];
    
    for (const key of testKeys) {
      await shardManager.query(
        'SELECT * FROM users WHERE id = $1',
        [key],
        key
      );
    }
    
    console.log('\nShard statistics:');
    console.table(shardManager.getShardStats());
    
    console.log('\n--- Testing Cross-Shard Query ---');
    const crossShardResult = await shardManager.crossShardQuery(
      'SELECT COUNT(*) as total FROM users',
      []
    );
    
    console.log('Cross-shard result:', crossShardResult);
  }
  
  testSharding().then(() => {
    console.log('\n--- Challenge 2: Read/Write Splitting ---');
    
    // Challenge 2: Read/Write Database Splitting
    class ReadWriteDatabaseManager {
      constructor() {
        this.masterDB = { id: 'master', type: 'write', load: 0, queries: [] };
        this.replicaDBs = [
          { id: 'replica1', type: 'read', load: 0, queries: [] },
          { id: 'replica2', type: 'read', load: 0, queries: [] },
          { id: 'replica3', type: 'read', load: 0, queries: [] }
        ];
        this.currentReplicaIndex = 0;
      }
      
      // Route queries based on operation type
      async query(sql, params = []) {
        const isReadQuery = this.isReadQuery(sql);
        
        if (isReadQuery) {
          return await this.executeReadQuery(sql, params);
        } else {
          return await this.executeWriteQuery(sql, params);
        }
      }
      
      isReadQuery(sql) {
        const readOperations = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'];
        const operation = sql.trim().toUpperCase().split(' ')[0];
        return readOperations.includes(operation);
      }
      
      async executeWriteQuery(sql, params) {
        this.masterDB.load++;
        this.masterDB.queries.push({
          sql,
          params,
          timestamp: Date.now()
        });
        
        console.log(`Write query executed on master:`, sql);
        
        // Simulate write operation
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Simulate replication delay
        setTimeout(() => {
          console.log('Data replicated to read replicas');
        }, 100);
        
        return {
          database: 'master',
          type: 'write',
          rows: [{ id: 1, affected: true }],
          executionTime: 50
        };
      }
      
      async executeReadQuery(sql, params) {
        // Load balancing among read replicas (round-robin)
        const replica = this.replicaDBs[this.currentReplicaIndex];
        this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicaDBs.length;
        
        replica.load++;
        replica.queries.push({
          sql,
          params,
          timestamp: Date.now()
        });
        
        console.log(`Read query executed on ${replica.id}:`, sql);
        
        // Simulate read operation
        await new Promise(resolve => setTimeout(resolve, 20));
        
        return {
          database: replica.id,
          type: 'read',
          rows: [{ id: 1, data: 'sample' }],
          executionTime: 20
        };
      }
      
      getStats() {
        return {
          master: {
            load: this.masterDB.load,
            queryCount: this.masterDB.queries.length
          },
          replicas: this.replicaDBs.map(replica => ({
            id: replica.id,
            load: replica.load,
            queryCount: replica.queries.length
          }))
        };
      }
    }
    
    // Test read/write splitting
    async function testReadWriteSplitting() {
      const dbManager = new ReadWriteDatabaseManager();
      
      const queries = [
        'SELECT * FROM users',
        'INSERT INTO users (name) VALUES ($1)',
        'SELECT COUNT(*) FROM posts',
        'UPDATE users SET name = $1 WHERE id = $2',
        'SELECT * FROM users WHERE active = true',
        'DELETE FROM posts WHERE id = $1',
        'SELECT * FROM users ORDER BY created_at DESC'
      ];
      
      console.log('Executing mixed read/write queries...');
      
      for (const sql of queries) {
        await dbManager.query(sql, ['sample']);
      }
      
      console.log('\nDatabase statistics:');
      console.table(dbManager.getStats());
    }
    
    testReadWriteSplitting().then(() => {
      setTimeout(() => {
        console.log('\n=== END EXERCISES ===');
        console.log('\n💾 Database Best Practices Summary:');
        console.log('• Use connection pooling to manage database connections');
        console.log('• Always use parameterized queries to prevent SQL injection');
        console.log('• Implement proper transaction management');
        console.log('• Use database migrations for schema changes');
        console.log('• Consider sharding for horizontal scaling');
        console.log('• Implement read/write splitting for better performance');
        console.log('• Add appropriate indexes for query optimization');
        console.log('• Monitor database performance and query execution');
        console.log('• Implement proper error handling and retry logic');
        console.log('• Use caching layers to reduce database load');
      }, 1000);
    });
  });
}

console.log('Starting database exercises...\n');