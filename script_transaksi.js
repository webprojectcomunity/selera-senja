// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

const namaLogIn = localStorage.getItem('namaUser') || localStorage.getItem('currentUser') || '';
let currentCartData = [];
let totalBayar = 0;

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Ambil data keranjang dari localStorage
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

    // 3. Validasi
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

// --- FUNGSI PROSES PEMBAYARAN AKHIR ---
function prosesPembayaranAkhir() {
    const btnSubmit = document.getElementById('btn-proses-bayar');
  const idUser = localStorage.getItem('idUser') || localStorage.getItem('userId') || '';

    // Tangkap radio button tercentang secara presisi
    const selectedRadio = document.querySelector('input[name="payment_method"]:checked');
    const metodePembayaran = selectedRadio ? selectedRadio.value : 'Tunai';

    const catatanElem = document.getElementById('catatan-transaksi');
    const catatan = catatanElem ? catatanElem.value.trim() : '';

    if (!confirm(`Konfirmasi pemesanan sebesar ${formatRupiah(totalBayar)} dengan metode ${metodePembayaran}?`)) {
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Memproses Pesanan...";
    }

    const isTunai = metodePembayaran.toLowerCase() === 'tunai';
    const statusAwal = isTunai ? 'Sedang Dikemas' : 'Belum Bayar';
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

console.log("========== DEBUG CHECKOUT ==========");
console.log("Radio dipilih:", selectedRadio);
console.log(
    "Value radio:",
    selectedRadio ? selectedRadio.value : "TIDAK ADA"
);
console.log("Metode pembayaran:", metodePembayaran);
console.log("ID transaksi:", idTransaksi);
console.log("Status:", statusAwal);
console.log("Payload:", payload);
console.log("====================================");

    // Kirim via Hidden Form ke Iframe untuk menghindari kendala CORS pada POST
    const iframeName = 'hidden_iframe_' + Date.now();
    let iframe = document.getElementById(iframeName);
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.name = iframeName;
        iframe.style.id = iframeName;
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

    document.body.appendChild(form);
    form.submit();

    // Bersihkan LocalStorage
    localStorage.removeItem('cart');
    localStorage.removeItem('keranjang');
    localStorage.removeItem('cartItems');
    localStorage.removeItem('spg_cart');
    localStorage.removeItem('checkout_items');
    if (namaLogIn) localStorage.removeItem(`cart_cache_${namaLogIn.trim()}`);
    if (window.updateCartBadge) window.updateCartBadge();

    localStorage.setItem('last_transaction_id', idTransaksi);

    // Pengalihan Halaman (memberi jeda agar Spreadsheet selesai memproses)
    setTimeout(() => {
        if (!isTunai) {
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
    }, 2500);
}
