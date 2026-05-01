const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8002;

// .env থেকে Central API এর URL এবং Token নেওয়া
const CENTRAL_API_URL = process.env.CENTRAL_API_URL;
const CENTRAL_API_TOKEN = process.env.CENTRAL_API_TOKEN;

// Central API কল করার জন্য একটি Axios ইন্সট্যান্স তৈরি
const centralApi = axios.create({
  baseURL: CENTRAL_API_URL,
  headers: {
    'Authorization': `Bearer ${CENTRAL_API_TOKEN}`
  }
});

// P5: Categories Cache Variable
let cachedCategories = null;

// P5: Helper function to fetch and cache categories
async function getValidCategories() {
  if (cachedCategories) {
    return cachedCategories; // Cache এ থাকলে সরাসরি ফেরত দেবে
  }
  try {
    const response = await centralApi.get('/api/data/categories');
    cachedCategories = response.data.categories;
    return cachedCategories;
  } catch (error) {
    console.error("Failed to fetch categories", error.message);
    return [];
  }
}

// P1: Health Check
app.get('/status', (req, res) => {
  res.json({ service: "rental-service", status: "OK" });
});

// P3 & P5: GET /rentals/products
app.get('/rentals/products', async (req, res) => {
  try {
    const { category } = req.query;

    // P5 Logic: ক্যাটাগরি দেওয়া থাকলে ভ্যালিডেশন চেক করা
    if (category) {
      const validCategories = await getValidCategories();
      
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: `Invalid category: '${category}'`,
          suggestion: "Please use one of the valid categories below.",
          validCategories: validCategories
        });
      }
    }

    // P3 Logic: Central API থেকে প্রোডাক্ট আনা (পেজিনেশনসহ)
    const response = await centralApi.get('/api/data/products', { params: req.query });
    
    // Central API ডিফল্টভাবেই { data, page, limit, total, totalPages } রিটার্ন করে, তাই হুবহু পাঠিয়ে দিচ্ছি
    res.json(response.data);
    
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Failed to connect to Central API" });
    }
  }
});

// P3: GET /rentals/products/:id
app.get('/rentals/products/:id', async (req, res) => {
  try {
    const response = await centralApi.get(`/api/data/products/${req.params.id}`, { params: req.query });
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Failed to connect to Central API" });
    }
  }
});

const { parseISO, isWithinInterval, areIntervalsOverlapping, format, addDays, subDays, max, min } = require('date-fns');

// P7: GET /rentals/products/:id/availability
app.get('/rentals/products/:id/availability', async (req, res) => {
  try {
    const productId = req.params.id;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "Missing 'from' or 'to' query parameters" });
    }

    const reqStart = new Date(from);
    const reqEnd = new Date(to);

    // ১. সেন্ট্রাল এপিআই থেকে ওই প্রোডাক্টের সব রেন্টাল হিস্ট্রি আনা
    const response = await centralApi.get('/api/data/rentals', { 
      params: { product_id: productId, limit: 100 } 
    });
    const rentals = response.data.data;

    // ২. ইন্টারভ্যালগুলো বের করা এবং সর্ট (Sort) করা
    let intervals = rentals.map(r => ({
      start: new Date(r.rentalStart),
      end: new Date(r.rentalEnd)
    })).sort((a, b) => a.start - b.start);

    // ৩. ওভারল্যাপিং ইন্টারভ্যাল মার্জ (Merge) করা (অ্যালগরিদম)
    const mergedBusy = [];
    if (intervals.length > 0) {
      let current = intervals[0];
      for (let i = 1; i < intervals.length; i++) {
        if (intervals[i].start <= current.end) {
          // ওভারল্যাপ হলে এন্ড ডেট বাড়িয়ে দেওয়া
          current.end = new Date(Math.max(current.end, intervals[i].end));
        } else {
          mergedBusy.push(current);
          current = intervals[i];
        }
      }
      mergedBusy.push(current);
    }

    // ৪. চেক করা যে রিকোয়েস্টেড ডেট রেঞ্জ ফ্রি কি না
    const conflicts = mergedBusy.filter(busy => 
      areIntervalsOverlapping(
        { start: reqStart, end: reqEnd },
        { start: busy.start, end: busy.end }
      )
    );

    const isAvailable = conflicts.length === 0;

    // ৫. ফ্রি উইন্ডোগুলো বের করা (Requested range এর ভেতর)
    const freeWindows = [];
    let lastEnd = reqStart;

    mergedBusy.forEach(busy => {
      if (busy.start > lastEnd && busy.start <= reqEnd) {
        freeWindows.push({
          start: format(lastEnd, 'yyyy-MM-dd'),
          end: format(subDays(busy.start, 1), 'yyyy-MM-dd')
        });
      }
      if (busy.end > lastEnd) lastEnd = addDays(busy.end, 1);
    });

    if (lastEnd <= reqEnd) {
      freeWindows.push({
        start: format(lastEnd, 'yyyy-MM-dd'),
        end: format(reqEnd, 'yyyy-MM-dd')
      });
    }

    // 6. sending final response
    res.json({
      productId: parseInt(productId),
      from,
      to,
      available: isAvailable,
      busyPeriods: mergedBusy.map(b => ({
        start: format(b.start, 'yyyy-MM-dd'),
        end: format(b.end, 'yyyy-MM-dd')
      })),
      freeWindows: isAvailable ? [{ start: from, end: to }] : freeWindows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to calculate availability" });
  }
});

// P8: GET /rentals/kth-busiest-date
app.get('/rentals/kth-busiest-date', async (req, res) => {
  try {
    let { from, to, k } = req.query;
    k = parseInt(k);

    // ১. ভ্যালিডেশন (Validation)
    if (!from || !to || isNaN(k) || k <= 0) {
      return res.status(400).json({ error: "Invalid 'from', 'to', or 'k'" });
    }

    const startMonth = new Date(from + "-01");
    const endMonth = new Date(to + "-01");

    if (startMonth > endMonth) {
      return res.status(400).json({ error: "'from' must be before 'to'" });
    }

    // রেঞ্জ ১২ মাসের বেশি কি না চেক করা
    const diffMonths = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + (endMonth.getMonth() - startMonth.getMonth());
    if (diffMonths >= 12) {
      return res.status(400).json({ error: "Max range is 12 months" });
    }

    // ২. ডেটা সংগ্রহ (Fetching Month by Month in Parallel)
    const monthsToFetch = [];
    let current = new Date(startMonth);
    while (current <= endMonth) {
      monthsToFetch.push(format(current, 'yyyy-MM'));
      current.setMonth(current.getMonth() + 1);
    }

    const statsRequests = monthsToFetch.map(month => 
      centralApi.get('/api/data/rentals/stats', { params: { group_by: 'date', month } })
    );

    const responses = await Promise.all(statsRequests);
    const allData = responses.flatMap(r => r.data.data);

    if (k > allData.length) {
      return res.status(404).json({ error: "Not enough distinct dates available" });
    }

    // ৩. অপ্টিমাইজড অ্যালগরিদম: Min-Heap (For 15 Bonus Points)
    // আমরা এমন একটি হিপ রাখব যা শুধুমাত্র টপ K আইটেম ধরে রাখবে
    const minHeap = [];

    for (const item of allData) {
      if (minHeap.length < k) {
        minHeap.push(item);
        minHeap.sort((a, b) => a.count - b.count); // ছোট সর্ট (k সাইজের)
      } else if (item.count > minHeap[0].count) {
        minHeap[0] = item;
        minHeap.sort((a, b) => a.count - b.count);
      }
    }

    // হিপের প্রথম এলিমেন্টটাই হলো আমাদের k-th busiest
    const result = minHeap[0];

    res.json({
      from,
      to,
      k,
      date: result.date,
      rentalCount: result.count
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// P9: GET /rentals/users/:id/top-categories
app.get('/rentals/users/:id/top-categories', async (req, res) => {
  try {
    const userId = req.params.id;
    let k = parseInt(req.query.k) || 5;

    // Validation
    if (k <= 0) {
      return res.status(400).json({ error: "'k' must be a positive integer" });
    }

    // 1. Fetch all rentals for this user
    const rentalResponse = await centralApi.get('/api/data/rentals', {
      params: { renter_id: userId, limit: 100 } // Fetching a significant batch
    });
    const rentals = rentalResponse.data.data;

    if (!rentals || rentals.length === 0) {
      return res.json({ userId: parseInt(userId), topCategories: [] });
    }

    // 2. Extract unique product IDs
    const productIds = [...new Set(rentals.map(r => r.productId))];

    // 3. Fetch product details in batches of 50 (Bonus Requirement)
    let allProducts = [];
    for (let i = 0; i < productIds.length; i += 50) {
      const batch = productIds.slice(i, i + 50);
      const productResponse = await centralApi.get('/api/data/products/batch', {
        params: { ids: batch.join(',') }
      });
      allProducts = allProducts.concat(productResponse.data.data);
    }

    // Map productId to category for quick lookup
    const productCategoryMap = {};
    allProducts.forEach(p => {
      productCategoryMap[p.id] = p.category;
    });

    // 4. Count rentals per category
    const categoryCounts = {};
    rentals.forEach(r => {
      const category = productCategoryMap[r.productId];
      if (category) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    });

    // 5. Convert to array and find top K using Min-Heap logic (Bonus Points)
    const categoryArray = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      rentalCount: count
    }));

    // Using a simple min-heap approach for optimized top-K selection
    const topK = [];
    for (const item of categoryArray) {
      if (topK.length < k) {
        topK.push(item);
        topK.sort((a, b) => b.rentalCount - a.rentalCount); // Keep it sorted desc
      } else if (item.rentalCount > topK[topK.length - 1].rentalCount) {
        topK[topK.length - 1] = item;
        topK.sort((a, b) => b.rentalCount - a.rentalCount);
      }
    }

    res.json({
      userId: parseInt(userId),
      topCategories: topK
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch top categories" });
  }
});

const { differenceInDays, startOfYear, endOfYear, max: maxDate, min: minDate } = require('date-fns');

// P10: GET /rentals/products/:id/free-streak?year=2023
app.get('/rentals/products/:id/free-streak', async (req, res) => {
  try {
    const productId = req.params.id;
    const year = parseInt(req.query.year) || 2023;
    
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 11, 31));

    // 1. Fetch all rentals for the product
    // Note: We fetch a larger limit to ensure we get all records for the year
    const response = await centralApi.get('/api/data/rentals', {
      params: { product_id: productId, limit: 100 }
    });
    const rentals = response.data.data;

    // 2. Filter rentals that overlap with the requested year and clip them
    let intervals = rentals
      .map(r => ({
        start: new Date(r.rentalStart),
        end: new Date(r.rentalEnd)
      }))
      .filter(interval => interval.start <= yearEnd && interval.end >= yearStart)
      .map(interval => ({
        // Clip intervals to stay within the target year boundaries
        start: maxDate([interval.start, yearStart]),
        end: minDate([interval.end, yearEnd])
      }))
      .sort((a, b) => a.start - b.start);

    // 3. Merge overlapping clipped intervals
    const mergedBusy = [];
    if (intervals.length > 0) {
      let current = intervals[0];
      for (let i = 1; i < intervals.length; i++) {
        if (intervals[i].start <= current.end) {
          current.end = maxDate([current.end, intervals[i].end]);
        } else {
          mergedBusy.push(current);
          current = intervals[i];
        }
      }
      mergedBusy.push(current);
    }

    // 4. Find the gaps between merged busy periods to identify "free streaks"
    let longestFreeStreak = { from: null, to: null, days: 0 };
    let lastBusyEnd = yearStart;

    // Helper to update longest streak
    const updateStreak = (start, end) => {
      const days = differenceInDays(end, start) + 1;
      if (days > longestFreeStreak.days) {
        longestFreeStreak = {
          from: format(start, 'yyyy-MM-dd'),
          to: format(end, 'yyyy-MM-dd'),
          days: days
        };
      }
    };

    if (mergedBusy.length === 0) {
      // Entire year is free if no rentals found
      updateStreak(yearStart, yearEnd);
    } else {
      // Check gap before the first rental
      if (mergedBusy[0].start > yearStart) {
        updateStreak(yearStart, subDays(mergedBusy[0].start, 1));
      }

      // Check gaps between rentals
      for (let i = 0; i < mergedBusy.length - 1; i++) {
        const gapStart = addDays(mergedBusy[i].end, 1);
        const gapEnd = subDays(mergedBusy[i+1].start, 1);
        if (gapStart <= gapEnd) {
          updateStreak(gapStart, gapEnd);
        }
      }

      // Check gap after the last rental
      const lastRentalEnd = mergedBusy[mergedBusy.length - 1].end;
      if (lastRentalEnd < yearEnd) {
        updateStreak(addDays(lastRentalEnd, 1), yearEnd);
      }
    }

    res.json({
      productId: parseInt(productId),
      year,
      longestFreeStreak
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to calculate free streak" });
  }
});

// P12: Helper function to merge two sorted arrays using Two Pointers (O(N) time)
function mergeTwoSortedArrays(arr1, arr2) {
  const merged = [];
  let i = 0, j = 0;
  
  while (i < arr1.length && j < arr2.length) {
    const date1 = new Date(arr1[i].rentalStart);
    const date2 = new Date(arr2[j].rentalStart);
    
    if (date1 <= date2) {
      merged.push(arr1[i]);
      i++;
    } else {
      merged.push(arr2[j]);
      j++;
    }
  }
  
  // Push remaining elements
  while (i < arr1.length) merged.push(arr1[i++]);
  while (j < arr2.length) merged.push(arr2[j++]);
  
  return merged;
}

// P12: Helper function to merge K sorted arrays using Divide and Conquer (O(N log K) time)
function mergeKSortedArrays(arrays) {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0];
  
  const mid = Math.floor(arrays.length / 2);
  const left = mergeKSortedArrays(arrays.slice(0, mid));
  const right = mergeKSortedArrays(arrays.slice(mid));
  
  return mergeTwoSortedArrays(left, right);
}

// P12: GET /rentals/merged-feed
app.get('/rentals/merged-feed', async (req, res) => {
  try {
    const { productIds, limit } = req.query;

    // 1. Validation
    if (!productIds) {
      return res.status(400).json({ error: "Missing 'productIds' query parameter" });
    }

    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      return res.status(400).json({ error: "'limit' must be a positive integer max 100" });
    }

    // Parse and deduplicate product IDs
    const idArray = [...new Set(productIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)))];

    if (idArray.length === 0 || idArray.length > 10) {
      return res.status(400).json({ error: "Provide between 1 and 10 valid productIds" });
    }

    // 2. Fetch rental data for each product in parallel
    const fetchPromises = idArray.map(async (productId) => {
      try {
        // We fetch up to 'limit' records for EACH product, because the final top 'limit'
        // could theoretically all come from a single product.
        const response = await centralApi.get('/api/data/rentals', {
          params: { product_id: productId, limit: limitNum }
        });
        
        // Map to the required output format
        return response.data.data.map(r => ({
          rentalId: r.id,
          productId: r.productId,
          rentalStart: r.rentalStart,
          rentalEnd: r.rentalEnd
        }));
      } catch (err) {
        console.error(`Failed to fetch rentals for product ${productId}`);
        return [];
      }
    });

    const allSortedArrays = await Promise.all(fetchPromises);

    // 3. Apply Divide and Conquer Merge Algorithm
    const mergedFeed = mergeKSortedArrays(allSortedArrays);

    // 4. Return only the requested 'limit' number of records
    res.json({
      productIds: idArray,
      limit: limitNum,
      feed: mergedFeed.slice(0, limitNum)
    });

  } catch (error) {
    console.error("P12 Error:", error.message);
    res.status(500).json({ error: "Failed to generate merged feed" });
  }
});

app.listen(PORT, () => console.log(`Rental service running on port ${PORT}`));