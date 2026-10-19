/************************************************
 * KONFIGURASI & SESSION GUARD
 ************************************************/
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwSCT3UhUj2-6VcXeDbBYAQDD-CjUouquTMxDnvjj8Y-eGBvo_hSfXnk0E6xGWszeGwmg/exec';

// Cek session saat halaman dimuat
if (localStorage.getItem('namaUser')) {
    window.location.replace('landing_page.html');
}

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (formLogin) formLogin.onsubmit = prosesLogin;
    if (formRegister) formRegister.onsubmit = prosesDaftar;
});

/************************************************
 * LOGIKA MODAL POPUP LOGIN
 ************************************************/
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = "flex";
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = "none";
}

// Tutup modal ketika mengklik area di luar kotak modal
window.onclick = function(event) {
    const modal = document.getElementById('loginModal');
    if (event.target === modal) {
        closeLoginModal();
    }
};

// Cek apakah user sudah login sebelum mengakses menu
function checkLoginOrRedirect() {
    if (localStorage.getItem('namaUser')) {
        window.location.href = 'landing_page.html';
    } else {
        openLoginModal();
    }
}

/************************************************
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

/************************************************
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
