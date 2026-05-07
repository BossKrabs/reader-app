<template>
  <div 
    class="reader-wrapper" 
    :style="themeStyles" 
    @scroll="handleScroll" 
    @click="handlePageClick"
    ref="readerBox"
  >

    <div class="bookshelf-drawer" :class="{ 'open': showBookshelf }" @click.stop>
      <div class="drawer-header">
        <h3>📚 我的书架</h3>
        <button class="close-btn" @click="showBookshelf = false">✖</button>
      </div>
      
      <div v-for="book in bookshelf" :key="book.id" class="book-item" @click="loadBook(book)">
        <span class="book-name">{{ book.title }}</span>
        <button class="delete-btn" @click.stop="deleteBook(book.id)">🗑️</button>
      </div>
      
      <div v-if="bookshelf.length === 0" class="empty-tip">
        书架空空如也，快去添加吧！
      </div>

      <label class="add-book-btn">
        ➕ 添加书籍
        <input type="file" accept=".txt" @change="handleFileUpload" hidden />
      </label>
    </div>

    <div class="toolbar" v-show="showMenu" @click.stop>
      <input type="file" accept=".txt" @change="handleFileUpload" class="file-input" />
      <button @click="showBookshelf = !showBookshelf">📂 书架</button>
      <button @click="changeTheme('paper')">📜 纸质</button>
      <button @click="changeTheme('dark')">🌙 护眼</button>
      <button @click="fontSize++">A+</button>
      <button @click="fontSize--">A-</button>
    </div>

    <div class="content-area" :style="{ fontSize: fontSize + 'px' }">
      <h2 class="book-title">{{ bookTitle }}</h2>
      <pre class="text-content" @scroll="handleScroll">{{ rawText }}</pre>
    </div>
  
    <div class="bottom-bar" v-show="showMenu">
        进度：{{ readPercentage }}%
    </div>
  </div>

  <div class="content-area">
    <h2 v-if="!isEpub">{{ bookTitle }}</h2>
    <pre v-if="!isEpub" class="text-content">{{ rawText }}</pre>
  <div v-else id="epub-viewer" class="epub-container"></div>
</div>

</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import ePub from 'epubjs';

const rawText = ref('');
const bookTitle = ref('未命名书籍');
const readerBox = ref(null); 
const fontSize = ref(18);
const currentTheme = ref('paper');
const showMenu = ref(true); 

const bookshelf = ref([]); 
const showBookshelf = ref(false);
const currentBookId = ref(null);

const rendition = ref(null);
const isEpub = ref(false);

// ================= 1. 书架逻辑 =================
const loadBook = (book) => {
  bookTitle.value = book.title;
  currentBookId.value = book.id;
  isEpub.value = book.isEpub || false;
  showBookshelf.value = false; 

  if (isEpub.value) {
    // 如果是 EPUB，必须等 DOM 更新出 epub-viewer 容器后再渲染
    nextTick(() => {
      displayEpub(book.content);
    });
  } else {
    rawText.value = book.content;
    restoreProgress(); 
  }
};

const saveBookshelf = () => {
  try {
    localStorage.setItem('my_library', JSON.stringify(bookshelf.value));
  } catch (e) {
    alert("警告：本地存储空间已满！请删除部分书籍后再添加。");
  }
};

const deleteBook = (id) => {
  bookshelf.value = bookshelf.value.filter(b => b.id !== id);
  saveBookshelf();
  if (currentBookId.value === id) {
    bookTitle.value = '未命名书籍';
    rawText.value = '';
    if(rendition.value) {
        rendition.value.destroy();
        rendition.value = null;
    }
  }
};

// ================= 2. 主题与渲染逻辑 =================
const themes = {
  paper: { 
    bg: '#f4ecd8', text: '#5f4b32',
    epubRules: { body: { 'color': '#5f4b32 !important', 'background': '#f4ecd8 !important' } }
  },
  dark: { 
    bg: '#1a1a1a', text: '#999',
    epubRules: { body: { 'color': '#999 !important', 'background': '#1a1a1a !important' } }
  }
};

const themeStyles = computed(() => ({
  backgroundColor: themes[currentTheme.value].bg,
  color: themes[currentTheme.value].text
}));

const changeTheme = (type) => {
  currentTheme.value = type;
  localStorage.setItem('reader_theme', type); 
};

// 统一的主题同步函数
const applyThemeToEpub = () => {
  if (!rendition.value) return;
  const currentConfig = themes[currentTheme.value];
  rendition.value.themes.fontSize(`${fontSize.value}px`);
  rendition.value.themes.register('custom', currentConfig.epubRules);
  rendition.value.themes.select('custom');
};

// 监听器：一旦变色或改字号，通知 EPUB 同步
watch([fontSize, currentTheme], () => {
  if (isEpub.value) {
    applyThemeToEpub();
  }
});

// ================= 3. 文件读取逻辑 =================
const displayEpub = (data) => {
  // 清空之前的渲染
  document.getElementById("epub-viewer").innerHTML = ""; 
  const book = ePub(data);
  rendition.value = book.renderTo("epub-viewer", {
    width: "100%",
    height: "100%",
    flow: "scrolled"
  });
  rendition.value.display();
  applyThemeToEpub(); // 渲染后立即应用当前主题
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const fileName = file.name.toLowerCase();
  const reader = new FileReader();
  
  if (fileName.endsWith('.epub')) {
    isEpub.value = true;
    reader.onload = (e) => {
      const newBook = {
        id: Date.now(), 
        title: file.name.replace('.epub', ''),
        content: e.target.result, // EPUB 存的是 ArrayBuffer
        progress: 0,
        isEpub: true
      };
      bookshelf.value.push(newBook);
      saveBookshelf();
      loadBook(newBook); 
    };
    reader.readAsArrayBuffer(file);
  } else {
    isEpub.value = false;
    reader.onload = (e) => {
      const newBook = {
        id: Date.now(), 
        title: file.name.replace('.txt', ''),
        content: e.target.result, // TXT 存的是字符串
        progress: 0,
        isEpub: false
      };
      bookshelf.value.push(newBook);
      saveBookshelf();
      loadBook(newBook); 
    };
    reader.readAsText(file, 'UTF-8');
  }
};

// ================= 4. 进度与交互逻辑 =================
const readPercentage = ref(0);

const handlePageClick = (e) => {
  const width = window.innerWidth;
  const x = e.clientX; 
  const height = window.innerHeight - 40; 

  if (x < width * 0.3) {
    readerBox.value.scrollBy({ top: -height, behavior: 'smooth' });
  } else if (x > width * 0.7) {
    readerBox.value.scrollBy({ top: height, behavior: 'smooth' });
  } else {
    showMenu.value = !showMenu.value;
  }
};

const handleScroll = (event) => {
  const el = event.target;
  const scrollTop = el.scrollTop;
  if(bookTitle.value !== '未命名书籍') {
    localStorage.setItem(`progress_${bookTitle.value}`, scrollTop);
  }
  
  const total = el.scrollHeight - el.clientHeight;
  readPercentage.value = total > 0 ? Math.round((scrollTop / total) * 100) : 0;
};

const restoreProgress = async () => {
  const savedProgress = localStorage.getItem(`progress_${bookTitle.value}`);
  if (savedProgress && readerBox.value) {
    await nextTick(); 
    readerBox.value.scrollTop = parseFloat(savedProgress);
  }
};

// ================= 5. 初始化加载 =================
onMounted(async () => {
  const savedLibrary = localStorage.getItem('my_library');
  if (savedLibrary) {
    bookshelf.value = JSON.parse(savedLibrary);
  }

  const savedTheme = localStorage.getItem('reader_theme');
  if (savedTheme) {
    currentTheme.value = savedTheme;
  }
});
</script>

<style scoped>
.reader-wrapper {
  height: 100vh;
  overflow-y: auto;
  transition: all 0.3s ease; 
  scroll-behavior: smooth; 
}

.toolbar {
  position: fixed;
  top: 0;
  width: 100%;
  background: rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  backdrop-filter: blur(5px);
  z-index: 100; 
}

.file-input { width: 180px; }

.content-area {
  max-width: 700px;
  margin: 70px auto 0;
  padding: 0 20px;
  line-height: 1.6;
}

.text-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: "PingFang SC", "Microsoft YaHei", serif;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  width: 100%;
  background: rgba(0,0,0,0.6);
  color: white;
  text-align: center;
  padding: 5px 0;
  font-size: 12px;
}

/* --- 书架专属样式优化 --- */
.bookshelf-drawer {
  position: fixed;
  left: -280px; /* 藏到屏幕外 */
  top: 0; 
  width: 280px; 
  height: 100%;
  background: #f9f9f9; 
  box-shadow: 4px 0 15px rgba(0,0,0,0.1);
  z-index: 200; 
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 20px; 
  color: #333;
  box-sizing: border-box; /* 防止 padding 撑破容器 */
}

.bookshelf-drawer.open { left: 0; }

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #eee;
}

.close-btn {
  background: none; border: none; font-size: 18px; cursor: pointer; color: #999;
}

.book-item {
  padding: 12px 10px; 
  border-radius: 8px;
  margin-bottom: 8px;
  background: #fff;
  cursor: pointer; 
  display: flex; 
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.book-item:hover { background: #f0f0f0; }

.book-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn { background: none; border: none; cursor: pointer; }

.add-book-btn {
  display: block; 
  margin-top: 20px; 
  text-align: center;
  padding: 12px; 
  border: 2px dashed #ccc; 
  border-radius: 8px;
  cursor: pointer;
  color: #666;
  font-weight: bold;
}
.add-book-btn:hover { background: #eee; }

.empty-tip { text-align: center; color: #999; font-size: 14px; margin: 20px 0; }

.epub-container {
  height: calc(100vh - 100px); /* 留出标题和工具栏空间 */
  width: 100%;
}
</style>