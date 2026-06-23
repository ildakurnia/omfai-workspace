<?php
/**
 * Root Router index.php
 * Berfungsi sebagai gerbang utama untuk mengarahkan request ke Laravel (API) atau Next.js (Frontend)
 */

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)
);

// 1. Arahkan semua request API ke Laravel backend
if (strpos($uri, '/api') === 0 || $uri === '/api') {
    require_once __DIR__ . '/backend/public/index.php';
    exit;
}

// 2. Arahkan asset statis Next.js (jika filenya ada di frontend/out)
$staticFile = __DIR__ . '/frontend/out' . $uri;
if ($uri !== '/' && file_exists($staticFile) && !is_dir($staticFile)) {
    $mime = mime_content_type($staticFile);
    
    // Perbaikan mime-type css & js jika tidak terdeteksi benar oleh host
    if (preg_match('/\.css$/', $uri)) {
        $mime = 'text/css';
    } elseif (preg_match('/\.js$/', $uri)) {
        $mime = 'application/javascript';
    } elseif (preg_match('/\.svg$/', $uri)) {
        $mime = 'image/svg+xml';
    }
    
    header("Content-Type: $mime");
    readfile($staticFile);
    exit;
}

// 3. Sajikan index.html dari Next.js static export untuk halaman frontend lainnya
if (file_exists(__DIR__ . '/frontend/out/index.html')) {
    require_once __DIR__ . '/frontend/out/index.html';
    exit;
}

// 4. Tampilan fallback jika build Next.js belum siap
echo "<html><head><title>OMFAI Workspace</title><style>body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #fafafa; color: #333; } .container { text-align: center; border: 1px solid #ddd; padding: 40px; border-radius: 8px; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }</style></head><body>";
echo "<div class='container'>";
echo "<h2>OMFAI Workspace - Deploy Sukses!</h2>";
echo "<p>Silakan jalankan build frontend Next.js terlebih dahulu di server Anda:</p>";
echo "<code>cd frontend && npm install && npm run build</code>";
echo "<p>Setelah itu, folder <code>frontend/out</code> akan terisi dan halaman ini otomatis terganti.</p>";
echo "</div>";
echo "</body></html>";
