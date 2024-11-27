const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Example endpoint to send a notification
app.post("/notify", (req, res) => {
  const { message, recipient } = req.body;
  // Handle the logic for sending the notification
  res.send(`Notification sent to ${recipient}: ${message}`);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
