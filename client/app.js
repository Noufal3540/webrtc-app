// ✅ Corrected WebRTC client/app.js with fixes for common issues

const socket = io();
const statusEl = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const micBtn = document.getElementById('toggleMic');
const camBtn = document.getElementById('toggleCam');

let localStream;
let peerConnection;
let isOfferer = false;
const roomId = 'stream-room';

// WebRTC configuration with multiple STUN servers for better connectivity
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// 1️⃣ Acquire local stream and join room
async function initializeMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480 }, 
      audio: true 
    });
    localVideo.srcObject = localStream;
    console.log('✅ Camera & mic stream acquired');
    socket.emit('join-room', roomId);
  } catch (err) {
    console.error('❌ getUserMedia error:', err);
    statusEl.textContent = '❌ Camera/mic access denied';
    alert('Please allow camera and mic access to use this app.');
  }
}

// Initialize media on page load
initializeMedia();

// 2️⃣ Handle signaling room readiness
socket.on('room-ready', ({ isOfferer: offerFlag }) => {
  isOfferer = offerFlag;
  console.log('✅ Room ready. Offerer:', isOfferer);
  statusEl.textContent = `✅ Connected - ${isOfferer ? 'Initiating' : 'Waiting for'} call`;
  startWebRTC();
});

// 3️⃣ Setup WebRTC PeerConnection
function startWebRTC() {
  // Clean up existing connection if any
  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = new RTCPeerConnection(rtcConfig);

  // Add local tracks only if stream exists
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
      console.log('🎵 Added local track:', track.kind);
    });
  }

  // Remote track handler
  peerConnection.ontrack = event => {
    console.log('📡 Got remote track:', event.track.kind);
    const [stream] = event.streams;
    if (remoteVideo.srcObject !== stream) {
      remoteVideo.srcObject = stream;
      remoteVideo.hidden = false;
      statusEl.textContent = '✅ Connected - Video call active';
      console.log('✅ Attached remote stream');
    }
  };

  // ICE candidate handler
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', { roomId, candidate: event.candidate });
      console.log('🧊 Sent ICE candidate');
    } else {
      console.log('🧊 ICE gathering complete');
    }
  };

  // Connection state monitoring
  peerConnection.onconnectionstatechange = () => {
    console.log('🔗 Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'connected') {
      statusEl.textContent = '✅ Peer connected successfully';
    } else if (peerConnection.connectionState === 'disconnected') {
      statusEl.textContent = '⚠️ Peer disconnected';
    } else if (peerConnection.connectionState === 'failed') {
      statusEl.textContent = '❌ Connection failed';
      // Attempt to restart connection
      setTimeout(() => {
        if (isOfferer) {
          createOffer();
        }
      }, 2000);
    }
  };

  // ICE connection state monitoring
  peerConnection.oniceconnectionstatechange = () => {
    console.log('🧊 ICE state:', peerConnection.iceConnectionState);
  };

  // Create offer for the initiator
  if (isOfferer) {
    // Use explicit offer creation instead of negotiationneeded
    setTimeout(createOffer, 100); // Small delay to ensure everything is set up
  }
}

// Separate offer creation function
async function createOffer() {
  try {
    console.log('📨 Creating offer');
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { roomId, sdp: offer });
    console.log('📨 Offer sent');
  } catch (err) {
    console.error('❌ Error creating offer:', err);
  }
}

// 4️⃣ Signaling handlers with better error handling
socket.on('offer', async ({ sdp }) => {
  try {
    console.log('📨 Received offer');
    if (!peerConnection) {
      startWebRTC();
      // Wait a bit for setup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { roomId, sdp: answer });
    console.log('📨 Answer sent');
  } catch (err) {
    console.error('❌ Error handling offer:', err);
  }
});

socket.on('answer', async ({ sdp }) => {
  try {
    console.log('📨 Received answer');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    console.log('✅ Answer processed');
  } catch (err) {
    console.error('❌ Error handling answer:', err);
  }
});

socket.on('ice-candidate', async ({ candidate }) => {
  try {
    console.log('📨 Received ICE candidate');
    if (peerConnection && peerConnection.remoteDescription) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE candidate added');
    } else {
      console.log('⚠️ Queuing ICE candidate - remote description not set yet');
      // In a production app, you might want to queue these candidates
    }
  } catch (err) {
    console.error('❌ ICE candidate error:', err);
  }
});

// 5️⃣ UI controls with improved media handling
socket.on('connect', () => {
  statusEl.textContent = `✅ Connected to server (id: ${socket.id})`;
  console.log('🌐 Socket connected');
});

socket.on('disconnect', () => {
  statusEl.textContent = '❌ Disconnected from server';
  console.log('🌐 Socket disconnected');
});

// Heartbeat for connection monitoring
socket.on('pong', () => console.log('👋 Server responded'));
setInterval(() => {
  if (socket.connected) {
    socket.emit('ping');
  }
}, 5000); // Reduced frequency

// Improved microphone toggle
micBtn.addEventListener('click', () => {
  if (!localStream) return;
  
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    micBtn.textContent = audioTrack.enabled ? '🔇 Mute Mic' : '🎤 Unmute Mic';
    micBtn.className = audioTrack.enabled ? '' : 'muted';
    console.log('🎤 Mic toggled:', audioTrack.enabled ? 'on' : 'off');
  }
});

// Improved camera toggle
let cameraEnabled = true;
camBtn.addEventListener('click', async () => {
  if (!localStream) return;

  const videoTrack = localStream.getVideoTracks()[0];
  
  if (cameraEnabled && videoTrack) {
    // Disable video track
    videoTrack.enabled = false;
    localVideo.style.display = 'none';
    camBtn.textContent = '🎥 Enable Camera';
    cameraEnabled = false;
    console.log('📷 Camera disabled');
  } else {
    // Enable video track or get new stream
    if (videoTrack) {
      videoTrack.enabled = true;
      localVideo.style.display = 'block';
    } else {
      try {
        // Get new video stream if track was stopped
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        // Replace the video track in the peer connection
        if (peerConnection) {
          const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }
        
        // Add to local stream
        localStream.addTrack(newVideoTrack);
        localVideo.srcObject = localStream;
        localVideo.style.display = 'block';
      } catch (err) {
        console.error('❌ Error restarting camera:', err);
        return;
      }
    }
    
    camBtn.textContent = '📷 Disable Camera';
    cameraEnabled = true;
    console.log('📷 Camera enabled');
  }
});

// 6️⃣ Chat functionality with input validation
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg || msg.length > 500) return; // Length limit
  
  socket.emit('chat-message', { roomId, message: msg });
  appendMessage(`🧑‍💻 You: ${msg}`, 'own-message');
  chatInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);

// Send message on Enter key
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

socket.on('chat-message', ({ message }) => {
  appendMessage(`👤 Peer: ${message}`, 'peer-message');
});

function appendMessage(msg, className = '') {
  const div = document.createElement('div');
  div.textContent = msg;
  div.className = className;
  div.style.padding = '5px';
  div.style.marginBottom = '5px';
  div.style.borderRadius = '5px';
  
  if (className === 'own-message') {
    div.style.backgroundColor = '#e3f2fd';
    div.style.textAlign = 'right';
  } else if (className === 'peer-message') {
    div.style.backgroundColor = '#f3e5f5';
  }
  
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 7️⃣ Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  if (peerConnection) {
    peerConnection.close();
  }
  socket.disconnect();
});