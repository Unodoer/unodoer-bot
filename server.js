// server.js
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Environment Variables (set in .env or hardcoded for testing)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "wzatco"
};

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

// ✅ Main Chat Endpoint
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message?.trim();
  if (!userMessage) {
    return res.status(400).json({ reply: "❗ Please send a message." });
  }

  try {
    const db = await mysql.createConnection(DB_CONFIG);

    // 🔍 Try to fetch knowledge base from MySQL
    const [rows] = await db.execute(
      "SELECT content FROM knowledge_base ORDER BY updated_at DESC LIMIT 1"
    );
    await db.end();

    let knowledgeBase = rows?.[0]?.content || "";

    // ✅ Try to match message in KB content (simple match)
    if (knowledgeBase.toLowerCase().includes(userMessage.toLowerCase())) {
      return res.json({ reply: knowledgeBase });
    }

  } catch (dbError) {
    console.error("❗ DB error:", dbError.message);
    // Continue to OpenAI fallback
  }

  // 💬 Fallback: OpenAI ChatGPT
  try {
    const fetch = (await import("node-fetch")).default;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful support bot for WZATCO projectors." },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
      }),
    });

    const data = await gptRes.json();
    const reply = data.choices?.[0]?.message?.content || "I'm not sure how to help with that.";

    res.json({ reply });

  } catch (aiError) {
    console.error("❗ OpenAI error:", aiError.message);
    res.status(500).json({ reply: "⚠️ Sorry, something went wrong." });
  }
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`🤖 UNODOER JS Bot running at http://localhost:${PORT}`);
});
