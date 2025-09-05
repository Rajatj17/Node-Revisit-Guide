// Node.js WebSocket and Real-time Communication Exercises

const { EventEmitter } = require('events');

console.log('=== NODE.JS WEBSOCKET & REAL-TIME COMMUNICATION EXERCISES ===\n');

// EXERCISE 1: Basic WebSocket Server Implementation
console.log('Exercise 1: Custom WebSocket Server Implementation');

class SimpleWebSocketServer extends EventEmitter {
  constructor(port = 8080) {
    super();
    this.port = port;
    this.clients = new Set();
    this.rooms = new Map(); // roomId -> Set of clients
    this.clientRooms = new Map(); // client -> roomId
    this.messageId = 0;
  }
  
  // Simulate WebSocket server startup
  start() {
    console.log(`🚀 WebSocket server starting on port ${this.port}`);
    
    // Simulate server startup
    setTimeout(() => {
      console.log(`✅ WebSocket server listening on port ${this.port}`);
      this.emit('server-ready');
    }, 100);
    
    return this;
  }
  
  // Simulate client connection
  simulateConnection(clientId) {
    const client = {
      id: clientId,
      connectedAt: Date.now(),
      lastSeen: Date.now(),
      metadata: {},
      
      send: (data) => {
        console.log(`📤 Sending to ${clientId}:`, JSON.stringify(data));
        
        // Simulate network delay
        setTimeout(() => {
          this.emit('message-sent', clientId, data);
        }, 10 + Math.random() * 50);
      },
      
      close: () => {
        this.disconnect(client);
      }
    };
    
    this.clients.add(client);
    console.log(`🔗 Client ${clientId} connected (Total: ${this.clients.size})`);
    
    this.emit('client-connected', client);
    
    // Send welcome message
    client.send({
      type: 'welcome',
      message: 'Connected to WebSocket server',
      clientId: clientId,
      timestamp: Date.now()
    });
    
    return client;
  }
  
  // Handle client message
  handleMessage(clientId, data) {
    const client = this.getClient(clientId);
    if (!client) {
      console.log(`❌ Message from unknown client: ${clientId}`);
      return;
    }
    
    client.lastSeen = Date.now();
    
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      message.id = ++this.messageId;
      message.fromClient = clientId;
      message.timestamp = Date.now();
      
      console.log(`📨 Received from ${clientId}:`, message.type || 'message');
      
      this.emit('client-message', client, message);
      this.processMessage(client, message);
      
    } catch (error) {
      console.log(`❌ Invalid message from ${clientId}:`, error.message);
      client.send({
        type: 'error',
        message: 'Invalid message format',
        error: error.message
      });
    }
  }
  
  processMessage(client, message) {
    switch (message.type) {
      case 'join-room':
        this.joinRoom(client, message.roomId);
        break;
        
      case 'leave-room':
        this.leaveRoom(client);
        break;
        
      case 'room-message':
        this.broadcastToRoom(client, message);
        break;
        
      case 'private-message':
        this.sendPrivateMessage(client, message);
        break;
        
      case 'broadcast':
        this.broadcast(message, client);
        break;
        
      case 'ping':
        client.send({ type: 'pong', timestamp: Date.now() });
        break;
        
      default:
        console.log(`❓ Unknown message type: ${message.type}`);
        client.send({
          type: 'error',
          message: `Unknown message type: ${message.type}`
        });
    }
  }
  
  joinRoom(client, roomId) {
    // Leave current room first
    this.leaveRoom(client);
    
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    
    this.rooms.get(roomId).add(client);
    this.clientRooms.set(client, roomId);
    
    console.log(`🏠 Client ${client.id} joined room: ${roomId}`);
    
    client.send({
      type: 'room-joined',
      roomId: roomId,
      memberCount: this.rooms.get(roomId).size
    });
    
    // Notify other room members
    this.broadcastToRoom(client, {
      type: 'user-joined',
      userId: client.id,
      message: `${client.id} joined the room`
    }, false);
  }
  
  leaveRoom(client) {
    const currentRoom = this.clientRooms.get(client);
    if (!currentRoom) return;
    
    const room = this.rooms.get(currentRoom);
    if (room) {
      room.delete(client);
      
      if (room.size === 0) {
        this.rooms.delete(currentRoom);
      } else {
        // Notify remaining members
        this.broadcastToRoom(client, {
          type: 'user-left',
          userId: client.id,
          message: `${client.id} left the room`
        }, false);
      }
    }
    
    this.clientRooms.delete(client);
    console.log(`🚪 Client ${client.id} left room: ${currentRoom}`);
  }
  
  broadcastToRoom(sender, message, includeSender = true) {
    const roomId = this.clientRooms.get(sender);
    if (!roomId) {
      sender.send({
        type: 'error',
        message: 'Not in any room'
      });
      return;
    }
    
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const enrichedMessage = {
      ...message,
      roomId: roomId,
      fromUser: sender.id,
      timestamp: Date.now()
    };
    
    console.log(`📢 Broadcasting to room ${roomId}: ${message.type || 'message'}`);
    
    for (const client of room) {
      if (client !== sender || includeSender) {
        client.send(enrichedMessage);
      }
    }
  }
  
  sendPrivateMessage(sender, message) {
    const targetClient = this.getClient(message.targetClientId);
    
    if (!targetClient) {
      sender.send({
        type: 'error',
        message: `Client ${message.targetClientId} not found`
      });
      return;
    }
    
    const privateMessage = {
      type: 'private-message',
      fromUser: sender.id,
      message: message.message,
      timestamp: Date.now()
    };
    
    targetClient.send(privateMessage);
    
    // Send confirmation to sender
    sender.send({
      type: 'private-message-sent',
      toUser: targetClient.id,
      message: message.message,
      timestamp: Date.now()
    });
    
    console.log(`💌 Private message: ${sender.id} → ${targetClient.id}`);
  }
  
  broadcast(message, excludeClient = null) {
    const broadcastMessage = {
      ...message,
      timestamp: Date.now(),
      fromServer: true
    };
    
    console.log(`📡 Broadcasting to all clients: ${message.type || 'message'}`);
    
    for (const client of this.clients) {
      if (client !== excludeClient) {
        client.send(broadcastMessage);
      }
    }
  }
  
  getClient(clientId) {
    return Array.from(this.clients).find(client => client.id === clientId);
  }
  
  disconnect(client) {
    this.leaveRoom(client);
    this.clients.delete(client);
    console.log(`❌ Client ${client.id} disconnected (Remaining: ${this.clients.size})`);
    
    this.emit('client-disconnected', client);
  }
  
  getStats() {
    const roomStats = {};
    for (const [roomId, clients] of this.rooms) {
      roomStats[roomId] = clients.size;
    }
    
    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      roomStats,
      uptime: Date.now() - this.startTime || 0
    };
  }
  
  // Cleanup inactive connections
  cleanupInactiveConnections(timeout = 60000) {
    const now = Date.now();
    const inactiveClients = [];
    
    for (const client of this.clients) {
      if (now - client.lastSeen > timeout) {
        inactiveClients.push(client);
      }
    }
    
    inactiveClients.forEach(client => {
      console.log(`🧹 Cleaning up inactive client: ${client.id}`);
      this.disconnect(client);
    });
    
    return inactiveClients.length;
  }
}

// Test WebSocket server
function testWebSocketServer() {
  const server = new SimpleWebSocketServer(8080);
  
  console.log('--- Testing WebSocket Server ---');
  
  server.on('server-ready', () => {
    // Simulate multiple client connections
    const client1 = server.simulateConnection('user1');
    const client2 = server.simulateConnection('user2');
    const client3 = server.simulateConnection('user3');
    
    setTimeout(() => {
      console.log('\n--- Testing Room Functionality ---');
      
      // Join rooms
      server.handleMessage('user1', {
        type: 'join-room',
        roomId: 'chat-room-1'
      });
      
      server.handleMessage('user2', {
        type: 'join-room', 
        roomId: 'chat-room-1'
      });
      
      server.handleMessage('user3', {
        type: 'join-room',
        roomId: 'chat-room-2'
      });
    }, 500);
    
    setTimeout(() => {
      console.log('\n--- Testing Room Messages ---');
      
      // Send room messages
      server.handleMessage('user1', {
        type: 'room-message',
        message: 'Hello everyone in room 1!',
        messageType: 'text'
      });
      
      server.handleMessage('user3', {
        type: 'room-message',
        message: 'Hello from room 2!',
        messageType: 'text'
      });
    }, 1000);
    
    setTimeout(() => {
      console.log('\n--- Testing Private Messages ---');
      
      server.handleMessage('user1', {
        type: 'private-message',
        targetClientId: 'user2',
        message: 'Hey user2, this is a private message!'
      });
    }, 1500);
    
    setTimeout(() => {
      console.log('\n--- Testing Broadcast ---');
      
      server.broadcast({
        type: 'server-announcement',
        message: 'Server maintenance in 5 minutes',
        priority: 'high'
      });
    }, 2000);
    
    setTimeout(() => {
      console.log('\n--- Server Statistics ---');
      console.table(server.getStats());
    }, 2500);
  });
  
  server.start();
  return server;
}

const wsServer = testWebSocketServer();

setTimeout(() => {
  console.log('\n--- Separator ---\n');
  exerciseTwo();
}, 3000);

// EXERCISE 2: Real-time Chat Application
function exerciseTwo() {
  console.log('Exercise 2: Real-time Chat Application Architecture');
  
  class ChatApplication {
    constructor() {
      this.users = new Map(); // userId -> user info
      this.channels = new Map(); // channelId -> channel info
      this.messages = new Map(); // channelId -> array of messages
      this.userConnections = new Map(); // userId -> connection
      this.onlineUsers = new Set();
      this.messageId = 0;
    }
    
    // User management
    registerUser(userId, userInfo) {
      this.users.set(userId, {
        id: userId,
        ...userInfo,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        isOnline: false
      });
      
      console.log(`👤 User registered: ${userId} (${userInfo.name})`);
    }
    
    connectUser(userId, connection) {
      const user = this.users.get(userId);
      if (!user) {
        throw new Error(`User ${userId} not registered`);
      }
      
      user.isOnline = true;
      user.lastSeen = Date.now();
      this.userConnections.set(userId, connection);
      this.onlineUsers.add(userId);
      
      console.log(`🟢 User ${userId} connected`);
      
      // Send user their channels and recent messages
      this.sendUserChannels(userId);
      this.broadcastUserStatus(userId, 'online');
    }
    
    disconnectUser(userId) {
      const user = this.users.get(userId);
      if (user) {
        user.isOnline = false;
        user.lastSeen = Date.now();
      }
      
      this.userConnections.delete(userId);
      this.onlineUsers.delete(userId);
      
      console.log(`🔴 User ${userId} disconnected`);
      this.broadcastUserStatus(userId, 'offline');
    }
    
    // Channel management
    createChannel(channelId, channelInfo, creatorId) {
      if (this.channels.has(channelId)) {
        throw new Error(`Channel ${channelId} already exists`);
      }
      
      const channel = {
        id: channelId,
        ...channelInfo,
        createdBy: creatorId,
        createdAt: Date.now(),
        members: new Set([creatorId]),
        isPrivate: channelInfo.isPrivate || false
      };
      
      this.channels.set(channelId, channel);
      this.messages.set(channelId, []);
      
      console.log(`📁 Channel created: ${channelId} by ${creatorId}`);
      
      // Notify creator
      this.sendToUser(creatorId, {
        type: 'channel-created',
        channel: this.getChannelInfo(channelId)
      });
      
      return channel;
    }
    
    joinChannel(userId, channelId) {
      const channel = this.channels.get(channelId);
      const user = this.users.get(userId);
      
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      if (channel.isPrivate && !channel.members.has(userId)) {
        throw new Error('Cannot join private channel without invitation');
      }
      
      channel.members.add(userId);
      console.log(`🏠 ${userId} joined channel: ${channelId}`);
      
      // Send recent messages to new member
      this.sendRecentMessages(userId, channelId);
      
      // Notify channel members
      this.broadcastToChannel(channelId, {
        type: 'user-joined-channel',
        userId: userId,
        userName: user.name,
        channelId: channelId,
        timestamp: Date.now()
      }, userId);
    }
    
    leaveChannel(userId, channelId) {
      const channel = this.channels.get(channelId);
      
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }
      
      channel.members.delete(userId);
      console.log(`🚪 ${userId} left channel: ${channelId}`);
      
      // Notify remaining members
      const user = this.users.get(userId);
      this.broadcastToChannel(channelId, {
        type: 'user-left-channel',
        userId: userId,
        userName: user?.name,
        channelId: channelId,
        timestamp: Date.now()
      });
    }
    
    // Message handling
    sendMessage(fromUserId, channelId, messageData) {
      const channel = this.channels.get(channelId);
      const user = this.users.get(fromUserId);
      
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }
      
      if (!user) {
        throw new Error(`User ${fromUserId} not found`);
      }
      
      if (!channel.members.has(fromUserId)) {
        throw new Error(`User ${fromUserId} is not a member of channel ${channelId}`);
      }
      
      const message = {
        id: ++this.messageId,
        channelId: channelId,
        fromUserId: fromUserId,
        fromUserName: user.name,
        ...messageData,
        timestamp: Date.now(),
        edited: false,
        reactions: new Map()
      };
      
      // Store message
      const channelMessages = this.messages.get(channelId);
      channelMessages.push(message);
      
      // Keep only recent messages (last 100)
      if (channelMessages.length > 100) {
        channelMessages.splice(0, channelMessages.length - 100);
      }
      
      console.log(`💬 Message in ${channelId} from ${fromUserId}: ${messageData.content?.substring(0, 30)}...`);
      
      // Broadcast to channel members
      this.broadcastToChannel(channelId, {
        type: 'new-message',
        message: this.sanitizeMessage(message)
      });
      
      return message;
    }
    
    editMessage(userId, channelId, messageId, newContent) {
      const channelMessages = this.messages.get(channelId);
      const message = channelMessages?.find(m => m.id === messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      if (message.fromUserId !== userId) {
        throw new Error('Can only edit own messages');
      }
      
      message.content = newContent;
      message.edited = true;
      message.editedAt = Date.now();
      
      this.broadcastToChannel(channelId, {
        type: 'message-edited',
        messageId: messageId,
        newContent: newContent,
        editedAt: message.editedAt
      });
      
      console.log(`✏️  Message ${messageId} edited by ${userId}`);
    }
    
    addReaction(userId, channelId, messageId, emoji) {
      const channelMessages = this.messages.get(channelId);
      const message = channelMessages?.find(m => m.id === messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      if (!message.reactions.has(emoji)) {
        message.reactions.set(emoji, new Set());
      }
      
      const reactions = message.reactions.get(emoji);
      const hadReaction = reactions.has(userId);
      
      if (hadReaction) {
        reactions.delete(userId);
        if (reactions.size === 0) {
          message.reactions.delete(emoji);
        }
      } else {
        reactions.add(userId);
      }
      
      this.broadcastToChannel(channelId, {
        type: 'message-reaction',
        messageId: messageId,
        emoji: emoji,
        userId: userId,
        added: !hadReaction,
        reactionCount: reactions.size
      });
      
      console.log(`${hadReaction ? '➖' : '➕'} ${userId} ${hadReaction ? 'removed' : 'added'} reaction ${emoji} to message ${messageId}`);
    }
    
    // Utility methods
    sendToUser(userId, data) {
      const connection = this.userConnections.get(userId);
      if (connection && connection.send) {
        connection.send(data);
      }
    }
    
    broadcastToChannel(channelId, data, excludeUserId = null) {
      const channel = this.channels.get(channelId);
      if (!channel) return;
      
      for (const memberId of channel.members) {
        if (memberId !== excludeUserId && this.onlineUsers.has(memberId)) {
          this.sendToUser(memberId, data);
        }
      }
    }
    
    broadcastUserStatus(userId, status) {
      const user = this.users.get(userId);
      if (!user) return;
      
      // Find all channels the user is in
      for (const [channelId, channel] of this.channels) {
        if (channel.members.has(userId)) {
          this.broadcastToChannel(channelId, {
            type: 'user-status',
            userId: userId,
            userName: user.name,
            status: status,
            timestamp: Date.now()
          }, userId);
        }
      }
    }
    
    sendUserChannels(userId) {
      const userChannels = [];
      
      for (const [channelId, channel] of this.channels) {
        if (channel.members.has(userId)) {
          userChannels.push(this.getChannelInfo(channelId));
        }
      }
      
      this.sendToUser(userId, {
        type: 'user-channels',
        channels: userChannels
      });
    }
    
    sendRecentMessages(userId, channelId, count = 20) {
      const channelMessages = this.messages.get(channelId) || [];
      const recentMessages = channelMessages
        .slice(-count)
        .map(msg => this.sanitizeMessage(msg));
      
      this.sendToUser(userId, {
        type: 'recent-messages',
        channelId: channelId,
        messages: recentMessages
      });
    }
    
    getChannelInfo(channelId) {
      const channel = this.channels.get(channelId);
      if (!channel) return null;
      
      return {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        isPrivate: channel.isPrivate,
        memberCount: channel.members.size,
        createdAt: channel.createdAt,
        createdBy: channel.createdBy
      };
    }
    
    sanitizeMessage(message) {
      return {
        id: message.id,
        channelId: message.channelId,
        fromUserId: message.fromUserId,
        fromUserName: message.fromUserName,
        content: message.content,
        messageType: message.messageType,
        timestamp: message.timestamp,
        edited: message.edited,
        editedAt: message.editedAt,
        reactions: Object.fromEntries(
          Array.from(message.reactions.entries()).map(([emoji, users]) => [
            emoji,
            Array.from(users)
          ])
        )
      };
    }
    
    getStats() {
      return {
        totalUsers: this.users.size,
        onlineUsers: this.onlineUsers.size,
        totalChannels: this.channels.size,
        totalMessages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0)
      };
    }
  }
  
  // Test chat application
  function testChatApplication() {
    console.log('--- Testing Chat Application ---');
    
    const chat = new ChatApplication();
    
    // Register users
    chat.registerUser('alice', { name: 'Alice Smith', avatar: 'avatar1.jpg' });
    chat.registerUser('bob', { name: 'Bob Johnson', avatar: 'avatar2.jpg' });
    chat.registerUser('charlie', { name: 'Charlie Brown', avatar: 'avatar3.jpg' });
    
    // Mock connections
    const mockConnection = (userId) => ({
      send: (data) => console.log(`📱 ${userId} received:`, data.type, data.message || '')
    });
    
    // Connect users
    chat.connectUser('alice', mockConnection('alice'));
    chat.connectUser('bob', mockConnection('bob'));
    
    // Create channels
    chat.createChannel('general', { 
      name: 'General', 
      description: 'General discussion' 
    }, 'alice');
    
    chat.createChannel('dev-team', {
      name: 'Dev Team',
      description: 'Development team private channel',
      isPrivate: true
    }, 'alice');
    
    // Users join channels
    setTimeout(() => {
      console.log('\n--- Users Joining Channels ---');
      chat.joinChannel('bob', 'general');
      chat.joinChannel('bob', 'dev-team'); // Should be allowed since Alice can invite
    }, 500);
    
    // Send messages
    setTimeout(() => {
      console.log('\n--- Sending Messages ---');
      
      chat.sendMessage('alice', 'general', {
        content: 'Hello everyone! Welcome to the chat.',
        messageType: 'text'
      });
      
      chat.sendMessage('bob', 'general', {
        content: 'Hi Alice! Great to be here.',
        messageType: 'text'
      });
      
      chat.sendMessage('alice', 'dev-team', {
        content: 'Let\\'s discuss the new features.',
        messageType: 'text'
      });
    }, 1000);
    
    // Add reactions and edit messages
    setTimeout(() => {
      console.log('\n--- Message Interactions ---');
      
      chat.addReaction('bob', 'general', 1, '👋');
      chat.addReaction('alice', 'general', 2, '😊');
      
      chat.editMessage('alice', 'general', 1, 'Hello everyone! Welcome to our awesome chat application.');
    }, 1500);
    
    // Connect third user
    setTimeout(() => {
      console.log('\n--- Third User Joining ---');
      
      chat.connectUser('charlie', mockConnection('charlie'));
      chat.joinChannel('charlie', 'general');
      
      chat.sendMessage('charlie', 'general', {
        content: 'Hey folks! Just joined the party! 🎉',
        messageType: 'text'
      });
    }, 2000);
    
    // Show stats
    setTimeout(() => {
      console.log('\n--- Chat Application Statistics ---');
      console.table(chat.getStats());
    }, 2500);
    
    return chat;
  }
  
  const chatApp = testChatApplication();
  
  setTimeout(() => exerciseThree(), 3000);
}

// EXERCISE 3: Scalable WebSocket Architecture
function exerciseThree() {
  console.log('\n--- Separator ---\n');
  console.log('Exercise 3: Scalable WebSocket Architecture');
  
  // Redis-like pub/sub system for scaling WebSockets
  class MessageBroker extends EventEmitter {
    constructor() {
      super();
      this.channels = new Map(); // channel -> Set of subscribers
      this.subscribers = new Map(); // subscriber -> Set of channels
    }
    
    subscribe(subscriber, channel) {
      if (!this.channels.has(channel)) {
        this.channels.set(channel, new Set());
      }
      
      if (!this.subscribers.has(subscriber)) {
        this.subscribers.set(subscriber, new Set());
      }
      
      this.channels.get(channel).add(subscriber);
      this.subscribers.get(subscriber).add(channel);
      
      console.log(`📻 ${subscriber} subscribed to channel: ${channel}`);
    }
    
    unsubscribe(subscriber, channel) {
      const channelSubs = this.channels.get(channel);
      const subscriberChannels = this.subscribers.get(subscriber);
      
      if (channelSubs) {
        channelSubs.delete(subscriber);
        if (channelSubs.size === 0) {
          this.channels.delete(channel);
        }
      }
      
      if (subscriberChannels) {
        subscriberChannels.delete(channel);
        if (subscriberChannels.size === 0) {
          this.subscribers.delete(subscriber);
        }
      }
      
      console.log(`📻 ${subscriber} unsubscribed from channel: ${channel}`);
    }
    
    publish(channel, message) {
      const subscribers = this.channels.get(channel);
      if (!subscribers) return 0;
      
      const enrichedMessage = {
        ...message,
        channel,
        publishedAt: Date.now()
      };
      
      console.log(`📡 Publishing to channel ${channel} (${subscribers.size} subscribers)`);
      
      for (const subscriber of subscribers) {
        this.emit('message', subscriber, channel, enrichedMessage);
      }
      
      return subscribers.size;
    }
    
    getStats() {
      return {
        totalChannels: this.channels.size,
        totalSubscribers: this.subscribers.size,
        channelStats: Object.fromEntries(
          Array.from(this.channels.entries()).map(([channel, subs]) => [
            channel,
            subs.size
          ])
        )
      };
    }
  }
  
  // Load balancer for WebSocket servers
  class WebSocketLoadBalancer {
    constructor() {
      this.servers = [];
      this.currentIndex = 0;
      this.healthCheck = new Map(); // serverId -> health status
    }
    
    addServer(serverId, serverInfo) {
      const server = {
        id: serverId,
        ...serverInfo,
        connections: 0,
        load: 0,
        healthy: true,
        addedAt: Date.now()
      };
      
      this.servers.push(server);
      this.healthCheck.set(serverId, { healthy: true, lastCheck: Date.now() });
      
      console.log(`⚖️  Added server: ${serverId} (${serverInfo.host}:${serverInfo.port})`);
      return server;
    }
    
    removeServer(serverId) {
      const index = this.servers.findIndex(s => s.id === serverId);
      if (index !== -1) {
        this.servers.splice(index, 1);
        this.healthCheck.delete(serverId);
        console.log(`⚖️  Removed server: ${serverId}`);
        return true;
      }
      return false;
    }
    
    getServerForConnection(strategy = 'round-robin') {
      const healthyServers = this.servers.filter(s => s.healthy);
      
      if (healthyServers.length === 0) {
        throw new Error('No healthy servers available');
      }
      
      let selectedServer;
      
      switch (strategy) {
        case 'round-robin':
          selectedServer = this.roundRobinSelection(healthyServers);
          break;
          
        case 'least-connections':
          selectedServer = healthyServers.reduce((least, current) => 
            current.connections < least.connections ? current : least
          );
          break;
          
        case 'least-load':
          selectedServer = healthyServers.reduce((least, current) => 
            current.load < least.load ? current : least
          );
          break;
          
        case 'random':
          selectedServer = healthyServers[Math.floor(Math.random() * healthyServers.length)];
          break;
          
        default:
          selectedServer = healthyServers[0];
      }
      
      selectedServer.connections++;
      this.updateServerLoad(selectedServer);
      
      console.log(`⚖️  Routed connection to server: ${selectedServer.id} (${selectedServer.connections} connections)`);
      return selectedServer;
    }
    
    roundRobinSelection(servers) {
      const server = servers[this.currentIndex % servers.length];
      this.currentIndex = (this.currentIndex + 1) % servers.length;
      return server;
    }
    
    releaseConnection(serverId) {
      const server = this.servers.find(s => s.id === serverId);
      if (server) {
        server.connections = Math.max(0, server.connections - 1);
        this.updateServerLoad(server);
        console.log(`⚖️  Connection released from server: ${serverId} (${server.connections} remaining)`);
      }
    }
    
    updateServerLoad(server) {
      // Simple load calculation based on connections
      server.load = server.connections / 100; // Assume 100 connections = 100% load
    }
    
    performHealthCheck() {
      console.log('⚖️  Performing health checks...');
      
      for (const server of this.servers) {
        // Simulate health check
        const isHealthy = Math.random() > 0.1; // 90% success rate
        const wasHealthy = server.healthy;
        
        server.healthy = isHealthy;
        this.healthCheck.get(server.id).healthy = isHealthy;
        this.healthCheck.get(server.id).lastCheck = Date.now();
        
        if (wasHealthy && !isHealthy) {
          console.log(`⚠️  Server ${server.id} became unhealthy`);
        } else if (!wasHealthy && isHealthy) {
          console.log(`✅ Server ${server.id} recovered`);
        }
      }
    }
    
    getStats() {
      const totalConnections = this.servers.reduce((sum, s) => sum + s.connections, 0);
      
      return {
        totalServers: this.servers.length,
        healthyServers: this.servers.filter(s => s.healthy).length,
        totalConnections,
        averageLoad: totalConnections > 0 ? 
          this.servers.reduce((sum, s) => sum + s.load, 0) / this.servers.length : 0,
        serverStats: this.servers.map(s => ({
          id: s.id,
          healthy: s.healthy,
          connections: s.connections,
          load: Math.round(s.load * 100) + '%'
        }))
      };
    }
  }
  
  // Connection manager with sticky sessions
  class ConnectionManager {
    constructor(loadBalancer, messageBroker) {
      this.loadBalancer = loadBalancer;
      this.messageBroker = messageBroker;
      this.sessions = new Map(); // sessionId -> server assignment
      this.connections = new Map(); // connectionId -> connection info
      this.userSessions = new Map(); // userId -> sessionId
    }
    
    createConnection(userId, sessionId = null) {
      // Generate session ID if not provided
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      let server;
      
      // Check if user has existing session (sticky session)
      const existingSessionId = this.userSessions.get(userId);
      if (existingSessionId && this.sessions.has(existingSessionId)) {
        server = this.sessions.get(existingSessionId);
        console.log(`🔗 Reusing sticky session for ${userId}: ${server.id}`);
      } else {
        // Get new server from load balancer
        server = this.loadBalancer.getServerForConnection('least-connections');
        this.sessions.set(sessionId, server);
        this.userSessions.set(userId, sessionId);
      }
      
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const connection = {
        id: connectionId,
        userId: userId,
        sessionId: sessionId,
        serverId: server.id,
        server: server,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        
        send: (data) => {
          console.log(`📤 [${server.id}] Sending to ${userId}:`, data.type || 'data');
          this.messageBroker.publish(`user:${userId}`, data);
        },
        
        close: () => {
          this.closeConnection(connectionId);
        }
      };
      
      this.connections.set(connectionId, connection);
      
      // Subscribe to user-specific messages
      this.messageBroker.subscribe(`server:${server.id}`, `user:${userId}`);
      
      console.log(`🔗 Created connection ${connectionId} for ${userId} on ${server.id}`);
      
      return connection;
    }
    
    closeConnection(connectionId) {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
      
      // Release server resources
      this.loadBalancer.releaseConnection(connection.serverId);
      
      // Unsubscribe from messages
      this.messageBroker.unsubscribe(`server:${connection.serverId}`, `user:${connection.userId}`);
      
      // Remove from tracking
      this.connections.delete(connectionId);
      
      console.log(`❌ Closed connection ${connectionId} for ${connection.userId}`);
    }
    
    broadcastToUsers(userIds, message) {
      const uniqueUserIds = [...new Set(userIds)];
      
      console.log(`📡 Broadcasting to ${uniqueUserIds.length} users`);
      
      for (const userId of uniqueUserIds) {
        this.messageBroker.publish(`user:${userId}`, message);
      }
    }
    
    sendToUser(userId, message) {
      this.messageBroker.publish(`user:${userId}`, message);
    }
    
    getStats() {
      const connectionsByServer = new Map();
      
      for (const conn of this.connections.values()) {
        const serverId = conn.serverId;
        connectionsByServer.set(serverId, (connectionsByServer.get(serverId) || 0) + 1);
      }
      
      return {
        totalConnections: this.connections.size,
        totalSessions: this.sessions.size,
        connectionsByServer: Object.fromEntries(connectionsByServer),
        averageConnectionAge: this.connections.size > 0 ?
          Array.from(this.connections.values()).reduce((sum, conn) => 
            sum + (Date.now() - conn.connectedAt), 0) / this.connections.size : 0
      };
    }
  }
  
  // Test scalable WebSocket architecture
  function testScalableArchitecture() {
    console.log('--- Testing Scalable WebSocket Architecture ---');
    
    const messageBroker = new MessageBroker();
    const loadBalancer = new WebSocketLoadBalancer();
    const connectionManager = new ConnectionManager(loadBalancer, messageBroker);
    
    // Add WebSocket servers to load balancer
    loadBalancer.addServer('ws-server-1', { 
      host: '10.0.1.10', 
      port: 8080, 
      region: 'us-west-1' 
    });
    loadBalancer.addServer('ws-server-2', { 
      host: '10.0.1.11', 
      port: 8080, 
      region: 'us-west-1' 
    });
    loadBalancer.addServer('ws-server-3', { 
      host: '10.0.1.12', 
      port: 8080, 
      region: 'us-east-1' 
    });
    
    // Set up message broker event handling
    messageBroker.on('message', (subscriber, channel, message) => {
      console.log(`📨 [${subscriber}] Received on ${channel}:`, message.type || 'message');
    });
    
    console.log('\n--- Creating Connections ---');
    
    // Create connections for multiple users
    const connections = [];
    const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
    
    userIds.forEach(userId => {
      const conn = connectionManager.createConnection(userId);
      connections.push(conn);
    });
    
    console.log('\n--- Testing Message Broadcasting ---');
    
    setTimeout(() => {
      // Test broadcasting
      connectionManager.broadcastToUsers(['user1', 'user2', 'user3'], {
        type: 'system-announcement',
        message: 'Server maintenance scheduled for tonight',
        priority: 'medium'
      });
      
      // Test individual messaging
      connectionManager.sendToUser('user4', {
        type: 'private-notification',
        message: 'You have a new friend request',
        from: 'user1'
      });
    }, 500);
    
    console.log('\n--- Testing Load Balancing ---');
    
    setTimeout(() => {
      // Create more connections to test load balancing
      for (let i = 6; i <= 10; i++) {
        connectionManager.createConnection(`user${i}`);
      }
      
      console.log('\nLoad Balancer Stats:');
      console.table(loadBalancer.getStats().serverStats);
      
      console.log('\nConnection Manager Stats:');
      console.table(connectionManager.getStats());
    }, 1000);
    
    console.log('\n--- Testing Health Checks ---');
    
    setTimeout(() => {
      loadBalancer.performHealthCheck();
      
      setTimeout(() => {
        console.log('\nPost-health check stats:');
        console.table(loadBalancer.getStats().serverStats);
      }, 500);
    }, 1500);
    
    return { messageBroker, loadBalancer, connectionManager };
  }
  
  testScalableArchitecture();
  
  setTimeout(() => practicalChallenges(), 3000);
}

// PRACTICAL CHALLENGES
function practicalChallenges() {
  console.log('\n=== PRACTICAL CHALLENGES ===\n');
  
  console.log('Challenge 1: Real-time Collaborative Document Editing');
  console.log('Challenge 2: Live Gaming Leaderboard System');
  console.log('Challenge 3: Video Streaming Chat with Moderation');
  console.log('Challenge 4: Multi-room Voice/Video Conference System');
  console.log('Challenge 5: IoT Device Monitoring Dashboard');
  
  // Challenge 1: Collaborative Document Editing with Operational Transform
  console.log('\n--- Challenge 1: Collaborative Document Editing ---');
  
  class CollaborativeDocument {
    constructor(documentId) {
      this.documentId = documentId;
      this.content = '';
      this.version = 0;
      this.operations = [];
      this.collaborators = new Map(); // userId -> cursor position
      this.locked = false;
      this.lockHolder = null;
    }
    
    // Apply operation with operational transform
    applyOperation(operation, fromUserId) {
      console.log(`📝 Applying operation from ${fromUserId}:`, operation.type);
      
      const transformedOp = this.transformOperation(operation, this.version);
      
      switch (transformedOp.type) {
        case 'insert':
          this.content = this.content.slice(0, transformedOp.position) + 
                        transformedOp.text + 
                        this.content.slice(transformedOp.position);
          break;
          
        case 'delete':
          this.content = this.content.slice(0, transformedOp.position) + 
                        this.content.slice(transformedOp.position + transformedOp.length);
          break;
          
        case 'retain':
          // No content change, just cursor movement
          break;
      }
      
      this.version++;
      this.operations.push({
        ...transformedOp,
        version: this.version,
        userId: fromUserId,
        timestamp: Date.now()
      });
      
      // Update collaborator cursor
      this.updateCursor(fromUserId, transformedOp.position);
      
      return {
        version: this.version,
        operation: transformedOp,
        content: this.content
      };
    }
    
    transformOperation(operation, atVersion) {
      // Simplified operational transform
      // In a real system, you'd use more sophisticated algorithms like OT or CRDT
      
      let transformedOp = { ...operation };
      
      // Apply transformations based on operations since atVersion
      const laterOperations = this.operations.filter(op => op.version > atVersion);
      
      for (const laterOp of laterOperations) {
        if (laterOp.type === 'insert' && laterOp.position <= transformedOp.position) {
          transformedOp.position += laterOp.text.length;
        } else if (laterOp.type === 'delete' && laterOp.position < transformedOp.position) {
          transformedOp.position -= Math.min(laterOp.length, transformedOp.position - laterOp.position);
        }
      }
      
      return transformedOp;
    }
    
    updateCursor(userId, position) {
      this.collaborators.set(userId, {
        position: position,
        lastUpdate: Date.now()
      });
    }
    
    getDocument() {
      return {
        id: this.documentId,
        content: this.content,
        version: this.version,
        collaborators: Array.from(this.collaborators.entries()).map(([userId, cursor]) => ({
          userId,
          position: cursor.position,
          lastUpdate: cursor.lastUpdate
        })),
        locked: this.locked,
        lockHolder: this.lockHolder
      };
    }
  }
  
  // Test collaborative document
  const doc = new CollaborativeDocument('doc-123');
  
  // Simulate multiple users editing
  console.log('Initial document:', doc.getDocument());
  
  doc.applyOperation({
    type: 'insert',
    position: 0,
    text: 'Hello '
  }, 'user1');
  
  doc.applyOperation({
    type: 'insert',
    position: 6,
    text: 'World!'
  }, 'user2');
  
  doc.applyOperation({
    type: 'insert',
    position: 6,
    text: 'beautiful '
  }, 'user3');
  
  console.log('Final document:', doc.getDocument());
  
  setTimeout(() => {
    console.log('\n=== END EXERCISES ===');
    console.log('\n🔌 WebSocket & Real-time Communication Best Practices:');
    console.log('• Implement proper connection management and cleanup');
    console.log('• Use message queues for scalable pub/sub architecture');
    console.log('• Implement heartbeat/ping-pong for connection health');
    console.log('• Handle reconnection and message replay for reliability');
    console.log('• Use sticky sessions for stateful connections');
    console.log('• Implement proper authentication and authorization');
    console.log('• Add rate limiting to prevent abuse');
    console.log('• Monitor connection metrics and performance');
    console.log('• Design for horizontal scaling with load balancers');
    console.log('• Implement graceful degradation for connection failures');
  }, 1000);
}

console.log('Starting WebSocket exercises...\n');