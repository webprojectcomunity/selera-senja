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

    // 2. Ambil data dari API
    try {
        const response = await fetch(APPS_SCRIPT_URL + '?action=getProducts');
        const result = await response.json();
        
        if (!result.data || !Array.isArray(result.data)) {
            throw new Error("Format data tidak valid");
        }
        
        // --- LOGIKA PENCARIAN YANG DIPERBAIKI ---
        currentProduct = result.data.find(item => {
            const keys = Object.keys(item);
            const idKey = keys.find(k => k.toLowerCase().includes('produk'));
            
            const idDariSheet = idKey ? String(item[idKey]).trim() : '';
            return idDariSheet === idProduk.trim();
        });

        if (currentProduct) {
            renderProduct(currentProduct);
        } else {
            console.error("Gagal menemukan produk dengan ID:", idProduk);
            document.getElementById('nama-produk').innerText = "Produk tidak ditemukan";
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Gagal memuat detail produk.");
    }
});

// --- FUNGSI TAMPILAN ---
function renderProduct(item) {
    const getVal = (key) => {
        const keys = Object.keys(item);
        const foundKey = keys.find(k => k.trim().toLowerCase() === key.toLowerCase());
        return foundKey ? item[foundKey] : '';
    };

    // Mengambil harga mentah dari sheet dan membersihkan karakter non-angka
    const hargaRaw = getVal('harga').toString().replace(/[^0-9]/g, '');
    const hargaSatuan = parseFloat(hargaRaw) || 0;

    document.getElementById('nama-produk').innerText = getVal('nama') || 'Tanpa Nama';
    document.getElementById('img-produk').src = getVal('gambar') || '';
    
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

    // Bersihkan karakter non-angka dari string harga sheet (misal Rp. 15.000 -> 15000)
    const hargaRaw = getVal('harga').toString().replace(/[^0-9]/g, '');
    const hargaSatuan = parseFloat(hargaRaw) || 0;
    
    const total = hargaSatuan * qty;
    
    // MENGGUNAKAN TITIK UNTUK RIBUAN (Hasil: Subtotal: Rp 30.000)
    document.getElementById('total-harga').innerText = 'Subtotal: Rp ' + total.toLocaleString('id-ID');
}
// --- LOGIKA KUANTITAS ---
function updateQty(change) {
    qty += change;
    if (qty < 1) qty = 1;
    document.getElementById('qty').innerText = qty;
    
    // Perbarui teks total harga setiap kali kuantitas berubah
    hitungDanTampilkanTotal();
}

// --- FUNGSI SUBMIT KE KERANJANG SPREADSHEET ---
// --- FUNGSI SUBMIT KE KERANJANG SPREADSHEET (BEBAS CORS ERROR) ---
async function submitOrder(event) {
    // 1. Cegah reload halaman bawaan browser
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
        // Gunakan mode 'no-cors' agar browser tidak memblokir request ke Google Script
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(payload)
        });

        // Karena mode 'no-cors', request terkirim tanpa error.
        // Tampilkan notifikasi lalu redirect ke landing_page.html
        alert("Berhasil ditambahkan ke keranjang!");
        window.location.href = 'landing_page.html';

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
