const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

// In-memory session tracking
const sessions = {};

// ✅ Google Sheet Setup
const SHEET_ID = "1nR24LNPAMOFw8jR-KHJmJgfwI-vCnh2_hl3_O4TF-X8";
const doc = new GoogleSpreadsheet(SHEET_ID);
const creds = require("./credentials.json"); // service account JSON in project folder

// ✅ Email Setup (iCloud)
const transporter = nodemailer.createTransport({
  service: "iCloud",
  auth: {
    user: "unodoer@icloud.com",
    pass: "plovbbjmvfdipqpy"
  }
});

// ✅ Bot Questions
const steps = [
  "🎫 Please enter the ticket subject:",
  "🔼 What is the priority? (Low / Medium / High)",
  "🗂️ Select a category: Hardware / Software / Other",
  "🙍‍♂️ Your full name?",
  "📱 Your phone number?",
  "🛒 Where did you purchase it from? (Amazon / Flipkart / Other)",
  "🧾 Order number (if any)?",
  "📝 Describe your issue in detail:",
  "📎 Paste file link (or type 'done' to skip):"
];

// ✅ Main Chat Endpoint
app.post("/chat", async (req, res) => {
  const userInput = req.body.message.trim();
  const sessionId = "user"; // For now using one session

  if (!sessions[sessionId]) {
    sessions[sessionId] = { step: 0, data: {} };
  }

  const session = sessions[sessionId];
  const step = session.step;
  const data = session.data;

  switch (step) {
    case 0: data.subject = userInput; break;
    case 1: data.priority = userInput; break;
    case 2: data.category = userInput; break;
    case 3: data.name = userInput; break;
    case 4: data.phone = userInput; break;
    case 5: data.purchasedFrom = userInput; break;
    case 6: data.orderNo = userInput; break;
    case 7: data.description = userInput; break;
    case 8: data.file = userInput.toLowerCase() === "done" ? "No file" : userInput; break;
  }

  // Ask next question
  if (step < steps.length - 1) {
    session.step++;
    return res.json({ reply: steps[session.step] });
  }

  // ✅ Submit to Google Sheet + Send Email
  try {
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Tickets"];
    await sheet.addRow({
      "Ticket Subject": data.subject,
      "Priority": data.priority,
      "Category": data.category,
      "Name": data.name,
      "Phone": data.phone,
      "Purchased From": data.purchasedFrom,
      "Order No.": data.orderNo,
      "Description": data.description,
      "File URL": data.file,
      "Timestamp": new Date().toLocaleString()
    });

    await transporter.sendMail({
      from: "unodoer@icloud.com",
      to: "support@wzatco.com",
      subject: "🆕 New WZATCO Ticket Submitted",
      html: `
        <h2>New Ticket Submitted</h2>
        <p><b>Subject:</b> ${data.subject}</p>
        <p><b>Priority:</b> ${data.priority}</p>
        <p><b>Category:</b> ${data.category}</p>
        <p><b>Name:</b> ${data.name}</p>
        <p><b>Phone:</b> ${data.phone}</p>
        <p><b>Purchased From:</b> ${data.purchasedFrom}</p>
        <p><b>Order No.:</b> ${data.orderNo}</p>
        <p><b>Description:</b><br>${data.description}</p>
        <p><b>File:</b> ${data.file}</p>
        <hr>
        <p>Submitted at: ${new Date().toLocaleString()}</p>
      `
    });

    delete sessions[sessionId];

    return res.json({ reply: "✅ Your ticket has been submitted successfully. Our support team will contact you soon." });

  } catch (err) {
    console.error("❌ Ticket Submit Error:", err.message);
    return res.json({ reply: "⚠️ Ticket submit failed. Please try again later." });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 UNODOER Ticket Bot is running at http://localhost:${PORT}`);
});

