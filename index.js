/********************************----------------
 * KONFIGURASI & SESSION GUARD
 ************************************************/
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwSCT3UhUj2-6VcXeDbBYAQDD-CjUouquTMxDnvjj8Y-eGBvo_hSfXnk0E6xGWszeGwmg/exec';

// Cek session guard: Jika user sudah login, langsung arahkan ke landing_page.html
if (localStorage.getItem('namaUser')) {
    window.location.replace('landing_page.html');
}

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (formLogin) formLogin.onsubmit = prosesLogin;
    if (formRegister) formRegister.onsubmit = prosesDaftar;

    // Panggil fungsi untuk memuat makanan terpopuler saat halaman dimuat
    muatMakananTerpopuler();
});

/********************************----------------
 * AMBIL MAKANAN TERPOPULER / DEAL OF THE DAY
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
                // Pastikan URL gambar valid atau gunakan fallback gambar lokal/aman
                let gambarUrl = (item.gambar && item.gambar.startsWith('http')) 
                    ? item.gambar 
                    : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80';
                
                let hargaStr = item.harga_satuan ? `Rp ${Number(item.harga_satuan).toLocaleString('id-ID')}` : '$49';

                htmlContent += `
                    <div class="deal-item" onclick="checkLoginOrRedirect()" style="cursor: pointer;">
                        <img src="${gambarUrl}" alt="${item.nama_produk}" crossorigin="anonymous">
                        <div class="item-rating">⭐⭐⭐⭐⭐</div>
                        <div class="deal-item-name">${item.nama_produk}</div>
                        <div class="deal-item-price">${hargaStr}</div>
                    </div>
                `;
            });
            dealItemsContainer.innerHTML = htmlContent;
        }
    } catch (error) {
        console.error("Gagal memuat makanan terpopuler:", error);
    }
}

/********************************----------------
 * SWITCH TAB (MASUK / DAFTAR)
 ************************************************/
function switchTab(tab) {
    const btnLogin = document.getElementById('btn-login');
    const btnRegister = document.getElementById('btn-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (!btnLogin || !btnRegister || !formLogin || !formRegister) return;

    btnLogin.classList.remove('active');
    btnRegister.classList.remove('active');
    formLogin.classList.remove('active');
    formRegister.classList.remove('active');

    if (tab === 'login') {
        btnLogin.classList.add('active');
        formLogin.classList.add('active');
    } else {
        btnRegister.classList.add('active');
        formRegister.classList.add('active');
    }
}

/********************************----------------
 * PROSES LOGIN & DAFTAR (API CALL)
 ************************************************/
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
        const response = await fetch(APPS_SCRIPT_URL, {
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
        const response = await fetch(APPS_SCRIPT_URL, {
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
