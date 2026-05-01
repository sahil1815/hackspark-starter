const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8004;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/rentpi';

app.get('/status', (req, res) => {
  res.json({ status: "OK" });
});

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

const Chat = mongoose.model('Chat', new mongoose.Schema({
  sessionId: String, role: String, content: String, createdAt: { type: Date, default: Date.now }
}));

// ৩. জেমিনি সেটআপ (মডেল: gemini-pro - যা সব API Key তে কাজ করে)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash", // <--- THE ULTIMATE FIX
  tools: [{
    functionDeclarations: [{
      name: "check_product_availability",
      description: "Check if a product is available for rent today.",
      parameters: { type: "OBJECT", properties: { productId: { type: "NUMBER" } }, required: ["productId"] }
    }]
  }]
});

app.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    if (!sessionId || !message) return res.status(400).json({ error: "Missing data" });

    await Chat.create({ sessionId, role: 'user', content: message });

    const chatSession = model.startChat();
    
    // System instruction injected directly into the prompt to avoid SDK conflicts
    const prompt = `You are RentPi's assistant. You MUST use the check_product_availability tool if asked about availability. User says: ${message}`;
    
    let result = await chatSession.sendMessage(prompt);
    let response = result.response;

    const part = response.candidates[0]?.content?.parts?.find(p => p.functionCall);
    
    if (part) {
      const functionCall = part.functionCall;
      if (functionCall.name === "check_product_availability") {
        const pId = functionCall.args.productId;
        console.log(`[Tool] Checking availability for: ${pId}`);

        const rServiceUrl = process.env.RENTAL_SERVICE_URL || 'http://rental-service:8002';
        const today = new Date().toISOString().split('T')[0];
        
        let statusText = "currently unavailable";
        try {
          const { data } = await axios.get(`${rServiceUrl}/rentals/products/${pId}/availability?from=${today}&to=${today}`);
          statusText = data.available ? "available for rent today" : "booked or unavailable today";
        } catch (e) {
          console.error("Rental Service call failed");
          statusText = "status unknown due to a connection issue";
        }

        result = await chatSession.sendMessage([{
          functionResponse: {
            name: "check_product_availability",
            response: { result: statusText }
          }
        }]);
        response = result.response;
      }
    }

    let reply = "";
    try {
      reply = response.text();
      // Clean up the prompt injection from the reply if Gemini repeats it
      reply = reply.replace("You are RentPi's assistant. ", "");
    } catch (e) {
      reply = "I've checked the database. The item is " + (statusText || "status unknown") + ".";
    }

    await Chat.create({ sessionId, role: 'model', content: reply });
    res.json({ sessionId, reply });

  } catch (error) {
    console.error("Detailed Chat Error:", error.message);
    res.status(500).json({ error: "Chat Error", details: error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Agentic Service on port ${PORT}`));