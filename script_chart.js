// --- KONFIGURASI API ---
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

const namaLogIn = localStorage.getItem('namaUser');

// Variabel global untuk menampung data keranjang aktif
let currentCartItems = [];

document.addEventListener('DOMContentLoaded', () => {
    // Sesi Proteksi
    if (!namaLogIn) {
        alert("Sesi berakhir, silakan login kembali.");
        window.location.replace('index.html');
        return;
    }

    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.innerText = "Pengguna: " + namaLogIn;
    }

    // Pasang Event Listener langsung ke tombol Checkout (#btn-checkout)
    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
        btnCheckout.addEventListener('click', prosesSemuaTransaksi);
    }

    loadCartData();
});

// --- FUNGSI AMBIL DATA DARI SHEET 'chart' ---
async function loadCartData() {
    const cartList = document.getElementById('cart-list');
    const totalSection = document.getElementById('total-section');
    const btnCheckout = document.getElementById('btn-checkout');
    
    if (!cartList) return;

    try {
        // Panggil data khusus milik user yang sedang aktif login
        const resChart = await fetch(APPS_SCRIPT_URL + '?action=getCart&user=' + encodeURIComponent(namaLogIn.trim()));
        const chartResult = await resChart.json();

        if (!chartResult.success || !Array.isArray(chartResult.data) || chartResult.data.length === 0) {
            cartList.innerHTML = `<p style="text-align: center; color: #7f8c8d;">Keranjang Anda kosong.</p>`;
            currentCartItems = [];
            if (totalSection) totalSection.style.display = 'none';
            if (btnCheckout) btnCheckout.disabled = true;
            return;
        }

        currentCartItems = chartResult.data;
        if (btnCheckout) btnCheckout.disabled = false;

        cartList.innerHTML = ''; // Bersihkan teks loading awal
        let grandTotal = 0;

        // Render baris data dari spreadsheet ke elemen HTML
        currentCartItems.forEach((item) => {
            // Bersihkan sisa string/titik format ribuan sheet agar parsing angka tidak menjadi NaN
            const hargaRaw = item.harga_satuan ? item.harga_satuan.toString().replace(/[^0-9.-]/g, '') : '0';
            const totalRaw = item.total_harga ? item.total_harga.toString().replace(/[^0-9.-]/g, '') : '0';

            const harga = parseFloat(hargaRaw) || 0;
            const jumlah = parseInt(item.jumlah) || 0;
            const totalItem = parseFloat(totalRaw) || (harga * jumlah);
            
            grandTotal += totalItem;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div class="cart-info">
                    <h4>${item.nama_produk || 'Produk'} (${item.id_produk})</h4>
                    <p>Harga Satuan: Rp ${harga.toLocaleString('id-ID')}</p>
                    <p>Jumlah: <strong>${jumlah}</strong> pcs</p>
                    ${item.catatan ? `<p style="font-style: italic; color: #7f8c8d;">Catatan: "${item.catatan}"</p>` : ''}
                    <p style="font-weight: bold; margin-top: 5px;">Total: Rp ${totalItem.toLocaleString('id-ID')}</p>
                </div>
                <button type="button" class="btn-hapus" onclick="hapusItemKeranjang(event, '${item.id_produk}', this)">Hapus</button>
            `;
            cartList.appendChild(itemDiv);
        });

        // Tampilkan kalkulasi total belanjaan di bagian bawah
        if (totalSection) {
            totalSection.style.display = 'block';
            const grandTotalElem = document.getElementById('grand-total');
            if (grandTotalElem) {
                grandTotalElem.innerText = 'Rp ' + grandTotal.toLocaleString('id-ID');
            }
        }

    } catch (error) {
        console.error("Gagal memuat keranjang:", error);
        cartList.innerHTML = `<p style="text-align: center; color: #e74c3c;">Gagal memuat data keranjang.</p>`;
        if (btnCheckout) btnCheckout.disabled = true;
    }
}

// --- FUNGSI HAPUS DATA ITEM (BEBAS ERROR CORS) ---
async function hapusItemKeranjang(event, idProduk, buttonElement) {
    if (event) event.preventDefault();

    if (!confirm("Apakah Anda yakin ingin menghapus produk ini dari keranjang?")) return;

    // Kunci tombol tindakan agar tidak di-klik ganda
    buttonElement.disabled = true;
    buttonElement.innerText = "...";

    const payload = {
        action: 'deleteCartItem',
        data: {
            user: namaLogIn,
            id_produk: idProduk
        }
    };

    try {
        // Gunakan mode 'no-cors' agar browser tidak mencegat redirect Google Apps Script
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        });

        // Jeda 300ms agar Google Sheet selesai menghapus baris di server
        setTimeout(() => {
            loadCartData();
        }, 300);

    } catch (error) {
        console.error("Gagal menghapus item:", error);
        alert("Gagal terhubung ke jaringan.");
        buttonElement.disabled = false;
        buttonElement.innerText = "Hapus";
    }
}

// --- FUNGSI MELANJUTKAN TRANSAKSI ---
function prosesSemuaTransaksi() {
    if (!currentCartItems || currentCartItems.length === 0) {
        alert("Keranjang Anda kosong. Silakan pilih makanan terlebih dahulu.");
        return;
    }

    // Simpan seluruh data keranjang ke localStorage untuk dibaca oleh transaksi.html
    localStorage.setItem('checkout_items', JSON.stringify(currentCartItems));

    // Arahkan ke halaman transaksi
    window.location.href = 'transaksi.html';
}

// --- FUNGSI NAVIGASI LANDING PAGE ---
function bukaKeranjang() {
    window.location.href = 'chart.html';
}

function logout() {
    if (confirm("Apakah Anda yakin ingin keluar?")) {
        localStorage.removeItem('namaUser');
        window.location.replace('index.html');
    }
}

// --- EKSKUSI GLOBAL WINDOW (Mencegah ReferenceError pada onclick HTML) ---
window.prosesSemuaTransaksi = prosesSemuaTransaksi;
window.hapusItemKeranjang = hapusItemKeranjang;
window.bukaKeranjang = bukaKeranjang;
window.logout = logout;
