const express = require("express");
const admin = require("firebase-admin");
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://test-project-d79ab.firebaseio.com",
});

const db = admin.firestore();

// Listener for real-time updates
db.collection("notifications").onSnapshot((snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
      const notification = change.doc.data();
      console.log("New notification:", notification);
      // In a real app, you might broadcast the notification to clients
    }
  });
});

// Endpoint to send a notification to Firestore
app.post("/send-notification", express.json(), async (req, res) => {
  try {
    const { userId, message } = req.body;

    // Save notification in Firestore
    await db.collection("notifications").add({
      userId,
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send("Notification sent!");
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).send("Error sending notification");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
