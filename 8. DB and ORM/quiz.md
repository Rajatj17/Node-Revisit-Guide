# Database & ORM Quiz

## Question 1: Multiple Choice
What is the main advantage of using connection pooling in database applications?

A) Faster query execution  
B) Reduced memory usage  
C) Better resource utilization and reduced connection overhead  
D) Automatic query optimization  

**Answer: C** - Connection pooling reuses existing connections, reducing the overhead of creating/destroying connections and managing resource usage efficiently.

---

## Question 2: True/False
In database transactions, the ACID properties stand for Atomicity, Consistency, Isolation, and Durability.

**Answer: True** - ACID properties ensure reliable database transactions: Atomicity (all-or-nothing), Consistency (valid state), Isolation (concurrent safety), Durability (permanent changes).

---

## Question 3: Code Analysis
```javascript
const query = `SELECT * FROM users WHERE name = '${userName}'`;
db.query(query, (err, results) => {
  res.json(results);
});
```

What's wrong with this code and how would you fix it?

**Answer:** **SQL Injection vulnerability** - user input is directly concatenated into the query. Fix with parameterized queries:
```javascript
const query = 'SELECT * FROM users WHERE name = $1';
db.query(query, [userName], (err, results) => {
  res.json(results);
});
```

---

## Question 4: Fill in the Blank
The _______ isolation level prevents dirty reads but allows phantom reads, while _______ prevents all three phenomena (dirty reads, non-repeatable reads, phantom reads).

**Answer: READ COMMITTED, SERIALIZABLE**

---

## Question 5: Short Answer
Explain the difference between optimistic and pessimistic locking in database systems.

**Answer:** 
- **Optimistic locking**: Assumes conflicts are rare; checks for conflicts only at commit time using version numbers or timestamps
- **Pessimistic locking**: Assumes conflicts are likely; locks data immediately when accessed, preventing other transactions from modifying it

---

## Question 6: Connection Pool Configuration
```javascript
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

Explain what each configuration parameter does.

**Answer:**
- **max: 20** - Maximum number of connections in the pool
- **idleTimeoutMillis: 30000** - Close idle connections after 30 seconds
- **connectionTimeoutMillis: 2000** - Timeout for acquiring a connection (2 seconds)

---

## Question 7: Multiple Choice
In database sharding, which approach distributes data based on a hash function applied to a shard key?

A) Range-based sharding  
B) Hash-based sharding  
C) Directory-based sharding  
D) Geographic sharding  

**Answer: B** - Hash-based sharding uses a hash function on the shard key to determine which shard stores the data.

---

## Question 8: Transaction Management
Complete this transaction pattern:

```javascript
async function transferMoney(fromAccount, toAccount, amount) {
  const client = await pool.connect();
  
  try {
    // Your implementation here
    
  } catch (error) {
    // Your error handling here
  } finally {
    // Your cleanup here
  }
}
```

**Answer:**
```javascript
async function transferMoney(fromAccount, toAccount, amount) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check balance
    const balanceResult = await client.query(
      'SELECT balance FROM accounts WHERE id = $1', 
      [fromAccount]
    );
    
    if (balanceResult.rows[0].balance < amount) {
      throw new Error('Insufficient funds');
    }
    
    // Debit from account
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, fromAccount]
    );
    
    // Credit to account
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, toAccount]
    );
    
    await client.query('COMMIT');
    return { success: true };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## Question 9: Query Optimization
Rank these queries from most to least efficient for finding active users:

A) `SELECT * FROM users WHERE status = 'active' AND created_at > '2023-01-01'`  
B) `SELECT id, name FROM users WHERE status = 'active' AND created_at > '2023-01-01'`  
C) `SELECT * FROM users WHERE created_at > '2023-01-01' AND status = 'active'`  

**Answer: B > A = C** - B is most efficient (selecting only needed columns). A and C are equivalent (query optimizer handles predicate order), but both less efficient than B due to `SELECT *`.

---

## Question 10: Advanced Scenario
You're designing a multi-tenant SaaS application. Each tenant needs data isolation. Compare these approaches:

1. Separate databases per tenant
2. Shared database with tenant_id column
3. Separate schemas per tenant

**Answer:**

**1. Separate databases per tenant:**
- ✅ Complete isolation, easier backup/restore per tenant
- ❌ Higher resource usage, complex maintenance

**2. Shared database with tenant_id:**  
- ✅ Resource efficient, simpler maintenance
- ❌ Risk of data leakage, complex row-level security

**3. Separate schemas per tenant:**
- ✅ Balance of isolation and efficiency
- ❌ Limited by database schema limits, moderate complexity

**Best choice depends on**: tenant count, data sensitivity, resource constraints, and compliance requirements.

---

## Practical Challenge Questions

### Challenge 1: Database Migration System
Design a migration system that supports:
- Forward and backward migrations
- Migration rollback
- Migration status tracking
- Atomic migration execution

### Challenge 2: Connection Pool Monitoring
```javascript
class ConnectionPool {
  constructor(config) {
    this.connections = [];
    this.activeConnections = new Set();
    // Add monitoring capabilities
  }
}
```

Add comprehensive monitoring to track pool health and performance.

### Challenge 3: Query Builder
Implement a query builder that supports:
- Method chaining
- Complex WHERE clauses
- JOINs
- Subqueries
- Parameter binding

### Challenge 4: Database Sharding
You have 10 million users. Design a sharding strategy considering:
- Even data distribution
- Query patterns (mostly by user_id)
- Cross-shard query requirements
- Future scaling needs

### Challenge 5: Read/Write Splitting
```javascript
// Implement intelligent read/write splitting
class DatabaseManager {
  constructor() {
    this.master = new Database(masterConfig);
    this.replicas = [
      new Database(replica1Config),
      new Database(replica2Config)
    ];
  }
  
  async query(sql, params) {
    // Your implementation here
  }
}
```

Implement load balancing, failover, and replication lag handling.

**Solutions:**

**Challenge 2:** Connection Pool Monitoring:
```javascript
class ConnectionPool {
  constructor(config) {
    this.connections = [];
    this.activeConnections = new Set();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      queuedRequests: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      connectionFailures: 0
    };
    this.startMonitoring();
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      poolUtilization: this.activeConnections.size / this.connections.length,
      healthStatus: this.getHealthStatus()
    };
  }
  
  getHealthStatus() {
    const utilization = this.activeConnections.size / this.connections.length;
    if (utilization > 0.9) return 'critical';
    if (utilization > 0.7) return 'warning';
    return 'healthy';
  }
  
  startMonitoring() {
    setInterval(() => {
      this.metrics.activeConnections = this.activeConnections.size;
      this.metrics.totalConnections = this.connections.length;
      // Log or emit metrics
    }, 5000);
  }
}
```

**Challenge 4:** Sharding Strategy:
```javascript
class UserShardManager {
  constructor() {
    // Hash-based sharding with consistent hashing
    this.shardCount = 16; // Start with 16 shards
    this.virtualNodes = 100; // Virtual nodes for better distribution
    this.hashRing = new Map();
    this.initializeHashRing();
  }
  
  // Use user_id hash for even distribution
  getShardForUser(userId) {
    const hash = this.consistentHash(userId.toString());
    return this.findShardFromHashRing(hash);
  }
  
  // Support for cross-shard queries when needed
  async queryAllShards(sql, params) {
    const results = await Promise.allSettled(
      this.getAllShards().map(shard => 
        shard.query(sql, params)
      )
    );
    return this.aggregateResults(results);
  }
}
```