const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

const SHEET_JSON_URL = "https://docs.google.com/spreadsheets/d/1nR24LNPAMOFw8jR-KHJmJgfwI-vCnh2_hl3_O4TF-X8/gviz/tq?tqx=out:json";

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message?.trim();
  if (!userMessage) return res.json({ reply: "❗ No message received." });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  try {
    const fetch = (await import("node-fetch")).default;

    // Fetch Sheet data
    const sheetRes = await fetch(SHEET_JSON_URL);
    const sheetText = await sheetRes.text();
    const jsonText = sheetText.replace(/^[^\(]*\(/, "").replace(/\);$/, "");
    const data = JSON.parse(jsonText);

    // Format FAQ
    const faqs = data.table.rows.map(row => ({
      question: row.c[0]?.v?.toLowerCase() || "",
      answer: row.c[1]?.v || "No answer available"
    }));

    // Match user input to FAQ using keyword similarity
    let matched = null;
    for (const faq of faqs) {
      const keywords = faq.question.split(" ");
      const matchCount = keywords.filter(k => userMessage.toLowerCase().includes(k)).length;
      if (matchCount >= 2) {
        matched = faq;
        break;
      }
    }

    if (matched) {
      return res.json({ reply: matched.answer });
    }

    // Fallback: ChatGPT
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a friendly and knowledgeable support assistant for Wzatco projector products. Answer clearly and helpfully.",
          },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const gptData = await gptRes.json();
    const botReply = gptData.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a helpful response.";
    res.json({ reply: botReply });

  } catch (error) {
    console.error("Error:", error);
    res.json({ reply: "⚠️ Error: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ UNODOER Bot server running at http://localhost:${PORT}`);
});
