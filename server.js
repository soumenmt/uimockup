const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { OpenAI } = require("openai");  // Correct import for the latest OpenAI package
const puppeteer = require("puppeteer");
const { v4: uuidv4 } = require("uuid");
require('dotenv').config();
const puppeteer = require('puppeteer-core');


const app = express();
const PORT = process.env.PORT;
app.use(bodyParser.json());
app.use("/static", express.static("static")); // serve images

// OpenAI Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // replace with your key
});

// Utility: extract code blocks
function extractBlock(text, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const match = regex.exec(text);
  return match ? match[1] : "";
}

app.get("/", async (req, res) => {
  res.status(200).json({ status: 'mockup generation connected successfully.' });
});
// API endpoint
app.post("/generate-ui-mockup", async (req, res) => {
  const { prompt } = req.body;

  try {
    // 1. Prompt → HTML/CSS via GPT
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: `Generate minimal HTML and CSS for this UI: "${prompt}". Return HTML and CSS inside <html> and <style> tags.`,
        },
      ],
    });

    const content = gptResponse.choices[0].message.content;
    const htmlPart = extractBlock(content, "html");
    const cssPart = extractBlock(content, "style");
    const fullHtml = `
      <html>
        <head><style>${cssPart}</style></head>
        <body>${htmlPart}</body>
      </html>
    `;

    // 2. Render HTML → Image via Puppeteer
    const imageId = uuidv4();
    const imagePath = `static/${imageId}.png`;

    //const puppeteer = require('puppeteer-core');

    const browser = await puppeteer.launch({
      executablePath: '/app/.apt/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setContent(fullHtml);
    await page.setViewport({ width: 400, height: 600 });
    await page.screenshot({ path: imagePath });
    await browser.close();

    // 3. Send response
    res.json({
      image_url: `http://localhost:${PORT}/${imagePath}`,
      html: htmlPart,
      css: cssPart,
    });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Ensure 'static' folder exists
if (!fs.existsSync("static")) fs.mkdirSync("static");

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
