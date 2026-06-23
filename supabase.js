/* ============================================================
   AN PROGRESS — SUPABASE.JS
   Cloud Sync & Google Auth — File Terpisah dari script.js

   CARA PAKAI:
   1. Ganti SUPABASE_URL dan SUPABASE_ANON_KEY dengan milikmu
   2. Tambahkan <script src="supabase.js"></script> di index.html
      SEBELUM <script src="script.js"></script>
   3. script.js tidak perlu diubah besar — cukup panggil:
      window.ANSupabase.syncData()  → setelah simpanData()
      window.ANSupabase.loadData()  → saat pertama login
   ============================================================ */

"use strict";

/* ============================================================
   KONFIGURASI — GANTI INI DENGAN MILIKMU
   Ambil dari: Supabase Dashboard > Settings > API
   ============================================================ */
const SUPABASE_URL = "https://sbeabxlsnjcclccasqdi.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZWFieGxzbmpjY2xjY2FzcWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDQ0MDksImV4cCI6MjA5NzY4MDQwOX0.zsoUh0tu5U-6exwK2USJv7jFvEfqPunYlfGULIy8rLk";

/* ============================================================
   INISIALISASI CLIENT
   Menggunakan Supabase CDN — sudah di-load via index.html
   ============================================================ */
// Access token disimpan di sini, diupdate setiap auth state berubah
let _accessToken = null;

// Buat Supabase client dengan custom fetch
// Tujuan: inject Authorization header dari token terbaru di setiap request
const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (url, options = {}) => {
      // Inject header Authorization + Content-Type di setiap request
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {}),
      };
      if (_accessToken) {
        headers['Authorization'] = `Bearer ${_accessToken}`;
      }
      return fetch(url, { ...options, headers });
    }
  }
});

/* ============================================================
   STATE INTERNAL
   ============================================================ */
let _currentUser = null; // object user Supabase (atau null)
let _syncPending = false; // flag debounce sync
let _syncTimer = null; // timer debounce

/* ============================================================
   UTILITAS INTERNAL
   ============================================================ */
function _log(msg, data) {
  console.log(`[ANSupabase] ${msg}`, data ?? "");
}

function _err(msg, error) {
  console.error(`[ANSupabase] ❌ ${msg}`, error);
}

/* Ambil APP state dari script.js — sudah global */
function _getAPP() {
  return typeof APP !== "undefined" ? APP : null;
}

/* ============================================================
   AUTH — LOGIN, LOGOUT, SESSION
   ============================================================ */

/**
 * Login menggunakan Google OAuth
 * Setelah redirect kembali, Supabase otomatis simpan session
 */
async function loginGoogle() {
  try {
    const { error } = await _sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
      },
    });
    if (error) throw error;
  } catch (e) {
    _err("Login Google gagal", e);
    _showNotif("Login gagal: " + e.message, "error");
  }
}

/**
 * Logout
 */
async function logout() {
  try {
    await _sb.auth.signOut();
    _currentUser = null;
    _updateUILogin(null);
    _log("Logout berhasil");
    _showNotif("Berhasil logout.", "default");
  } catch (e) {
    _err("Logout gagal", e);
  }
}

/**
 * Ambil user saat ini (sync — dari cache internal)
 */
function getCurrentUser() {
  return _currentUser;
}

/**
 * Cek session saat pertama load
 * Dipanggil otomatis saat supabase.js dimuat
 */
async function _initSession() {
  // INITIAL_SESSION event dari onAuthStateChange sudah handle loadData.
  // _initSession hanya untuk inisialisasi token awal.
  try {
    const { data: { session } } = await _sb.auth.getSession();
    _accessToken = session?.access_token ?? null;
    if (session?.user) {
      _currentUser = session.user;
      _log("Session ditemukan:", _currentUser.email);
      _updateUILogin(_currentUser);
    } else {
      _log("Tidak ada session aktif.");
      _updateUILogin(null);
    }
  } catch (e) {
    _err("initSession gagal", e);
  }
}

/**
 * Tunggu APP dari script.js siap sebelum loadData
 * Mencegah race condition "APP tidak ditemukan"
 */
function _waitAppReadyThenLoad() {
  if (window._ANAppReady) {
    loadData();
  } else {
    window.addEventListener('an-app-ready', () => loadData(), { once: true });
    setTimeout(() => {
      if (!window._ANAppReady && _currentUser) {
        _log("Fallback load setelah timeout");
        loadData();
      }
    }, 4000);
  }
}

/**
 * Listen perubahan auth state (login/logout otomatis)
 */
_sb.auth.onAuthStateChange(async (event, session) => {
  _log("Auth event:", event);

  // SELALU update token dulu — ini kunci fix 403 dan PGRST102
  _accessToken = session?.access_token ?? null;

  if (event === "INITIAL_SESSION" && session?.user) {
    // Session sudah ada saat page load
    _currentUser = session.user;
    _updateUILogin(_currentUser);
    _waitAppReadyThenLoad();
  } else if (event === "SIGNED_IN" && session?.user) {
    // User baru saja login
    _currentUser = session.user;
    _updateUILogin(_currentUser);
    _waitAppReadyThenLoad();
    _showNotif(
      `Halo, ${_currentUser.user_metadata?.name ?? "User"}! Data dimuat dari cloud.`,
      "success",
    );
  } else if (event === "TOKEN_REFRESHED" && session) {
    // Token di-refresh otomatis — update token baru
    _accessToken = session.access_token;
    _log("Token refreshed");
  } else if (event === "SIGNED_OUT") {
    _currentUser = null;
    _accessToken = null;
    _updateUILogin(null);
  }
});

/* ============================================================
   UI HELPER — Update tampilan login di sidebar/profil
   ============================================================ */
function _updateUILogin(user) {
  /* Elemen sidebar user info */
  const nameEl = document.getElementById("sidebar-user-name");
  const levelEl = document.getElementById("sidebar-user-level");
  const avatarEl = document.getElementById("sidebar-user-avatar");

  /* Elemen tombol login/logout di halaman Pengaturan */
  const btnManualSync = document.getElementById("btn-manual-sync");
  const btnLogin = document.getElementById("btn-google-login");
  const btnLogout = document.getElementById("btn-google-logout");
  const userInfo = document.getElementById("supabase-user-info");
  const userEmail = document.getElementById("supabase-user-email");
  const userPhoto = document.getElementById("supabase-user-photo");

  if (user) {
    const nama = user.user_metadata?.full_name ?? user.email;
    const foto = user.user_metadata?.avatar_url ?? "";
    const email = user.email ?? "";

    /* Sidebar */
    if (nameEl) nameEl.textContent = nama.split(" ")[0];
    if (avatarEl && foto) {
      avatarEl.style.backgroundImage = `url(${foto})`;
      avatarEl.textContent = "";
    }

    /* Pengaturan panel */
    if (btnLogin) btnLogin.style.display = "none";
    if (btnManualSync) btnManualSync.style.display = "inline-flex";
    if (btnLogout) btnLogout.style.display = "inline-flex";
    if (userInfo) userInfo.style.display = "flex";
    if (userEmail) userEmail.textContent = email;
    if (userPhoto && foto) userPhoto.src = foto;
  } else {
    /* Reset sidebar */
    if (avatarEl) {
      avatarEl.style.backgroundImage = "";
    }

    /* Pengaturan panel */
    if (btnLogin) btnLogin.style.display = "inline-flex";
    if (btnManualSync) btnManualSync.style.display = "none";
    if (btnLogout) btnLogout.style.display = "none";
    if (userInfo) userInfo.style.display = "none";
  }
}

/* ============================================================
   CLOUD SYNC — KIRIM DATA KE SUPABASE
   Dipanggil setelah simpanData() di script.js
   Menggunakan debounce 2 detik agar tidak spam API
   ============================================================ */

/**
 * Trigger sync dengan debounce
 * Panggil ini setiap kali ada perubahan data
 */
function syncData() {
  if (!_currentUser) return; // skip kalau belum login
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _doSync();
  }, 2000); // tunggu 2 detik setelah aksi terakhir
}

/**
 * Eksekusi sync ke Supabase
 */
async function _doSync() {
  if (!_currentUser) return;
  const app = _getAPP();
  if (!app) {
    _err("APP tidak ditemukan");
    return;
  }

  const uid = _currentUser.id;
  _log("Memulai sync untuk user:", _currentUser.email);

  try {
    await Promise.all([
      _syncProfile(uid, app),
      _syncTable("quests", uid, app.quest),
      _syncTable("inventory", uid, app.inventory),
      _syncTable("wishlist", uid, app.wishlist),
      _syncTable("goals", uid, app.goals),
      _syncTable("savings", uid, app.savings),
      _syncTable("finance_accounts", uid, app.accounts),
      _syncTable("transactions", uid, app.transactions),
      _syncTable("activity_logs", uid, app.activityLog),
      _syncTable("ai_chats", uid, app.aiChats),
      _syncTable("sosial", uid, app.sosial),
    ]);
    _log("✅ Sync selesai");
  } catch (e) {
    _err("Sync gagal", e);
  }
}

/**
 * Sync tabel profiles (data tunggal per user)
 */
async function _syncProfile(uid, app) {
  const payload = {
    id: uid,
    nama: app.profil?.nama ?? "",
    panggilan: app.profil?.panggilan ?? "",
    umur: app.profil?.umur ?? "",
    lahir: app.profil?.lahir ?? "",
    kota: app.profil?.kota ?? "",
    deskripsi: app.profil?.deskripsi ?? "",
    foto: app.profil?.foto ?? "",
    level: app.level ?? 1,
    exp: app.exp ?? 0,
    total_exp: app.totalExp ?? 0,
    dark_mode: app.darkMode ?? false,
    stats: app.stats ?? {},
    productivity_log: app.productivityLog ?? {},
    updated_at: new Date().toISOString(),
  };

  const { error } = await _sb
    .from("profiles")
    .upsert(payload, { onConflict: "id" });
  if (error) _err("Sync profiles gagal", error);
}

/**
 * Sync tabel array (quests, inventory, dll)
 * Strategi: upsert semua item + hapus yang sudah tidak ada
 */
async function _syncTable(table, uid, items) {
  if (!Array.isArray(items) || items.length === 0) {
    // Kalau array kosong, hapus semua data di cloud untuk table ini
    const { error } = await _sb.from(table).delete().eq("user_id", uid);
    if (error) _err(`Hapus ${table} gagal`, error);
    return;
  }

  /* Mapping key camelCase → snake_case per tabel */
  const mapped = items.map((item) => _mapToDb(table, uid, item));

  /* Upsert semua */
  const { error: upsertErr } = await _sb
    .from(table)
    .upsert(mapped, { onConflict: "id" });
  if (upsertErr) {
    _err(`Upsert ${table} gagal`, upsertErr);
    return;
  }

  /* Hapus yang sudah tidak ada di local */
  const localIds = items.map((i) => i.id);
  const { error: delErr } = await _sb
    .from(table)
    .delete()
    .eq("user_id", uid)
    .not("id", "in", `(${localIds.map((id) => `'${id}'`).join(",")})`);
  if (delErr) _err(`Hapus orphan ${table} gagal`, delErr);
}

/**
 * Mapping data APP → format kolom DB per tabel
 */
function _mapToDb(table, uid, item) {
  const base = {
    id: item.id,
    user_id: uid,
    updated_at: new Date().toISOString(),
  };

  switch (table) {
    case "quests":
      return {
        ...base,
        judul: item.judul,
        deskripsi: item.deskripsi,
        kategori: item.kategori,
        hari: item.hari,
        exp: item.exp,
        tipe: item.tipe,
        selesai: item.selesai,
        tanggal: item.tanggal,
      };
    case "inventory":
      return {
        ...base,
        gambar: item.gambar,
        nama: item.nama,
        harga: item.harga,
        tanggal_beli: item.tanggalBeli,
        kondisi: item.kondisi,
        catatan: item.catatan,
      };
    case "wishlist":
      return {
        ...base,
        gambar: item.gambar,
        nama: item.nama,
        spesifikasi: item.spesifikasi,
        harga: item.harga,
        grup: item.grup,
        status: item.status,
        tanggal_beli: item.tanggalBeli,
      };
    case "goals":
      return {
        ...base,
        judul: item.judul,
        kategori: item.kategori,
        deskripsi: item.deskripsi,
        selesai: item.selesai,
      };
    case "savings":
      return {
        ...base,
        nama: item.nama,
        target: item.target,
        terkumpul: item.terkumpul,
        deadline: item.deadline,
      };
    case "finance_accounts":
      return { ...base, nama: item.nama, ikon: item.ikon, saldo: item.saldo };
    case "transactions":
      return {
        ...base,
        tipe: item.tipe,
        nominal: item.nominal,
        kategori: item.kategori,
        akun: item.akun,
        tanggal: item.tanggal,
        catatan: item.catatan,
      };
    case "activity_logs":
      return {
        ...base,
        tipe: item.tipe,
        teks: item.teks,
        waktu: item.waktu ?? new Date().toISOString(),
      };
    case "ai_chats":
      return { ...base, judul: item.judul, pesan: item.pesan ?? [] };
    case "sosial":
      return {
        ...base,
        tipe: item.tipe,
        deskripsi: item.deskripsi,
        tanggal: item.tanggal,
      };
    default:
      return { ...base, ...item };
  }
}

/* ============================================================
   LOAD DATA — AMBIL DATA DARI SUPABASE KE APP
   Dipanggil saat pertama login atau buka app dengan session aktif
   ============================================================ */

/**
 * Load semua data dari Supabase ke APP
 * Hanya jalan kalau user sudah login
 */
async function loadData() {
  if (!_currentUser) {
    _log("loadData: belum login, skip.");
    return;
  }
  const app = _getAPP();
  if (!app) {
    _err("APP tidak ditemukan");
    return;
  }

  // Pastikan token fresh sebelum semua request
  const { data: { session: freshSession } } = await _sb.auth.getSession();
  if (freshSession?.access_token) {
    _accessToken = freshSession.access_token;
  }

  const uid = _currentUser.id;
  _log("Memuat data dari cloud untuk:", _currentUser.email);

  try {
    const [
      profile,
      quests,
      inventory,
      wishlist,
      goals,
      savings,
      accounts,
      transactions,
      actLog,
      aiChats,
      sosial,
    ] = await Promise.all([
      _sb.from("profiles").select("*").eq("id", uid).single(),
      _sb.from("quests").select("*").eq("user_id", uid),
      _sb.from("inventory").select("*").eq("user_id", uid),
      _sb.from("wishlist").select("*").eq("user_id", uid),
      _sb.from("goals").select("*").eq("user_id", uid),
      _sb.from("savings").select("*").eq("user_id", uid),
      _sb.from("finance_accounts").select("*").eq("user_id", uid),
      _sb.from("transactions").select("*").eq("user_id", uid),
      _sb
        .from("activity_logs")
        .select("*")
        .eq("user_id", uid)
        .order("waktu", { ascending: false })
        .limit(200),
      _sb.from("ai_chats").select("*").eq("user_id", uid),
      _sb.from("sosial").select("*").eq("user_id", uid),
    ]);

    /* Merge profile */
    if (profile.data) {
      const p = profile.data;
      app.profil = {
        nama: p.nama,
        panggilan: p.panggilan,
        umur: p.umur,
        lahir: p.lahir,
        kota: p.kota,
        deskripsi: p.deskripsi,
        foto: p.foto,
      };
      app.level = p.level ?? 1;
      app.exp = p.exp ?? 0;
      app.totalExp = p.total_exp ?? 0;
      app.darkMode = p.dark_mode ?? false;
      app.stats = p.stats ?? {
        pengetahuan: 0,
        kesehatan: 0,
        uang: 0,
        sosial: 0,
      };
      app.productivityLog = p.productivity_log ?? {};
    }

    /* Merge array data — mapping snake_case → camelCase */
    if (quests.data?.length) app.quest = quests.data.map(_mapFromDb_quest);
    if (inventory.data?.length)
      app.inventory = inventory.data.map(_mapFromDb_inventory);
    if (wishlist.data?.length)
      app.wishlist = wishlist.data.map(_mapFromDb_wishlist);
    if (goals.data?.length) app.goals = goals.data.map(_mapFromDb_goals);
    if (savings.data?.length)
      app.savings = savings.data.map(_mapFromDb_savings);
    if (accounts.data?.length)
      app.accounts = accounts.data.map(_mapFromDb_accounts);
    if (transactions.data?.length)
      app.transactions = transactions.data.map(_mapFromDb_transactions);
    if (actLog.data?.length)
      app.activityLog = actLog.data.map(_mapFromDb_actlog);
    if (aiChats.data?.length) app.aiChats = aiChats.data.map(_mapFromDb_aichat);
    if (sosial.data?.length) app.sosial = sosial.data.map(_mapFromDb_sosial);

    /* Simpan ke LocalStorage sebagai cache */
    if (typeof simpanData === "function") simpanData();

    /* Re-render semua */
    if (typeof renderAll === "function") renderAll();

    _log("✅ Data berhasil dimuat dari cloud");
  } catch (e) {
    _err("loadData gagal", e);
  }
}

/* ============================================================
   MAPPING DB → APP (snake_case → camelCase)
   ============================================================ */
const _mapFromDb_quest = (r) => ({
  id: r.id,
  judul: r.judul,
  deskripsi: r.deskripsi,
  kategori: r.kategori,
  hari: r.hari,
  exp: r.exp,
  tipe: r.tipe,
  selesai: r.selesai,
  tanggal: r.tanggal,
});
const _mapFromDb_inventory = (r) => ({
  id: r.id,
  gambar: r.gambar,
  nama: r.nama,
  harga: r.harga,
  tanggalBeli: r.tanggal_beli,
  kondisi: r.kondisi,
  catatan: r.catatan,
});
const _mapFromDb_wishlist = (r) => ({
  id: r.id,
  gambar: r.gambar,
  nama: r.nama,
  spesifikasi: r.spesifikasi,
  harga: r.harga,
  grup: r.grup,
  status: r.status,
  tanggalBeli: r.tanggal_beli,
});
const _mapFromDb_goals = (r) => ({
  id: r.id,
  judul: r.judul,
  kategori: r.kategori,
  deskripsi: r.deskripsi,
  selesai: r.selesai,
});
const _mapFromDb_savings = (r) => ({
  id: r.id,
  nama: r.nama,
  target: r.target,
  terkumpul: r.terkumpul,
  deadline: r.deadline,
});
const _mapFromDb_accounts = (r) => ({
  id: r.id,
  nama: r.nama,
  ikon: r.ikon,
  saldo: r.saldo,
});
const _mapFromDb_transactions = (r) => ({
  id: r.id,
  tipe: r.tipe,
  nominal: r.nominal,
  kategori: r.kategori,
  akun: r.akun,
  tanggal: r.tanggal,
  catatan: r.catatan,
});
const _mapFromDb_actlog = (r) => ({
  id: r.id,
  tipe: r.tipe,
  teks: r.teks,
  waktu: r.waktu,
});
const _mapFromDb_aichat = (r) => ({
  id: r.id,
  judul: r.judul,
  pesan: r.pesan ?? [],
});
const _mapFromDb_sosial = (r) => ({
  id: r.id,
  tipe: r.tipe,
  deskripsi: r.deskripsi,
  tanggal: r.tanggal,
});

/* ============================================================
   NOTIFIKASI INTERNAL (pakai showToast dari script.js kalau ada)
   ============================================================ */
function _showNotif(msg, tipe = "default") {
  if (typeof showToast === "function") {
    showToast(msg, tipe);
  } else {
    console.log(`[ANSupabase] ${msg}`);
  }
}

/* ============================================================
   PUBLIC API — window.ANSupabase
   Ini yang dipanggil dari script.js dan index.html
   ============================================================ */
window.ANSupabase = {
  loginGoogle,
  logout,
  getCurrentUser,
  syncData,
  loadData,
};

/* ============================================================
   AUTO INIT — Jalankan saat supabase.js dimuat
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  _initSession();
});
