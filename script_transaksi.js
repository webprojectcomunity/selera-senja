// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

const namaLogIn = localStorage.getItem('namaUser') || localStorage.getItem('currentUser') || '';
let currentCartData = [];
let totalBayar = 0;

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Coba ambil data dari localStorage terlebih dahulu (prioritas utama dari tombol checkout)
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

    // 2. Jika data lokal kosong, tarik langsung dari Server Google Apps Script menggunakan action=getCart
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
                // Simpan kembali ke checkout_items agar valid
                localStorage.setItem('checkout_items', JSON.stringify(currentCartData));
            }
        } catch (err) {
            console.error("Gagal mengambil data keranjang dari server:", err);
        }
    }

    // 3. Validasi Akhir: Jika tetap kosong, kembalikan pengguna ke halaman chart.html
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

    // 5. Tampilkan total bayar ke UI
    const totalBayarElem = document.getElementById('element-total-bayar');
    if (totalBayarElem) {
        totalBayarElem.innerText = formatRupiah(totalBayar);
    }

    // 6. Render ringkasan item ke dalam kontainer transaksi.html
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

// --- EKSEKUSI KIRIM TRANSAKSI KE GOOGLE APPS SCRIPT (MENGGUNAKAN HIDDEN FORM) ---
// --- EKSEKUSI KIRIM TRANSAKSI KE GOOGLE APPS SCRIPT (MENGGUNAKAN HIDDEN FORM) ---
async function prosesPembayaranAkhir() {
    const btnSubmit = document.getElementById('btn-proses-bayar');
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

    const statusAwal = (metodePembayaran === 'Tunai') ? 'Sedang Dikemas' : 'Belum Bayar';
    const idTransaksi = 'TRX-' + Date.now();

    // Payload dikirim ke Google Apps Script
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

    // Fungsi pembantu untuk membersihkan keranjang lokal
    function bersihkanKeranjangLokal() {
        localStorage.removeItem('cart');
        localStorage.removeItem('keranjang');
        localStorage.removeItem('cartItems');
        localStorage.removeItem('spg_cart');
        localStorage.removeItem('checkout_items');
        if (namaLogIn) {
            localStorage.removeItem(`cart_cache_${namaLogIn.trim()}`);
        }
        if (window.updateCartBadge) window.updateCartBadge();
    }

    // Fungsi pembantu untuk melakukan navigasi halaman
    function arahkanHalaman() {
        if (metodePembayaran === 'QRIS') {
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
            window.location.replace('order.html'); 
        }
    }

    try {
        // --- 1. BUAT ATAU AMBIL IFRAME TERSEMBUNYI ---
        let iframe = document.getElementById('hidden_iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.name = 'hidden_iframe';
            iframe.id = 'hidden_iframe';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }

        // --- 2. BUAT ATAU AMBIL FORM TERSEMBUNYI ---
        let form = document.getElementById('hidden_form_transaksi');
        if (!form) {
            form = document.createElement('form');
            form.id = 'hidden_form_transaksi';
            form.method = 'POST';
            form.action = APPS_SCRIPT_URL;
            form.target = 'hidden_iframe';
            document.body.appendChild(form);
        } else {
            form.innerHTML = '';
        }

        // Masukkan data payload sebagai input form
        const inputPayload = document.createElement('input');
        inputPayload.type = 'hidden';
        inputPayload.name = 'payload';
        inputPayload.value = JSON.stringify(payload);
        form.appendChild(inputPayload);

        // --- 3. SUBMIT FORM KE GOOGLE APPS SCRIPT ---
        form.submit();

        // Kirim perintah susulan untuk membersihkan cart di database Google Sheets lewat iframe
        setTimeout(() => {
            form.innerHTML = '';
            const clearPayload = document.createElement('input');
            clearPayload.type = 'hidden';
            clearPayload.name = 'payload';
            clearPayload.value = JSON.stringify({
                action: "clearCartAfterCheckout",
                user: namaLogIn,
                items: currentCartData
            });
            form.appendChild(clearPayload);
            form.submit();
        }, 1200);

        bersihkanKeranjangLokal();
        arahkanHalaman();

    } catch (error) {
        console.error("Error Hidden Form Submission:", error);
        alert("Terjadi kesalahan saat memproses form transaksi.");
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Konfirmasi & Bayar Sekarang";
        }
    }
}
