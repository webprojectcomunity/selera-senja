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

    // Tentukan status awal: Tunai = "Sedang Dikemas", QRIS = "Belum Bayar"
    const statusAwal = (metodePembayaran === 'Tunai') ? 'Sedang Dikemas' : 'Belum Bayar';

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
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result && (result.success || result.status === 'success')) {
            const idTransaksi = (result && result.id_transaksi) ? result.id_transaksi : ('TRX-' + Date.now());

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

            // Bersihkan keranjang lokal
            localStorage.removeItem('cart');
            localStorage.removeItem('keranjang');
            localStorage.removeItem('cartItems');
            localStorage.removeItem('spg_cart');

            if (window.updateCartBadge) window.updateCartBadge();

            // KEDUANYA MASUK KE order_status.html, namun jika QRIS kita simpan sesi untuk opsi tampilkan barcode jika diperlukan
            if (metodePembayaran === 'QRIS') {
                const qrisData = {
                    id_transaksi: idTransaksi,
                    total_bayar: totalBayar,
                    nama_user: namaUser,
                    qr_code_url: (result && result.qr_code_url) ? result.qr_code_url : '' 
                };
                localStorage.setItem('active_qris_trx', JSON.stringify(qrisData));
                
                alert("Pesanan dibuat dengan status: Belum Bayar. Silakan selesaikan pembayaran QRIS.");
            } else {
                alert("Pesanan berhasil dibuat! Status pesanan: Sedang Dikemas.");
            }

            // Langsung arahkan ke halaman order_status.html untuk kedua metode
            window.location.replace('order_status.html');

        } else {
            alert("Gagal memproses pesanan: " + ((result && result.message) ? result.message : "Terjadi kesalahan server."));
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
