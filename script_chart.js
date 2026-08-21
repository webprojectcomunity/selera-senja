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

    // 2. Tarik data terbaru dari server Google di latar belakang via Fetch API Standar
    fetchCartFromServer();
}

// --- FUNGSI AMBIL DATA DARI SERVER MENGGUNAKAN FETCH STANDAR (MENGATASI CHROME ANDROID) ---
async function fetchCartFromServer() {
    const url = `${APPS_SCRIPT_URL}?action=getCart&user=${encodeURIComponent(namaLogIn.trim())}`;
    
    console.log("Memanggil API Fetch:", url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const chartResult = await response.json();

        console.log("=================================");
        console.log("RESPONSE JSON DARI APPS SCRIPT");
        console.log("=================================");
        console.log("Full response:", chartResult);

        // Validasi response
        if (!chartResult || chartResult.success !== true || !Array.isArray(chartResult.data)) {
            console.error("FORMAT DATA SERVER TIDAK VALID:", chartResult);
            handleFetchError();
            return;
        }

        // Data valid
        currentCartItems = chartResult.data;
        console.log("Keranjang berhasil dimuat:", currentCartItems);

        // Simpan cache
        localStorage.setItem(cacheKey, JSON.stringify(currentCartItems));

        // Render data
        renderCartItems(currentCartItems);

    } catch (error) {
        console.error("GAGAL SINKRONISASI KERANJANG VIA FETCH:", error);
        handleFetchError();
    }
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

    buttonElement.disabled = true;
    buttonElement.innerText = "...";

    // 1. Hapus secara instan dari tampilan lokal & update cache
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
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error("Gagal menghapus item di server:", error);
        alert("Gagal terhubung ke jaringan.");
        fetchCartFromServer();
    }
}

// --- FUNGSI MELANJUTKAN KE HALAMAN CHECKOUT ---
function prosesSemuaTransaksi() {
    if (!currentCartItems || currentCartItems.length === 0) {
        alert("Keranjang Anda kosong. Silakan pilih produk terlebih dahulu.");
        return;
    }

    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
        btnCheckout.disabled = true;
        btnCheckout.innerText = "Memproses...";
    }

    // 1. Simpan item keranjang ke localStorage untuk dibaca oleh checkout.html
    localStorage.setItem('checkout_items', JSON.stringify(currentCartItems));

    // 2. Arahkan pengguna ke halaman checkout tanpa melakukan POST transaksi prematur
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

// --- EKSEKUSI GLOBAL WINDOW ---
window.prosesSemuaTransaksi = prosesSemuaTransaksi;
window.hapusItemKeranjang = hapusItemKeranjang;
window.bukaKeranjang = bukaKeranjang;
window.logout = logout;
