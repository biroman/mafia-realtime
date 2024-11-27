const express = require("express");
const admin = require("firebase-admin");
const WebSocket = require("ws"); // WebSocket library
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://test-project-d79ab.firebaseio.com",
});

const db = admin.firestore();

// Initialize WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// List of connected WebSocket clients
const clients = [];

// Add WebSocket connection handler
wss.on("connection", (ws) => {
  clients.push(ws);
  console.log("New WebSocket client connected");

  // Remove client from list when disconnected
  ws.on("close", () => {
    const index = clients.indexOf(ws);
    if (index > -1) {
      clients.splice(index, 1);
      console.log("WebSocket client disconnected");
    }
  });
});

// Listener for real-time updates from Firestore
db.collection("notifications").onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
      const notification = change.doc.data();
      console.log("New notification:", notification);

      // Broadcast the notification to all connected WebSocket clients
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(notification));
        }
      });
    }
  });
});

app.post("/send-notification", express.json(), async (req, res) => {
  try {
    const { userId, city, correctCity, message } = req.body;

    // Save notification in Firestore
    const docRef = await db.collection("notifications").add({
      userId,
      city,
      correctCity,
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Broadcast the notification to all connected WebSocket clients
    const notification = {
      userId,
      city,
      correctCity,
      message,
    };

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(notification));
      }
    });

    res.status(200).send("Notification sent!");
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).send("Error sending notification");
  }
});

// Upgrade HTTP server to support WebSocket connections
app.server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle WebSocket upgrade requests
app.server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
