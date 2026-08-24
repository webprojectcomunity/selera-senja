// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';
const PROFILE_API_URL = 'https://script.google.com/macros/s/AKfycbwSCT3UhUj2-6VcXeDbBYAQDD-CjUouquTMxDnvjj8Y-eGBvo_hSfXnk0E6xGWszeGwmg/exec';
const tomtomApiKey = 'eEDlFbYFgMqbARs7GYv39ogTM5MzYogE'; 

const namaLogIn = localStorage.getItem('namaUser') || localStorage.getItem('currentUser'] || '';
const currentUserId = localStorage.getItem('idUser') || localStorage.getItem('userId') || '';
let currentCartData = [];
let totalBayar = 0;

// Variabel untuk menyimpan data alamat default
let userLatitude = localStorage.getItem('latitude') || '0.9103';
let userLongitude = localStorage.getItem('longitude') || '103.4435';
let userNamaJalan = localStorage.getItem('nama_jalan') || 'Alamat belum diatur';

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

document.addEventListener('DOMContentLoaded', async () => {
    // A. Ambil data profil, koordinat, & alamat terbaru dari API Database Profil
    if (currentUserId) {
        try {
            const profRes = await fetch(`${PROFILE_API_URL}?action=getUserProfile&id_user=${currentUserId}`);
            const profResult = await profRes.json();
            if (profResult.success && profResult.data) {
                if (profResult.data.latitude) userLatitude = profResult.data.latitude;
                if (profResult.data.longitude) userLongitude = profResult.data.longitude;
                if (profResult.data.nama_jalan) userNamaJalan = profResult.data.nama_jalan;
                
                // Simpan ke cache lokal
                localStorage.setItem('latitude', userLatitude);
                localStorage.setItem('longitude', userLongitude);
                localStorage.setItem('nama_jalan', userNamaJalan);
            }
        } catch (e) {
            console.error("Gagal memuat profil alamat dari database:", e);
        }
    }

    // Tampilkan nama jalan ke antarmuka
    const jalanElem = document.getElementById('display-nama-jalan');
    if (jalanElem) {
        jalanElem.innerText = userNamaJalan ? userNamaJalan : "Belum ada patokan/nama jalan yang disimpan.";
    }

    // Inisialisasi Peta TomTom Statis (Tanpa interaksi)
    initStaticMap(parseFloat(userLatitude), parseFloat(userLongitude));

    // B. Ambil data keranjang dari localStorage
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

    // C. Jika lokal kosong, tarik dari Server Transaksi
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

    // D. Validasi keranjang
    if (!currentCartData || currentCartData.length === 0) {
        alert("Tidak ada data produk yang akan di-checkout atau keranjang kosong.");
        window.location.replace('chart.html');
        return;
    }

    // E. Hitung Total Bayar
    totalBayar = 0;
    currentCartData.forEach(item => {
        const hargaRaw = item.total_harga ? item.total_harga.toString().replace(/[^0-9.-]/g, '') : ((item.harga_satuan || item.harga || 0) * (item.jumlah || 1));
        totalBayar += parseFloat(hargaRaw) || 0;
    });

    const totalBayarElem = document.getElementById('element-total-bayar');
    if (totalBayarElem) {
        totalBayarElem.innerText = formatRupiah(totalBayar);
    }

    // F. Render ringkasan item
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

// Fungsi untuk membuat peta statis TomTom (tidak bisa digeser/zoom)
function initStaticMap(lat, lng) {
    try {
        const staticMap = tt.map({
            key: tomtomApiKey,
            container: 'static-map',
            center: [lng, lat],
            zoom: 15,
            interactive: false 
        });

        new tt.Marker()
            .setLngLat([lng, lat])
            .addTo(staticMap);
    } catch (err) {
        console.error("Gagal merender peta statis:", err);
    }
}

// --- FUNGSI PROSES PEMBAYARAN AKHIR ---
function prosesPembayaranAkhir() {
    const btnSubmit = document.getElementById('btn-proses-bayar');

    const selectedRadio = document.querySelector('input[name="payment_method"]:checked');
    const metodePembayaran = selectedRadio ? selectedRadio.value : 'Tunai';

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
        id_user: currentUserId,
        id_transaksi: idTransaksi,
        total_bayar: totalBayar,
        metode_pembayaran: metodePembayaran,
        status: statusAwal,
        catatan: `Alamat: ${userNamaJalan} (Lat: ${userLatitude}, Lng: ${userLongitude})`, 
        items: currentCartData
    };

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

    document.body.appendChild(form);
    form.submit();

    // Bersihkan LocalStorage keranjang
    localStorage.removeItem('cart');
    localStorage.removeItem('keranjang');
    localStorage.removeItem('cartItems');
    localStorage.removeItem('spg_cart');
    localStorage.removeItem('checkout_items');
    if (namaLogIn) localStorage.removeItem(`cart_cache_${namaLogIn.trim()}`);
    if (window.updateCartBadge) window.updateCartBadge();

    localStorage.setItem('last_transaction_id', idTransaksi);

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
