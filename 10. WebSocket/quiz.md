# WebSocket & Real-time Communication Quiz

## Question 1: Multiple Choice
What is the main advantage of WebSocket over HTTP polling for real-time communication?

A) Better security  
B) Simpler implementation  
C) Persistent bidirectional connection with lower latency  
D) Better browser support  

**Answer: C** - WebSocket provides a persistent, full-duplex connection that eliminates the overhead of repeated HTTP requests.

---

## Question 2: True/False
WebSocket connections automatically scale horizontally without additional infrastructure changes.

**Answer: False** - WebSocket connections are stateful and require additional infrastructure like sticky sessions, load balancers, and message brokers for horizontal scaling.

---

## Question 3: Code Analysis
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Broadcast to all clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });
});
```

What's problematic about this broadcasting approach?

**Answer:** Issues include:
1. **No sender exclusion** - message is sent back to the sender
2. **No error handling** - `client.send()` can throw errors
3. **No message validation** - raw data is broadcast without checks
4. **Memory leaks** - no cleanup of closed connections
5. **No rate limiting** - vulnerable to spam attacks

---

## Question 4: Fill in the Blank
The _______ pattern helps maintain user sessions across multiple WebSocket servers in a scaled environment.

**Answer: Sticky Sessions (or Session Affinity)**

---

## Question 5: Short Answer
Explain the difference between Socket.IO and native WebSockets.

**Answer:**
**Native WebSockets:**
- Direct browser WebSocket API
- Lightweight, minimal overhead
- Manual handling of reconnection, fallbacks
- No built-in rooms/namespaces

**Socket.IO:**
- Library built on top of WebSockets
- Automatic fallback to polling
- Built-in reconnection, heartbeat
- Rooms, namespaces, middleware support
- Higher-level abstraction with more features

---

## Question 6: Connection Management
```javascript
class WebSocketManager {
  constructor() {
    this.connections = new Map();
  }
  
  addConnection(userId, ws) {
    // Implementation needed
  }
  
  removeConnection(userId) {
    // Implementation needed
  }
  
  broadcastToUsers(userIds, message) {
    // Implementation needed
  }
}
```

Complete this WebSocket connection manager.

**Answer:**
```javascript
class WebSocketManager {
  constructor() {
    this.connections = new Map();
  }
  
  addConnection(userId, ws) {
    // Close existing connection if any
    if (this.connections.has(userId)) {
      this.connections.get(userId).close();
    }
    
    this.connections.set(userId, ws);
    
    // Handle connection close
    ws.on('close', () => {
      this.connections.delete(userId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      this.connections.delete(userId);
    });
  }
  
  removeConnection(userId) {
    const ws = this.connections.get(userId);
    if (ws) {
      ws.close();
      this.connections.delete(userId);
    }
  }
  
  broadcastToUsers(userIds, message) {
    userIds.forEach(userId => {
      const ws = this.connections.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to send to ${userId}:`, error);
          this.connections.delete(userId);
        }
      }
    });
  }
}
```

---

## Question 7: Multiple Choice
Which approach is best for handling WebSocket message ordering in a distributed system?

A) Use timestamps on each message  
B) Use sequence numbers with acknowledgments  
C) Use a message queue with guaranteed ordering  
D) All of the above  

**Answer: D** - Different approaches suit different scenarios: timestamps for loose ordering, sequence numbers for strict client-side ordering, message queues for server-side guaranteed ordering.

---

## Question 8: Scaling WebSockets
How would you handle the challenge of broadcasting messages to users connected to different WebSocket servers?

**Answer:** Use a **Message Broker/Pub-Sub system**:

1. **Redis Pub/Sub**:
   ```javascript
   // Server 1
   redis.publish('user:123', JSON.stringify(message));
   
   // Server 2 
   redis.subscribe('user:123');
   redis.on('message', (channel, message) => {
     const userId = channel.split(':')[1];
     sendToLocalUser(userId, JSON.parse(message));
   });
   ```

2. **Message Queue (RabbitMQ/Apache Kafka)**:
   - Each server subscribes to user-specific topics
   - Messages are published to user topics
   - Automatic load balancing and persistence

3. **Database-based approach** for smaller scale:
   - Store messages in database with TTL
   - Servers poll for user messages

---

## Question 9: Real-time Collaboration
Implement a simple operational transform for collaborative text editing:

```javascript
function transformOperation(op1, op2) {
  // op1 and op2 are concurrent operations
  // Return transformed versions
}
```

**Answer:**
```javascript
function transformOperation(op1, op2) {
  // Simplified operational transform for insert/delete operations
  
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op1.position <= op2.position) {
      return [op1, { ...op2, position: op2.position + op1.text.length }];
    } else {
      return [{ ...op1, position: op1.position + op2.text.length }, op2];
    }
  }
  
  if (op1.type === 'insert' && op2.type === 'delete') {
    if (op1.position <= op2.position) {
      return [op1, { ...op2, position: op2.position + op1.text.length }];
    } else {
      const deletedCharsBeforeInsert = Math.min(op2.length, op1.position - op2.position);
      return [{ ...op1, position: op1.position - deletedCharsBeforeInsert }, op2];
    }
  }
  
  if (op1.type === 'delete' && op2.type === 'insert') {
    // Symmetric to above case
    return transformOperation(op2, op1).reverse();
  }
  
  if (op1.type === 'delete' && op2.type === 'delete') {
    // Handle overlapping deletions - more complex
    // Simplified: whoever deletes first wins
    return [op1, null]; // op2 becomes no-op
  }
  
  return [op1, op2];
}
```

---

## Question 10: Advanced Scenario
Design a WebSocket system for a real-time multiplayer game that needs to handle:
- 1000+ concurrent players
- Low latency requirements (< 50ms)
- Anti-cheat validation
- Graceful handling of disconnections

**Answer:** Multi-layered architecture:

1. **Load Balancer with Geographic Distribution**:
   ```javascript
   // Route players to nearest server based on latency
   const server = selectServerByLatency(playerLocation);
   ```

2. **Game State Synchronization**:
   ```javascript
   class GameStateManager {
     constructor() {
       this.authoritative = true; // Server is authoritative
       this.tickRate = 20; // 50ms updates
       this.players = new Map();
     }
     
     validatePlayerAction(action, playerId) {
       // Anti-cheat validation
       const player = this.players.get(playerId);
       if (!this.isValidAction(action, player.state)) {
         this.flagSuspiciousActivity(playerId, action);
         return false;
       }
       return true;
     }
     
     broadcastGameState() {
       setInterval(() => {
         const gameState = this.generateStateSnapshot();
         this.broadcastToAllPlayers(gameState);
       }, 1000 / this.tickRate);
     }
   }
   ```

3. **Connection Management**:
   ```javascript
   class PlayerConnectionManager {
     handleDisconnection(playerId) {
       // Grace period for reconnection
       setTimeout(() => {
         if (!this.isPlayerReconnected(playerId)) {
           this.removePlayerFromGame(playerId);
         }
       }, 30000); // 30 second grace period
     }
     
     handleReconnection(playerId, newConnection) {
       // Restore player state and catch up
       this.restorePlayerState(playerId);
       this.sendStateCatchup(playerId, newConnection);
     }
   }
   ```

4. **Performance Optimizations**:
   - Use binary protocols (MessagePack/Protocol Buffers)
   - Implement interest management (only send relevant updates)
   - Use UDP for time-critical data, WebSocket for reliable data
   - Implement client-side prediction with server reconciliation

---

## Practical Challenge Questions

### Challenge 1: Chat System with Message History
Design a chat system that:
- Stores message history
- Supports offline message delivery
- Handles file attachments
- Implements message reactions

### Challenge 2: Live Data Dashboard
Create a real-time dashboard that:
- Shows live metrics from multiple sources
- Handles connection failures gracefully
- Implements data aggregation
- Supports historical data playback

### Challenge 3: Collaborative Whiteboard
Implement a shared whiteboard with:
- Real-time drawing synchronization
- Operational transformation for concurrent edits
- Undo/redo functionality
- Layer management

### Challenge 4: IoT Device Management
Build a system for managing IoT devices that:
- Handles device status updates
- Supports remote device control
- Implements device grouping
- Provides real-time monitoring

### Challenge 5: Live Video Chat Integration
Design WebSocket integration for video chat that handles:
- Signaling for WebRTC connections
- Room management
- User presence
- Screen sharing coordination

**Solutions:**

**Challenge 1:** Chat System Architecture:
```javascript
class ChatSystem {
  constructor() {
    this.messageStorage = new MessageStorage();
    this.onlineUsers = new Map();
    this.offlineMessageQueue = new Map();
  }
  
  async sendMessage(fromUserId, toUserId, message) {
    // Store message
    const storedMessage = await this.messageStorage.store({
      from: fromUserId,
      to: toUserId,
      message,
      timestamp: Date.now()
    });
    
    // Try to deliver immediately
    if (this.onlineUsers.has(toUserId)) {
      this.deliverMessage(toUserId, storedMessage);
    } else {
      // Queue for offline delivery
      this.queueOfflineMessage(toUserId, storedMessage);
    }
  }
  
  async handleUserOnline(userId) {
    this.onlineUsers.set(userId, { connectedAt: Date.now() });
    
    // Deliver queued messages
    const queuedMessages = this.offlineMessageQueue.get(userId) || [];
    for (const message of queuedMessages) {
      this.deliverMessage(userId, message);
    }
    this.offlineMessageQueue.delete(userId);
  }
}
```

**Challenge 3:** Collaborative Whiteboard:
```javascript
class CollaborativeWhiteboard {
  constructor() {
    this.strokes = [];
    this.version = 0;
    this.operationHistory = [];
  }
  
  applyOperation(operation, userId) {
    const transformedOp = this.transformOperation(operation);
    
    switch (transformedOp.type) {
      case 'draw':
        this.strokes.push({
          id: transformedOp.id,
          path: transformedOp.path,
          style: transformedOp.style,
          userId: userId,
          version: ++this.version
        });
        break;
        
      case 'erase':
        this.strokes = this.strokes.filter(stroke => 
          !this.strokeIntersectsPath(stroke, transformedOp.erasePath)
        );
        break;
    }
    
    this.operationHistory.push(transformedOp);
    return this.broadcastOperation(transformedOp);
  }
}
```