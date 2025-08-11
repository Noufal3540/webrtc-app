const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store room information
const rooms = new Map();

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});
app.use(express.static(path.join(__dirname, '../client')));

// Room-based signaling and chat
io.on('connection', socket => {
  console.log('🔌 A client connected:', socket.id);

  // Ping/pong test
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Join a WebRTC room with proper role assignment
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        clients: [],
        createdAt: Date.now()
      });
    }
    
    const room = rooms.get(roomId);
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    
    console.log(`👤 ${socket.id} joined room: ${roomId} (${clients.length} total clients)`);
    
    // Store socket in room data
    if (!room.clients.find(client => client.id === socket.id)) {
      room.clients.push({
        id: socket.id,
        joinedAt: Date.now()
      });
    }

    if (clients.length === 1) {
      // First person in room - they will be the receiver
      socket.emit('room-ready', { isOfferer: false });
      console.log(`📋 ${socket.id} is waiting for another peer`);
    } else if (clients.length === 2) {
      // Second person joins - they become the offerer
      socket.emit('room-ready', { isOfferer: true });
      
      // Notify the first person that room is ready
      const firstClient = room.clients[0];
      if (firstClient && firstClient.id !== socket.id) {
        socket.to(firstClient.id).emit('room-ready', { isOfferer: false });
      }
      
      console.log(`🤝 Room ${roomId} is ready for WebRTC connection`);
    } else {
      // Room is full
      socket.emit('room-full', { message: 'Room is full. Maximum 2 participants allowed.' });
      socket.leave(roomId);
      console.log(`🚫 ${socket.id} rejected - room ${roomId} is full`);
    }
  });

  // WebRTC signaling with proper data forwarding
  socket.on('offer', (data) => {
    console.log(`📨 Forwarding offer from ${socket.id} to room ${data.roomId}`);
    // Forward the complete data object, not just SDP
    socket.to(data.roomId).emit('offer', { sdp: data.sdp });
  });

  socket.on('answer', (data) => {
    console.log(`📨 Forwarding answer from ${socket.id} to room ${data.roomId}`);
    // Forward the complete data object, not just SDP
    socket.to(data.roomId).emit('answer', { sdp: data.sdp });
  });

  socket.on('ice-candidate', (data) => {
    console.log(`🧊 Forwarding ICE candidate from ${socket.id} to room ${data.roomId}`);
    // Forward the complete candidate object
    socket.to(data.roomId).emit('ice-candidate', { candidate: data.candidate });
  });

  // 💬 Chat messaging with sender info
  socket.on('chat-message', ({ roomId, message }) => {
    console.log(`💬 Chat message in room ${roomId}: ${message}`);
    // Forward message to other clients in the room
    socket.to(roomId).emit('chat-message', { 
      message,
      senderId: socket.id,
      timestamp: Date.now()
    });
  });

  // Handle user leaving room explicitly
  socket.on('leave-room', (roomId) => {
    handleUserLeaving(socket, roomId);
  });

  // Handle disconnects
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    
    // Clean up user from all rooms
    for (const [roomId, room] of rooms.entries()) {
      const clientIndex = room.clients.findIndex(client => client.id === socket.id);
      if (clientIndex !== -1) {
        room.clients.splice(clientIndex, 1);
        
        // Notify other clients in the room about the disconnect
        socket.to(roomId).emit('peer-disconnected', { 
          peerId: socket.id,
          message: 'Your peer has disconnected'
        });
        
        console.log(`🚪 ${socket.id} left room ${roomId}`);
        
        // Clean up empty rooms
        if (room.clients.length === 0) {
          rooms.delete(roomId);
          console.log(`🗑️ Deleted empty room: ${roomId}`);
        }
        break;
      }
    }
  });

  // Handle room leaving
  function handleUserLeaving(socket, roomId) {
    socket.leave(roomId);
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const clientIndex = room.clients.findIndex(client => client.id === socket.id);
      
      if (clientIndex !== -1) {
        room.clients.splice(clientIndex, 1);
        
        // Notify remaining clients
        socket.to(roomId).emit('peer-left', {
          peerId: socket.id,
          message: 'Your peer has left the room'
        });
        
        console.log(`👋 ${socket.id} left room ${roomId}`);
        
        // Clean up empty rooms
        if (room.clients.length === 0) {
          rooms.delete(roomId);
          console.log(`🗑️ Deleted empty room: ${roomId}`);
        }
      }
    }
  }
});

// Periodic cleanup of old empty rooms (optional)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [roomId, room] of rooms.entries()) {
    if (room.clients.length === 0 && (now - room.createdAt) > maxAge) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up old empty room: ${roomId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Error handling
server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

io.on('error', (err) => {
  console.error('❌ Socket.IO error:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`🌐 Access the app at: http://localhost:${PORT}`);
});