// --- KONFIGURASI ---
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec";
const APPS_SCRIPT_URL_API = "https://script.google.com/macros/s/AKfycbwSCT3UhUj2-6VcXeDbBYAQDD-CjUouquTMxDnvjj8Y-eGBvo_hSfXnk0E6xGWszeGwmg/exec";

let cachedData = []; // Untuk optimasi kecepatan
let currentPage = 1;  // Halaman aktif saat ini
const itemsPerPage = 10; // Batas maksimal 10 produk per halaman

/**
 * HELPER: Konversi URL Google Drive ke Link Gambar Thumbnail
 */
function convertDriveUrl(url) {
    if (!url) return 'https://via.placeholder.com/300x200?text=No+Image';
    try {
        const match = url.match(/id=([^&]+)/);
        return match && match[1] ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000` : url;
    } catch (e) { return url; }
}

/**
 * HELPER: Render foto profil agar konsisten dan bisa dipakai ulang
 */
function renderProfilePhoto() {
    const savedFoto = localStorage.getItem('fotoUser');
    const profilePicDiv = document.querySelector('.profile-pic');
    if (profilePicDiv && savedFoto) {
        const finalFotoUrl = convertDriveUrl(savedFoto);
        profilePicDiv.innerHTML = `<img src="${finalFotoUrl}" alt="Foto Profil" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    }
}

/************************************************
 * FUNGSI SIDEBAR NAVIGATION
 ************************************************/
function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

/************************************************
 * FUNGSI BADGE & SINKRONISASI KERANJANG
 ************************************************/
function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;

  let rawCart = localStorage.getItem('cart') || 
                localStorage.getItem('keranjang') || 
                localStorage.getItem('cartItems');

  if (!rawCart) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('cart_cache_') || key.includes('cart'))) {
        rawCart = localStorage.getItem(key);
        if (rawCart) break;
      }
    }
  }
        
  let cartData = [];
  try {
    cartData = rawCart ? JSON.parse(rawCart) : [];
  } catch (e) {
    console.error('Gagal membaca JSON keranjang:', e);
    cartData = [];
  }

  const totalItems = Array.isArray(cartData) 
    ? cartData.reduce((sum, item) => {
        const qty = item.jumlah ?? item.qty ?? item.quantity ?? 1;
        return sum + (Number(qty) || 0);
      }, 0)
    : 0;

  if (totalItems > 0) {
    badge.innerText = totalItems > 99 ? '99+' : totalItems;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function syncCartFromDatabase(username) {
  if (!username || username === 'guest') {
    updateCartBadge();
    return;
  }

  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getCart&user=${encodeURIComponent(username)}`);
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      localStorage.setItem('cart', JSON.stringify(result.data));
    }
  } catch (error) {
    console.error('Gagal mengambil data keranjang dari server:', error);
  } finally {
    updateCartBadge();
  }
}
async function updateOrderBadge() {
    const currentIdUser = localStorage.getItem('idUser') || '';
    const orderBadge = document.getElementById('order-badge');
    
    if (!currentIdUser || !orderBadge) return;

    try {
        const url = `${APPS_SCRIPT_URL}?action=getTransactions&id_user=${encodeURIComponent(currentIdUser.trim())}`;
        const response = await fetch(url);
        const result = await response.json();
        
        let rawTransactions = [];
        if (Array.isArray(result)) {
            rawTransactions = result;
        } else if (result && result.success && Array.isArray(result.data)) {
            rawTransactions = result.data;
        } else if (result && Array.isArray(result.data)) {
            rawTransactions = result.data;
        }

        // FILTER: Hanya hitung pesanan yang BELUM selesai/dibatalkan
        // Sesuaikan kata kunci status ("selesai", "completed", "dibatalkan", "cancelled") 
        // dengan teks status yang disimpan di database Anda.
        const activeOrders = rawTransactions.filter(item => {
            // Ambil kolom status (sesuaikan key objek, misal: item.status atau item.Status)
            const status = (item.status || item.Status || '').toLowerCase().trim();
            
            // Status yang membuat badge DIHILANGKAN/TIDAK DIHITUNG:
            const isFinished = status === 'selesai' || status === 'completed' || status === 'dibatalkan' || status === 'cancelled';
            
            return !isFinished; // Hanya ambil yang aktif (Belum selesai)
        });

        const totalOrders = activeOrders.length;

        if (totalOrders > 0) {
            orderBadge.textContent = totalOrders > 99 ? '99+' : totalOrders;
            orderBadge.style.display = 'flex';
        } else {
            orderBadge.style.display = 'none';
        }
    } catch (error) {
        console.error("Gagal memuat jumlah pesanan untuk badge:", error);
    }
}
/****************--------------------------------
 * FUNGSI POP-UP GAMBAR PRODUK
 ************************************************/
function openImageModal(imgUrl, productName) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    
    if (modal && modalImg) {
        modal.style.display = 'flex';
        modalImg.src = imgUrl;
        if (modalTitle) modalTitle.innerText = productName;
    }
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/****************--------------------------------
 * FUNGSI UTAMA: Load Menu dengan LocalStorage Cache & Pagination
 ************************************************/
async function loadMenu(searchQuery = '', page = 1) {
    currentPage = page;
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    
    if (cachedData.length === 0) {
        const savedCache = localStorage.getItem('product_cache');
        if (savedCache) {
            try {
                cachedData = JSON.parse(savedCache);
            } catch (e) {
                cachedData = [];
            }
        }
    }

    if (cachedData.length === 0) {
        grid.innerHTML = '<p style="grid-column: span 2; text-align:center;">Memuat menu...</p>';
    } else {
        renderProductGrid(cachedData, searchQuery, grid, currentPage);
    }

    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=getProducts');
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            cachedData = result.data;
            localStorage.setItem('product_cache', JSON.stringify(cachedData));
            renderProductGrid(cachedData, searchQuery, grid, currentPage);
        }
    } catch (error) {
        console.error('Gagal memperbarui data latar belakang:', error);
        if (cachedData.length === 0) {
            grid.innerHTML = '<p style="grid-column: span 2; text-align:center; color:red;">Gagal memuat data.</p>';
        }
    }
}

function renderProductGrid(sourceData, searchQuery, gridElement, page = 1) {
    let data = sourceData;
    
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        data = data.filter(item => 
            (item.nama || item.Nama || '').toLowerCase().includes(query) || 
            (item.deskripsi || item.Deskripsi || '').toLowerCase().includes(query)
        );
    }

    gridElement.innerHTML = '';
    
    if (data.length === 0) {
        gridElement.innerHTML = '<p style="grid-column: span 2; text-align:center;">Makanan tidak ditemukan</p>';
        removePaginationContainer();
        return;
    }

    const totalPages = Math.ceil(data.length / itemsPerPage);
    
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    currentPage = page;

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    paginatedData.forEach(item => {
        const values = Object.values(item);
        
        const idProduk  = values[0] || ''; 
        const nama      = values[2] || 'Tanpa Nama'; 
        const deskripsi = values[3] || '-';
        const harga     = values[4] || '0';
        const img       = convertDriveUrl(values[5] || '');

        const card = `
        <div class="food-card">
            <div class="food-image-wrapper">
                <img src="${img}" alt="${nama}" loading="lazy" class="clickable-img" style="cursor: pointer;" onclick="openImageModal('${img}', '${nama.replace(/'/g, "\\'")}')" onerror="this.src='https://via.placeholder.com/300x200?text=Error'">
            </div>
            <div class="glass-content">
                <h3>${nama}</h3>
                <p>${deskripsi}</p>
                <div class="card-footer">
                    <span class="price">${harga}</span>
                    <button class="add-btn" data-id="${idProduk}">+</button>
                </div>
            </div>
        </div>`;
        gridElement.insertAdjacentHTML('beforeend', card);
    });

    renderPaginationControls(totalPages, page, searchQuery);
}

function renderPaginationControls(totalPages, page, searchQuery) {
    let container = document.getElementById('pagination-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'pagination-container';
        container.style.cssText = 'grid-column: 1 / -1; display: flex; justify-content: center; align-items: center; gap: 15px; margin: 20px 0;';
        
        const grid = document.getElementById('product-grid');
        grid.after(container);
    }

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <button id="btn-prev" ${page === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : 'style="cursor: pointer;"'} class="pagination-btn">◀ Sebelumnya</button>
        <span style="font-weight: bold; font-size: 14px;">Hal ${page} dari ${totalPages}</span>
        <button id="btn-next" ${page === totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : 'style="cursor: pointer;"'} class="pagination-btn">Berikutnya ▶</button>
    `;

    document.getElementById('btn-prev').onclick = () => {
        if (currentPage > 1) {
            loadMenu(searchQuery, currentPage - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    document.getElementById('btn-next').onclick = () => {
        if (currentPage < totalPages) {
            loadMenu(searchQuery, currentPage + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
}

function removePaginationContainer() {
    const container = document.getElementById('pagination-container');
    if (container) container.remove();
}

function initEventDelegation() {
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('add-btn')) {
            const idProduk = e.target.getAttribute('data-id');
            if (idProduk) {
                window.location.href = `detail_pesanan.html?id=${idProduk}`;
            } else {
                alert("ID produk tidak ditemukan!");
            }
        }
    });
}

async function jalankanPencarian() {
    const searchQuery = document.getElementById('search-food').value;
    await loadMenu(searchQuery, 1);
}

function logout() {
    if (confirm('Keluar dari aplikasi?')) {
        localStorage.removeItem('namaUser');
        localStorage.removeItem('idUser');
        localStorage.removeItem('fotoUser');
        window.location.replace('index.html');
    }
}

/************************************************
 * INISIALISASI HALAMAN & EVENT LISTENERS
 ************************************************/
document.addEventListener('DOMContentLoaded', async () => {
    updateCartBadge();
    updateOrderBadge(); // Panggil fungsi badge pesanan di sini

    const greetingElement = document.getElementById('user-greeting');
    const urlParams = new URLSearchParams(window.location.search);
    const qrUserId = urlParams.get('userId');

    // 1. Tangani proses Login QR Code
    if (qrUserId) {
        if (greetingElement) greetingElement.innerText = "Mengautentikasi...";
        
        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "login_qr",
                    userId: qrUserId
                })
            });
            const data = await response.json();

            if (data.success) {
                localStorage.setItem('namaUser', data.user.nama);
                localStorage.setItem('idUser', data.user.id_user);
                if (data.user.foto) {
                    localStorage.setItem('fotoUser', data.user.foto);
                }
                
                if (greetingElement) greetingElement.innerText = `Hallo ${data.user.nama} !`;
                window.history.replaceState({}, document.title, window.location.pathname);
                
                syncCartFromDatabase(data.user.nama);
                updateOrderBadge(); // Perbarui badge pesanan setelah login QR berhasil
                loadMenu();
                initEventDelegation();
                renderProfilePhoto();
                return;
            } else {
                alert("Gagal Login QR: " + data.message);
                window.location.replace('index.html');
                return;
            }
        } catch (error) {
            console.error("Error Login QR:", error);
            alert("Terjadi masalah koneksi server saat memproses QR Code.");
            window.location.replace('index.html');
            return;
        }
    }

    // 2. Tangani Login Reguler
    const namaLogIn = localStorage.getItem('namaUser') || localStorage.getItem('currentUser');
    const idUser = localStorage.getItem('idUser');
    
    if (!namaLogIn) {
        window.location.replace('index.html');
        return;
    }

    if (greetingElement) greetingElement.innerText = `Hallo ${namaLogIn} !`;

    if (!localStorage.getItem('fotoUser') && idUser) {
        try {
            const profileRes = await fetch(`${APPS_SCRIPT_URL_API}?action=getUserProfile&id_user=${idUser}`);
            const profileJson = await profileRes.json();
            
            if (profileJson.success && profileJson.data && profileJson.data.foto) {
                localStorage.setItem('fotoUser', profileJson.data.foto);
            }
        } catch (err) {
            console.error("Gagal memuat foto profil otomatis:", err);
        }
    }

    renderProfilePhoto();
    syncCartFromDatabase(namaLogIn);
    updateOrderBadge();
    loadMenu();
    initEventDelegation();
});

window.addEventListener('storage', (event) => {
  if (['cart', 'keranjang', 'cartItems'].includes(event.key)) {
    updateCartBadge();
  }
});

// Window Global Exports
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.updateCartBadge = updateCartBadge;
window.updateOrderBadge = updateOrderBadge;
window.syncCartFromDatabase = syncCartFromDatabase;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.jalankanPencarian = jalankanPencarian;
window.logout = logout;

history.pushState(null, null, location.href);
window.onpopstate = () => history.go(1);
