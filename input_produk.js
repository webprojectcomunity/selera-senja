/************************************************
 * KONFIGURASI API
 ************************************************/
// GANTI URL INI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbwBLIlk6lbANUmDwdUkMtldg0AB5aDD-9_7bAQJ6UAbcTHZeHwlnLluwyXIG2jWRxNX/exec";


/************************************************
 * ELEMENT
 ************************************************/
const btnSubmit = document.getElementById("btnSubmit");
const statusText = document.getElementById("status");
const previewBox = document.getElementById("previewBox");
const previewImg = document.getElementById("previewImg");
const gambarInput = document.getElementById("gambar");


/************************************************
 * PREVIEW GAMBAR
 ************************************************/
gambarInput.addEventListener("change", function(e) {
    const file = e.target.files[0];

    if (!file) {
        previewBox.style.display = "none";
        return;
    }

    /****************************************
     * VALIDASI SIZE (Maks 2MB)
     ****************************************/
    if (file.size > 2 * 1024 * 1024) {
        alert("Ukuran gambar maksimal 2MB");
        gambarInput.value = "";
        previewBox.style.display = "none";
        return;
    }

    const reader = new FileReader();

    reader.onload = function(evt) {
        previewImg.src = evt.target.result;
        previewBox.style.display = "block";
    };

    reader.readAsDataURL(file);
});


/************************************************
 * BUTTON CLICK
 ************************************************/
btnSubmit.addEventListener("click", uploadData);


/************************************************
 * UPLOAD DATA
 ************************************************/
function uploadData() {
    const nama = document.getElementById("nama").value.trim();
    const deskripsi = document.getElementById("deskripsi").value.trim();
    const harga = document.getElementById("harga").value.trim();

    /********************************************
     * VALIDASI
     ********************************************/
    if (!nama) {
        showStatus("⚠️ Nama produk wajib diisi", "darkred");
        return;
    }

    if (!harga) {
        showStatus("⚠️ Harga wajib diisi", "darkred");
        return;
    }

    /********************************************
     * DISABLE BUTTON
     ********************************************/
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Menyimpan...";
    showStatus("Memproses data...", "#000");

    /********************************************
     * FILE
     ********************************************/
    const file = gambarInput.files[0];

    /********************************************
     * JIKA ADA FILE
     ********************************************/
    if (file) {
        const reader = new FileReader();

        reader.onload = function(evt) {
            const base64Data = evt.target.result.split(',')[1];

            const data = {
                nama: nama,
                deskripsi: deskripsi,
                harga: harga,
                imageB64: base64Data,
                mimeType: file.type,
                filename: Date.now() + "_" + file.name
            };

            console.log("DATA KIRIM :", data);
            kirimData(data);
        };

        reader.readAsDataURL(file);

    } else {
        /****************************************
         * TANPA GAMBAR
         ****************************************/
        const data = {
            nama: nama,
            deskripsi: deskripsi,
            harga: harga,
            imageB64: "",
            mimeType: "",
            filename: ""
        };

        kirimData(data);
    }
}


/************************************************
 * KIRIM KE SERVER (DIUBAH MENGGUNAKAN FETCH)
 ************************************************/
async function kirimData(data) {
    // Membungkus data sesuai dengan format yang diminta doPost di GAS
    const payload = {
        action: "saveProduct",
        data: data
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            redirect: "follow", // Penting untuk melewati pengalihan otomatis Google
            headers: {
                "Content-Type": "text/plain;charset=utf-8", // text/plain untuk menghindari preflight CORS
            },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        console.log("RESPONSE :", res);

        if (res.success) {
            showStatus("✅ " + res.message, "green");
            console.log("IMAGE URL :", res.imageUrl);
            resetForm();
        } else {
            showStatus("❌ " + res.message, "darkred");
        }

    } catch (err) {
        console.error("Terjadi Kesalahan:", err);
        showStatus("❌ Gagal menghubungi server", "darkred");
    } finally {
        // Mengembalikan tombol ke state semula
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Simpan Produk";
    }
}


/************************************************
 * STATUS
 ************************************************/
function showStatus(message, color) {
    statusText.innerText = message;
    statusText.style.color = color;
}


/************************************************
 * RESET FORM
 ************************************************/
function resetForm() {
    document.getElementById("nama").value = "";
    document.getElementById("deskripsi").value = "";
    document.getElementById("harga").value = "";
    gambarInput.value = "";
    previewBox.style.display = "none";
}
