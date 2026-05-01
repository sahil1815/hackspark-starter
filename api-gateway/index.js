const express = require('express');
const axios = require('axios');
const proxy = require('express-http-proxy');
const app = express();
const PORT = process.env.PORT || 8000;

// P1: Health Checks
const services = {
  "user-service": "http://user-service:8001/status",
  "rental-service": "http://rental-service:8002/status",
  "analytics-service": "http://analytics-service:8003/status",
  "agentic-service": "http://agentic-service:8004/status"
};

app.get('/status', async (req, res) => {
  const downstream = {};
  const requests = Object.entries(services).map(async ([name, url]) => {
    try {
      const response = await axios.get(url, { timeout: 2000 });
      downstream[name] = response.data.status;
    } catch (error) {
      downstream[name] = "UNREACHABLE";
    }
  });

  await Promise.all(requests);
  res.json({ service: "api-gateway", status: "OK", downstream });
});


// P2: Proxy /users routes to user-service
app.use('/users', proxy('http://user-service:8001', {
  proxyReqPathResolver: (req) => {
    return '/users' + req.url;
  }
}));

// P3: Proxy /rentals routes to rental-service
app.use('/rentals', proxy('http://rental-service:8002', {
  proxyReqPathResolver: (req) => {
    return '/rentals' + req.url;
  }
}));

// P11: Proxy /analytics routes to analytics-service
app.use('/analytics', proxy('http://analytics-service:8003', {
  proxyReqPathResolver: (req) => {
    return '/analytics' + req.url;
  }
}));

// P15: Proxy /chat routes to agentic-service
app.use('/chat', proxy('http://agentic-service:8004', {
  proxyReqPathResolver: (req) => {
    return '/chat' + req.url;
  }
}));

app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));