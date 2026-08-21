// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

const namaLogIn = localStorage.getItem('namaUser') || localStorage.getItem('currentUser') || '';
let currentCartData = [];
let totalBayar = 0;

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Coba ambil data dari localStorage
    const specificCacheKey = namaLogIn ? `cart_cache_${namaLogIn.trim()}` : '';
    const rawCartData = 
        localStorage.getItem('checkout_items') || 
        (specificCacheKey ? localStorage.getItem(specificCacheKey) : null) || 
        localStorage.getItem('cart') || 
        localStorage.getItem('keranjang') || 
        localStorage.getItem('cartItems') || 
        localStorage.getItem('spg_cart') || '[]';

    try {
        currentCartData = JSON.parse(rawCartData);
    } catch (e) {
        currentCartData = [];
    }

    // 2. Jika lokal kosong, tarik dari Server Google Apps Script
    if ((!currentCartData || currentCartData.length === 0) && namaLogIn) {
        const summaryContainer = document.getElementById('summary-items-container');
        if (summaryContainer) {
            summaryContainer.innerHTML = `<p style="text-align: center; color: #7f8c8d; font-size: 13px;">Memuat rincian pesanan dari server...</p>`;
        }

        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?action=getCart&user=${encodeURIComponent(namaLogIn.trim())}`);
            const result = await response.json();
            if (result && result.success && Array.isArray(result.data)) {
                currentCartData = result.data;
                localStorage.setItem('checkout_items', JSON.stringify(currentCartData));
            }
        } catch (err) {
            console.error("Gagal mengambil data keranjang dari server:", err);
        }
    }

    // 3. Validasi Akhir
    if (!currentCartData || currentCartData.length === 0) {
        alert("Tidak ada data produk yang akan di-checkout atau keranjang kosong.");
        window.location.replace('chart.html');
        return;
    }

    // 4. Hitung Total Bayar
    totalBayar = 0;
    currentCartData.forEach(item => {
        const hargaRaw = item.total_harga ? item.total_harga.toString().replace(/[^0-9.-]/g, '') : ((item.harga_satuan || item.harga || 0) * (item.jumlah || 1));
        totalBayar += parseFloat(hargaRaw) || 0;
    });

    const totalBayarElem = document.getElementById('element-total-bayar');
    if (totalBayarElem) {
        totalBayarElem.innerText = formatRupiah(totalBayar);
    }

    // 5. Render ringkasan item
    const summaryContainer = document.getElementById('summary-items-container');
    if (summaryContainer) {
        summaryContainer.innerHTML = '';
        currentCartData.forEach(item => {
            const nama = item.nama_produk || 'Produk';
            const qty = item.jumlah || item.qty || 1;
            const subtotal = item.total_harga ? parseFloat(item.total_harga.toString().replace(/[^0-9.-]/g, '')) : ((item.harga_satuan || item.harga || 0) * qty);
            
            const itemRow = document.createElement('div');
            itemRow.style.cssText = "display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; color: #555;";
            itemRow.innerHTML = `
                <span>${nama} (${qty}x)</span>
                <span>${formatRupiah(subtotal)}</span>
            `;
            summaryContainer.appendChild(itemRow);
        });
    }
});

// --- FUNGSI PROSES PEMBAYARAN MENGGUNAKAN HIDDEN FORM (BYPASS CORS) ---
function prosesPembayaranAkhir() {
    const btnSubmit = document.getElementById('btn-proses-bayar');
    const idUser = localStorage.getItem('idUser') || '';

    // --- PERBAIKAN UTAMA PENANGKAPAN METODE PEMBAYARAN ---
    // Mencari radio button yang dipilih berdasarkan berbagai kemungkinan nama atribut HTML
    let metodePembayaran = "Tunai"; // Default fallback
    
    const checkedRadio = document.querySelector('input[type="radio"]:checked');
    if (checkedRadio) {
        // Ambil dari value radio, atau jika value kosong ambil dari teks label di dekatnya
        metodePembayaran = checkedRadio.value || checkedRadio.getAttribute('id') || 'Tunai';
    } else {
        // Jika menggunakan elemen select/dropdown
        const selectElem = document.getElementById('metode-pembayaran') || document.getElementById('payment_method');
        if (selectElem) {
            metodePembayaran = selectElem.value;
        }
    }

    // Normalisasi teks agar konsisten (misal: "tunai" jadi "Tunai", "qris" jadi "QRIS")
    if (metodePembayaran.toLowerCase().includes('tunai') || metodePembayaran.toLowerCase().includes('cash')) {
        metodePembayaran = 'Tunai';
    } else if (metodePembayaran.toLowerCase().includes('qris')) {
        metodePembayaran = 'QRIS';
    } else if (metodePembayaran.toLowerCase().includes('transfer') || metodePembayaran.toLowerCase().includes('tf')) {
        metodePembayaran = 'Transfer';
    }

    // --- DEBUGGING: Cek hasil tangkapan di Console Browser (Tekan F12) ---
    console.log("METODE PEMBAYARAN TERPILIH:", metodePembayaran);

    const catatanElem = document.getElementById('catatan-transaksi');
    const catatan = catatanElem ? catatanElem.value.trim() : '';

    if (!confirm(`Konfirmasi pemesanan sebesar ${formatRupiah(totalBayar)} dengan metode ${metodePembayaran}?`)) {
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Memproses Pesanan...";
    }

    // Tentukan status awal berdasarkan metode pembayaran yang benar-benar terpilih
    const statusAwal = (metodePembayaran.toUpperCase() === 'TUNAI') ? 'Sedang Dikemas' : 'Belum Bayar';
    const idTransaksi = 'TRX-' + Date.now();

    const payload = {
        action: "createTransaction",
        user: namaLogIn,
        id_user: idUser,
        id_transaksi: idTransaksi,
        total_bayar: totalBayar,
        metode_pembayaran: metodePembayaran,
        status: statusAwal,
        catatan: catatan,
        items: currentCartData
    };

    // --- BUAT IFRAME & FORM TERSEMBUNYI UNTUK MENGIRIM DATA TANPA CORS ---
    const iframeName = 'hidden_iframe_' + Date.now();
    let iframe = document.getElementById(iframeName);
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = APPS_SCRIPT_URL;
    form.target = iframeName;

    const inputPayload = document.createElement('input');
    inputPayload.type = 'hidden';
    inputPayload.name = 'payload';
    inputPayload.value = JSON.stringify(payload);
    form.appendChild(inputPayload);

    const clearPayload = {
        action: "clearCartAfterCheckout",
        user: namaLogIn,
        items: currentCartData
    };

    const inputClear = document.createElement('input');
    inputClear.type = 'hidden';
    inputClear.name = 'clear_payload';
    inputClear.value = JSON.stringify(clearPayload);
    form.appendChild(inputClear);

    document.body.appendChild(form);
    form.submit();

    // Bersihkan localStorage lokal
    localStorage.removeItem('cart');
    localStorage.removeItem('keranjang');
    localStorage.removeItem('cartItems');
    localStorage.removeItem('spg_cart');
    localStorage.removeItem('checkout_items');
    if (namaLogIn) localStorage.removeItem(`cart_cache_${namaLogIn.trim()}`);
    if (window.updateCartBadge) window.updateCartBadge();

    localStorage.setItem('last_transaction_id', idTransaksi);

    // Berikan jeda sejenak lalu pindah halaman sesuai metode pembayaran
    setTimeout(() => {
        if (metodePembayaran.toUpperCase() === 'QRIS') {
            const qrisData = {
                id_transaksi: idTransaksi,
                total_bayar: totalBayar,
                nama_user: namaLogIn,
                qr_code_url: ''
            };
            localStorage.setItem('active_qris_trx', JSON.stringify(qrisData));
            alert("Pesanan dibuat. Silakan selesaikan pembayaran QRIS.");
            window.location.replace('qris_payment.html');
        } else {
            alert("Pesanan berhasil dibuat! Status pesanan: Sedang Dikemas.");
            window.location.replace('order.html?trx=' + encodeURIComponent(idTransaksi));
        }
    }, 1500);
}
