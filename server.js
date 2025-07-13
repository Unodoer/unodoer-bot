const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Replace with your published Google Sheet JSON URL
const SHEET_JSON_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSsE8ko-FUw7yfzkEwXvBm2aGSrpTRk2UCnX-bkLKR0uEBNVWoKHqLNOF8fRjz8FYvtOlrL6xdbv3N7/gviz/tq?tqx=out:json";

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.json({ reply: "❗ No message received." });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  try {
    const fetch = (await import("node-fetch")).default;

    // 📊 Fetch data from your Google Sheet (FAQs)
    const sheetRes = await fetch(SHEET_JSON_URL);
    const sheetText = await sheetRes.text();
    const jsonText = sheetText.replace(/^.*?\(/, "").replace(/\);$/, "");
    const data = JSON.parse(jsonText);

    const faqs = data.table.rows.map(row => ({
      question: row.c[0]?.v?.toLowerCase() || "",
      answer: row.c[1]?.v || "No answer available"
    }));

    // 🔍 Try to match the user's message to a question
    const matched = faqs.find(faq =>
      userMessage.toLowerCase().includes(faq.question)
    );

    if (matched) {
      return res.json({ reply: matched.answer });
    }

    // 💡 If not found in sheet, ask ChatGPT
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
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

    const gptData = await gptRes.json();
    const botReply = gptData.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
    res.json({ reply: botReply });

  } catch (error) {
    res.json({ reply: "⚠️ Error: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ UNODOER Bot server running at http://localhost:${PORT}`);
});
