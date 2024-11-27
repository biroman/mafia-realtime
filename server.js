const express = require("express");
const cors = require("cors"); // Import the CORS package
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

// Enable CORS for your frontend URL (in this case https://mafiaspillet.no)
const corsOptions = {
  origin: "https://mafiaspillet.no", // Replace this with your frontend URL
  methods: "GET,POST", // Allow the methods that your frontend will use
  allowedHeaders: "Content-Type", // Allow the necessary headers
};

app.use(cors(corsOptions)); // Enable CORS with the specified options

// Initialize WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Map to store clients with their senderId
const clients = new Map();

wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");

  // Temporarily add the client with a null senderId
  clients.set(ws, null);

  // Listen for a message to register the client's senderId
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      if (data.senderId) {
        clients.set(ws, data.senderId); // Update the senderId for this client
        console.log(`Registered client with senderId: ${data.senderId}`);
      }
    } catch (error) {
      console.error("Invalid message received:", message);
    }
  });

  // Handle WebSocket disconnection
  ws.on("close", () => {
    clients.delete(ws); // Remove the client from the Map
    console.log("WebSocket client disconnected");
  });
});

// Listener for real-time updates from Firestore
db.collection("notifications").onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
      const notification = change.doc.data();
      console.log("New notification:", notification);

      // Broadcast the notification to all connected WebSocket clients
      clients.forEach((clientSenderId, client) => {
        console.log(`Attempting to send to client: ${clientSenderId}`);
        if (
          client.readyState === WebSocket.OPEN &&
          clientSenderId !== notification.senderId
        ) {
          console.log(`Sending notification to client: ${clientSenderId}`);
          client.send(JSON.stringify(notification));
        }
      });
    }
  });
});

// Endpoint to send a notification to Firestore
app.post("/send-notification", express.json(), async (req, res) => {
  try {
    const { senderId, user, city, correctCity } = req.body;

    // Ensure all required fields are provided
    if (!senderId || !user || !city || correctCity === undefined) {
      return res.status(400).send("Missing required fields");
    }

    // Save notification in Firestore with the updated structure
    await db.collection("notifications").add({
      senderId, // The sender of the notification
      user, // The user who receives the notification
      city, // The city mentioned in the notification
      correctCity, // Whether the city is correct or not
      timestamp: admin.firestore.FieldValue.serverTimestamp(), // Timestamp for when the notification was created
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
