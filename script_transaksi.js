// --- KONFIGURASI API & TOMTOM ---
var APPS_SCRIPT_URL = window.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';
var PROFILE_API_URL = window.PROFILE_API_URL || 'https://script.google.com/macros/s/AKfycbwSCT3UhUj2-6VcXeDbBYAQDD-CjUouquTMxDnvjj8Y-eGBvo_hSfXnk0E6xGWszeGwmg/exec';
var tomtomApiKey = window.tomtomApiKey || 'eEDlFbYFgMqbARs7GYv39ogTM5MzYogE'; 

const namaLogIn = localStorage.getItem('namaUser') || localStorage.getItem('currentUser') || '';
const currentUserId = localStorage.getItem('idUser') || localStorage.getItem('userId') || localStorage.getItem('id_user') || '';
let currentCartData = [];
let totalBayar = 0;

// Variabel Peta Global ala pengaturan_alamat.html
let map, marker;
let userLatitude = localStorage.getItem('latitude') || '0.9103';
let userLongitude = localStorage.getItem('longitude') || '103.4435';
let userNamaJalan = localStorage.getItem('nama_jalan') || 'Alamat belum diatur';
let cachedEmail = localStorage.getItem('emailUser') || localStorage.getItem('email') || "";

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
}

document.addEventListener('DOMContentLoaded', async () => {
    // A. Ambil data profil, koordinat, & alamat terbaru dari API Database Profil (Sheet Users)
    if (currentUserId) {
        try {
            const profRes = await fetch(`${PROFILE_API_URL}?action=getUserProfile&id_user=${currentUserId}`);
            const profResult = await profRes.json();
            if (profResult.success && profResult.data) {
                if (profResult.data.latitude) userLatitude = profResult.data.latitude;
                if (profResult.data.longitude) userLongitude = profResult.data.longitude;
                if (profResult.data.nama_jalan) userNamaJalan = profResult.data.nama_jalan;
                if (profResult.data.email) cachedEmail = profResult.data.email;
                
                // Simpan ke cache lokal
                localStorage.setItem('latitude', userLatitude);
                localStorage.setItem('longitude', userLongitude);
                localStorage.setItem('nama_jalan', userNamaJalan);
                if (profResult.data.email) localStorage.setItem('emailUser', profResult.data.email);
                if (profResult.data.no_hp) localStorage.setItem('noHpUser', profResult.data.no_hp);
            }
        } catch (e) {
            console.error("Gagal memuat profil alamat dari database Users:", e);
        }
    }

    // Periksa ulang dari localStorage jika variabel masih kosong
    userNamaJalan = localStorage.getItem('nama_jalan') || userNamaJalan;
    userLatitude = localStorage.getItem('latitude') || userLatitude;
    userLongitude = localStorage.getItem('longitude') || userLongitude;

    let latNum = parseFloat(userLatitude) || 0.9103;
    let lngNum = parseFloat(userLongitude) || 103.4435;

    // Validasi rentang koordinat global
    if (latNum < -90 || latNum > 90 || isNaN(latNum)) latNum = 0.9103;
    if (lngNum < -180 || lngNum > 180 || isNaN(lngNum)) lngNum = 103.4435;

    userLatitude = latNum;
    userLongitude = lngNum;

    // Tampilkan nama jalan ke antarmuka
    updateAlamatUI(userNamaJalan);

    // Inisialisasi Peta TomTom Interaktif (seperti pengaturan_alamat.html)
    initInteractiveMap(userLatitude, userLongitude);

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
        const hargaRaw = item.total_harga ? item.total_harga.toString().replace(/[^0-9.-]/g, '') : ((item.harga_satuan || item.harga || 0) * (item.jumlah || item.qty || 1));
        totalBayar += parseFloat(hargaRaw) || 0;
    });

    const totalBayarElem = document.getElementById('element-total-bayar');
    if (totalBayarElem) {
        totalBayarElem.innerText = formatRupiah(totalBayar);
    }

    // F. Render ringkasan item (DENGAN GAMBAR PRODUK)
    const summaryContainer = document.getElementById('summary-items-container');
    if (summaryContainer) {
        summaryContainer.innerHTML = '';
        currentCartData.forEach(item => {
            const nama = item.nama_produk || item.nama || 'Produk';
            const qty = parseInt(item.jumlah || item.qty || 1, 10);
            const subtotal = item.total_harga ? parseFloat(item.total_harga.toString().replace(/[^0-9.-]/g, '')) : ((item.harga_satuan || item.harga || 0) * qty);
            const gambarProduk = item.gambar && item.gambar !== "" ? item.gambar : "https://via.placeholder.com/60?text=Menu";
            
            const itemRow = document.createElement('div');
            itemRow.className = "flex items-center justify-between text-xs text-slate-700 py-2 border-b border-slate-100 last:border-none";
            itemRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee; color: #555;";
            itemRow.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${gambarProduk}" alt="${nama}" onerror="this.src='https://via.placeholder.com/60?text=Menu';" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;">
                    <div>
                        <span style="font-weight: 600; color: #0f172a; display: block;">${nama}</span>
                        <span style="font-size: 11px; color: #64748b;">Jumlah: ${qty}x</span>
                    </div>
                </div>
                <span style="font-weight: 600; color: #10b981;">${formatRupiah(subtotal)}</span>
            `;
            summaryContainer.appendChild(itemRow);
        });
    }
});

// --- INISIALISASI PETA TOMTOM INTERAKTIF (ALA PENGATURAN ALAMAT) ---
function initInteractiveMap(lat, lng) {
    if (map) return;

    try {
        map = tt.map({
            key: tomtomApiKey,
            container: 'static-map',
            center: [lng, lat],
            zoom: 15
        });

        map.addControl(new tt.NavigationControl());

        marker = new tt.Marker({ draggable: true, color: '#ef4444' })
            .setLngLat([lng, lat])
            .addTo(map);

        marker.on('dragend', function() {
            var lngLat = marker.getLngLat();
            userLatitude = lngLat.lat;
            userLongitude = lngLat.lng;
            simpanAlamatKeDatabaseBackground(userLatitude, userLongitude, userNamaJalan);
        });

        map.on('click', function(e) {
            var lngLat = e.lngLat;
            marker.setLngLat(lngLat);
            userLatitude = lngLat.lat;
            userLongitude = lngLat.lng;
            simpanAlamatKeDatabaseBackground(userLatitude, userLongitude, userNamaJalan);
        });

        setTimeout(() => {
            map.resize();
        }, 300);

    } catch (err) {
        console.error("Gagal menginisialisasi peta interaktif TomTom:", err);
    }
}

// --- FUNGSI GPS TOMBOL GEOLOCATION ---
function pusatkanKePosisiGPS() {
    if (!navigator.geolocation) {
        alert("Browser Anda tidak mendukung fitur Geolocation.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            userLatitude = lat;
            userLongitude = lng;

            if (map && marker) {
                map.setCenter([lng, lat]);
                map.setZoom(16);
                marker.setLngLat([lng, lat]);
            }

            simpanAlamatKeDatabaseBackground(userLatitude, userLongitude, userNamaJalan);
            alert("Posisi peta berhasil diperbarui ke lokasi GPS Anda!");
        },
        function(error) {
            alert("Gagal mendeteksi GPS. Pastikan izin lokasi/GPS aktif.");
            console.error(error);
        },
        { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
}

// --- SIMPAN OTOMATIS KE DATABASE USERS DI LATAR BELAKANG SAAT PIN DIGESER ---
function simpanAlamatKeDatabaseBackground(lat, lng, jalan) {
    if (!currentUserId) return;

    var payload = {
        action: "updateProfile",
        id_user: currentUserId,
        nama: localStorage.getItem('namaUser') || localStorage.getItem('nama') || "User",
        email: cachedEmail || "user@placeholder.com",
        no_hp: localStorage.getItem('noHpUser') || localStorage.getItem('no_hp') || "",
        latitude: lat,
        longitude: lng,
        nama_jalan: jalan
    };

    fetch(PROFILE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            localStorage.setItem('latitude', lat);
            localStorage.setItem('longitude', lng);
        }
    })
    .catch(err => console.error("Background sync alamat gagal:", err));
}

function updateAlamatUI(namaJalan) {
    const jalanElem = document.getElementById('display-nama-jalan');
    if (jalanElem) {
        if (namaJalan && namaJalan !== "null" && namaJalan !== "undefined" && namaJalan !== "Alamat belum diatur") {
            jalanElem.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span>📍 ${namaJalan}</span>
                    <button type="button" onclick="pusatkanKePosisiGPS()" style="background: #e2e8f0; border: none; padding: 6px 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 11px; width: fit-content; color: #0f172a;">Gunakan Lokasi GPS Saya</button>
                </div>
            `;
        } else {
            jalanElem.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span>Alamat belum diatur secara spesifik pada pin peta.</span>
                    <button type="button" onclick="pusatkanKePosisiGPS()" style="background: #10b981; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 11px; width: fit-content;">Gunakan Lokasi GPS Saya</button>
                </div>
            `;
        }
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

    const userInfo = {
        id_user: currentUserId,
        nama: namaLogIn,
        email: cachedEmail,
        no_hp: localStorage.getItem('noHpUser') || '',
        latitude: userLatitude,
        longitude: userLongitude,
        nama_jalan: userNamaJalan
    };

    const formattedItems = currentCartData.map(item => {
        const qty = parseInt(item.jumlah || item.qty || 1, 10);
        const harga = parseFloat(item.harga_satuan || item.harga || 0);
        const total = item.total_harga ? parseFloat(item.total_harga.toString().replace(/[^0-9.-]/g, '')) : (harga * qty);

        return {
            id_produk: item.id_produk || '',
            nama_produk: item.nama_produk || item.nama || 'Produk',
            jumlah: qty,
            harga_satuan: harga,
            subtotal: total,
            gambar: item.gambar || ''
        };
    });

    const payload = {
        action: "createTransaction",
        user_info: userInfo,
        id_transaksi: idTransaksi,
        total_bayar: totalBayar,
        metode_pembayaran: metodePembayaran,
        status: statusAwal,
        catatan: `Alamat: ${userNamaJalan} (Lat: ${userLatitude}, Lng: ${userLongitude})`, 
        items: formattedItems
    };

    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
    })
    .then(() => {
        localStorage.removeItem('cart');
        localStorage.removeItem('keranjang');
        localStorage.removeItem('cartItems');
        localStorage.removeItem('spg_cart');
        localStorage.removeItem('checkout_items');
        if (namaLogIn) localStorage.removeItem(`cart_cache_${namaLogIn.trim()}`);
        if (window.updateCartBadge) window.updateCartBadge();

        localStorage.setItem('last_transaction_id', idTransaksi);

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
    })
    .catch(err => {
        console.error("Gagal memproses transaksi:", err);
        alert("Terjadi kesalahan koneksi saat memproses transaksi.");
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Konfirmasi & Bayar Sekarang";
        }
    });
}
