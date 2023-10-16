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

const allSockets = {};
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

function handleUserCleanup(socketId) {
  // remove user from list
  Object.entries(users).forEach(([key, value]) => {
    if (key === socketId) delete users[key];
  });
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

  console.log("rooms after removing member");
  console.log(rooms);

  // if user was owner of any room, take action
  Object.entries(rooms).forEach(([key, value]) => {
    if (value["owner"] === socketId) {
      // if more users present, make next user as owner
      if (value["members"].length > 0) {
        value["owner"] = value["members"][0];
      }
      // if no users present, remove room
      else {
        delete rooms[key];
      }
    }
  });
}

// run when client connects
io.on("connection", (socket) => {
  console.log("New WS Connection...");

  console.log("-----ROOMS------");
  console.log(rooms);
  console.log("----USERS-------");
  console.log(users);

  // create room
  socket.on("createRoom", (ownerName) => {
    // generate a unique room code
    const roomCode = generateUniqueRoomCode();

    // add owner data to user list
    users[socket.id] = {
      userId: socket.id,
      userName: ownerName,
      ownerRoom: [roomCode],
      memberRoom: [roomCode],
    };

    // create a new room with the owner (current socket)
    rooms[roomCode] = { owner: socket.id, members: [socket.id] };

    // join room as owner
    socket.join(roomCode);

    allSockets[roomCode] = [];
    // store all sockets per room
    allSockets[roomCode].push(socket);

    // send roomCode + ownerName obj back
    const result = {
      roomCode: roomCode,
      userData: users[socket.id],
    };

    // Emit an event to the owner client to inform them about the room creation
    socket.emit("roomCreated", result);

    // console.log(rooms);
  });

  // join room
  socket.on("joinRoom", (joineeName, roomCodeInput) => {
    // if roomCode does not exist, return
    if (!(roomCodeInput in rooms)) return;

    // add user data to user list
    users[socket.id] = {
      userId: socket.id,
      userName: joineeName,
      ownerRoom: [],
      memberRoom: [roomCodeInput],
    };

    // join user to room
    rooms[roomCodeInput]["members"].push(socket.id);

    // store all sockets per room
    allSockets[roomCodeInput].push(socket);

    const userList = [];

    Object.entries(users).forEach(([key, value]) => {
      if (value["memberRoom"].includes(roomCodeInput)) {
        userList.push(value);
      }
    });

    // send roomCode + userList back
    const result = {
      roomCode: roomCodeInput,
      userList,
      joineeName,
    };

    // join room as user
    socket.join(roomCodeInput);

    // const roomSockets = allSockets[roomCodeInput];

    // console.log("------ALL SOCKETS-----");
    // console.log(allSockets);

    // if (roomSockets) {
    //   roomSockets.forEach((client) => {
    //     client.emit("roomJoined", result);
    //   });
    // }

    // emit an event to everyone in same room
    // io.to(roomCodeInput).emit("roomJoined", result);
    io.emit("roomJoined", result);

    // Emit an event to the owner client to inform them about the room creation
    // socket.emit("roomJoined", result);

    // console.log(rooms);
  });

  // welcome current user
  socket.emit("message", "Welcome to Chatroom");

  // broadcast when a user connects
  socket.broadcast.emit("message", "A user has joined the chat");

  // runs when client disconnects
  socket.on("disconnect", () => {
    console.log(`${socket.id} has left the chat`);

    console.log("DISCONNECTED");

    handleRoomCleanup(socket.id);

    if (users[socket.id]) {
      io.emit("roomLeft", socket.id, users[socket.id].userName);
    }

    handleUserCleanup(socket.id);
  });
});

const PORT = 3000 || process.env.PORT;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
