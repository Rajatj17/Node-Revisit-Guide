# Real-time Applications with WebSockets and Socket.IO - Complete Guide

Real-time communication is **essential** for modern interactive applications. Understanding WebSockets and how to implement scalable real-time features is crucial for building engaging user experiences.

## WebSocket Protocol Fundamentals

### HTTP vs WebSocket Comparison

```javascript
// Traditional HTTP Request-Response
const express = require('express');
const app = express();

// ❌ Inefficient polling for real-time updates
app.get('/api/messages', async (req, res) => {
  const messages = await getLatestMessages();
  res.json(messages);
});

// Client-side polling (inefficient)
/*
setInterval(async () => {
  const response = await fetch('/api/messages');
  const messages = await response.json();
  updateUI(messages);
}, 1000); // Poll every second - wasteful!
*/

// ✅ WebSocket - Persistent bidirectional connection
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send immediate response
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to WebSocket server'
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received:', message);
      
      // Broadcast to all connected clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'message',
            data: message,
            timestamp: new Date().toISOString()
          }));
        }
      });
    } catch (error) {
      console.error('Message parsing error:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
```

### Native WebSocket Server Implementation

```javascript
class WebSocketServer {
  constructor(port) {
    this.port = port;
    this.wss = new WebSocket.Server({ port });
    this.clients = new Map(); // Store client metadata
    this.rooms = new Map(); // Store room memberships
    this.setupServer();
  }
  
  setupServer() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const clientInfo = {
        id: clientId,
        ws: ws,
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        connectedAt: new Date(),
        rooms: new Set(),
        authenticated: false,
        userId: null
      };
      
      this.clients.set(clientId, clientInfo);
      console.log(`Client ${clientId} connected from ${clientInfo.ip}`);
      
      // Send connection acknowledgment
      this.sendToClient(clientId, {
        type: 'connection',
        clientId: clientId,
        message: 'Connected successfully'
      });
      
      // Setup message handling
      ws.on('message', (data) => {
        this.handleMessage(clientId, data);
      });
      
      // Setup disconnection handling
      ws.on('close', () => {
        this.handleDisconnection(clientId);
      });
      
      // Setup error handling
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientError(clientId, error);
      });
    });
    
    console.log(`WebSocket server running on port ${this.port}`);
  }
  
  generateClientId() {
    return require('crypto').randomUUID();
  }
  
  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      const client = this.clients.get(clientId);
      
      if (!client) return;
      
      console.log(`Message from ${clientId}:`, message);
      
      switch (message.type) {
        case 'authenticate':
          this.handleAuthentication(clientId, message.data);
          break;
          
        case 'join_room':
          this.handleJoinRoom(clientId, message.data.room);
          break;
          
        case 'leave_room':
          this.handleLeaveRoom(clientId, message.data.room);
          break;
          
        case 'message':
          this.handleChatMessage(clientId, message.data);
          break;
          
        case 'ping':
          this.sendToClient(clientId, { type: 'pong' });
          break;
          
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Message parsing error:', error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }
  
  async handleAuthentication(clientId, authData) {
    try {
      // Validate JWT token or other auth mechanism
      const user = await this.validateAuthToken(authData.token);
      
      const client = this.clients.get(clientId);
      client.authenticated = true;
      client.userId = user.id;
      client.username = user.username;
      
      this.sendToClient(clientId, {
        type: 'authenticated',
        user: {
          id: user.id,
          username: user.username
        }
      });
      
      console.log(`Client ${clientId} authenticated as ${user.username}`);
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'authentication_failed',
        message: 'Invalid credentials'
      });
    }
  }
  
  async validateAuthToken(token) {
    // Implement your authentication logic
    const jwt = require('jsonwebtoken');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
  
  handleJoinRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    
    if (!client || !client.authenticated) {
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Authentication required'
      });
      return;
    }
    
    // Add client to room
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    
    this.rooms.get(roomName).add(clientId);
    client.rooms.add(roomName);
    
    // Notify client
    this.sendToClient(clientId, {
      type: 'room_joined',
      room: roomName
    });
    
    // Notify other room members
    this.broadcastToRoom(roomName, {
      type: 'user_joined',
      room: roomName,
      user: {
        id: client.userId,
        username: client.username
      }
    }, clientId);
    
    console.log(`Client ${clientId} joined room: ${roomName}`);
  }
  
  handleLeaveRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    
    if (this.rooms.has(roomName)) {
      this.rooms.get(roomName).delete(clientId);
      
      // Remove room if empty
      if (this.rooms.get(roomName).size === 0) {
        this.rooms.delete(roomName);
      }
    }
    
    if (client) {
      client.rooms.delete(roomName);
      
      // Notify client
      this.sendToClient(clientId, {
        type: 'room_left',
        room: roomName
      });
      
      // Notify other room members
      this.broadcastToRoom(roomName, {
        type: 'user_left',
        room: roomName,
        user: {
          id: client.userId,
          username: client.username
        }
      });
    }
    
    console.log(`Client ${clientId} left room: ${roomName}`);
  }
  
  handleChatMessage(clientId, messageData) {
    const client = this.clients.get(clientId);
    
    if (!client || !client.authenticated) {
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Authentication required'
      });
      return;
    }
    
    const message = {
      id: require('crypto').randomUUID(),
      type: 'chat_message',
      room: messageData.room,
      user: {
        id: client.userId,
        username: client.username
      },
      content: messageData.content,
      timestamp: new Date().toISOString()
    };
    
    // Save message to database
    this.saveMessage(message);
    
    // Broadcast to room
    this.broadcastToRoom(messageData.room, message);
  }
  
  async saveMessage(message) {
    // Implement database storage
    try {
      // Example with MongoDB
      // await MessageModel.create(message);
      console.log('Message saved:', message.id);
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }
  
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
  
  broadcastToRoom(roomName, message, excludeClientId = null) {
    const roomClients = this.rooms.get(roomName);
    
    if (roomClients) {
      roomClients.forEach((clientId) => {
        if (clientId !== excludeClientId) {
          this.sendToClient(clientId, message);
        }
      });
    }
  }
  
  broadcastToAll(message, excludeClientId = null) {
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }
  
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    
    if (client) {
      // Remove from all rooms
      client.rooms.forEach((roomName) => {
        this.handleLeaveRoom(clientId, roomName);
      });
      
      // Remove client
      this.clients.delete(clientId);
      
      console.log(`Client ${clientId} disconnected`);
    }
  }
  
  handleClientError(clientId, error) {
    console.error(`Client ${clientId} error:`, error);
    
    // Optionally remove problematic client
    if (error.code === 'ECONNRESET') {
      this.handleDisconnection(clientId);
    }
  }
  
  getServerStats() {
    return {
      totalClients: this.clients.size,
      authenticatedClients: Array.from(this.clients.values()).filter(c => c.authenticated).length,
      totalRooms: this.rooms.size,
      roomStats: Array.from(this.rooms.entries()).map(([name, clients]) => ({
        name,
        clientCount: clients.size
      }))
    };
  }
}

// Usage
const wsServer = new WebSocketServer(8080);

// Monitor server stats
setInterval(() => {
  console.log('Server Stats:', wsServer.getServerStats());
}, 30000);
```

## Socket.IO Implementation

```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

class SocketIOServer {
  constructor(port) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });
    
    this.port = port;
    this.connectedUsers = new Map(); // userId -> socket mapping
    this.userSockets = new Map(); // socketId -> userId mapping
    this.setupMiddleware();
    this.setupEventHandlers();
  }
  
  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }
        
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        const user = await this.getUserById(decoded.id);
        
        if (!user) {
          return next(new Error('User not found'));
        }
        
        socket.userId = user.id;
        socket.username = user.username;
        socket.user = user;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
    
    // Rate limiting middleware
    this.io.use((socket, next) => {
      socket.rateLimiter = new Map();
      next();
    });
  }
  
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.username} connected: ${socket.id}`);
      
      // Store user connection
      this.connectedUsers.set(socket.userId, socket);
      this.userSockets.set(socket.id, socket.userId);
      
      // Send user their current status
      socket.emit('connection_status', {
        connected: true,
        userId: socket.userId,
        username: socket.username
      });
      
      // Notify friends about online status
      this.notifyFriendsStatus(socket.userId, 'online');
      
      // Setup event handlers
      this.setupChatHandlers(socket);
      this.setupRoomHandlers(socket);
      this.setupGameHandlers(socket);
      this.setupNotificationHandlers(socket);
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`User ${socket.username} disconnected: ${reason}`);
        this.handleDisconnection(socket);
      });
      
      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.username}:`, error);
      });
    });
  }
  
  setupChatHandlers(socket) {
    // Private message
    socket.on('private_message', async (data) => {
      if (!this.checkRateLimit(socket, 'private_message', 10, 60000)) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }
      
      try {
        const { recipientId, content } = data;
        
        // Validate and save message
        const message = await this.savePrivateMessage({
          senderId: socket.userId,
          recipientId,
          content,
          timestamp: new Date()
        });
        
        // Send to recipient if online
        const recipientSocket = this.connectedUsers.get(recipientId);
        if (recipientSocket) {
          recipientSocket.emit('private_message', {
            id: message.id,
            sender: {
              id: socket.userId,
              username: socket.username
            },
            content: message.content,
            timestamp: message.timestamp
          });
        }
        
        // Confirm to sender
        socket.emit('message_sent', {
          id: message.id,
          recipientId,
          delivered: !!recipientSocket
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Group chat message
    socket.on('group_message', async (data) => {
      if (!this.checkRateLimit(socket, 'group_message', 20, 60000)) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }
      
      try {
        const { roomId, content } = data;
        
        // Verify user is in the room
        if (!socket.rooms.has(roomId)) {
          socket.emit('error', { message: 'Not a member of this room' });
          return;
        }
        
        // Save message
        const message = await this.saveGroupMessage({
          senderId: socket.userId,
          roomId,
          content,
          timestamp: new Date()
        });
        
        // Broadcast to room
        this.io.to(roomId).emit('group_message', {
          id: message.id,
          room: roomId,
          sender: {
            id: socket.userId,
            username: socket.username
          },
          content: message.content,
          timestamp: message.timestamp
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to send group message' });
      }
    });
    
    // Typing indicators
    socket.on('typing_start', (data) => {
      if (data.type === 'private') {
        const recipientSocket = this.connectedUsers.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('typing_start', {
            userId: socket.userId,
            username: socket.username
          });
        }
      } else if (data.type === 'group') {
        socket.to(data.roomId).emit('typing_start', {
          roomId: data.roomId,
          userId: socket.userId,
          username: socket.username
        });
      }
    });
    
    socket.on('typing_stop', (data) => {
      if (data.type === 'private') {
        const recipientSocket = this.connectedUsers.get(data.recipientId);
        if (recipientSocket) {
          recipientSocket.emit('typing_stop', {
            userId: socket.userId
          });
        }
      } else if (data.type === 'group') {
        socket.to(data.roomId).emit('typing_stop', {
          roomId: data.roomId,
          userId: socket.userId
        });
      }
    });
  }
  
  setupRoomHandlers(socket) {
    // Join room
    socket.on('join_room', async (data) => {
      try {
        const { roomId, password } = data;
        
        // Validate room access
        const canJoin = await this.validateRoomAccess(socket.userId, roomId, password);
        if (!canJoin) {
          socket.emit('join_room_failed', { roomId, reason: 'Access denied' });
          return;
        }
        
        // Join room
        socket.join(roomId);
        
        // Get room info
        const roomInfo = await this.getRoomInfo(roomId);
        
        socket.emit('room_joined', {
          room: roomInfo,
          members: await this.getRoomMembers(roomId)
        });
        
        // Notify other room members
        socket.to(roomId).emit('user_joined_room', {
          roomId,
          user: {
            id: socket.userId,
            username: socket.username
          }
        });
        
        console.log(`${socket.username} joined room: ${roomId}`);
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });
    
    // Leave room
    socket.on('leave_room', (data) => {
      const { roomId } = data;
      
      socket.leave(roomId);
      
      socket.emit('room_left', { roomId });
      
      // Notify other room members
      socket.to(roomId).emit('user_left_room', {
        roomId,
        user: {
          id: socket.userId,
          username: socket.username
        }
      });
      
      console.log(`${socket.username} left room: ${roomId}`);
    });
    
    // Create room
    socket.on('create_room', async (data) => {
      try {
        const room = await this.createRoom({
          name: data.name,
          description: data.description,
          isPrivate: data.isPrivate,
          password: data.password,
          createdBy: socket.userId
        });
        
        // Join the created room
        socket.join(room.id);
        
        socket.emit('room_created', room);
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to create room' });
      }
    });
  }
  
  setupGameHandlers(socket) {
    // Game invitation
    socket.on('game_invite', (data) => {
      const { recipientId, gameType } = data;
      
      const recipientSocket = this.connectedUsers.get(recipientId);
      if (recipientSocket) {
        recipientSocket.emit('game_invite', {
          from: {
            id: socket.userId,
            username: socket.username
          },
          gameType,
          inviteId: require('crypto').randomUUID()
        });
      }
    });
    
    // Game move
    socket.on('game_move', async (data) => {
      try {
        const { gameId, move } = data;
        
        // Validate and process move
        const gameState = await this.processGameMove(gameId, socket.userId, move);
        
        // Broadcast to game participants
        this.io.to(`game_${gameId}`).emit('game_move', {
          gameId,
          player: {
            id: socket.userId,
            username: socket.username
          },
          move,
          gameState
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Invalid game move' });
      }
    });
  }
  
  setupNotificationHandlers(socket) {
    // Mark notifications as read
    socket.on('mark_notifications_read', async (data) => {
      try {
        await this.markNotificationsAsRead(socket.userId, data.notificationIds);
        
        socket.emit('notifications_marked_read', {
          notificationIds: data.notificationIds
        });
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to mark notifications as read' });
      }
    });
  }
  
  checkRateLimit(socket, action, maxRequests, windowMs) {
    const now = Date.now();
    const key = `${action}:${socket.userId}`;
    
    if (!socket.rateLimiter.has(key)) {
      socket.rateLimiter.set(key, []);
    }
    
    const requests = socket.rateLimiter.get(key);
    
    // Remove old requests outside the window
    while (requests.length > 0 && now - requests[0] > windowMs) {
      requests.shift();
    }
    
    // Check if under limit
    if (requests.length < maxRequests) {
      requests.push(now);
      return true;
    }
    
    return false;
  }
  
  async notifyFriendsStatus(userId, status) {
    try {
      const friends = await this.getUserFriends(userId);
      
      friends.forEach(friend => {
        const friendSocket = this.connectedUsers.get(friend.id);
        if (friendSocket) {
          friendSocket.emit('friend_status_change', {
            userId,
            status,
            timestamp: new Date()
          });
        }
      });
    } catch (error) {
      console.error('Failed to notify friends about status change:', error);
    }
  }
  
  handleDisconnection(socket) {
    // Remove from tracking
    this.connectedUsers.delete(socket.userId);
    this.userSockets.delete(socket.id);
    
    // Notify friends about offline status
    this.notifyFriendsStatus(socket.userId, 'offline');
    
    // Update last seen
    this.updateUserLastSeen(socket.userId);
  }
  
  // Utility methods
  async getUserById(userId) {
    // Implement user lookup from database
    // return await User.findById(userId);
    return { id: userId, username: `user_${userId}` }; // Mock implementation
  }
  
  async getUserFriends(userId) {
    // Implement friends lookup
    return []; // Mock implementation
  }
  
  async savePrivateMessage(messageData) {
    // Implement message saving
    return { id: require('crypto').randomUUID(), ...messageData };
  }
  
  async saveGroupMessage(messageData) {
    // Implement group message saving
    return { id: require('crypto').randomUUID(), ...messageData };
  }
  
  async validateRoomAccess(userId, roomId, password) {
    // Implement room access validation
    return true; // Mock implementation
  }
  
  async getRoomInfo(roomId) {
    // Implement room info retrieval
    return { id: roomId, name: `Room ${roomId}` };
  }
  
  async getRoomMembers(roomId) {
    // Implement room members retrieval
    return [];
  }
  
  async createRoom(roomData) {
    // Implement room creation
    return { id: require('crypto').randomUUID(), ...roomData };
  }
  
  async processGameMove(gameId, playerId, move) {
    // Implement game logic
    return { valid: true, gameState: 'in_progress' };
  }
  
  async markNotificationsAsRead(userId, notificationIds) {
    // Implement notification marking
    console.log(`Marked notifications as read for user ${userId}`);
  }
  
  async updateUserLastSeen(userId) {
    // Implement last seen update
    console.log(`Updated last seen for user ${userId}`);
  }
  
  // Send notification to user
  sendNotificationToUser(userId, notification) {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit('notification', notification);
      return true; // Delivered
    }
    return false; // User offline
  }
  
  // Broadcast to all connected users
  broadcastToAll(event, data) {
    this.io.emit(event, data);
  }
  
  // Get server statistics
  getServerStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      totalRooms: this.io.sockets.adapter.rooms.size,
      serverUptime: process.uptime()
    };
  }
  
  start() {
    this.server.listen(this.port, () => {
      console.log(`Socket.IO server running on port ${this.port}`);
    });
  }
}

// Usage
const socketServer = new SocketIOServer(3000);
socketServer.start();

// Monitor server stats
setInterval(() => {
  console.log('Socket.IO Server Stats:', socketServer.getServerStats());
}, 30000);
```

## Scaling WebSocket Connections

### Redis Adapter for Socket.IO

```javascript
const redis = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

class ScalableSocketIOServer extends SocketIOServer {
  constructor(port) {
    super(port);
    this.setupRedisAdapter();
  }
  
  setupRedisAdapter() {
    // Create Redis clients for pub/sub
    const pubClient = redis.createClient({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD
    });
    
    const subClient = pubClient.duplicate();
    
    // Setup Redis adapter
    this.io.adapter(createAdapter(pubClient, subClient));
    
    console.log('Redis adapter configured for Socket.IO scaling');
  }
  
  // Cross-server message sending
  async sendToUserAcrossServers(userId, event, data) {
    // This will work across multiple server instances
    this.io.to(`user_${userId}`).emit(event, data);
  }
  
  // Cross-server room broadcasting
  async broadcastToRoomAcrossServers(roomId, event, data) {
    this.io.to(roomId).emit(event, data);
  }
}

// Sticky session support for load balancing
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Restart worker
  });
} else {
  // Worker process
  const server = new ScalableSocketIOServer(process.env.PORT || 3000);
  server.start();
  
  console.log(`Worker ${process.pid} started`);
}
```

### Message Queue Integration

```javascript
const Bull = require('bull');

class MessageQueueSocketServer extends ScalableSocketIOServer {
  constructor(port) {
    super(port);
    this.setupMessageQueues();
  }
  
  setupMessageQueues() {
    // Create queues
    this.notificationQueue = new Bull('notification queue', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
      }
    });
    
    this.messageQueue = new Bull('message queue', {
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD
      }
    });
    
    // Process notification jobs
    this.notificationQueue.process('send_notification', async (job) => {
      const { userId, notification } = job.data;
      return this.processNotificationJob(userId, notification);
    });
    
    // Process message jobs
    this.messageQueue.process('send_message', async (job) => {
      const { recipients, message } = job.data;
      return this.processMessageJob(recipients, message);
    });
    
    console.log('Message queues configured');
  }
  
  async processNotificationJob(userId, notification) {
    try {
      // Try to send to connected user first
      const delivered = this.sendNotificationToUser(userId, notification);
      
      if (!delivered) {
        // User is offline, store notification for later
        await this.storeOfflineNotification(userId, notification);
        
        // Optionally send push notification
        await this.sendPushNotification(userId, notification);
      }
      
      return { delivered, stored: !delivered };
    } catch (error) {
      console.error('Notification job failed:', error);
      throw error;
    }
  }
  
  async processMessageJob(recipients, message) {
    const results = [];
    
    for (const recipientId of recipients) {
      try {
        const socket = this.connectedUsers.get(recipientId);
        
        if (socket) {
          socket.emit('message', message);
          results.push({ recipientId, delivered: true });
        } else {
          // Store message for offline user
          await this.storeOfflineMessage(recipientId, message);
          results.push({ recipientId, delivered: false, stored: true });
        }
      } catch (error) {
        console.error(`Failed to send message to ${recipientId}:`, error);
        results.push({ recipientId, delivered: false, error: error.message });
      }
    }
    
    return results;
  }
  
  // Queue a notification for processing
  async queueNotification(userId, notification, options = {}) {
    await this.notificationQueue.add('send_notification', {
      userId,
      notification
    }, {
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }
  
  // Queue a message for multiple recipients
  async queueMessage(recipients, message, options = {}) {
    await this.messageQueue.add('send_message', {
      recipients,
      message
    }, {
      attempts: options.attempts || 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    });
  }
  
  async storeOfflineNotification(userId, notification) {
    // Store in database for when user comes back online
    try {
      // await OfflineNotification.create({
      //   userId,
      //   notification,
      //   createdAt: new Date()
      // });
      console.log(`Stored offline notification for user ${userId}`);
    } catch (error) {
      console.error('Failed to store offline notification:', error);
    }
  }
  
  async storeOfflineMessage(recipientId, message) {
    try {
      // await OfflineMessage.create({
      //   recipientId,
      //   message,
      //   createdAt: new Date()
      // });
      console.log(`Stored offline message for user ${recipientId}`);
    } catch (error) {
      console.error('Failed to store offline message:', error);
    }
  }
  
  async sendPushNotification(userId, notification) {
    // Integrate with push notification service (FCM, APNS, etc.)
    try {
      // const userDevice = await getUserDevice(userId);
      // await pushNotificationService.send(userDevice.token, notification);
      console.log(`Push notification sent to user ${userId}`);
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }
  
  // Send offline messages when user comes online
  async sendOfflineMessages(userId) {
    try {
      // const offlineMessages = await OfflineMessage.find({ recipientId: userId });
      // 
      // for (const msg of offlineMessages) {
      //   this.sendNotificationToUser(userId, msg.message);
      //   await msg.remove();
      // }
      
      console.log(`Sent offline messages to user ${userId}`);
    } catch (error) {
      console.error('Failed to send offline messages:', error);
    }
  }
}
```

## Client-Side Real-time Implementation

```javascript
// Client-side Socket.IO implementation
class RealtimeClient {
  constructor(serverUrl, token) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventHandlers = new Map();
    this.typingTimeouts = new Map();
  }
  
  connect() {
    this.socket = io(this.serverUrl, {
      auth: {
        token: this.token
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: this.maxReconnectAttempts
    });
    
    this.setupEventHandlers();
    this.setupConnectionHandlers();
  }
  
  setupConnectionHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.reconnectAttempts = 0;
      this.onConnectionStatusChange(true);
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.onConnectionStatusChange(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected the client, need to reconnect manually
        this.socket.connect();
      }
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.onConnectionFailed();
      }
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      this.onReconnected();
    });
    
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
    });
  }
  
  setupEventHandlers() {
    // Chat message handlers
    this.socket.on('private_message', (data) => {
      this.handlePrivateMessage(data);
    });
    
    this.socket.on('group_message', (data) => {
      this.handleGroupMessage(data);
    });
    
    // Typing indicators
    this.socket.on('typing_start', (data) => {
      this.handleTypingStart(data);
    });
    
    this.socket.on('typing_stop', (data) => {
      this.handleTypingStop(data);
    });
    
    // Room events
    this.socket.on('room_joined', (data) => {
      this.handleRoomJoined(data);
    });
    
    this.socket.on('user_joined_room', (data) => {
      this.handleUserJoinedRoom(data);
    });
    
    this.socket.on('user_left_room', (data) => {
      this.handleUserLeftRoom(data);
    });
    
    // Notifications
    this.socket.on('notification', (data) => {
      this.handleNotification(data);
    });
    
    // Friend status
    this.socket.on('friend_status_change', (data) => {
      this.handleFriendStatusChange(data);
    });
    
    // Error handling
    this.socket.on('error', (data) => {
      this.handleError(data);
    });
  }
  
  // Chat methods
  sendPrivateMessage(recipientId, content) {
    if (!this.isConnected()) {
      this.queueMessage('private_message', { recipientId, content });
      return;
    }
    
    this.socket.emit('private_message', {
      recipientId,
      content,
      timestamp: new Date().toISOString()
    });
  }
  
  sendGroupMessage(roomId, content) {
    if (!this.isConnected()) {
      this.queueMessage('group_message', { roomId, content });
      return;
    }
    
    this.socket.emit('group_message', {
      roomId,
      content,
      timestamp: new Date().toISOString()
    });
  }
  
  // Typing indicators
  startTyping(type, targetId) {
    if (!this.isConnected()) return;
    
    this.socket.emit('typing_start', {
      type, // 'private' or 'group'
      recipientId: type === 'private' ? targetId : undefined,
      roomId: type === 'group' ? targetId : undefined
    });
    
    // Auto-stop typing after 3 seconds
    const key = `${type}_${targetId}`;
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key));
    }
    
    const timeout = setTimeout(() => {
      this.stopTyping(type, targetId);
    }, 3000);
    
    this.typingTimeouts.set(key, timeout);
  }
  
  stopTyping(type, targetId) {
    if (!this.isConnected()) return;
    
    this.socket.emit('typing_stop', {
      type,
      recipientId: type === 'private' ? targetId : undefined,
      roomId: type === 'group' ? targetId : undefined
    });
    
    const key = `${type}_${targetId}`;
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key));
      this.typingTimeouts.delete(key);
    }
  }
  
  // Room methods
  joinRoom(roomId, password = null) {
    if (!this.isConnected()) {
      this.queueMessage('join_room', { roomId, password });
      return;
    }
    
    this.socket.emit('join_room', { roomId, password });
  }
  
  leaveRoom(roomId) {
    if (!this.isConnected()) return;
    
    this.socket.emit('leave_room', { roomId });
  }
  
  createRoom(roomData) {
    if (!this.isConnected()) {
      this.queueMessage('create_room', roomData);
      return;
    }
    
    this.socket.emit('create_room', roomData);
  }
  
  // Event handlers
  handlePrivateMessage(data) {
    console.log('Private message received:', data);
    this.triggerEvent('privateMessage', data);
    
    // Show notification if window is not focused
    if (!document.hasFocus()) {
      this.showNotification(`New message from ${data.sender.username}`, {
        body: data.content,
        icon: '/icons/message.png'
      });
    }
  }
  
  handleGroupMessage(data) {
    console.log('Group message received:', data);
    this.triggerEvent('groupMessage', data);
    
    if (!document.hasFocus()) {
      this.showNotification(`New message in ${data.room}`, {
        body: `${data.sender.username}: ${data.content}`,
        icon: '/icons/group-message.png'
      });
    }
  }
  
  handleTypingStart(data) {
    this.triggerEvent('typingStart', data);
  }
  
  handleTypingStop(data) {
    this.triggerEvent('typingStop', data);
  }
  
  handleRoomJoined(data) {
    console.log('Joined room:', data);
    this.triggerEvent('roomJoined', data);
  }
  
  handleUserJoinedRoom(data) {
    this.triggerEvent('userJoinedRoom', data);
  }
  
  handleUserLeftRoom(data) {
    this.triggerEvent('userLeftRoom', data);
  }
  
  handleNotification(data) {
    console.log('Notification received:', data);
    this.triggerEvent('notification', data);
    
    this.showNotification(data.title, {
      body: data.message,
      icon: data.icon || '/icons/notification.png'
    });
  }
  
  handleFriendStatusChange(data) {
    this.triggerEvent('friendStatusChange', data);
  }
  
  handleError(data) {
    console.error('Socket error:', data);
    this.triggerEvent('error', data);
  }
  
  // Utility methods
  isConnected() {
    return this.socket && this.socket.connected;
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
  
  // Event system
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }
  
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  triggerEvent(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  }
  
  // Connection status callbacks
  onConnectionStatusChange(connected) {
    this.triggerEvent('connectionStatusChange', { connected });
    
    if (connected) {
      this.processQueuedMessages();
    }
  }
  
  onConnectionFailed() {
    this.triggerEvent('connectionFailed');
  }
  
  onReconnected() {
    this.triggerEvent('reconnected');
  }
  
  // Message queuing for offline scenarios
  queueMessage(event, data) {
    if (!this.messageQueue) {
      this.messageQueue = [];
    }
    
    this.messageQueue.push({ event, data, timestamp: Date.now() });
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift();
    }
  }
  
  processQueuedMessages() {
    if (!this.messageQueue || this.messageQueue.length === 0) {
      return;
    }
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(({ event, data }) => {
      this.socket.emit(event, data);
    });
    
    console.log(`Processed ${messages.length} queued messages`);
  }
  
  // Browser notifications
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  }
  
  showNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    
    const notification = new Notification(title, {
      ...options,
      requireInteraction: false,
      silent: false
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

// Usage example
const realtimeClient = new RealtimeClient('http://localhost:3000', 'your-jwt-token');

// Setup event listeners
realtimeClient.on('privateMessage', (data) => {
  console.log('New private message:', data);
  // Update UI with new message
});

realtimeClient.on('connectionStatusChange', (data) => {
  console.log('Connection status:', data.connected ? 'Connected' : 'Disconnected');
  // Update connection indicator in UI
});

realtimeClient.on('typingStart', (data) => {
  console.log('User started typing:', data.username);
  // Show typing indicator
});

// Request notification permission and connect
realtimeClient.requestNotificationPermission().then(() => {
  realtimeClient.connect();
});
```

## Performance Optimization

```javascript
// Connection pool management for WebSockets
class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.connectionsByUser = new Map();
    this.roomConnections = new Map();
    this.heartbeatInterval = 30000; // 30 seconds
    this.maxConnectionsPerUser = 5;
    this.setupHeartbeat();
  }
  
  addConnection(socket) {
    const connectionInfo = {
      id: socket.id,
      userId: socket.userId,
      connectedAt: new Date(),
      lastPing: new Date(),
      roomCount: 0,
      messagesSent: 0,
      bytesTransferred: 0
    };
    
    this.connections.set(socket.id, connectionInfo);
    
    // Track connections per user
    if (!this.connectionsByUser.has(socket.userId)) {
      this.connectionsByUser.set(socket.userId, new Set());
    }
    
    const userConnections = this.connectionsByUser.get(socket.userId);
    
    // Limit connections per user
    if (userConnections.size >= this.maxConnectionsPerUser) {
      const oldestConnection = Array.from(userConnections)[0];
      this.disconnectConnection(oldestConnection);
    }
    
    userConnections.add(socket.id);
    
    console.log(`Connection added: ${socket.id} for user ${socket.userId}`);
  }
  
  removeConnection(socketId) {
    const connection = this.connections.get(socketId);
    if (connection) {
      // Remove from user connections
      const userConnections = this.connectionsByUser.get(connection.userId);
      if (userConnections) {
        userConnections.delete(socketId);
        
        if (userConnections.size === 0) {
          this.connectionsByUser.delete(connection.userId);
        }
      }
      
      this.connections.delete(socketId);
      console.log(`Connection removed: ${socketId}`);
    }
  }
  
  updateConnectionStats(socketId, stats) {
    const connection = this.connections.get(socketId);
    if (connection) {
      Object.assign(connection, stats);
    }
  }
  
  setupHeartbeat() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.heartbeatInterval);
  }
  
  performHealthCheck() {
    const now = new Date();
    const staleConnections = [];
    
    for (const [socketId, connection] of this.connections) {
      const timeSinceLastPing = now - connection.lastPing;
      
      // Mark stale connections (no ping for 2 minutes)
      if (timeSinceLastPing > 120000) {
        staleConnections.push(socketId);
      }
    }
    
    // Clean up stale connections
    staleConnections.forEach(socketId => {
      this.disconnectConnection(socketId);
    });
    
    console.log(`Health check: ${staleConnections.length} stale connections removed`);
  }
  
  disconnectConnection(socketId) {
    // Find socket and disconnect it
    const socket = this.findSocketById(socketId);
    if (socket) {
      socket.disconnect(true);
    }
    
    this.removeConnection(socketId);
  }
  
  findSocketById(socketId) {
    // This would be implemented based on your Socket.IO server setup
    return null; // Mock implementation
  }
  
  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.connectionsByUser.size,
      averageConnectionsPerUser: this.connections.size / (this.connectionsByUser.size || 1),
      connectionsByUser: Array.from(this.connectionsByUser.entries()).map(([userId, connections]) => ({
        userId,
        connectionCount: connections.size
      }))
    };
  }
}

// Message batching for better performance
class MessageBatcher {
  constructor(flushInterval = 100) {
    this.batches = new Map(); // targetId -> messages[]
    this.flushInterval = flushInterval;
    this.setupFlushing();
  }
  
  addMessage(targetId, message) {
    if (!this.batches.has(targetId)) {
      this.batches.set(targetId, []);
    }
    
    this.batches.get(targetId).push({
      ...message,
      batchedAt: Date.now()
    });
  }
  
  setupFlushing() {
    setInterval(() => {
      this.flushBatches();
    }, this.flushInterval);
  }
  
  flushBatches() {
    for (const [targetId, messages] of this.batches) {
      if (messages.length > 0) {
        // Send batched messages
        this.sendBatchedMessages(targetId, messages);
        
        // Clear batch
        this.batches.set(targetId, []);
      }
    }
  }
  
  sendBatchedMessages(targetId, messages) {
    // Group messages by type for more efficient processing
    const groupedMessages = messages.reduce((groups, message) => {
      const type = message.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(message);
      return groups;
    }, {});
    
    // Send each group
    for (const [type, typeMessages] of Object.entries(groupedMessages)) {
      this.emitBatchedMessage(targetId, type, typeMessages);
    }
  }
  
  emitBatchedMessage(targetId, type, messages) {
    // Implementation depends on your Socket.IO server setup
    console.log(`Sending ${messages.length} batched ${type} messages to ${targetId}`);
  }
}

// Memory usage monitoring
class MemoryMonitor {
  constructor() {
    this.memoryThreshold = 500 * 1024 * 1024; // 500MB
    this.checkInterval = 30000; // 30 seconds
    this.startMonitoring();
  }
  
  startMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }
  
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    
    console.log('Memory usage:', {
      heapUsed: Math.round(heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(usage.external / 1024 / 1024) + 'MB',
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB'
    });
    
    if (heapUsed > this.memoryThreshold) {
      console.warn('⚠️ High memory usage detected!');
      this.triggerMemoryCleanup();
    }
  }
  
  triggerMemoryCleanup() {
    // Force garbage collection if available
    if (global.gc) {
      console.log('Running garbage collection...');
      global.gc();
    }
    
    // Clean up caches, expired data, etc.
    this.cleanupExpiredData();
  }
  
  cleanupExpiredData() {
    // Implement cleanup logic for your application
    console.log('Cleaning up expired data...');
  }
}
```

## Security Considerations

```javascript
// WebSocket security implementation
class SecureWebSocketServer {
  constructor() {
    this.suspiciousConnections = new Map();
    this.rateLimiters = new Map();
    this.bannedIPs = new Set();
    this.setupSecurityMiddleware();
  }
  
  setupSecurityMiddleware() {
    // Origin validation
    this.validateOrigin = (origin) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      return allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development';
    };
    
    // IP blocking
    this.checkIPBan = (ip) => {
      return !this.bannedIPs.has(ip);
    };
    
    // Rate limiting
    this.checkRateLimit = (ip) => {
      if (!this.rateLimiters.has(ip)) {
        this.rateLimiters.set(ip, {
          requests: [],
          violations: 0
        });
      }
      
      const limiter = this.rateLimiters.get(ip);
      const now = Date.now();
      const windowMs = 60000; // 1 minute
      const maxRequests = 60; // 60 requests per minute
      
      // Remove old requests
      limiter.requests = limiter.requests.filter(time => now - time < windowMs);
      
      if (limiter.requests.length >= maxRequests) {
        limiter.violations++;
        
        // Ban IP after 3 violations
        if (limiter.violations >= 3) {
          this.bannedIPs.add(ip);
          console.warn(`IP banned for rate limit violations: ${ip}`);
        }
        
        return false;
      }
      
      limiter.requests.push(now);
      return true;
    };
  }
  
  // Message validation
  validateMessage(socket, message) {
    try {
      // Check message size
      const messageSize = JSON.stringify(message).length;
      if (messageSize > 10000) { // 10KB limit
        this.handleSuspiciousActivity(socket, 'oversized_message');
        return false;
      }
      
      // Check for malicious content
      if (this.containsMaliciousContent(message)) {
        this.handleSuspiciousActivity(socket, 'malicious_content');
        return false;
      }
      
      // Validate message structure
      if (!this.isValidMessageStructure(message)) {
        this.handleSuspiciousActivity(socket, 'invalid_structure');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Message validation error:', error);
      return false;
    }
  }
  
  containsMaliciousContent(message) {
    const content = JSON.stringify(message).toLowerCase();
    
    // Check for script injection attempts
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /eval\s*\(/i
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(content));
  }
  
  isValidMessageStructure(message) {
    // Implement message structure validation based on your protocol
    if (typeof message !== 'object') return false;
    if (!message.type || typeof message.type !== 'string') return false;
    if (message.type.length > 50) return false; // Reasonable type length limit
    
    return true;
  }
  
  handleSuspiciousActivity(socket, activity) {
    const clientIP = socket.handshake.address;
    const userId = socket.userId;
    
    if (!this.suspiciousConnections.has(clientIP)) {
      this.suspiciousConnections.set(clientIP, {
        activities: [],
        violations: 0
      });
    }
    
    const record = this.suspiciousConnections.get(clientIP);
    record.activities.push({
      activity,
      userId,
      timestamp: new Date(),
      socketId: socket.id
    });
    record.violations++;
    
    console.warn(`Suspicious activity detected: ${activity} from ${clientIP} (user: ${userId})`);
    
    // Escalate based on violation count
    if (record.violations >= 5) {
      this.bannedIPs.add(clientIP);
      socket.disconnect(true);
      console.error(`IP banned for repeated violations: ${clientIP}`);
    } else if (record.violations >= 3) {
      // Temporary restrictions
      socket.emit('warning', {
        message: 'Suspicious activity detected. Your connection is being monitored.'
      });
    }
  }
  
  // XSS protection for message content
  sanitizeMessage(content) {
    if (typeof content !== 'string') return content;
    
    // Basic HTML entity encoding
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  
  // Audit logging for security events
  logSecurityEvent(event, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      severity: this.getEventSeverity(event)
    };
    
    console.log('Security Event:', logEntry);
    
    // In production, send to security monitoring system
    // await securityLogger.log(logEntry);
  }
  
  getEventSeverity(event) {
    const highSeverityEvents = ['ip_banned', 'malicious_content', 'authentication_bypass_attempt'];
    const mediumSeverityEvents = ['rate_limit_violation', 'oversized_message'];
    
    if (highSeverityEvents.includes(event)) return 'HIGH';
    if (mediumSeverityEvents.includes(event)) return 'MEDIUM';
    return 'LOW';
  }
}
```

## Best Practices Summary

### ✅ Real-time Best Practices:

```javascript
// 1. Use namespaces for organization
const adminNamespace = io.of('/admin');
const chatNamespace = io.of('/chat');

// 2. Implement proper authentication
io.use(async (socket, next) => {
  try {
    const user = await authenticateUser(socket.handshake.auth.token);
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// 3. Use rooms for scalable broadcasting
socket.join('room_123');
io.to('room_123').emit('message', data);

// 4. Implement rate limiting
const rateLimiter = new RateLimiter(10, 60000); // 10 requests per minute
if (!rateLimiter.isAllowed(socket.userId)) {
  socket.emit('rate_limit_exceeded');
  return;
}

// 5. Handle offline scenarios
if (!userSocket) {
  await storeOfflineMessage(userId, message);
}
```

### ❌ Common Pitfalls:

```javascript
// 1. ❌ No error handling
socket.emit('data', data); // What if socket is disconnected?

// 2. ❌ Memory leaks with event listeners
socket.on('event', handler); // Never removed

// 3. ❌ No rate limiting
socket.on('message', processMessage); // Can be flooded

// 4. ❌ Storing sensitive data in client
socket.emit('user_data', { password: '123' }); // Never send passwords

// 5. ❌ Not handling reconnections
// Client doesn't handle connection drops gracefully
```

Real-time applications require careful consideration of connection management, security, scalability, and user experience. Proper implementation enables rich, interactive experiences while maintaining performance and reliability!