const express = require('express');
const axios = require('axios');
// Consolidated date-fns imports for all analytics algorithms
const { parseISO, differenceInDays, addDays, format, subYears, subDays, isBefore, isAfter } = require('date-fns');

const app = express();
const PORT = process.env.PORT || 8003;

const CENTRAL_API_URL = process.env.CENTRAL_API_URL;
const CENTRAL_API_TOKEN = process.env.CENTRAL_API_TOKEN;

if (!CENTRAL_API_URL || !CENTRAL_API_TOKEN) {
    console.error("CRITICAL ERROR: Central API URL or Token is missing in environment variables.");
}

const centralApi = axios.create({
  baseURL: CENTRAL_API_URL,
  headers: { 'Authorization': `Bearer ${CENTRAL_API_TOKEN}` }
});

// P1: Health Check
app.get('/status', (req, res) => {
  res.json({ service: "analytics-service", status: "OK" });
});

// P11: GET /analytics/peak-window (Sliding Window Algorithm)
app.get('/analytics/peak-window', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) return res.status(400).json({ error: "Missing 'from' or 'to'" });

    const startDate = new Date(from + "-01");
    const [toYear, toMonth] = to.split('-');
    const endDate = new Date(toYear, parseInt(toMonth), 0); 

    if (startDate > endDate) return res.status(400).json({ error: "'from' must not be after 'to'" });

    const monthsToFetch = [];
    let currentMonthDate = new Date(startDate);
    currentMonthDate.setDate(1); 

    while (currentMonthDate <= endDate) {
      monthsToFetch.push(format(currentMonthDate, 'yyyy-MM'));
      currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    }

    const statsRequests = monthsToFetch.map(month => 
      centralApi.get('/api/data/rentals/stats', { params: { group_by: 'date', month } })
    );

    const responses = await Promise.all(statsRequests);
    const rawData = responses.flatMap(r => r.data.data);

    const dataMap = {};
    rawData.forEach(item => {
      const safeDate = typeof item.date === 'string' ? item.date.split('T')[0] : item.date;
      const countValue = Number(item.count) || Number(item.rental_count) || 0;
      dataMap[safeDate] = countValue;
    });

    const timelineArray = [];
    let loopDate = new Date(startDate);
    while (loopDate <= endDate) {
      const dateStr = format(loopDate, 'yyyy-MM-dd');
      timelineArray.push({ date: dateStr, count: dataMap[dateStr] || 0 });
      loopDate = addDays(loopDate, 1);
    }

    let maxRentals = 0, maxWindowStartIdx = 0, currentSum = 0;
    for (let i = 0; i < 7; i++) currentSum += timelineArray[i].count;
    maxRentals = currentSum;

    for (let i = 7; i < timelineArray.length; i++) {
      currentSum = currentSum - timelineArray[i - 7].count + timelineArray[i].count;
      if (currentSum > maxRentals) {
        maxRentals = currentSum;
        maxWindowStartIdx = i - 6;
      }
    }

    res.json({
      from, to,
      peakWindow: {
        from: timelineArray[maxWindowStartIdx].date,
        to: timelineArray[maxWindowStartIdx + 6].date,
        totalRentals: maxRentals
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate peak window" });
  }
});

// P13: GET /analytics/surge-days (Monotonic Stack Algorithm)
app.get('/analytics/surge-days', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Invalid 'month' format. Use YYYY-MM" });

    const response = await centralApi.get('/api/data/rentals/stats', { params: { group_by: 'date', month } });
    const rawData = response.data.data;

    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    
    const dataMap = {};
    rawData.forEach(item => {
      const safeDate = typeof item.date === 'string' ? item.date.split('T')[0] : item.date;
      dataMap[safeDate] = Number(item.count) || Number(item.rental_count) || 0;
    });

    const dailyCounts = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      dailyCounts.push({ date: dateStr, count: dataMap[dateStr] || 0, nextSurgeDate: null, daysUntil: null });
    }

    const stack = [];
    for (let i = 0; i < dailyCounts.length; i++) {
      while (stack.length > 0 && dailyCounts[i].count > dailyCounts[stack[stack.length - 1]].count) {
        const prevIndex = stack.pop();
        dailyCounts[prevIndex].nextSurgeDate = dailyCounts[i].date;
        dailyCounts[prevIndex].daysUntil = i - prevIndex;
      }
      stack.push(i);
    }

    res.json({ month, data: dailyCounts });
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate surge days" });
  }
});

// P14: GET /analytics/recommendations (Seasonal Window Algorithm)
app.get('/analytics/recommendations', async (req, res) => {
  try {
    const { date, limit } = req.query;
    const limitNum = parseInt(limit) || 10;

    if (!date || isNaN(Date.parse(date))) return res.status(400).json({ error: "Invalid date" });

    const targetDate = new Date(date);
    const rentalCounts = {}; 

    const fetchPromises = [1, 2].flatMap(yearOffset => {
      const yearDate = subYears(targetDate, yearOffset);
      const windowStart = format(subDays(yearDate, 7), 'yyyy-MM-dd');
      const windowEnd = format(addDays(yearDate, 7), 'yyyy-MM-dd');

      return centralApi.get('/api/data/rentals', { params: { from: windowStart, to: windowEnd, limit: 100 } });
    });

    const responses = await Promise.all(fetchPromises);
    responses.forEach(response => {
      response.data.data.forEach(rental => {
        rentalCounts[rental.productId] = (rentalCounts[rental.productId] || 0) + 1;
      });
    });

    const topProductEntries = Object.entries(rentalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitNum);

    if (topProductEntries.length === 0) return res.json({ date, recommendations: [] });

    const topProductIds = topProductEntries.map(entry => entry[0]);
    const productDetailsResponse = await centralApi.get('/api/data/products/batch', { params: { ids: topProductIds.join(',') } });
    
    const detailsMap = {};
    productDetailsResponse.data.data.forEach(p => {
      detailsMap[p.id] = { name: p.name, category: p.category };
    });

    const recommendations = topProductEntries.map(([id, score]) => ({
      productId: parseInt(id),
      name: detailsMap[id]?.name || "Unknown Product",
      category: detailsMap[id]?.category || "Unknown",
      score: score
    }));

    res.json({ date, recommendations });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch seasonal recommendations" });
  }
});

app.listen(PORT, () => console.log(`Analytics service running on port ${PORT}`));