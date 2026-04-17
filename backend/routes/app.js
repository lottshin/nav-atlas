const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '..', 'data', 'links.json');

// Helper: read data
function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

// Helper: write data
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET /api/categories - Get all categories
router.get('/categories', (req, res) => {
  const data = readData();
  const categories = [...new Set(data.links.map(l => l.category))];
  res.json({ success: true, data: categories });
});

// GET /api/links - Get all links (with optional filters)
router.get('/links', (req, res) => {
  const { category, search, page = 1, limit = 50 } = req.query;
  const data = readData();
  let links = data.links;

  if (category && category !== 'all') {
    links = links.filter(l => l.category === category);
  }

  if (search) {
    const keyword = search.toLowerCase();
    links = links.filter(l =>
      l.title.toLowerCase().includes(keyword) ||
      l.description.toLowerCase().includes(keyword) ||
      l.url.toLowerCase().includes(keyword)
    );
  }

  const total = links.length;
  const start = (page - 1) * limit;
  const paginated = links.slice(start, start + Number(limit));

  res.json({
    success: true,
    data: paginated,
    pagination: { page: Number(page), limit: Number(limit), total }
  });
});

// POST /api/links - Add a new link
router.post('/links', (req, res) => {
  const { title, url, description, category, icon } = req.body;
  if (!title || !url || !category) {
    return res.status(400).json({ success: false, message: 'title, url, category are required' });
  }

  const data = readData();
  const newLink = {
    id: uuidv4(),
    title,
    url,
    description: description || '',
    category,
    icon: icon || '🔗',
    createdAt: new Date().toISOString()
  };

  data.links.push(newLink);
  writeData(data);
  res.status(201).json({ success: true, data: newLink });
});

// DELETE /api/links/:id - Delete a link
router.delete('/links/:id', (req, res) => {
  const data = readData();
  const index = data.links.findIndex(l => l.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Link not found' });
  }
  data.links.splice(index, 1);
  writeData(data);
  res.json({ success: true, message: 'Deleted' });
});

module.exports = router;