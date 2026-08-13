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
const formTitle = document.getElementById("formTitle");

// Element Mode & Update
const selectProduk = document.getElementById("selectProduk");
const idProdukInput = document.getElementById("idProduk");

// Element Foto Produk
const previewBox = document.getElementById("previewBox");
const previewImg = document.getElementById("previewImg");
const gambarInput = document.getElementById("gambar");

// Element QR Code
const qrCodeInput = document.getElementById("qrCode");
const previewQrBox = document.getElementById("previewQrBox");
const previewQrImg = document.getElementById("previewQrImg");


/************************************************
 * LOAD DAFTAR PRODUK SAAT HALAMAN DIMUAT
 ************************************************/
document.addEventListener("DOMContentLoaded", function() {
    loadDaftarProduk();
});

async function loadDaftarProduk() {
    try {
        const response = await fetch(API_URL + "?action=getProducts");
        const products = await response.json();
        
        if (selectProduk && Array.isArray(products)) {
            // Bersihkan opsi kecuali yang pertama
            selectProduk.innerHTML = '<option value="">-- Tambah Produk Baru --</option>';
            
            products.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p.id_produk;
                opt.textContent = `${p.id_produk} - ${p.nama}`;
                selectProduk.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Gagal memuat daftar produk:", err);
    }
}


/************************************************
 * PILIH PRODUK UNTUK UPDATE / EDIT
 ************************************************/
if (selectProduk) {
    selectProduk.addEventListener("change", async function() {
        const selectedId = this.value;

        if (!selectedId) {
            // Reset form kembali ke mode tambah baru
            resetForm();
            if (formTitle) formTitle.innerText = "Tambah Produk";
            btnSubmit.innerText = "Simpan Produk";
            return;
        }

        showStatus("Memuat data produk...", "#000");

        try {
            const response = await fetch(API_URL + "?action=getProducts");
            const products = await response.json();
            const produk = products.find(p => p.id_produk === selectedId);

            if (produk) {
                idProdukInput.value = produk.id_produk;
                document.getElementById("nama").value = produk.nama || "";
                document.getElementById("deskripsi").value = produk.deskripsi || "";
                document.getElementById("harga").value = produk.harga || "";

                // Tampilkan preview foto produk jika ada
                if (produk.gambar) {
                    previewImg.src = produk.gambar;
                    previewBox.style.display = "block";
                } else {
                    previewBox.style.display = "none";
                }

                // Tampilkan preview QR Code jika ada
                if (produk.qr_code) {
                    previewQrImg.src = produk.qr_code;
                    previewQrBox.style.display = "block";
                } else {
                    previewQrBox.style.display = "none";
                }

                if (formTitle) formTitle.innerText = "Update Produk (" + produk.id_produk + ")";
                btnSubmit.innerText = "Update Produk";
                showStatus("✅ Data produk dimuat. Silakan perbarui.", "green");
            }
        } catch (err) {
            console.error("Gagal mengambil detail produk:", err);
            showStatus("❌ Gagal memuat data produk", "darkred");
        }
    });
}


/************************************************
 * PREVIEW GAMBAR PRODUK
 ************************************************/
gambarInput.addEventListener("change", function(e) {
    const file = e.target.files[0];

    if (!file) {
        previewBox.style.display = "none";
        return;
    }

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
 * PREVIEW QR CODE
 ************************************************/
if (qrCodeInput) {
    qrCodeInput.addEventListener("change", function(e) {
        const file = e.target.files[0];

        if (!file) {
            previewQrBox.style.display = "none";
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert("Ukuran QR Code maksimal 2MB");
            qrCodeInput.value = "";
            previewQrBox.style.display = "none";
            return;
        }

        const reader = new FileReader();

        reader.onload = function(evt) {
            previewQrImg.src = evt.target.result;
            previewQrBox.style.display = "block";
        };

        reader.readAsDataURL(file);
    });
}


/************************************************
 * BUTTON CLICK
 ************************************************/
btnSubmit.addEventListener("click", uploadData);


/************************************************
 * UPLOAD / UPDATE DATA
 ************************************************/
function uploadData() {
    const idProduk = idProdukInput.value.trim();
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
    btnSubmit.innerText = idProduk ? "Memperbarui..." : "Menyimpan...";
    showStatus("Memproses data...", "#000");

    const fileGambar = gambarInput.files[0];
    const fileQr = qrCodeInput ? qrCodeInput.files[0] : null;

    // Helper untuk membaca file ke base64
    const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve({ base64: "", mimeType: "", filename: "" });
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                const base64Data = evt.target.result.split(',')[1];
                resolve({
                    base64: base64Data,
                    mimeType: file.type,
                    filename: Date.now() + "_" + file.name
                });
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    };

    // Proses pembacaan file gambar produk dan QR code secara bersamaan
    Promise.all([
        readFileAsBase64(fileGambar),
        readFileAsBase64(fileQr)
    ]).then(([imgResult, qrResult]) => {
        const data = {
            id_produk: idProduk,
            nama: nama,
            deskripsi: deskripsi,
            harga: harga,
            // Data Foto Produk
            imageB64: imgResult.base64,
            mimeType: imgResult.mimeType,
            filename: imgResult.filename,
            // Data QR Code
            qrB64: qrResult.base64,
            qrMimeType: qrResult.mimeType,
            qrFilename: qrResult.filename
        };

        console.log("DATA KIRIM :", data);
        kirimData(data, idProduk ? "updateProduct" : "saveProduct");
    }).catch(err => {
        console.error("Gagal membaca file:", err);
        showStatus("❌ Gagal memproses file gambar", "darkred");
        btnSubmit.disabled = false;
        btnSubmit.innerText = idProduk ? "Update Produk" : "Simpan Produk";
    });
}


/************************************************
 * KIRIM KE SERVER
 * GOOGLE APPS SCRIPT + GITHUB PAGES
 ************************************************/
async function kirimData(data, actionType) {
    const payload = {
        action: actionType,
        data: data
    };

    try {
        console.log("PAYLOAD DIKIRIM:", payload);

        const response = await fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        console.log("Request berhasil dikirim ke Google Apps Script");

        const successMsg = actionType === "updateProduct" 
            ? "✅ Produk berhasil diperbarui!" 
            : "✅ Produk sedang diproses dan berhasil disimpan!";

        showStatus(successMsg, "green");

        setTimeout(function () {
            resetForm();
            loadDaftarProduk(); // Refresh daftar produk di select
        }, 1500);

    } catch (err) {
        console.error("Terjadi Kesalahan:", err);
        showStatus(
            "❌ Gagal mengirim data ke server. Periksa koneksi atau URL API.",
            "darkred"
        );
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = idProdukInput.value ? "Update Produk" : "Simpan Produk";
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
    if (selectProduk) selectProduk.value = "";
    if (idProdukInput) idProdukInput.value = "";
    if (formTitle) formTitle.innerText = "Tambah Produk";

    document.getElementById("nama").value = "";
    document.getElementById("deskripsi").value = "";
    document.getElementById("harga").value = "";
    
    // Reset Foto Produk
    gambarInput.value = "";
    previewBox.style.display = "none";
    
    // Reset QR Code
    if (qrCodeInput) {
        qrCodeInput.value = "";
        previewQrBox.style.display = "none";
    }
}
