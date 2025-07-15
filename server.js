// server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Config
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "wzatco"
};

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

// ✅ POST /chat endpoint
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message?.trim();
  if (!userMessage) {
    return res.status(400).json({ reply: "❗ Please send a message." });
  }

  // ✅ Casual direct replies (like "hi", "how are you", etc.)
  const casualReplies = {
    "how are you": "I'm doing well, thank you! 😊 Hope you're doing great too. How can I help you today?",
    "hi": "Hi there! 👋 How can I assist you with your Wzatco projector?",
    "hello": "Hello! 😊 How can I support you today?",
    "ok": "Alright! Let me know if you need anything.",
    "thanks": "You're welcome! Let me know if you need anything else.",
    "thank you": "You're welcome! Happy to help 😊",
  };

  const lowerMsg = userMessage.toLowerCase();
  if (casualReplies[lowerMsg]) {
    return res.json({ reply: casualReplies[lowerMsg] });
  }

  // ✅ Try to get response from knowledge base (MySQL)
  try {
    const db = await mysql.createConnection(DB_CONFIG);
    const [rows] = await db.execute(
      "SELECT content FROM knowledge_base ORDER BY updated_at DESC LIMIT 1"
    );
    await db.end();

    const knowledgeBase = rows?.[0]?.content || "";
    if (knowledgeBase.toLowerCase().includes(lowerMsg)) {
      return res.json({ reply: knowledgeBase });
    }
  } catch (dbError) {
    console.error("❗ DB error:", dbError.message);
    // Continue to fallback
  }

  // ✅ Fallback to OpenAI ChatGPT
  try {
    const fetch = (await import("node-fetch")).default;
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
  model: "gpt-3.5-turbo",
  messages: [
    {
  role: "system",
  content: `You are UNODOER, the official multilingual support assistant for WZATCO projectors. Always introduce yourself as UNODOER. Automatically detect the user's language and reply in the same language, but prefer English if unsure. Be natural, kind, and helpful — like a real person. 
If the user asks for the WZATCO office address, reply with:
"The WZATCO head office is located in bengaluru"`
}

    {
      role: "user",
      content: userMessage
    }
  ],
  temperature: 0.7
})

    });

    const data = await gptRes.json();
    const reply = data.choices?.[0]?.message?.content || "I'm not sure how to help with that.";

    res.json({ reply });

  } catch (aiError) {
    console.error("❗ OpenAI error:", aiError.message);
    res.status(500).json({ reply: "⚠️ Sorry, something went wrong while connecting to ChatGPT." });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🤖 UNODOER JS Bot running at http://localhost:${PORT}`);
});
