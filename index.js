 /************************************************
     * SESSION GUARD (ANTI-BACK JIKA SUDAH LOGIN)
     ************************************************/
    if (localStorage.getItem('namaUser')) {
        window.location.replace('landing_page.html');
    }

    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwSCT3UhUj2-6VcXeDbBYAQDD-CjUouquTMxDnvjj8Y-eGBvo_hSfXnk0E6xGWszeGwmg/exec';

    /************************************************
     * JAVASCRIPT LOGIC UNTUK IMAGE SLIDER
     ************************************************/
    function jalankanSlider() {
        const slides = document.querySelectorAll('.slide');
        let indexSlideAktif = 0;

        // Mengganti slide setiap 3000 ms (3 detik)
        setInterval(() => {
            // Hapus kelas 'active' dari gambar saat ini
            slides[indexSlideAktif].classList.remove('active');
            
            // Pindah ke indeks berikutnya (kembali ke 0 jika sudah di ujung)
            indexSlideAktif = (indexSlideAktif + 1) % slides.length;
            
            // Tambahkan kelas 'active' ke gambar baru
            slides[indexSlideAktif].classList.add('active');
        }, 3000);
    }

    // Jalankan slider begitu halaman selesai dimuat
    document.addEventListener('DOMContentLoaded', () => {
        jalankanSlider();
    });

    function switchTab(tab) {
        const btnLogin = document.getElementById('btn-login');
        const btnRegister = document.getElementById('btn-register');
        const formLogin = document.getElementById('form-login');
        const formRegister = document.getElementById('form-register');

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

    async function prosesLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btnSubmit = event.target.querySelector('.submit-btn');

        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Memverifikasi...';

        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'login', email: email, password: password })
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('namaUser', result.user.nama);
                window.location.replace('landing_page.html');
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Terjadi kesalahan koneksi saat login.');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Masuk Sekarang';
        }
    }

    async function prosesDaftar(event) {
        event.preventDefault();
        const nama = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const btnSubmit = event.target.querySelector('.submit-btn');

        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Memproses...';

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
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Buat Akun';
        }
    }

    document.getElementById('form-login').onsubmit = prosesLogin;
    document.getElementById('form-register').onsubmit = prosesDaftar;