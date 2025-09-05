# Node.js Database Integration - Complete Guide

Database integration is the **backbone** of most Node.js applications. Understanding how to effectively work with different database systems is crucial for building scalable, maintainable applications.

## Database Types and Use Cases

### SQL Databases (Relational)
```javascript
// PostgreSQL with node-postgres (pg)
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  
  // Connection pool settings
  max: 20, // Maximum number of clients
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error if connection takes longer than 2 seconds
  
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Basic query execution
async function getUser(userId) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release(); // Always release the client back to the pool
  }
}

// Prepared statements for better performance
async function getUsersByStatus(status) {
  const query = {
    name: 'get-users-by-status',
    text: 'SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC',
    values: [status]
  };
  
  const result = await pool.query(query);
  return result.rows;
}
```

### NoSQL Databases (MongoDB)
```javascript
const mongoose = require('mongoose');

// Connection with options
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferCommands: false, // Disable mongoose buffering
  bufferMaxEntries: 0 // Disable mongoose buffering
});

// Schema definition with validation
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Please provide a valid email address'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  profile: {
    avatar: String,
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    socialLinks: [{
      platform: {
        type: String,
        enum: ['twitter', 'linkedin', 'github', 'website']
      },
      url: String
    }]
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true }, // Include virtuals when converting to JSON
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1, lastActive: -1 });
userSchema.index({ 'profile.bio': 'text', name: 'text' }); // Text search

// Virtual fields
userSchema.virtual('fullProfile').get(function() {
  return {
    name: this.name,
    email: this.email,
    avatar: this.profile?.avatar,
    bio: this.profile?.bio
  };
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const bcrypt = require('bcryptjs');
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  // Update lastActive timestamp
  this.lastActive = new Date();
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save({ validateBeforeSave: false });
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.getActiveUsers = function() {
  return this.find({ 
    status: 'active',
    lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  });
};

const User = mongoose.model('User', userSchema);
```

## Connection Pooling and Management

### SQL Connection Pool Management
```javascript
class DatabaseManager {
  constructor() {
    this.pools = new Map();
    this.isShuttingDown = false;
  }
  
  createPool(name, config) {
    const pool = new Pool({
      ...config,
      // Connection pool optimizations
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
      evict: 1000,
      
      // Health checks
      validate: async (client) => {
        try {
          await client.query('SELECT 1');
          return true;
        } catch (error) {
          return false;
        }
      }
    });
    
    // Monitor pool events
    pool.on('connect', (client) => {
      console.log(`New client connected to ${name} pool`);
    });
    
    pool.on('error', (err, client) => {
      console.error(`Database pool error for ${name}:`, err);
    });
    
    pool.on('remove', (client) => {
      console.log(`Client removed from ${name} pool`);
    });
    
    this.pools.set(name, pool);
    return pool;
  }
  
  getPool(name = 'default') {
    const pool = this.pools.get(name);
    if (!pool) {
      throw new Error(`Pool ${name} not found`);
    }
    return pool;
  }
  
  async query(poolName, text, params) {
    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }
    
    const pool = this.getPool(poolName);
    const start = Date.now();
    
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
      }
      
      return result;
    } catch (error) {
      console.error('Query failed:', { text, params, error: error.message });
      throw error;
    }
  }
  
  async transaction(poolName, callback) {
    const pool = this.getPool(poolName);
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async gracefulShutdown() {
    console.log('Starting database graceful shutdown...');
    this.isShuttingDown = true;
    
    const shutdownPromises = [];
    for (const [name, pool] of this.pools) {
      console.log(`Closing pool: ${name}`);
      shutdownPromises.push(pool.end());
    }
    
    await Promise.all(shutdownPromises);
    console.log('All database pools closed');
  }
  
  getPoolStats(poolName = 'default') {
    const pool = this.getPool(poolName);
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }
}

// Usage
const dbManager = new DatabaseManager();

// Create pools for different databases
dbManager.createPool('users', {
  host: process.env.USERS_DB_HOST,
  database: 'users_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

dbManager.createPool('analytics', {
  host: process.env.ANALYTICS_DB_HOST,
  database: 'analytics_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
```

### MongoDB Connection Management
```javascript
class MongoDBManager {
  constructor() {
    this.connections = new Map();
    this.isConnected = false;
  }
  
  async connect(uri, options = {}) {
    try {
      const defaultOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        retryReads: true,
        readPreference: 'primaryPreferred'
      };
      
      await mongoose.connect(uri, { ...defaultOptions, ...options });
      
      this.isConnected = true;
      console.log('MongoDB connected successfully');
      
      // Monitor connection events
      mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
        this.isConnected = false;
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
        this.isConnected = true;
      });
      
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      throw error;
    }
  }
  
  async disconnect() {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('MongoDB disconnected gracefully');
    }
  }
  
  getConnectionStats() {
    if (!this.isConnected) {
      return { status: 'disconnected' };
    }
    
    const db = mongoose.connection.db;
    return {
      status: 'connected',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }
  
  async healthCheck() {
    try {
      await mongoose.connection.db.admin().ping();
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }
}
```

## Repository Pattern and Data Access Layer

### SQL Repository Pattern
```javascript
class BaseRepository {
  constructor(tableName, db) {
    this.tableName = tableName;
    this.db = db;
  }
  
  async findById(id) {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }
  
  async findAll(options = {}) {
    const { limit = 50, offset = 0, orderBy = 'id', order = 'ASC' } = options;
    
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} 
       ORDER BY ${orderBy} ${order} 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  }
  
  async create(data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    
    const result = await this.db.query(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) 
       VALUES (${placeholders.join(', ')}) 
       RETURNING *`,
      values
    );
    
    return result.rows[0];
  }
  
  async update(id, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, index) => `${col} = $${index + 1}`);
    
    const result = await this.db.query(
      `UPDATE ${this.tableName} 
       SET ${setClause.join(', ')}, updated_at = NOW() 
       WHERE id = $${values.length + 1} 
       RETURNING *`,
      [...values, id]
    );
    
    return result.rows[0];
  }
  
  async delete(id) {
    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`,
      [id]
    );
    
    return result.rowCount > 0;
  }
  
  async count(conditions = {}) {
    let query = `SELECT COUNT(*) FROM ${this.tableName}`;
    const values = [];
    
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions).map((key, index) => {
        values.push(conditions[key]);
        return `${key} = $${index + 1}`;
      });
      query += ` WHERE ${whereClause.join(' AND ')}`;
    }
    
    const result = await this.db.query(query, values);
    return parseInt(result.rows[0].count);
  }
}

// Specific repository implementations
class UserRepository extends BaseRepository {
  constructor(db) {
    super('users', db);
  }
  
  async findByEmail(email) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0];
  }
  
  async findActiveUsers() {
    const result = await this.db.query(
      `SELECT * FROM users 
       WHERE status = 'active' 
       AND last_active > NOW() - INTERVAL '30 days'
       ORDER BY last_active DESC`
    );
    return result.rows;
  }
  
  async updateLastActive(userId) {
    await this.db.query(
      'UPDATE users SET last_active = NOW() WHERE id = $1',
      [userId]
    );
  }
  
  async getUserStats() {
    const result = await this.db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(DAY FROM NOW() - last_active)) as avg_inactive_days
      FROM users 
      GROUP BY status
    `);
    
    return result.rows.reduce((stats, row) => {
      stats[row.status] = {
        count: parseInt(row.count),
        avgInactiveDays: parseFloat(row.avg_inactive_days) || 0
      };
      return stats;
    }, {});
  }
}

// Service layer
class UserService {
  constructor(userRepository) {
    this.userRepo = userRepository;
  }
  
  async createUser(userData) {
    // Validate email uniqueness
    const existingUser = await this.userRepo.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }
    
    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    const user = await this.userRepo.create({
      ...userData,
      password: hashedPassword,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });
    
    // Remove password from response
    delete user.password;
    return user;
  }
  
  async authenticateUser(email, password) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }
    
    // Update last active
    await this.userRepo.updateLastActive(user.id);
    
    delete user.password;
    return user;
  }
  
  async getUserProfile(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    delete user.password;
    return user;
  }
}
```

### MongoDB Repository Pattern
```javascript
class MongoBaseRepository {
  constructor(model) {
    this.model = model;
  }
  
  async findById(id, options = {}) {
    try {
      const query = this.model.findById(id);
      
      if (options.populate) {
        query.populate(options.populate);
      }
      
      if (options.select) {
        query.select(options.select);
      }
      
      return await query.exec();
    } catch (error) {
      throw new Error(`Failed to find document by ID: ${error.message}`);
    }
  }
  
  async findOne(conditions, options = {}) {
    try {
      const query = this.model.findOne(conditions);
      
      if (options.populate) {
        query.populate(options.populate);
      }
      
      if (options.select) {
        query.select(options.select);
      }
      
      return await query.exec();
    } catch (error) {
      throw new Error(`Failed to find document: ${error.message}`);
    }
  }
  
  async findMany(conditions = {}, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { createdAt: -1 },
        populate,
        select
      } = options;
      
      const query = this.model
        .find(conditions)
        .limit(limit)
        .skip(skip)
        .sort(sort);
      
      if (populate) {
        query.populate(populate);
      }
      
      if (select) {
        query.select(select);
      }
      
      return await query.exec();
    } catch (error) {
      throw new Error(`Failed to find documents: ${error.message}`);
    }
  }
  
  async create(data) {
    try {
      const document = new this.model(data);
      return await document.save();
    } catch (error) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        throw new Error(`Validation failed: ${messages.join(', ')}`);
      }
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }
  
  async updateById(id, update, options = {}) {
    try {
      const defaultOptions = {
        new: true, // Return updated document
        runValidators: true, // Run schema validators
        ...options
      };
      
      return await this.model.findByIdAndUpdate(id, update, defaultOptions);
    } catch (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }
  
  async deleteById(id) {
    try {
      const result = await this.model.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }
  
  async count(conditions = {}) {
    try {
      return await this.model.countDocuments(conditions);
    } catch (error) {
      throw new Error(`Failed to count documents: ${error.message}`);
    }
  }
  
  async aggregate(pipeline) {
    try {
      return await this.model.aggregate(pipeline);
    } catch (error) {
      throw new Error(`Aggregation failed: ${error.message}`);
    }
  }
}

// Specific MongoDB repository
class MongoUserRepository extends MongoBaseRepository {
  constructor() {
    super(User);
  }
  
  async findByEmail(email) {
    return await this.findOne({ email: email.toLowerCase() });
  }
  
  async findActiveUsers() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return await this.findMany({
      status: 'active',
      lastActive: { $gte: thirtyDaysAgo }
    }, {
      sort: { lastActive: -1 },
      select: '-password'
    });
  }
  
  async searchUsers(searchTerm, options = {}) {
    const { limit = 20, skip = 0 } = options;
    
    return await this.model
      .find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { 'profile.bio': { $regex: searchTerm, $options: 'i' } }
        ],
        status: 'active'
      })
      .select('-password')
      .limit(limit)
      .skip(skip)
      .sort({ score: { $meta: 'textScore' } });
  }
  
  async getUsersByLocation(coordinates, maxDistance = 10000) {
    return await this.model
      .find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: coordinates
            },
            $maxDistance: maxDistance
          }
        },
        status: 'active'
      })
      .select('-password');
  }
  
  async getUserStatistics() {
    return await this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgDaysInactive: {
            $avg: {
              $divide: [
                { $subtract: [new Date(), '$lastActive'] },
                86400000 // milliseconds in a day
              ]
            }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
  }
  
  async getTopUsers(limit = 10) {
    return await this.aggregate([
      { $match: { status: 'active' } },
      {
        $addFields: {
          activityScore: {
            $add: [
              { $size: { $ifNull: ['$posts', []] } },
              { $multiply: [{ $size: { $ifNull: ['$followers', []] } }, 0.5] }
            ]
          }
        }
      },
      { $sort: { activityScore: -1 } },
      { $limit: limit },
      { $project: { password: 0 } }
    ]);
  }
}
```

## Database Transactions

### SQL Transactions
```javascript
class TransactionManager {
  constructor(db) {
    this.db = db;
  }
  
  async executeTransaction(operations) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const operation of operations) {
        const result = await operation(client);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  async transferFunds(fromUserId, toUserId, amount) {
    return await this.executeTransaction([
      // Check sender balance
      async (client) => {
        const result = await client.query(
          'SELECT balance FROM accounts WHERE user_id = $1 FOR UPDATE',
          [fromUserId]
        );
        
        const balance = result.rows[0]?.balance || 0;
        if (balance < amount) {
          throw new Error('Insufficient funds');
        }
        return balance;
      },
      
      // Debit sender
      async (client) => {
        return await client.query(
          'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2',
          [amount, fromUserId]
        );
      },
      
      // Credit receiver
      async (client) => {
        return await client.query(
          'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
          [amount, toUserId]
        );
      },
      
      // Log transaction
      async (client) => {
        return await client.query(
          `INSERT INTO transactions (from_user_id, to_user_id, amount, type, created_at) 
           VALUES ($1, $2, $3, 'transfer', NOW())`,
          [fromUserId, toUserId, amount]
        );
      }
    ]);
  }
}
```

### MongoDB Transactions
```javascript
class MongoTransactionManager {
  async executeTransaction(operations) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const results = [];
        
        for (const operation of operations) {
          const result = await operation(session);
          results.push(result);
        }
        
        return results;
      }, {
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' }
      });
    } finally {
      await session.endSession();
    }
  }
  
  async createUserWithProfile(userData, profileData) {
    return await this.executeTransaction([
      async (session) => {
        // Create user
        const user = new User(userData);
        await user.save({ session });
        return user;
      },
      
      async (session) => {
        // Create profile
        const profile = new Profile({
          ...profileData,
          userId: user._id
        });
        await profile.save({ session });
        return profile;
      },
      
      async (session) => {
        // Update user with profile reference
        await User.findByIdAndUpdate(
          user._id,
          { profileId: profile._id },
          { session }
        );
        return { user, profile };
      }
    ]);
  }
}
```

## Query Optimization and Performance

### SQL Query Optimization
```javascript
class QueryOptimizer {
  constructor(db) {
    this.db = db;
  }
  
  // Explain query performance
  async explainQuery(query, params = []) {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    const result = await this.db.query(explainQuery, params);
    
    const plan = result.rows[0]['QUERY PLAN'][0];
    return {
      executionTime: plan['Execution Time'],
      planningTime: plan['Planning Time'],
      totalCost: plan.Plan['Total Cost'],
      actualRows: plan.Plan['Actual Rows'],
      plan: plan.Plan
    };
  }
  
  // Batch operations for better performance
  async batchInsert(tableName, records) {
    if (records.length === 0) return [];
    
    const columns = Object.keys(records[0]);
    const values = [];
    const placeholders = [];
    
    records.forEach((record, recordIndex) => {
      const recordPlaceholders = columns.map((_, colIndex) => {
        const paramIndex = recordIndex * columns.length + colIndex + 1;
        values.push(record[columns[colIndex]]);
        return `$${paramIndex}`;
      });
      placeholders.push(`(${recordPlaceholders.join(', ')})`);
    });
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;
    
    const result = await this.db.query(query, values);
    return result.rows;
  }
  
  // Pagination with cursor-based approach
  async paginateQuery(baseQuery, params, options = {}) {
    const {
      cursor,
      limit = 50,
      sortField = 'id',
      sortDirection = 'ASC'
    } = options;
    
    let query = baseQuery;
    let queryParams = [...params];
    
    if (cursor) {
      const operator = sortDirection === 'ASC' ? '>' : '<';
      query += ` AND ${sortField} ${operator} $${queryParams.length + 1}`;
      queryParams.push(cursor);
    }
    
    query += ` ORDER BY ${sortField} ${sortDirection} LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit + 1); // Get one extra to check if there's a next page
    
    const result = await this.db.query(query, queryParams);
    const hasNextPage = result.rows.length > limit;
    
    if (hasNextPage) {
      result.rows.pop(); // Remove the extra row
    }
    
    return {
      data: result.rows,
      hasNextPage,
      nextCursor: hasNextPage ? result.rows[result.rows.length - 1][sortField] : null
    };
  }
}
```

### MongoDB Query Optimization
```javascript
class MongoQueryOptimizer {
  constructor(model) {
    this.model = model;
  }
  
  // Analyze query performance
  async explainQuery(query) {
    return await query.explain('executionStats');
  }
  
  // Efficient pagination
```javascript
  // Efficient pagination
  async paginateWithCursor(filter = {}, options = {}) {
    const {
      limit = 50,
      cursor,
      sortField = '_id',
      sortDirection = 1 // 1 for ascending, -1 for descending
    } = options;
    
    // Build query with cursor
    let query = { ...filter };
    if (cursor) {
      const operator = sortDirection === 1 ? '$gt' : '$lt';
      query[sortField] = { [operator]: cursor };
    }
    
    // Execute query with limit + 1 to check for next page
    const results = await this.model
      .find(query)
      .sort({ [sortField]: sortDirection })
      .limit(limit + 1)
      .lean(); // Use lean() for better performance when you don't need Mongoose documents
    
    const hasNextPage = results.length > limit;
    if (hasNextPage) {
      results.pop();
    }
    
    return {
      data: results,
      hasNextPage,
      nextCursor: hasNextPage ? results[results.length - 1][sortField] : null
    };
  }
  
  // Aggregation pipeline optimization
  async getOptimizedUserStats() {
    return await this.model.aggregate([
      // Use $match early to filter documents
      { $match: { status: 'active' } },
      
      // Use $project to limit fields early
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          createdAt: 1,
          lastActive: 1,
          posts: 1
        }
      },
      
      // Add computed fields
      {
        $addFields: {
          daysSinceCreated: {
            $divide: [
              { $subtract: [new Date(), '$createdAt'] },
              86400000 // milliseconds in a day
            ]
          },
          postCount: { $size: { $ifNull: ['$posts', []] } }
        }
      },
      
      // Group for statistics
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          avgDaysSinceCreated: { $avg: '$daysSinceCreated' },
          avgPostCount: { $avg: '$postCount' },
          maxPostCount: { $max: '$postCount' },
          minPostCount: { $min: '$postCount' }
        }
      }
    ]);
  }
  
  // Bulk operations for better performance
  async bulkWrite(operations) {
    try {
      const result = await this.model.bulkWrite(operations, {
        ordered: false, // Continue processing even if some operations fail
        w: 'majority' // Write concern
      });
      
      return {
        insertedCount: result.insertedCount,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        deletedCount: result.deletedCount,
        upsertedCount: result.upsertedCount
      };
    } catch (error) {
      console.error('Bulk write failed:', error);
      throw error;
    }
  }
}
```

## Caching Strategies

```javascript
// Redis caching layer
const Redis = require('ioredis');

class CacheManager {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });
    
    this.redis.on('connect', () => {
      console.log('Redis connected');
    });
  }
  
  // Cache-aside pattern
  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null; // Fail gracefully
    }
  }
  
  async set(key, value, ttl = 3600) {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  async del(key) {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }
  
  // Cache tags for bulk invalidation
  async setWithTags(key, value, tags = [], ttl = 3600) {
    const multi = this.redis.multi();
    
    // Set the value
    multi.setex(key, ttl, JSON.stringify(value));
    
    // Add key to each tag set
    tags.forEach(tag => {
      multi.sadd(`tag:${tag}`, key);
      multi.expire(`tag:${tag}`, ttl + 3600); // Tags expire later than data
    });
    
    await multi.exec();
  }
  
  async invalidateByTag(tag) {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        await this.redis.del(`tag:${tag}`);
      }
    } catch (error) {
      console.error('Tag invalidation error:', error);
    }
  }
  
  // Write-through cache
  async writeThrough(key, dataFetcher, ttl = 3600) {
    try {
      const data = await dataFetcher();
      await this.set(key, data, ttl);
      return data;
    } catch (error) {
      console.error('Write-through cache error:', error);
      throw error;
    }
  }
  
  // Write-behind cache (async write to database)
  async writeBehind(key, value, dbWriter, ttl = 3600) {
    try {
      // Set in cache immediately
      await this.set(key, value, ttl);
      
      // Write to database asynchronously
      setImmediate(async () => {
        try {
          await dbWriter(value);
        } catch (error) {
          console.error('Write-behind database write failed:', error);
          // Could implement retry logic here
        }
      });
      
      return value;
    } catch (error) {
      console.error('Write-behind cache error:', error);
      throw error;
    }
  }
}

// Cache decorator for repositories
function cached(ttl = 3600, keyGenerator) {
  return function(target, propertyName, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const cacheKey = keyGenerator ? keyGenerator(...args) : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      // If not in cache, execute original method
      const result = await originalMethod.apply(this, args);
      
      // Store in cache
      await this.cache.set(cacheKey, result, ttl);
      
      return result;
    };
    
    return descriptor;
  };
}

// Usage example
class CachedUserRepository extends UserRepository {
  constructor(db, cache) {
    super(db);
    this.cache = cache;
  }
  
  @cached(1800, (id) => `user:${id}`) // Cache for 30 minutes
  async findById(id) {
    return await super.findById(id);
  }
  
  @cached(300, (email) => `user:email:${email}`) // Cache for 5 minutes
  async findByEmail(email) {
    return await super.findByEmail(email);
  }
  
  async updateUser(id, data) {
    const result = await super.update(id, data);
    
    // Invalidate cache
    await this.cache.del(`user:${id}`);
    if (data.email) {
      await this.cache.del(`user:email:${data.email}`);
    }
    
    return result;
  }
}
```

## Database Migrations and Versioning

```javascript
// SQL Migration system
class MigrationManager {
  constructor(db) {
    this.db = db;
    this.migrationsTable = 'schema_migrations';
  }
  
  async initialize() {
    // Create migrations table if it doesn't exist
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  async getAppliedMigrations() {
    const result = await this.db.query(
      `SELECT version FROM ${this.migrationsTable} ORDER BY version`
    );
    return result.rows.map(row => row.version);
  }
  
  async applyMigration(version, upSql, downSql) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if migration already applied
      const existingResult = await client.query(
        `SELECT version FROM ${this.migrationsTable} WHERE version = $1`,
        [version]
      );
      
      if (existingResult.rows.length > 0) {
        throw new Error(`Migration ${version} already applied`);
      }
      
      // Apply migration
      await client.query(upSql);
      
      // Record migration
      await client.query(
        `INSERT INTO ${this.migrationsTable} (version) VALUES ($1)`,
        [version]
      );
      
      await client.query('COMMIT');
      console.log(`Migration ${version} applied successfully`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Migration ${version} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  async rollbackMigration(version, downSql) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Apply rollback
      await client.query(downSql);
      
      // Remove migration record
      await client.query(
        `DELETE FROM ${this.migrationsTable} WHERE version = $1`,
        [version]
      );
      
      await client.query('COMMIT');
      console.log(`Migration ${version} rolled back successfully`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Rollback ${version} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

// Migration definition
const migrations = [
  {
    version: '001_create_users_table',
    up: `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_status ON users(status);
    `,
    down: `
      DROP TABLE IF EXISTS users;
    `
  },
  {
    version: '002_add_user_profile_fields',
    up: `
      ALTER TABLE users 
      ADD COLUMN avatar VARCHAR(255),
      ADD COLUMN bio TEXT,
      ADD COLUMN last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      
      CREATE INDEX idx_users_last_active ON users(last_active);
    `,
    down: `
      ALTER TABLE users 
      DROP COLUMN IF EXISTS avatar,
      DROP COLUMN IF EXISTS bio,
      DROP COLUMN IF EXISTS last_active;
      
      DROP INDEX IF EXISTS idx_users_last_active;
    `
  }
];

// Run migrations
async function runMigrations() {
  const migrationManager = new MigrationManager(db);
  await migrationManager.initialize();
  
  const appliedMigrations = await migrationManager.getAppliedMigrations();
  
  for (const migration of migrations) {
    if (!appliedMigrations.includes(migration.version)) {
      await migrationManager.applyMigration(
        migration.version,
        migration.up,
        migration.down
      );
    }
  }
}
```

## Real-time Data with WebSockets

```javascript
const WebSocket = require('ws');
const EventEmitter = require('events');

class DatabaseChangeNotifier extends EventEmitter {
  constructor(db) {
    super();
    this.db = db;
    this.subscribers = new Map();
  }
  
  // PostgreSQL LISTEN/NOTIFY
  async startListening() {
    const client = await this.db.connect();
    
    // Listen for database notifications
    await client.query('LISTEN user_changes');
    await client.query('LISTEN post_changes');
    
    client.on('notification', (msg) => {
      try {
        const data = JSON.parse(msg.payload);
        this.emit('database_change', {
          channel: msg.channel,
          operation: data.operation,
          table: data.table,
          data: data.data
        });
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    });
    
    // Keep connection alive
    setInterval(() => {
      client.query('SELECT 1');
    }, 30000);
  }
  
  // WebSocket integration
  setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws, req) => {
      const userId = this.extractUserId(req);
      
      // Store connection
      this.subscribers.set(ws, { userId, interests: new Set() });
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });
      
      ws.on('close', () => {
        this.subscribers.delete(ws);
      });
    });
    
    // Broadcast database changes to interested clients
    this.on('database_change', (change) => {
      this.broadcastChange(change);
    });
  }
  
  handleWebSocketMessage(ws, data) {
    const subscriber = this.subscribers.get(ws);
    
    switch (data.type) {
      case 'subscribe':
        subscriber.interests.add(data.channel);
        ws.send(JSON.stringify({ 
          type: 'subscribed', 
          channel: data.channel 
        }));
        break;
        
      case 'unsubscribe':
        subscriber.interests.delete(data.channel);
        ws.send(JSON.stringify({ 
          type: 'unsubscribed', 
          channel: data.channel 
        }));
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }
  
  broadcastChange(change) {
    for (const [ws, subscriber] of this.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        // Check if subscriber is interested in this change
        if (subscriber.interests.has(change.channel) || 
            this.isUserRelated(change, subscriber.userId)) {
          
          ws.send(JSON.stringify({
            type: 'database_change',
            ...change
          }));
        }
      }
    }
  }
  
  isUserRelated(change, userId) {
    // Check if the change is related to the user
    return change.data && (
      change.data.userId === userId ||
      change.data.authorId === userId ||
      change.data.recipientId === userId
    );
  }
  
  extractUserId(req) {
    // Extract user ID from JWT token or session
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.id;
      } catch (error) {
        return null;
      }
    }
    return null;
  }
}

// Database triggers for real-time notifications
const createTriggers = async (db) => {
  // Create notification function
  await db.query(`
    CREATE OR REPLACE FUNCTION notify_changes() RETURNS TRIGGER AS $$
    BEGIN
      PERFORM pg_notify(
        TG_ARGV[0],
        json_build_object(
          'operation', TG_OP,
          'table', TG_TABLE_NAME,
          'data', row_to_json(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END)
        )::text
      );
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  // Create triggers
  await db.query(`
    DROP TRIGGER IF EXISTS user_changes_trigger ON users;
    CREATE TRIGGER user_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION notify_changes('user_changes');
  `);
  
  await db.query(`
    DROP TRIGGER IF EXISTS post_changes_trigger ON posts;
    CREATE TRIGGER post_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON posts
    FOR EACH ROW EXECUTE FUNCTION notify_changes('post_changes');
  `);
};
```

## Database Health Monitoring

```javascript
class DatabaseHealthMonitor {
  constructor(db, cache) {
    this.db = db;
    this.cache = cache;
    this.metrics = {
      connections: 0,
      queries: 0,
      slowQueries: 0,
      errors: 0,
      avgResponseTime: 0
    };
  }
  
  async checkHealth() {
    const checks = [];
    
    // Database connection check
    checks.push(this.checkDatabaseConnection());
    
    // Cache connection check
    checks.push(this.checkCacheConnection());
    
    // Query performance check
    checks.push(this.checkQueryPerformance());
    
    // Connection pool check
    checks.push(this.checkConnectionPool());
    
    const results = await Promise.allSettled(checks);
    
    return {
      timestamp: new Date().toISOString(),
      overall: results.every(r => r.status === 'fulfilled' && r.value.healthy),
      checks: results.map((result, index) => ({
        name: ['database', 'cache', 'query_performance', 'connection_pool'][index],
        status: result.status,
        ...result.value
      })),
      metrics: this.metrics
    };
  }
  
  async checkDatabaseConnection() {
    try {
      const start = Date.now();
      await this.db.query('SELECT 1');
      const responseTime = Date.now() - start;
      
      return {
        healthy: true,
        responseTime,
        message: 'Database connection is healthy'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        message: 'Database connection failed'
      };
    }
  }
  
  async checkCacheConnection() {
    try {
      const start = Date.now();
      await this.cache.redis.ping();
      const responseTime = Date.now() - start;
      
      return {
        healthy: true,
        responseTime,
        message: 'Cache connection is healthy'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        message: 'Cache connection failed'
      };
    }
  }
  
  async checkQueryPerformance() {
    try {
      const start = Date.now();
      
      // Run a representative query
      await this.db.query(`
        SELECT COUNT(*) as user_count, 
               AVG(EXTRACT(DAY FROM NOW() - created_at)) as avg_days_old
        FROM users 
        WHERE status = 'active'
      `);
      
      const responseTime = Date.now() - start;
      const isHealthy = responseTime < 1000; // Threshold: 1 second
      
      return {
        healthy: isHealthy,
        responseTime,
        message: isHealthy ? 'Query performance is good' : 'Query performance is slow'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        message: 'Query performance check failed'
      };
    }
  }
  
  async checkConnectionPool() {
    try {
      const stats = this.db.pool ? {
        totalCount: this.db.pool.totalCount || 0,
        idleCount: this.db.pool.idleCount || 0,
        waitingCount: this.db.pool.waitingCount || 0
      } : { totalCount: 0, idleCount: 0, waitingCount: 0 };
      
      const utilizationRate = stats.totalCount > 0 ? 
        (stats.totalCount - stats.idleCount) / stats.totalCount : 0;
      
      const isHealthy = utilizationRate < 0.9; // Alert if > 90% utilization
      
      return {
        healthy: isHealthy,
        stats,
        utilizationRate: Math.round(utilizationRate * 100),
        message: isHealthy ? 'Connection pool is healthy' : 'Connection pool is highly utilized'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        message: 'Connection pool check failed'
      };
    }
  }
  
  startMonitoring(interval = 30000) {
    setInterval(async () => {
      try {
        const health = await this.checkHealth();
        
        if (!health.overall) {
          console.warn('🚨 Database health check failed:', health);
          this.sendAlert(health);
        } else {
          console.log('✅ Database health check passed');
        }
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, interval);
  }
  
  async sendAlert(healthReport) {
    // Implement your alerting mechanism
    // This could be email, Slack, PagerDuty, etc.
    const failedChecks = healthReport.checks.filter(check => !check.healthy);
    
    console.error('Database Alert:', {
      timestamp: healthReport.timestamp,
      failedChecks: failedChecks.map(check => ({
        name: check.name,
        error: check.error || check.message
      }))
    });
  }
}

// Usage
const healthMonitor = new DatabaseHealthMonitor(dbManager, cacheManager);
healthMonitor.startMonitoring(30000); // Check every 30 seconds

// Health check endpoint
app.get('/health/database', async (req, res) => {
  try {
    const health = await healthMonitor.checkHealth();
    const statusCode = health.overall ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

## Best Practices Summary

### ✅ Database Best Practices:

```javascript
// 1. Always use connection pooling
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// 2. Use parameterized queries
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// 3. Implement proper error handling
try {
  const result = await dbOperation();
  return result;
} catch (error) {
  logger.error('Database operation failed:', error);
  throw new DatabaseError('Operation failed', error);
}

// 4. Use transactions for related operations
await db.transaction(async (trx) => {
  await trx.query('INSERT INTO...');
  await trx.query('UPDATE...');
});

// 5. Implement caching strategically
const cachedResult = await cache.get(key);
if (!cachedResult) {
  const result = await database.query(...);
  await cache.set(key, result, 3600);
  return result;
}
return cachedResult;
```

### ❌ Common Pitfalls:

```javascript
// 1. ❌ Not using connection pooling
const client = new Client(); // Creates new connection each time

// 2. ❌ SQL injection vulnerability
const query = `SELECT * FROM users WHERE id = ${userId}`; // NEVER DO THIS

// 3. ❌ Not handling connection failures
await db.query(sql); // What if connection fails?

// 4. ❌ Ignoring query performance
await User.find(); // Could return millions of records

// 5. ❌ Not cleaning up resources
const client = await pool.connect();
// Missing: client.release();
```

Understanding database integration patterns, connection management, and optimization techniques is crucial for building scalable Node.js applications that can handle production workloads efficiently!