
// ======================================
// KONFIGURASI SUPABASE
// ======================================
const SUPABASE_URL = "https://rkghyjznvfxrbqkkmwkz.supabase.co";
const SUPABASE_KEY = "sb_publishable_wsZ7xGdM0FXNKaVSS3wE9w_YRi36Ehp";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];
let cart = [];
let currentPhoto = null;

// ======================================
// ELEMEN
// ======================================
const $ = (id) => document.getElementById(id);

const rupiah = (angka) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(angka || 0);

function message(id, text, color = "") {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = color || "";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showApp(show) {
  $("loginPage").classList.toggle("hidden", show);
  $("app").classList.toggle("hidden", !show);
}

// ======================================
// LOGIN DAN SESSION
// ======================================
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  $("loginButton").disabled = true;
  $("loginButton").textContent = "MEMPROSES...";
  message("loginMessage", "Sedang menghubungkan ke Supabase...");

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    if (data.session) {
      showApp(true);
      await initializeApp();
    }
  } catch (error) {
    message("loginMessage", error.message, "#ff7777");
  } finally {
    $("loginButton").disabled = false;
    $("loginButton").textContent = "LOGIN";
  }
});

$("logoutButton").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  cart = [];
  showApp(false);
  $("loginForm").reset();
  message("loginMessage", "");
});

async function checkSession() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;

    if (data.session) {
      showApp(true);
      await initializeApp();
    } else {
      showApp(false);
    }
  } catch (error) {
    console.error("Session error:", error);
    showApp(false);
    message("loginMessage", error.message, "#ff7777");
  }
}

// ======================================
// NAVIGASI
// ======================================
document.querySelectorAll(".nav-link").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    document.querySelectorAll(".page").forEach((section) => {
      section.classList.add("hidden");
    });

    document.querySelectorAll(".nav-link").forEach((nav) => {
      nav.classList.remove("active");
    });

    $(page + "Page").classList.remove("hidden");
    button.classList.add("active");

    const titles = {
      dashboard: "Dashboard",
      kasir: "Kasir",
      produk: "Data Makanan",
      riwayat: "Riwayat Transaksi"
    };

    $("pageTitle").textContent = titles[page];

    if (page === "riwayat") loadHistory();
    if (page === "dashboard") loadDashboard();
  });
});

// ======================================
// INISIALISASI
// ======================================
async function initializeApp() {
  await loadProducts();
  await loadDashboard();
  renderCart();
}

// ======================================
// DATA PRODUK
// ======================================
async function loadProducts() {
  const { data, error } = await db
    .from("produk")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
    alert("Gagal mengambil produk: " + error.message);
    return;
  }

  products = data || [];
  renderProducts();
  renderProductTable();
  renderDashboardProducts();
}

function renderProducts() {
  const keyword = $("searchCashier").value.toLowerCase();

  const filtered = products.filter((product) =>
    product.nama.toLowerCase().includes(keyword)
  );

  $("cashierProducts").innerHTML = filtered.map((product) => `
    <article class="food-card">
      <img src="${escapeHTML(product.foto || "https://placehold.co/400x300?text=Makanan")}" alt="${escapeHTML(product.nama)}">
      <div class="food-info">
        <h4>${escapeHTML(product.nama)}</h4>
        <p>${rupiah(product.harga)}</p>
        <small>${escapeHTML(product.kategori)} • Stok: ${product.stok}</small>
        <button
          data-add="${product.id}"
          ${product.stok <= 0 ? "disabled" : ""}
        >
          ${product.stok <= 0 ? "Stok Habis" : "+ Tambah"}
        </button>
      </div>
    </article>
  `).join("") || '<p class="empty">Menu tidak ditemukan.</p>';
}

function renderDashboardProducts() {
  $("dashboardProducts").innerHTML = products.slice(0, 4).map((product) => `
    <article class="food-card">
      <img src="${escapeHTML(product.foto || "https://placehold.co/400x300?text=Makanan")}" alt="${escapeHTML(product.nama)}">
      <div class="food-info">
        <h4>${escapeHTML(product.nama)}</h4>
        <p>${rupiah(product.harga)}</p>
        <small>Stok: ${product.stok}</small>
      </div>
    </article>
  `).join("") || '<p class="empty">Belum ada menu.</p>';
}

$("searchCashier").addEventListener("input", renderProducts);

// ======================================
// TAMBAH KE KERANJANG
// ======================================
$("cashierProducts").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;

  const product = products.find(
    (item) => item.id === Number(button.dataset.add)
  );

  if (!product) return;

  const existing = cart.find((item) => item.id === product.id);
  const quantity = existing ? existing.jumlah : 0;

  if (quantity >= product.stok) {
    alert("Stok makanan tidak mencukupi.");
    return;
  }

  if (existing) {
    existing.jumlah++;
  } else {
    cart.push({
      id: product.id,
      nama: product.nama,
      harga: Number(product.harga),
      jumlah: 1,
      stok: product.stok
    });
  }

  renderCart();
});

function renderCart() {
  if (!cart.length) {
    $("cartItems").innerHTML =
      '<p class="empty">Belum ada makanan dipilih</p>';
  } else {
    $("cartItems").innerHTML = cart.map((item) => `
      <div class="cart-row">
        <div>
          <b>${escapeHTML(item.nama)}</b>
          <small>${rupiah(item.harga)} × ${item.jumlah}</small>
        </div>
        <div>
          <b>${rupiah(item.harga * item.jumlah)}</b>
          <button data-remove="${item.id}">Hapus</button>
        </div>
      </div>
    `).join("");
  }

  $("cartTotal").textContent = rupiah(
    cart.reduce((total, item) => total + item.harga * item.jumlah, 0)
  );
}

$("cartItems").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;

  cart = cart.filter((item) => item.id !== Number(button.dataset.remove));
  renderCart();
});

$("clearCart").addEventListener("click", () => {
  cart = [];
  renderCart();
});

// ======================================
// CHECKOUT
// ======================================
$("checkoutButton").addEventListener("click", async () => {
  if (!cart.length) {
    alert("Keranjang masih kosong.");
    return;
  }

  const button = $("checkoutButton");
  button.disabled = true;
  button.textContent = "MEMPROSES...";

  try {
    // Periksa ulang stok dari database
    for (const item of cart) {
      const { data, error } = await db
        .from("produk")
        .select("stok,nama")
        .eq("id", item.id)
        .single();

      if (error) throw error;

      if (data.stok < item.jumlah) {
        throw new Error("Stok " + data.nama + " tidak mencukupi.");
      }
    }

    const total = cart.reduce(
      (sum, item) => sum + item.harga * item.jumlah, 0
    );

    const { data: sale, error: saleError } = await db
      .from("penjualan")
      .insert({
        total,
        metode_pembayaran: $("paymentMethod").value
      })
      .select()
      .single();

    if (saleError) throw saleError;

    const details = cart.map((item) => ({
      penjualan_id: sale.id,
      produk_id: item.id,
      nama_produk: item.nama,
      harga: item.harga,
      jumlah: item.jumlah,
      subtotal: item.harga * item.jumlah
    }));

    const { error: detailError } = await db
      .from("detail_penjualan")
      .insert(details);

    if (detailError) throw detailError;

    for (const item of cart) {
      const { error } = await db
        .from("produk")
        .update({ stok: item.stok - item.jumlah })
        .eq("id", item.id);

      if (error) throw error;
    }

    alert("Transaksi berhasil!\nTotal: " + rupiah(total));

    cart = [];
    renderCart();
    await loadProducts();
    await loadDashboard();
    await loadHistory();

  } catch (error) {
    alert("Transaksi gagal: " + error.message);
    console.error(error);
  } finally {
    button.disabled = false;
    button.textContent = "PROSES PEMBAYARAN";
  }
});

// ======================================
// FORM PRODUK
// ======================================
$("addProductButton").addEventListener("click", () => {
  resetProductForm();
  $("productFormContainer").classList.remove("hidden");
});

$("cancelProductButton").addEventListener("click", () => {
  $("productFormContainer").classList.add("hidden");
});

function resetProductForm() {
  $("productForm").reset();
  $("productId").value = "";
  currentPhoto = null;
  $("photoPreview").src = "";
  $("photoPreview").classList.add("hidden");
  $("productFormTitle").textContent = "Tambah Makanan";
  message("productMessage", "");
}

$("productPhoto").addEventListener("change", () => {
  const file = $("productPhoto").files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("File harus berupa gambar.");
    $("productPhoto").value = "";
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    alert("Ukuran gambar maksimal 3 MB.");
    $("productPhoto").value = "";
    return;
  }

  const preview = URL.createObjectURL(file);
  $("photoPreview").src = preview;
  $("photoPreview").classList.remove("hidden");
});

async function uploadPhoto(file) {
  if (!file) return currentPhoto;

  const extension = file.name.split(".").pop().toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const path = fileName;

  const { error } = await db.storage
    .from("foto-makanan")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const { data } = db.storage
    .from("foto-makanan")
    .getPublicUrl(path);

  return data.publicUrl;
}

$("productForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const button = $("saveProductButton");
  button.disabled = true;
  button.textContent = "MENYIMPAN...";

  try {
    const id = $("productId").value;
    const file = $("productPhoto").files[0];

    const foto = await uploadPhoto(file);

    const productData = {
      nama: $("productName").value.trim(),
      kategori: $("productCategory").value,
      harga: Number($("productPrice").value),
      stok: Number($("productStock").value),
      foto: foto || null
    };

    if (!productData.nama || productData.harga < 0 || productData.stok < 0) {
      throw new Error("Periksa kembali data makanan.");
    }

    let result;

    if (id) {
      result = await db
        .from("produk")
        .update(productData)
        .eq("id", Number(id));
    } else {
      result = await db
        .from("produk")
        .insert(productData);
    }

    if (result.error) throw result.error;

    message("productMessage", "Makanan berhasil disimpan.", "#63d89b");
    resetProductForm();
    $("productFormContainer").classList.add("hidden");
    await loadProducts();
    await loadDashboard();

  } catch (error) {
    message("productMessage", error.message, "#ff7777");
    console.error(error);
  } finally {
    button.disabled = false;
    button.textContent = "Simpan Makanan";
  }
});

// ======================================
// TABEL PRODUK
// ======================================
function renderProductTable() {
  const keyword = $("searchProducts").value.toLowerCase();

  const filtered = products.filter((product) =>
    product.nama.toLowerCase().includes(keyword)
  );

  $("productTable").innerHTML = filtered.map((product) => `
    <tr>
      <td>
        <img src="${escapeHTML(product.foto || "https://placehold.co/100x100?text=Foto")}" alt="">
      </td>
      <td>${escapeHTML(product.nama)}</td>
      <td>${escapeHTML(product.kategori)}</td>
      <td>${rupiah(product.harga)}</td>
      <td>${product.stok}</td>
      <td>
        <button class="edit-btn" data-edit="${product.id}">Edit</button>
        <button class="danger-btn" data-delete="${product.id}">Hapus</button>
      </td>
    </tr>
  `).join("") || `
    <tr><td colspan="6" class="empty">Belum ada makanan.</td></tr>
  `;
}

$("searchProducts").addEventListener("input", renderProductTable);

$("productTable").addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    const product = products.find(
      (item) => item.id === Number(editButton.dataset.edit)
    );

    if (!product) return;

    resetProductForm();
    $("productId").value = product.id;
    $("productName").value = product.nama;
    $("productCategory").value = product.kategori;
    $("productPrice").value = product.harga;
    $("productStock").value = product.stok;

    currentPhoto = product.foto;

    if (product.foto) {
      $("photoPreview").src = product.foto;
      $("photoPreview").classList.remove("hidden");
    }

    $("productFormTitle").textContent = "Edit Makanan";
    $("productFormContainer").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (deleteButton) {
    const id = Number(deleteButton.dataset.delete);

    if (!confirm("Yakin ingin menghapus makanan ini?")) return;

    const { error } = await db.from("produk").delete().eq("id", id);

    if (error) {
      alert("Gagal menghapus: " + error.message);
      return;
    }

    await loadProducts();
    await loadDashboard();
  }
});

// ======================================
// DASHBOARD
// ======================================
async function loadDashboard() {
  const { data: sales, error } = await db
    .from("penjualan")
    .select("total");

  if (error) {
    console.error(error);
    return;
  }

  $("totalProduk").textContent = products.length;
  $("totalTransaksi").textContent = sales.length;

  const income = sales.reduce(
    (sum, item) => sum + Number(item.total), 0
  );

  $("totalPendapatan").textContent = rupiah(income);
  renderDashboardProducts();
}

// ======================================
// RIWAYAT TRANSAKSI
// ======================================
async function loadHistory() {
  const { data, error } = await db
    .from("penjualan")
    .select("*")
    .order("tanggal", { ascending: false });

  if (error) {
    alert("Gagal memuat riwayat: " + error.message);
    return;
  }

  $("historyTable").innerHTML = (data || []).map((sale) => `
    <tr>
      <td>#${sale.id}</td>
      <td>${new Date(sale.tanggal).toLocaleString("id-ID")}</td>
      <td>${rupiah(sale.total)}</td>
      <td>${escapeHTML(sale.metode_pembayaran)}</td>
      <td><button class="edit-btn" data-detail="${sale.id}">Lihat</button></td>
    </tr>
  `).join("") || `
    <tr><td colspan="5" class="empty">Belum ada transaksi.</td></tr>
  `;
}

$("historyTable").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-detail]");
  if (!button) return;

  const id = Number(button.dataset.detail);

  const { data, error } = await db
    .from("detail_penjualan")
    .select("*")
    .eq("penjualan_id", id);

  if (error) {
    alert(error.message);
    return;
  }

  $("historyDetail").innerHTML = `
    <h3>Detail Transaksi #${id}</h3>
    ${data.map((item) => `
      <div class="cart-row">
        <span>${escapeHTML(item.nama_produk)} × ${item.jumlah}</span>
        <b>${rupiah(item.subtotal)}</b>
      </div>
    `).join("")}
  `;
});

// ======================================
// MULAI APLIKASI
// ======================================
checkSession();

