// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

let currentProduct = null;
let qty = 1;

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

    // 3. Ambil data terbaru dari API di background (atau fetch langsung jika cache kosong)
    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=getProducts');
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data)) {
            productList = result.data;
            // Perbarui cache di localStorage
            localStorage.setItem('product_cache', JSON.stringify(productList));
            
            // Cari ulang produk dengan data paling fresh dari server
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

    // Kosongkan atau beri placeholder sementara untuk mencegah gambar produk sebelumnya tampil
    const imgElement = document.getElementById('img-produk');
    if (imgElement) {
        imgElement.src = ''; // Bersihkan gambar lama
    }

    // Mengambil harga mentah dari sheet dan membersihkan karakter non-angka
    const hargaRaw = getVal('harga').toString().replace(/[^0-9]/g, '');
    const hargaSatuan = parseFloat(hargaRaw) || 0;

    document.getElementById('nama-produk').innerText = getVal('nama') || 'Tanpa Nama';
    if (imgElement) {
        imgElement.src = getVal('gambar') || '';
    }
    
    // MENGGUNAKAN TITIK UNTUK RIBUAN (Hasil: Rp 30.000)
    document.getElementById('harga-produk').innerText = 'Harga: Rp ' + hargaSatuan.toLocaleString('id-ID');
    
    // Hitung total harga pertama kali saat data berhasil dimuat
    hitungDanTampilkanTotal();
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
window.logout = logout;
