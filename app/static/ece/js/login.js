let showingPw = false;
function togglePw() {
    const inp = document.getElementById('password');
    const eye = document.getElementById('eyeBtn');
    showingPw = !showingPw;
    inp.type        = showingPw ? 'text' : 'password';
    eye.textContent = showingPw ? 'visibility_off' : 'visibility';
}

function clearError() { document.getElementById('errBox').classList.add('hidden'); }

function showError(msg) {
    const box = document.getElementById('errBox');
    document.getElementById('errMsg').textContent = msg;
    box.classList.remove('hidden');
    document.getElementById('loginForm').classList.add('shake');
    setTimeout(() => document.getElementById('loginForm').classList.remove('shake'), 400);
}

function setLoading(on) {
    document.getElementById('loginBtn').disabled = on;
    document.getElementById('btnLabel').classList.toggle('hidden', on);
    document.getElementById('spinner').classList.toggle('hidden', !on);
}

async function doLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username) { showError('กรุณากรอก Username'); return; }
    if (!password) { showError('กรุณากรอกรหัสผ่าน');  return; }

    setLoading(true);
    clearError();

    const csrfEl = document.querySelector('[name=csrfmiddlewaretoken]');
    const csrf   = csrfEl ? csrfEl.value : '';

    const body = new URLSearchParams({ username, password, csrfmiddlewaretoken: csrf });

    try {
        const resp = await fetch('/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            redirect: 'follow',
            credentials: 'same-origin',
        });

        if (resp.ok || resp.redirected) {
            const finalUrl = resp.url || '';
            if (finalUrl.includes('login')) {
                const text = await resp.text();
                if (text.includes('ไม่ถูกต้อง') || text.includes('error') || text.includes('Error')) {
                    setLoading(false);
                    showError('Username หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
                } else {
                    window.location.href = resp.url;
                }
            } else {
                window.location.href = resp.url || '/login-success/lecturer/';
            }
        } else {
            setLoading(false);
            showError('Username หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        }
    } catch (err) {
        setLoading(false);
        showError('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const b1 = document.getElementById('bar1'), b2 = document.getElementById('bar2');
        if (b1) b1.style.width = '28%';
        if (b2) b2.style.width = '65%';
    }, 400);
});
