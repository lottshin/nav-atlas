// ========== Configuration ==========
const API_BASE = 'http://localhost:3000/api';

// ========== DOM Elements ==========
const searchInput = document.getElementById('searchInput');
const categoryList = document.getElementById('categoryList');
const linkGrid = document.getElementById('linkGrid');
const linkCount = document.getElementById('linkCount');
const currentCategory = document.getElementById('currentCategory');
const emptyState = document.getElementById('emptyState');
const themeToggle = document.getElementById('themeToggle');
const addLinkBtn = document.getElementById('addLinkBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const addLinkForm = document.getElementById('addLinkForm');

// ========== State ==========
let allLinks = [];
let categories = [];
let activeCategory = 'all';
let searchQuery = '';

// ========== Category Icon Map ==========
const categoryIcons = {
  '搜索引擎': '🔍',
  '开发工具': '💻',
  '设计工具': '🎨',
  '效率工具': '⚡',
  'AI 工具': '🤖',
  'default': '📁'
};

function getCategoryIcon(name) {
  return categoryIcons[name] || categoryIcons['default'];
}

// ========== API Calls ==========
async function fetchLinks(category = 'all', search = '') {
  try {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (search) params.set('search', search);

    const res = await fetch(`${API_BASE}/links?${params}`);
    const json = await res.json();
    return json.success ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch links:', err);
    return [];
  }
}

async function fetchCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    const json = await res.json();
    return json.success ? json.data : [];
  } catch (err) {
    console.error('Failed to fetch categories:', err);
    return [];
  }
}

async function addLink(data) {
  try {
    const res = await fetch(`${API_BASE}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    console.error('Failed to add link:', err);
    return null;
  }
}

// ========== Rendering ==========
function renderCategories() {
  const allItem = `<li class="${activeCategory === 'all' ? 'active' : ''}" data-category="all">
    <span class="cat-icon">📋</span> 全部
  </li>`;

  const items = categories.map(cat => `
    <li class="${activeCategory === cat ? 'active' : ''}" data-category="${cat}">
      <span class="cat-icon">${getCategoryIcon(cat)}</span> ${cat}
    </li>
  `).join('');

  categoryList.innerHTML = allItem + items;

  // Re-bind click events
  categoryList.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      activeCategory = li.dataset.category;
      updateView();
    });
  });
}

function renderLinks(links) {
  if (links.length === 0) {
    linkGrid.style.display = 'none';
    emptyState.style.display = 'block';
    linkCount.textContent = '0 个网站';
    return;
  }

  linkGrid.style.display = 'grid';
  emptyState.style.display = 'none';
  linkCount.textContent = `${links.length} 个网站`;

  linkGrid.innerHTML = links.map(link => `
    <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="card">
      <div class="card-header">
        <div class="card-icon">${link.icon || '🔗'}</div>
        <div>
          <div class="card-title">${escapeHtml(link.title)}</div>
          <div class="card-url">${extractDomain(link.url)}</div>
        </div>
      </div>
      <div class="card-desc">${escapeHtml(link.description)}</div>
      <span class="card-tag">${escapeHtml(link.category)}</span>
    </a>
  `).join('');
}

// ========== Helpers ==========
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ========== Update View ==========
async function updateView() {
  const catLabel = activeCategory === 'all' ? '全部网站' : activeCategory;
  currentCategory.textContent = catLabel;

  const links = await fetchLinks(activeCategory, searchQuery);
  allLinks = links;
  renderLinks(links);
  renderCategories();
}

// ========== Theme ==========
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.querySelector('.theme-icon').textContent = '☀️';
  }
}

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeToggle.querySelector('.theme-icon').textContent = '🌙';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeToggle.querySelector('.theme-icon').textContent = '☀️';
  }
});

// ========== Search ==========
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = e.target.value.trim();
    updateView();
  }, 300);
});

// Keyboard shortcut: press "/" to focus search
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === 'Escape') {
    modalOverlay.classList.remove('active');
  }
});

// ========== Modal ==========
addLinkBtn.addEventListener('click', () => modalOverlay.classList.add('active'));
modalClose.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('active');
});

addLinkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(addLinkForm);
  const data = {
    title: formData.get('title'),
    url: formData.get('url'),
    description: formData.get('description') || '',
    category: formData.get('category'),
    icon: formData.get('icon') || '🔗'
  };

  const result = await addLink(data);
  if (result) {
    addLinkForm.reset();
    modalOverlay.classList.remove('active');
    categories = await fetchCategories();
    updateView();
  }
});

// ========== Init ==========
async function init() {
  initTheme();
  categories = await fetchCategories();
  renderCategories();
  updateView();
}

init();