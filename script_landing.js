// --- KONFIGURASI ---
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec";
let cachedData = []; // Untuk optimasi kecepatan

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

/************************************************
 * FUNGSI BADGE & SINKRONISASI KERANJANG
 ************************************************/

/**
 * Memperbarui angka notifikasi merah pada badge keranjang
 */
/**
 * Memperbarui angka notifikasi merah pada badge keranjang
 */
function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;

  // 1. Cari data keranjang dari berbagai kemungkinan key localStorage (termasuk berbasis user cache)
  let rawCart = null;
  
  // Periksa kunci standar
  rawCart = localStorage.getItem('cart') || 
            localStorage.getItem('keranjang') || 
            localStorage.getItem('cartItems');

  // Jika belum ketemu, cari key yang berawalan 'cart_cache_' atau mengandung kata 'cart'
  if (!rawCart) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('cart_cache_') || key.includes('cart'))) {
        rawCart = localStorage.getItem(key);
        if (rawCart) break; // Ambil yang pertama kali ditemukan
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

  // Hitung total item
  const totalItems = Array.isArray(cartData) 
    ? cartData.reduce((sum, item) => {
        const qty = item.jumlah ?? item.qty ?? item.quantity ?? 1;
        return sum + (Number(qty) || 0);
      }, 0)
    : 0;

  if (totalItems > 0) {
    badge.innerText = totalItems > 99 ? '99+' : totalItems;
    badge.style.display = 'flex'; // Menampilkan balon merah
  } else {
    badge.style.display = 'none'; // Menyembunyikan jika kosong
  }
}
/**
 * Sinkronisasi data keranjang dari Spreadsheet Google Apps Script
 */
async function syncCartFromDatabase(username) {
  if (!username || username === 'guest') {
    updateCartBadge();
    return;
  }

  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=getCart&user=${encodeURIComponent(username)}`);
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      // Simpan hasil dari server ke localStorage
      localStorage.setItem('cart', JSON.stringify(result.data));
    }
  } catch (error) {
    console.error('Gagal mengambil data keranjang dari server:', error);
  } finally {
    // Perbarui indikator badge setelah proses fetch selesai
    updateCartBadge();
  }
}

/************************************************
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

/************************************************
 * FUNGSI UTAMA: Load Menu dengan LocalStorage Cache
 ************************************************/
async function loadMenu(searchQuery = '') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    
    // 1. Ambil data dari memory cache atau localStorage jika tersedia untuk instan render
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

    // Jika data sama sekali belum ada, tampilkan loading
    if (cachedData.length === 0) {
        grid.innerHTML = '<p style="grid-column: span 2; text-align:center;">Memuat menu...</p>';
    } else {
        // Render cepat menggunakan data cache yang ada agar pengguna tidak menunggu
        renderProductGrid(cachedData, searchQuery, grid);
    }

    // 2. Ambil data terbaru dari server di latar belakang (Background Fetch)
    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=getProducts');
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            cachedData = result.data;
            // Simpan ke localStorage agar sesi berikutnya langsung terbuka cepat
            localStorage.setItem('product_cache', JSON.stringify(cachedData));
            // Render ulang dengan data paling baru dari server
            renderProductGrid(cachedData, searchQuery, grid);
        }
    } catch (error) {
        console.error('Gagal memperbarui data latar belakang:', error);
        // Jika gagal total dan belum ada cache sama sekali, tampilkan pesan error
        if (cachedData.length === 0) {
            grid.innerHTML = '<p style="grid-column: span 2; text-align:center; color:red;">Gagal memuat data.</p>';
        }
    }
}

/**
 * HELPER: Memisahkan logika rendering grid produk agar bisa dipanggil berkali-kali
 */
function renderProductGrid(sourceData, searchQuery, gridElement) {
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
        return;
    }

    data.forEach(item => {
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
}

/**
 * Event Delegation untuk tombol tambah (+)
 */
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
    await loadMenu(document.getElementById('search-food').value);
}

function logout() {
    if (confirm('Keluar dari aplikasi?')) {
        localStorage.removeItem('namaUser');
        localStorage.removeItem('idUser');
        window.location.replace('index.html');
    }
}

/************************************************
 * INISIALISASI HALAMAN & EVENT LISTENERS
 ************************************************/
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tampilkan badge dari localStorage secara instan saat halaman dibuka
    updateCartBadge();

    const greetingElement = document.getElementById('user-greeting');
    
    // 2. CEK JALUR LOGIN QR CODE TERLEBIH DAHULU
    const urlParams = new URLSearchParams(window.location.search);
    const qrUserId = urlParams.get('userId');

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
                
                if (greetingElement) greetingElement.innerText = `Hallo ${data.user.nama} !`;
                
                // Bersihkan query string parameter di URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Sinkronkan data keranjang user dari spreadsheet
                syncCartFromDatabase(data.user.nama);
                
                loadMenu();
                initEventDelegation();
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

    // 3. CEK JALUR LOGIN MANUAL
    const namaLogIn = localStorage.getItem('namaUser') || localStorage.getItem('currentUser');
    if (!namaLogIn) {
        window.location.replace('index.html');
        return;
    }

    if (greetingElement) greetingElement.innerText = `Hallo ${namaLogIn} !`;
    
    // Sinkronkan data keranjang user dari spreadsheet
    syncCartFromDatabase(namaLogIn);

    loadMenu();
    initEventDelegation();
});

// Listener perubahan storage dari tab/halaman lain secara real-time
window.addEventListener('storage', (event) => {
  if (['cart', 'keranjang', 'cartItems'].includes(event.key)) {
    updateCartBadge();
  }
});

// Custom Listener agar fungsi bisa dipanggil secara langsung/global
window.addEventListener('cartUpdated', updateCartBadge);
window.updateCartBadge = updateCartBadge;
window.syncCartFromDatabase = syncCartFromDatabase;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;

// Proteksi tombol back browser
history.pushState(null, null, location.href);
window.onpopstate = () => history.go(1);
