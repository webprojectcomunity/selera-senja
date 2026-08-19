// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

// --- INISIALISASI DATA KERANJANG & TOTAL BAYAR (Cakupan Global) ---
const currentCartData = JSON.parse(localStorage.getItem('checkout_items') || '[]');

let totalBayar = 0;
currentCartData.forEach(item => {
    // Ambil harga dan bersihkan karakter non-angka
    const hargaRaw = item.total_harga ? item.total_harga.toString().replace(/[^0-9.-]/g, '') : (item.harga_satuan * item.jumlah);
    totalBayar += parseFloat(hargaRaw) || 0;
});

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

document.addEventListener('DOMContentLoaded', () => {
    // Sesi Proteksi / Validasi Data Keranjang Kosong
    if (currentCartData.length === 0) {
        alert("Tidak ada data produk yang akan di-checkout.");
        window.location.replace('chart.html');
        return;
    }

    // Tampilkan total bayar ke UI
    const totalBayarElem = document.getElementById('element-total-bayar');
    if (totalBayarElem) {
        totalBayarElem.innerText = formatRupiah(totalBayar);
    }

    // Render ringkasan item ke dalam kontainer
    const summaryContainer = document.getElementById('summary-items-container');
    if (summaryContainer) {
        summaryContainer.innerHTML = '';
        currentCartData.forEach(item => {
            const nama = item.nama_produk || 'Produk';
            const qty = item.jumlah || 1;
            const subtotal = item.total_harga ? parseFloat(item.total_harga.toString().replace(/[^0-9.-]/g, '')) : (item.harga_satuan * qty);
            
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

// --- EKSEKUSI KIRIM TRANSAKSI KE GOOGLE APPS SCRIPT ---
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

    // Tentukan status awal: Tunai = "Sedang Dikemas", QRIS = "Belum Bayar"
    const statusAwal = (metodePembayaran === 'Tunai') ? 'Sedang Dikemas' : 'Belum Bayar';

    // Payload ini 100% selaras dengan endpoint "createTransaction" di kode.gs
    const payload = {
        action: "createTransaction",
        user: namaUser,
        id_user: idUser,
        total_bayar: totalBayar,
        metode_pembayaran: metodePembayaran,
        status: statusAwal,
        catatan: catatan,
        items: currentCartData
    };

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload),
            redirect: "follow" // PENTING: Wajib ada untuk Apps Script
        });

        const result = await response.json();

        // Validasi response dari kode.gs (mengembalikan { success: true, ... })
        if (result && result.success) {
            const idTransaksi = result.id_transaksi || ('TRX-' + Date.now());

            // Simpan riwayat pesanan ke localStorage untuk ditampilkan di order_status.html
            let daftarPesanan = JSON.parse(localStorage.getItem('user_orders') || '[]');
            const pesananBaru = {
                id_transaksi: idTransaksi,
                tanggal: new Date().toLocaleString('id-ID'),
                items: currentCartData,
                total_bayar: totalBayar,
                metode_pembayaran: metodePembayaran,
                status: statusAwal
            };
            daftarPesanan.unshift(pesananBaru);
            localStorage.setItem('user_orders', JSON.stringify(daftarPesanan));

            // Bersihkan keranjang lokal (Frontend)
            localStorage.removeItem('cart');
            localStorage.removeItem('keranjang');
            localStorage.removeItem('cartItems');
            localStorage.removeItem('spg_cart');
            localStorage.removeItem('checkout_items');

            if (window.updateCartBadge) window.updateCartBadge();

            // Kondisional alur berdasarkan metode pembayaran
            if (metodePembayaran === 'QRIS') {
                const qrisData = {
                    id_transaksi: idTransaksi,
                    total_bayar: totalBayar,
                    nama_user: namaUser,
                    // Karena kode.gs tidak membalikkan qr_code_url, ini diisi string kosong 
                    // atau bisa digenerate manual di halaman qris_payment.html nanti
                    qr_code_url: result.qr_code_url || '' 
                };
                localStorage.setItem('active_qris_trx', JSON.stringify(qrisData));
                
                alert("Pesanan dibuat. Silakan selesaikan pembayaran QRIS.");
                window.location.replace('qris_payment.html'); 
            } else {
                alert("Pesanan berhasil dibuat! Status pesanan: Sedang Dikemas.");
                window.location.replace('order_status.html'); 
            }

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
