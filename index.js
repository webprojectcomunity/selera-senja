/********************************----------------
 * KONFIGURASI & SESSION GUARD
 ************************************************/
// 1. URL Apps Script khusus untuk Produk, Slider Hero, & Makanan Terpopuler
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwSCT3UhUj2-6VcXeDbBYAQDD-CjUouquTMxDnvjj8Y-eGBvo_hSfXnk0E6xGWszeGwmg/exec';

// 2. URL Apps Script khusus untuk User (Login & Register)
const APPS_SCRIPT_URL_USER = 'https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec';

// Session guard: Jika user sudah login, langsung arahkan ke landing_page.html
if (localStorage.getItem('namaUser')) {
    window.location.replace('landing_page.html');
}

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (formLogin) formLogin.onsubmit = prosesLogin;
    if (formRegister) formRegister.onsubmit = prosesDaftar;

    // 1. Muat gambar dari Kolom F Sheet Produk untuk Slider Hero
    muatHeroSlider();

    // 2. Muat makanan terpopuler dari Sheet Transaksi
    muatMakananTerpopuler();

    // 3. Muat daftar produk dari Sheet Produk untuk Discover Menu
    muatDaftarProdukMenu();
});

/****************--------------------------------
 * MUAT DAN JALANKAN HERO SLIDER DARI GOOGLE DRIVE SHEET PRODUK
 ************************************************/
async function muatHeroSlider() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getHeroSlides`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            const container = document.getElementById('hero-slider-container');
            if (!container) return;

            let slidesHtml = '';
            result.data.forEach((imgUrl, index) => {
                const activeClass = index === 0 ? 'active' : '';
                slidesHtml += `<div class="hero-slide ${activeClass}" style="background-image: url('${imgUrl}');"></div>`;
            });

            container.innerHTML = slidesHtml;

            // Jalankan Slider berganti bergantian setiap 3,5 detik
            jalankanSlider();
        }
    } catch (error) {
        console.error("Gagal memuat slider hero:", error);
    }
}

function jalankanSlider() {
    const slides = document.querySelectorAll('.hero-slide');
    if (!slides || slides.length < 2) return;

    let indexSlideAktif = 0;

    setInterval(() => {
        slides[indexSlideAktif].classList.remove('active');
        indexSlideAktif = (indexSlideAktif + 1) % slides.length;
        slides[indexSlideAktif].classList.add('active');
    }, 3500);
}

/****************--------------------------------
 * MUAT MAKANAN TERPOPULER (DARI SHEET TRANSAKSI)
 ************************************************/
async function muatMakananTerpopuler() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getTopProducts`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            const dealItemsContainer = document.querySelector('.deal-items');
            if (!dealItemsContainer) return;

            let htmlContent = '';
            const topItems = result.data.slice(0, 3);

            topItems.forEach(item => {
                let gambarUrl = item.gambar || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
                let hargaStr = item.harga_satuan ? `Rp ${Number(item.harga_satuan).toLocaleString('id-ID')}` : '$49';

                htmlContent += `
                    <div class="bg-white text-gray-800 rounded-xl p-2 text-center shadow transition transform hover:-translate-y-1 cursor-pointer" onclick="checkLoginOrRedirect()">
                        <img src="${gambarUrl}" alt="${item.nama_produk}" class="w-full h-16 object-cover rounded-lg mb-2">
                        <div class="text-xs text-yellow-400 mb-1">⭐⭐⭐⭐⭐</div>
                        <div class="font-bold text-xs truncate mb-1">${item.nama_produk}</div>
                        <div class="text-[#ea1d2c] font-bold text-xs">${hargaStr}</div>
                    </div>
                `;
            });
            dealItemsContainer.innerHTML = htmlContent;
        }
    } catch (error) {
        console.error("Gagal memuat makanan terpopuler:", error);
    }
}

/****************--------------------------------
 * MUAT DAFTAR PRODUK UNTUK MENU (DISCOVER MENU)
 ************************************************/
async function muatDaftarProdukMenu(searchQuery = '') {
    const menuContainer = document.getElementById('menu-container');
    if (!menuContainer) return;

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getProducts&search=${encodeURIComponent(searchQuery)}`);
        const result = await response.json();

        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            let htmlContent = '';

            result.data.forEach(item => {
                let gambarUrl = item.gambar || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
                
                let hargaNominal = item.harga ? Number(item.harga.toString().replace(/\D/g, '')) : 0;
                let hargaStr = hargaNominal > 0 ? `Rp ${hargaNominal.toLocaleString('id-ID')}` : 'Rp 0';
                let namaProduk = item.nama || item.nama_produk || 'Produk';

                htmlContent += `
                    <div class="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition border border-gray-100 cursor-pointer flex flex-col justify-between" onclick="checkLoginOrRedirect()">
                        <div>
                            <img src="${gambarUrl}" alt="${namaProduk}" class="w-full h-44 object-cover rounded-xl mb-4" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300'">
                            <h4 class="font-bold text-gray-800 text-lg mb-1">${namaProduk}</h4>
                            <div class="text-yellow-400 text-sm mb-2">⭐⭐⭐⭐⭐</div>
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-[#ea1d2c] font-extrabold text-lg">${hargaStr}</span>
                            <span class="bg-red-50 text-[#ea1d2c] p-2 rounded-lg text-sm font-bold">+ Pesan</span>
                        </div>
                    </div>
                `;
            });

            menuContainer.innerHTML = htmlContent;
        } else {
            menuContainer.innerHTML = `<p class="col-span-full text-center text-gray-500 py-8">Menu tidak ditemukan atau belum ada data produk.</p>`;
        }
    } catch (error) {
        console.error("Gagal memuat daftar produk:", error);
        menuContainer.innerHTML = `<p class="col-span-full text-center text-red-500 py-8">Gagal memuat data menu dari server.</p>`;
    }
}

// Fungsi Pencarian Hero Section
window.jalankanPencarianHero = function() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput ? searchInput.value : '';
    muatDaftarProdukMenu(query);
};

/****************--------------------------------
 * LOGIKA MODAL POPUP LOGIN & GLOBAL EXPORT
 ************************************************/
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

window.onclick = function(event) {
    const modal = document.getElementById('loginModal');
    if (event.target === modal) {
        closeLoginModal();
    }
};

function checkLoginOrRedirect() {
    if (localStorage.getItem('namaUser')) {
        window.location.href = 'landing_page.html';
    } else {
        openLoginModal();
    }
}

function switchTab(tab) {
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tab === 'login') {
        if (btnLogin) btnLogin.className = "flex-1 py-2.5 rounded-xl font-semibold text-sm transition bg-[#ea1d2c] text-white shadow-sm";
        if (btnRegister) btnRegister.className = "flex-1 py-2.5 rounded-xl font-semibold text-sm transition text-gray-500 hover:text-gray-800";
        if (formLogin) {
            formLogin.classList.remove('hidden');
            formLogin.classList.add('flex');
        }
        if (formRegister) {
            formRegister.classList.remove('flex');
            formRegister.classList.add('hidden');
        }
    } else {
        if (btnRegister) btnRegister.className = "flex-1 py-2.5 rounded-xl font-semibold text-sm transition bg-[#ea1d2c] text-white shadow-sm";
        if (btnLogin) btnLogin.className = "flex-1 py-2.5 rounded-xl font-semibold text-sm transition text-gray-500 hover:text-gray-800";
        if (formRegister) {
            formRegister.classList.remove('hidden');
            formRegister.classList.add('flex');
        }
        if (formLogin) {
            formLogin.classList.remove('flex');
            formLogin.classList.add('hidden');
        }
    }
}

async function prosesLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btnSubmit = event.target.querySelector('.submit-btn');

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Memverifikasi...';
    }

    try {
        const response = await fetch(APPS_SCRIPT_URL_USER, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', email: email, password: password })
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('namaUser', result.user.nama);
            localStorage.setItem('idUser', result.user.id_user);
            localStorage.setItem('emailUser', result.user.email);
            window.location.replace('landing_page.html');
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error(error);
        alert('Terjadi kesalahan koneksi saat login.');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Masuk Sekarang';
        }
    }
}

async function prosesDaftar(event) {
    event.preventDefault();

    const nama = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const btnSubmit = event.target.querySelector('.submit-btn');

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Memproses...';
    }

    try {
        const response = await fetch(APPS_SCRIPT_URL_USER, {
            method: 'POST',
            body: JSON.stringify({ action: 'register', nama: nama, email: email, password: password })
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            switchTab('login');
            document.getElementById('login-email').value = email;
            document.getElementById('reg-name').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error(error);
        alert('Gagal terhubung ke server.');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Buat Akun';
        }
    }
}

// Daftarkan fungsi ke objek window agar terbaca oleh atribut onclick di HTML
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.checkLoginOrRedirect = checkLoginOrRedirect;
window.switchTab = switchTab;
