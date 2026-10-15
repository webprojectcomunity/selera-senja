// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

let currentProduct = null;
let qty = 1;
let fullDescriptionText = ""; // Variabel penyimpan teks deskripsi asli

document.addEventListener('DOMContentLoaded', async () => {
    // --- LOGIKA PROTEKSI SESI ---
    const namaLogIn = localStorage.getItem('namaUser');
    if (!namaLogIn) {
        alert("Sesi berakhir, silakan login kembali.");
        window.location.replace('index.html');
        return;
    }

    // 1. Ambil ID dari URL
    const params = new URLSearchParams(window.location.search);
    const idProduk = params.get('id');

    if (!idProduk) {
        alert("Produk tidak ditemukan!");
        window.location.href = 'landing_page.html';
        return;
    }

    // 2. Ambil data produk (Prioritaskan dari cache localStorage terlebih dahulu untuk kecepatan)
    let productList = [];
    const savedCache = localStorage.getItem('product_cache');
    
    if (savedCache) {
        try {
            productList = JSON.parse(savedCache);
        } catch (e) {
            productList = [];
        }
    }

    // Fungsi helper untuk mencari produk berdasarkan ID dari array data
    const findProductById = (dataArray) => {
        return dataArray.find(item => {
            const keys = Object.keys(item);
            const idKey = keys.find(k => k.toLowerCase().includes('produk') || k.toLowerCase() === 'id');
            const idDariSheet = idKey ? String(item[idKey]).trim() : '';
            return idDariSheet === idProduk.trim();
        });
    };

    // Jika cache ada, coba cari langsung agar halaman terbuka instan
    if (productList.length > 0) {
        currentProduct = findProductById(productList);
        if (currentProduct) {
            renderProduct(currentProduct);
        }
    }

    // 3. Ambil data terbaru dari API di background
    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=getProducts');
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data)) {
            productList = result.data;
            localStorage.setItem('product_cache', JSON.stringify(productList));
            
            currentProduct = findProductById(productList);
            if (currentProduct) {
                renderProduct(currentProduct);
            } else if (!currentProduct) {
                console.error("Gagal menemukan produk dengan ID:", idProduk);
                document.getElementById('nama-produk').innerText = "Produk tidak ditemukan";
            }
        } else if (!currentProduct) {
            throw new Error("Format data tidak valid");
        }
    } catch (error) {
        console.error("Error:", error);
        if (!currentProduct) {
            alert("Gagal memuat detail produk.");
            document.getElementById('nama-produk').innerText = "Gagal memuat produk";
        }
    }
});


// --- FUNGSI TAMPILAN ---
function renderProduct(item) {
    const getVal = (key) => {
        const keys = Object.keys(item);
        const foundKey = keys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        return foundKey ? item[foundKey] : '';
    };

    const imgElement = document.getElementById('img-produk');
    if (imgElement) {
        imgElement.src = ''; 
    }

    const hargaRaw = getVal('harga').toString().replace(/[^0-9]/g, '');
    const hargaSatuan = parseFloat(hargaRaw) || 0;

    // Tampilkan Nama Produk
    document.getElementById('nama-produk').innerText = getVal('nama') || 'Tanpa Nama';
    
    // Tampilkan Deskripsi Produk dari kolom spreadsheet (Kolom D / 'deskripsi')
    fullDescriptionText = getVal('deskripsi') || 'Tidak ada deskripsi tersedia untuk produk ini.';
    const deskripsiElem = document.getElementById('deskripsi-produk');
    const btnToggle = document.getElementById('btn-toggle-deskripsi');

    if (deskripsiElem) {
        deskripsiElem.innerText = fullDescriptionText;
        deskripsiElem.classList.remove('expanded');
        
        // Logika: Tampilkan tombol "Baca Selengkapnya" hanya jika teks deskripsi cukup panjang (> 90 karakter)
        if (btnToggle) {
            if (fullDescriptionText.length > 90) {
                btnToggle.style.display = 'inline-block';
                btnToggle.innerText = 'Baca Selengkapnya';
            } else {
                btnToggle.style.display = 'none';
            }
        }
    }

    if (imgElement) {
        imgElement.src = getVal('gambar') || '';
    }
    
    document.getElementById('harga-produk').innerText = 'Harga: Rp ' + hargaSatuan.toLocaleString('id-ID');
    
    hitungDanTampilkanTotal();
}

// --- LOGIKA BACA SELENGKAPNYA / TUTUP ---
function toggleDeskripsi() {
    const deskripsiElem = document.getElementById('deskripsi-produk');
    const btnToggle = document.getElementById('btn-toggle-deskripsi');

    if (!deskripsiElem || !btnToggle) return;

    const isExpanded = deskripsiElem.classList.contains('expanded');

    if (isExpanded) {
        deskripsiElem.classList.remove('expanded');
        btnToggle.innerText = 'Baca Selengkapnya';
    } else {
        deskripsiElem.classList.add('expanded');
        btnToggle.innerText = 'Tutup';
    }
}

// --- LOGIKA HITUNG TOTAL ---
function hitungDanTampilkanTotal() {
    if (!currentProduct) return;

    const getVal = (key) => {
        const keys = Object.keys(currentProduct);
        const foundKey = keys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        return foundKey ? currentProduct[foundKey] : '';
    };

    const hargaRaw = getVal('harga').toString().replace(/[^0-9]/g, '');
    const hargaSatuan = parseFloat(hargaRaw) || 0;
    const total = hargaSatuan * qty;
    
    document.getElementById('total-harga').innerText = 'Subtotal: Rp ' + total.toLocaleString('id-ID');
}

// --- LOGIKA KUANTITAS ---
function updateQty(change) {
    qty += change;
    if (qty < 1) qty = 1;
    document.getElementById('qty').innerText = qty;
    hitungDanTampilkanTotal();
}

// --- FUNGSI SUBMIT KE KERANJANG SPREADSHEET ---
async function submitOrder(event) {
    if (event) event.preventDefault();

    if (!currentProduct) {
        alert("Data produk belum termuat sempurna.");
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-order');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Menambahkan...";
    }

    const getVal = (key) => {
        const keys = Object.keys(currentProduct);
        const foundKey = keys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        return foundKey ? currentProduct[foundKey] : '';
    };

    const catatan = document.getElementById('catatan').value;
    const namaLogIn = localStorage.getItem('namaUser') || 'Guest';

    const hargaRaw = getVal('harga').toString().replace(/[^0-9]/g, '');
    const hargaSatuan = parseFloat(hargaRaw) || 0;
    const totalHarga = hargaSatuan * qty;

    const payload = {
        action: 'addToCart',
        data: {
            user: namaLogIn,
            id_produk: getVal('id_produk') || getVal('id') || getVal('idproduk'),
            nama_produk: getVal('nama') || getVal('nama_produk'),
            harga: hargaSatuan,
            jumlah: qty,
            total_harga: totalHarga,
            catatan: catatan
        }
    };

    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(payload)
        });

        alert("Berhasil ditambahkan ke keranjang!");
        window.location.href = 'chart.html';

    } catch (error) {
        console.error("Error submit order:", error);
        alert("Gagal menyimpan pesanan. Periksa koneksi internet Anda.");
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Tambah ke Keranjang";
        }
    }
}

function logout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        localStorage.removeItem('namaUser');
        window.location.replace('index.html');
    }
}

window.updateQty = updateQty;
window.submitOrder = submitOrder;
window.toggleDeskripsi = toggleDeskripsi;
window.logout = logout;
