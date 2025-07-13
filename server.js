const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

// ✅ Replace with your actual published sheet URL
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSsE8ko-FUw7yfzkEwXvBm2aGSrpTRk2UCnX-bkLKR0uEBNVWoKHqLNOF8fRjz8FYvtOlrL6xdbv3N7/pubhtml";

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.json({ reply: "No message received." });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  try {
    const fetch = (await import("node-fetch")).default;

    // Step 1: Try to fetch from Sheet
    const sheetRes = await fetch(SHEET_URL);
    const faqData = await sheetRes.json();

    // Find a match from the sheet (simple contains check)
    const matched = faqData.find(row => {
      const question = row.Question?.toLowerCase() || "";
      return userMessage.toLowerCase().includes(question);
    });

    if (matched && matched.Answer) {
      return res.json({ reply: matched.Answer });
    }

    // Step 2: If no match, ask ChatGPT
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful support assistant for Wzatco projectors." },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const aiData = await aiRes.json();
    const botReply = aiData.choices?.[0]?.message?.content || "Sorry, I didn't understand that.";
    res.json({ reply: botReply });

  } catch (err) {
    res.json({ reply: "⚠️ Error: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
