// Eksekusi Kirim Transaksi ke Google Apps Script
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
            // Bersihkan keranjang lokal setelah pesanan berhasil dibuat
            localStorage.removeItem('cart');
            localStorage.removeItem('keranjang');
            localStorage.removeItem('cartItems');
            localStorage.removeItem('spg_cart');

            if (window.updateCartBadge) window.updateCartBadge();

            // --- CABANG ALUR PEMBAYARAN ---
            if (metodePembayaran === 'QRIS') {
                // Simpan data sementara untuk halaman QRIS
                const qrisData = {
                    id_transaksi: result.id_transaksi || ('TRX-' + Date.now()),
                    total_bayar: totalBayar,
                    nama_user: namaUser,
                    qr_code_url: result.qr_code_url || 'qris_placeholder.png' // Bisa disesuaikan dari backend jika ada
                };
                localStorage.setItem('active_qris_trx', JSON.stringify(qrisData));

                // Arahkan ke halaman barcode QRIS
                window.location.replace('qris_payment.html');
            } else {
                // Alur Tunai
                alert("Pesanan berhasil dibuat! Silakan lakukan pembayaran tunai di kasir.");
                window.location.replace('landing_page.html');
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
