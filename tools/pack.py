#!/usr/bin/env python3
"""Pack site/ into one self-contained HTML for a Claude Artifact preview (not used for GitHub Pages)."""
import re, os, io, base64, json, sys
from PIL import Image
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = sys.argv[1] if len(sys.argv) > 1 else '/mnt/user-data/outputs/SkincarePro_B_preview.html'
html = open(f'{S}/index.html').read(); css = open(f'{S}/app.css').read(); js = open(f'{S}/app.js').read()
names = sorted(set(re.findall(r'assets/([\w.\-]+)', html + js + css)) | set(re.findall(r"play\([^,]+,\s*'([\w.\-]+)'", js)))   # play() takes bare file names
A = {}; total = 0
for n in names:
    p = f'{S}/assets/{n}'
    if not os.path.exists(p): continue
    raw = open(p, 'rb').read(); ext = n.rsplit('.', 1)[1].lower()
    mime = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'svg': 'image/svg+xml', 'gif': 'image/gif', 'webp': 'image/webp', 'mp4': 'video/mp4'}.get(ext, 'application/octet-stream')
    if mime in ('image/png', 'image/jpeg') and len(raw) > 80_000:
        im = Image.open(p)
        if not getattr(im, 'is_animated', False):
            MX = 720 if re.match(r'(det_an_|fm2_|atl_)', n) else 1200   # 1022v: many detail images, keep the artifact under 16MB
            if max(im.size) > MX: im = im.resize((round(im.width * MX / max(im.size)), round(im.height * MX / max(im.size))), Image.LANCZOS)
            alpha = im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getextrema()[3][0] < 255
            b = io.BytesIO()
            if alpha: im.convert('RGBA').save(b, 'WEBP', quality=72, method=6); m2 = 'image/webp'
            else: im.convert('RGB').save(b, 'JPEG', quality=72, optimize=True, progressive=True); m2 = 'image/jpeg'
            if len(b.getvalue()) < len(raw): raw, mime = b.getvalue(), m2
    A[n] = f'data:{mime};base64,' + base64.b64encode(raw).decode(); total += len(raw)
html = re.sub(r'(?<![\w-])src="assets/([\w.\-]+)(\?[^"]*)?"', lambda m: f'data-a="{m.group(1)}"', html)
html = re.sub(r'data-src="assets/([\w.\-]+)(\?[^"]*)?"', lambda m: f'data-as="{m.group(1)}"', html)
css = re.sub(r'url\((["\']?)assets/([\w.\-]+)\1\)', lambda m: f'url({A.get(m.group(2), "assets/" + m.group(2))})', css)
js = js.replace("'assets/56d90.svg'", "__A['56d90.svg']").replace("'assets/2df40.svg'", "__A['2df40.svg']")
js = js.replace("function play(sel, file) { const v = Date.now(); each(sel, im => { im.src = 'assets/' + file + '?v=' + v; im.classList.add('on'); }); }",
                "function play(sel, file) { const v = Date.now(); each(sel, im => { im.src = (__A[file] || ('assets/' + file)) + '#' + v; im.classList.add('on'); }); }")   # new URL restarts the APNG, no fetch/blob (CSP-safe)
assert '__A[file]' in js, 'play() not rewritten'
boot = ("<script>window.__A=" + json.dumps(A) + ";(function(){const fix=r=>{r.querySelectorAll('img[data-a]').forEach(i=>{const s=__A[i.dataset.a];if(s)i.src=s;});"
        "r.querySelectorAll('[data-as]').forEach(i=>{const s=__A[i.dataset.as];if(s)i.dataset.src=s;});};fix(document);document.querySelectorAll('template').forEach(t=>fix(t.content));})();</script>")
html, nc = re.subn(r'<link[^>]*href="app\.css[^"]*"[^>]*>', lambda m: '<style>' + css + '</style>', html)
assert nc == 1, 'app.css link not found'
html, nj = re.subn(r'<script[^>]*src="app\.js[^"]*"[^>]*></script>', lambda m: boot + '<script>' + js + '</script>', html)
assert nj == 1, 'app.js script not found'
os.makedirs(os.path.dirname(OUT), exist_ok=True); open(OUT, 'w').write(html)
print('assets', len(A), 'raw MB', round(total / 1e6, 2), 'html MB', round(os.path.getsize(OUT) / 1e6, 2))
