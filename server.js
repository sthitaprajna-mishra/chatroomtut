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

// run when client connects
io.on("connection", (socket) => {
  console.log("New WS Connection...");

  socket.emit("message", "Welcome to Chatroom");
});

const PORT = 3000 || process.env.PORT;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
