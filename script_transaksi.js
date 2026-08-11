const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec";

let currentCartData = [];
let totalBayar = 0;

// Format Rupiah
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

// Handling pergantian UI Metode Pembayaran (Diselaraskan dengan HTML)
function pilihPembayaran(value) {
    const qrisBox = document.getElementById('qris-box');
    const labelTunai = document.getElementById('label-tunai');
    const labelQris = document.getElementById('label-qris');

    if (labelTunai && labelQris) {
        labelQris.classList.toggle('active', value === 'QRIS');
        labelTunai.classList.toggle('active', value === 'Tunai');
    }

    if (qrisBox) {
        qrisBox.style.display = (value === 'QRIS') ? 'block' : 'none';
    }
}

// Inisialisasi Halaman
document.addEventListener('DOMContentLoaded', () => {
    const activeUser = localStorage.getItem('namaUser') || localStorage.getItem('currentUser') || localStorage.getItem('username');
    
    // Set Nama User (Menggunakan ID 'user-display' sesuai HTML)
    const userDisplayElem = document.getElementById('user-display');
    if (userDisplayElem) {
        userDisplayElem.innerText = activeUser || 'Pelanggan';
    }

    if (!activeUser) {
        alert("Sesi berakhir, silakan login kembali.");
        window.location.replace('index.html');
        return;
    }

    // Ambil data keranjang dari berbagai kemungkinan key localStorage
    const rawCart = localStorage.getItem('cart') || 
                    localStorage.getItem('keranjang') || 
                    localStorage.getItem('cartItems') || 
                    localStorage.getItem('spg_cart');
    
    try {
        currentCartData = rawCart ? JSON.parse(rawCart) : [];
    } catch (e) {
        console.error("Gagal parse data keranjang:", e);
        currentCartData = [];
    }

    // Cek apakah keranjang kosong
    if (!Array.isArray(currentCartData) || currentCartData.length === 0) {
        alert("Keranjang Anda kosong!");
        window.location.href = 'chart.html';
        return;
    }

    renderOrderSummary();
});

// Render Item Pesanan ke UI
function renderOrderSummary() {
    const container = document.getElementById('order-items-list');
    if (!container) return;
    
    container.innerHTML = '';
    totalBayar = 0;

    currentCartData.forEach(item => {
        const nama = item.nama_produk || item.nama || item.title || 'Produk';
        const jumlah = parseInt(item.jumlah || item.qty || item.quantity || 1, 10);
        const harga = parseFloat(item.harga_satuan || item.harga || item.price || 0);
        const totalHargaItem = harga * jumlah;

        totalBayar += totalHargaItem;

        const rowHTML = `
            <div class="order-item">
                <div class="item-detail">
                    <h4>${nama}</h4>
                    <p>${jumlah}x @ ${formatRupiah(harga)}</p>
                </div>
                <div class="item-price">${formatRupiah(totalHargaItem)}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHTML);
    });

    // Update elemen Total Pembayaran di HTML
    const grandTotalElem = document.getElementById('grand-total');
    if (grandTotalElem) {
        grandTotalElem.innerText = formatRupiah(totalBayar);
    }
}

// Eksekusi Kirim Transaksi ke Google Apps Script (Diselaraskan dengan HTML)
async function prosesPembayaranAkhir() {
    const btnSubmit = document.getElementById('btn-proses-bayar');
    const namaUser = localStorage.getItem('namaUser') || localStorage.getItem('currentUser') || 'Pelanggan';
    const idUser = localStorage.getItem('idUser') || '';
    
    const selectedPayment = document.querySelector('input[name="payment_method"]:checked');
    const metodePembayaran = selectedPayment ? selectedPayment.value : 'Tunai';
    
    const catatanElem = document.getElementById('catatan-transaksi');
    const catatan = catatanElem ? catatanElem.value.trim() : '';

    if (!confirm(`Konfirmasi pemesanan sebesar ${formatRupiah(totalBayar)} dengan metode ${metodePembayaran}?`)) {
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Memproses Pesanan...";
    }

    const payload = {
        action: "createTransaction",
        user: namaUser,
        id_user: idUser,
        total_bayar: totalBayar,
        metode_pembayaran: metodePembayaran,
        catatan: catatan,
        items: currentCartData
    };

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            alert("Pesanan berhasil dibuat! Silakan lakukan pembayaran.");
            
            // Bersihkan seluruh kunci keranjang lokal
            localStorage.removeItem('cart');
            localStorage.removeItem('keranjang');
            localStorage.removeItem('cartItems');
            localStorage.removeItem('spg_cart');

            if (window.updateCartBadge) window.updateCartBadge();

            window.location.replace('landing_page.html');
        } else {
            alert("Gagal memproses pesanan: " + (result.message || "Terjadi kesalahan server."));
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerText = "Konfirmasi & Bayar Sekarang";
            }
        }
    } catch (error) {
        console.error("Error Transaksi:", error);
        alert("Terjadi kesalahan koneksi server.");
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Konfirmasi & Bayar Sekarang";
        }
    }
}
