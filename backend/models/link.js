const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '..', 'data', 'links.json');

class Link {
  /**
   * Read all data from the JSON file
   */
  static readAll() {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * Write data to the JSON file
   */
  static writeAll(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Get all links with optional filters
   * @param {Object} options - { category, search, page, limit }
   * @returns {Object} - { links, pagination }
   */
  static find({ category, search, page = 1, limit = 50 } = {}) {
    const data = this.readAll();
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

    return {
      links: paginated,
      pagination: { page: Number(page), limit: Number(limit), total }
    };
  }

  /**
   * Find a link by ID
   * @param {string} id
   * @returns {Object|null}
   */
  static findById(id) {
    const data = this.readAll();
    return data.links.find(l => l.id === id) || null;
  }

  /**
   * Create a new link
   * @param {Object} attrs - { title, url, description, category, icon }
   * @returns {Object} - The created link
   */
  static create({ title, url, description, category, icon }) {
    const data = this.readAll();
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
    this.writeAll(data);
    return newLink;
  }

  /**
   * Delete a link by ID
   * @param {string} id
   * @returns {boolean} - Whether the link was found and deleted
   */
  static delete(id) {
    const data = this.readAll();
    const index = data.links.findIndex(l => l.id === id);
    if (index === -1) return false;
    data.links.splice(index, 1);
    this.writeAll(data);
    return true;
  }

  /**
   * Get all unique categories
   * @returns {string[]}
   */
  static getCategories() {
    const data = this.readAll();
    return [...new Set(data.links.map(l => l.category))];
  }
}

module.exports = Link;