// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

const namaLogIn = localStorage.getItem('namaUser');
const cacheKey = `cart_cache_${namaLogIn ? namaLogIn.trim() : 'guest'}`;

// Variabel global untuk menampung data keranjang aktif
let currentCartItems = [];

document.addEventListener('DOMContentLoaded', () => {
    // Sesi Proteksi
    if (!namaLogIn) {
        alert("Sesi berakhir, silakan login kembali.");
        window.location.replace('index.html');
        return;
    }

    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.innerText = "Pengguna: " + namaLogIn;
    }

    // Pasang Event Listener langsung ke tombol Checkout (#btn-checkout)
    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
        btnCheckout.addEventListener('click', prosesSemuaTransaksi);
    }

    // Muat data keranjang secara instan dari cache lokal, lalu sinkronkan dari server
    loadCartInstantly();
});

// --- FUNGSI AMBIL DATA INSTAN (CACHE + BACKGROUND SYNC) ---
function loadCartInstantly() {
    const cartList = document.getElementById('cart-list');
    if (!cartList) return;

    // 1. Coba baca dari cache lokal terlebih dahulu agar halaman terbuka tanpa jeda
    const savedCache = localStorage.getItem(cacheKey);
    if (savedCache) {
        try {
            currentCartItems = JSON.parse(savedCache);
            renderCartItems(currentCartItems);
        } catch (e) {
            currentCartItems = [];
        }
    }

    // Jika cache masih kosong sama sekali, tampilkan teks memuat sementara
    if (currentCartItems.length === 0) {
        cartList.innerHTML = `<p style="text-align: center; color: #7f8c8d;">Memuat keranjang...</p>`;
    }

    // 2. Tarik data terbaru dari server Google di latar belakang via JSONP
    fetchCartFromServer();
}

// --- FUNGSI AMBIL DATA DARI SERVER MENGGUNAKAN JSONP (MENGATASI CORS) ---
function fetchCartFromServer() {
    const callbackName = 'cartCallback_' + Math.random().toString(36).substring(2, 9);

    // Definisikan fungsi callback global untuk menerima data dari Apps Script
    window[callbackName] = function(chartResult) {
        // Hapus script tag setelah data berhasil dimuat
        document.getElementById(callbackName)?.remove();
        delete window[callbackName];

        if (!chartResult || !chartResult.success || !Array.isArray(chartResult.data)) {
            console.error("Format data server tidak valid");
            handleFetchError();
            return;
        }

        currentCartItems = chartResult.data;
        
        // Simpan versi terbaru ke localStorage
        localStorage.setItem(cacheKey, JSON.stringify(currentCartItems));

        // Render ulang dengan data fresh dari server
        renderCartItems(currentCartItems);
    };

    // Buat elemen script dinamis
    const script = document.createElement('script');
    script.id = callbackName;
    script.src = `${APPS_SCRIPT_URL}?action=getCart&user=${encodeURIComponent(namaLogIn.trim())}&callback=${callbackName}`;
    
    // Tangani jika terjadi error jaringan pada pemuatan script
    script.onerror = function() {
        document.getElementById(callbackName)?.remove();
        delete window[callbackName];
        console.error("Gagal sinkronisasi keranjang via JSONP.");
        handleFetchError();
    };

    document.body.appendChild(script);
}

// --- FUNGSI PENANGANAN GAGAL AMBIL DATA ---
function handleFetchError() {
    const cartList = document.getElementById('cart-list');
    const totalSection = document.getElementById('total-section');
    const btnCheckout = document.getElementById('btn-checkout');

    if (currentCartItems.length === 0 && cartList) {
        cartList.innerHTML = `<p style="text-align: center; color: #e74c3c;">Gagal memuat data keranjang.</p>`;
        if (totalSection) totalSection.style.display = 'none';
        if (btnCheckout) btnCheckout.disabled = true;
    }
}

// --- FUNGSI RENDER TAMPILAN KERANJANG ---
function renderCartItems(items) {
    const cartList = document.getElementById('cart-list');
    const totalSection = document.getElementById('total-section');
    const btnCheckout = document.getElementById('btn-checkout');

    if (!cartList) return;

    if (!Array.isArray(items) || items.length === 0) {
        cartList.innerHTML = `<p style="text-align: center; color: #7f8c8d;">Keranjang Anda kosong.</p>`;
        currentCartItems = [];
        if (totalSection) totalSection.style.display = 'none';
        if (btnCheckout) btnCheckout.disabled = true;
        return;
    }

    if (btnCheckout) btnCheckout.disabled = false;
    cartList.innerHTML = ''; 
    let grandTotal = 0;

    items.forEach((item) => {
        const hargaRaw = item.harga_satuan ? item.harga_satuan.toString().replace(/[^0-9.-]/g, '') : '0';
        const totalRaw = item.total_harga ? item.total_harga.toString().replace(/[^0-9.-]/g, '') : '0';

        const harga = parseFloat(hargaRaw) || 0;
        const jumlah = parseInt(item.jumlah) || 0;
        const totalItem = parseFloat(totalRaw) || (harga * jumlah);
        
        grandTotal += totalItem;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <div class="cart-info">
                <h4>${item.nama_produk || 'Produk'} (${item.id_produk})</h4>
                <p>Harga Satuan: Rp ${harga.toLocaleString('id-ID')}</p>
                <p>Jumlah: <strong>${jumlah}</strong> pcs</p>
                ${item.catatan ? `<p style="font-style: italic; color: #7f8c8d;">Catatan: "${item.catatan}"</p>` : ''}
                <p style="font-weight: bold; margin-top: 5px;">Total: Rp ${totalItem.toLocaleString('id-ID')}</p>
            </div>
            <button type="button" class="btn-hapus" onclick="hapusItemKeranjang(event, '${item.id_produk}', this)">Hapus</button>
        `;
        cartList.appendChild(itemDiv);
    });

    if (totalSection) {
        totalSection.style.display = 'block';
        const grandTotalElem = document.getElementById('grand-total');
        if (grandTotalElem) {
            grandTotalElem.innerText = 'Rp ' + grandTotal.toLocaleString('id-ID');
        }
    }
}

// --- FUNGSI HAPUS DATA ITEM (OPTIMISTIC UI / INSTAN) ---
async function hapusItemKeranjang(event, idProduk, buttonElement) {
    if (event) event.preventDefault();

    if (!confirm("Apakah Anda yakin ingin menghapus produk ini dari keranjang?")) return;

    // Kunci tombol tindakan
    buttonElement.disabled = true;
    buttonElement.innerText = "...";

    // 1. Hapus secara instan dari tampilan lokal & update cache (Optimistic UI)
    currentCartItems = currentCartItems.filter(item => String(item.id_produk).trim() !== String(idProduk).trim());
    renderCartItems(currentCartItems);
    localStorage.setItem(cacheKey, JSON.stringify(currentCartItems));

    const payload = {
        action: 'deleteCartItem',
        data: {
            user: namaLogIn,
            id_produk: idProduk
        }
    };

    try {
        // 2. Kirim perintah hapus ke server di latar belakang
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });

    } catch (error) {
        console.error("Gagal menghapus item di server:", error);
        alert("Gagal terhubung ke jaringan.");
        // Ambil ulang data dari server jika terjadi kendala jaringan
        fetchCartFromServer();
    }
}

// --- FUNGSI MELANJUTKAN TRANSAKSI (CHECKOUT) ---
async function prosesSemuaTransaksi() {
    if (!currentCartItems || currentCartItems.length === 0) {
        alert("Keranjang Anda kosong. Silakan pilih produk terlebih dahulu.");
        return;
    }

    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
        btnCheckout.disabled = true;
        btnCheckout.innerText = "Memproses...";
    }

    // 1. Simpan ke LocalStorage agar terbaca di halaman transaksi.html
    localStorage.setItem('checkout_items', JSON.stringify(currentCartItems));

    // 2. Kirim perintah hapus spesifik ke backend Google Apps Script (Sheet chart)
    const payload = {
        action: 'clearCartAfterCheckout',
        user: namaLogIn,
        items: currentCartItems // Mengirim daftar item yang dicheckout agar dihapus berdasarkan User & ID Produk
    };

    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });

        // 3. Bersihkan cache lokal keranjang user tersebut
        localStorage.removeItem(cacheKey);

    } catch (error) {
        console.error("Gagal membersihkan keranjang di server:", error);
    }

    // 4. Arahkan ke halaman transaksi
    window.location.href = 'transaksi.html';
}

// --- FUNGSI NAVIGASI LANDING PAGE ---
function bukaKeranjang() {
    window.location.href = 'chart.html';
}

function logout() {
    if (confirm("Apakah Anda yakin ingin keluar?")) {
        localStorage.removeItem('namaUser');
        window.location.replace('index.html');
    }
}

// --- EKSKUSI GLOBAL WINDOW ---
window.prosesSemuaTransaksi = prosesSemuaTransaksi;
window.hapusItemKeranjang = hapusItemKeranjang;
window.bukaKeranjang = bukaKeranjang;
window.logout = logout;
