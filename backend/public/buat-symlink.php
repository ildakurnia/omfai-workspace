<?php
/**
 * Script Darurat untuk Membuat Storage Symlink di Hostinger
 * Letakkan file ini di: backend/public/buat-symlink.php
 */

// Path folder penyimpanan asli (rahasia/internal)
$targetFolder = __DIR__ . '/../storage/app/public';

// Path folder pintasan virtual (publik)
$linkFolder = __DIR__ . '/storage';

echo "<h2>Laravel Storage Symlink Generator</h2>";
echo "<p>Target Folder: <code>" . htmlspecialchars($targetFolder) . "</code></p>";
echo "<p>Link Folder: <code>" . htmlspecialchars($linkFolder) . "</code></p>";

// Cek apakah link sudah ada
if (file_exists($linkFolder)) {
    echo "<p style='color: orange; font-weight: bold;'>Status: Tautan storage (symlink) sudah ada sebelumnya di server Anda!</p>";
} else {
    // Membuat symlink menggunakan fungsi php symlink()
    if (symlink($targetFolder, $linkFolder)) {
        echo "<p style='color: green; font-weight: bold;'>Status: SUKSES! Tautan storage (symlink) berhasil dibuat!</p>";
    } else {
        echo "<p style='color: red; font-weight: bold;'>Status: GAGAL! Tidak dapat membuat tautan di server. Pastikan izin folder publik aman.</p>";
    }
}
?>
