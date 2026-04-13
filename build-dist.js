const fs = require('fs');
const path = require('path');

const sourceDir = __dirname;
const distDir = path.join(__dirname, 'dist');

// Directories and non-HTML files to ALWAYS copy to dist
const includePaths = [
    'assets',
    'css',
    'js',
    'netlify.toml',
    'robots.txt',
    'sitemap.xml',
    'favicon.ico'
];

// Include every root-level HTML page automatically so new pages are deployed too.
const excludedHtmlFiles = new Set([
    'about.html',
    'about_v2.html',
    'eugene-showcase.html',
    'frequency-diagram.html',
    'jasmina_source.html',
    'preview.html',
    'test-images.html'
]);

const htmlFiles = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html') && !excludedHtmlFiles.has(entry.name))
    .map(entry => entry.name);

const itemsToCopy = [...includePaths, ...htmlFiles];

// Helper to copy directory recursively
function copyDirSync(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            // Only copy minified CSS/JS files if they exist in source CSS/JS folders
            if (src.includes('css') && srcPath.endsWith('.css') && !srcPath.endsWith('.min.css')) {
                continue;
            }
            if (src.includes('js') && srcPath.endsWith('.js') && !srcPath.endsWith('.min.js')) {
                continue;
            }
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Clean dist directory if it exists
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

console.log('📦 Starting strict production build generation...');

itemsToCopy.forEach(item => {
    const srcPath = path.join(sourceDir, item);
    const destPath = path.join(distDir, item);

    if (fs.existsSync(srcPath)) {
        const stats = fs.statSync(srcPath);
        if (stats.isDirectory()) {
            console.log(`Copying directory: ${item}`);
            copyDirSync(srcPath, destPath);
        } else {
            console.log(`Copying file: ${item}`);

            // Rewrite HTML logic
            if (item.endsWith('.html')) {
                let htmlContent = fs.readFileSync(srcPath, 'utf8');
                htmlContent = htmlContent.replace(/href="css\/([a-zA-Z0-9_-]+)\.css"/g, 'href="css/$1.min.css"');
                htmlContent = htmlContent.replace(/src="js\/([a-zA-Z0-9_-]+)\.js"/g, 'src="js/$1.min.js"');
                fs.writeFileSync(destPath, htmlContent);
            }
            // Fix Netlify TOML logic
            else if (item === 'netlify.toml') {
                let tomlContent = fs.readFileSync(srcPath, 'utf8');
                tomlContent = tomlContent.replace(/\[build\][\s\S]*?(?=\[\[headers\]\])/g, '');
                tomlContent = tomlContent.replace(/\[build\.environment\][\s\S]*/g, '');
                fs.writeFileSync(destPath, tomlContent.trim() + '\n');
            }
            // Normal copy
            else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
});

console.log('✅ Success! Your clean deployment is ready in the "dist" folder.');
console.log('🚀 Drag and drop the "dist" folder into Netlify.');
