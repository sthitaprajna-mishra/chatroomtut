const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const cors = require("cors"); // Import the CORS middleware

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Enable CORS only for the specific origin (your React app's origin)
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

const rooms = {};
const users = {}; // Dictionary to store user information and their rooms

function generateUniqueRoomCode() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const codeLength = 6; // Adjust the length of the room code as needed

  let roomCode;
  let isUnique = false;

  // Keep generating room codes until a unique one is found
  while (!isUnique) {
    roomCode = "";

    for (let i = 0; i < codeLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      roomCode += characters.charAt(randomIndex);
    }

    // Check if the generated code is unique
    if (!rooms[roomCode]) {
      isUnique = true;
    }
  }

  return roomCode;
}

function handleRoomCleanup(socketId) {
  // remove user from all rooms
  Object.entries(rooms).forEach(([key, value]) => {
    if (value["members"].includes(socketId)) {
      value["members"] = value["members"].filter(
        (memberId) => memberId !== socketId
      );
    }
  });

  // if user was owner of any room, take action
  Object.entries(rooms).forEach(([key, value]) => {
    if (value["owner"] === socketId) {
      // if more users present, make next user as owner
      if (value["members"].length > 0) {
        value["owner"] = value["members"][0];
      }
      // if no users present, remove room
      delete rooms[key];
    }
  });
}

// run when client connects
io.on("connection", (socket) => {
  console.log("New WS Connection...");

  // create room
  socket.on("createRoom", (ownerName) => {
    // generate a unique room code
    const roomCode = generateUniqueRoomCode();

    // add owner data to user list
    users[socket.id] = ownerName;

    // create a new room with the owner (current socket)
    rooms[roomCode] = { owner: socket.id, members: [socket.id] };

    // join room as owner
    socket.join(roomCode);

    // send roomCode + ownerName obj back
    const result = {
      roomCode: roomCode,
      userData: {
        userId: socket.id,
        userName: users[socket.id],
      },
    };

    // Emit an event to the owner client to inform them about the room creation
    socket.emit("roomCreated", result);

    console.log(rooms);
  });

  // welcome current user
  socket.emit("message", "Welcome to Chatroom");

  // broadcast when a user connects
  socket.broadcast.emit("message", "A user has joined the chat");

  // runs when client disconnects
  socket.on("disconnect", () => {
    console.log(`${socket.id} has left the chat`);
    handleRoomCleanup(socket.id);
    io.emit("message", "A user has left the chat");
  });
});

const PORT = 3000 || process.env.PORT;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
